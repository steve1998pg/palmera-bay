// Palmera Bay — bootstrap, game loop, camera, shooting raycast, explosions,
// shop purchases, the state machine, and the window.__pb automation contract.
import * as THREE from '../vendor/three.module.min.js';
import { mulberry32, clamp, angleDiff, wrapAngle } from './random.js';
import { START_CLOCK, START_CASH, LOCATIONS, VEHICLES, SHOP_UPGRADES, SHOP_GEAR, SHOP_SHOWROOM, WEAPONS, START_RESERVE, RANKS, rankFor } from './config.js';
import { buildCity } from './city.js';
import { makeAudio } from './audio.js';
import { makeSave } from './save.js';
import { makeInput } from './input.js';
import { makePlayer } from './player.js';
import { makePolice } from './police.js';
import { makeMissions } from './missions.js';
import { makeHud } from './hud.js';
import { stageShot } from './shots.js';
import { spawnCar, removeCar, driveCar, damageCar, updateTraffic, collideCars } from './vehicles.js';
import { spawnPerson, updatePeople, ejectDriver } from './people.js';

const params = new URLSearchParams(location.search);
const seed = Math.max(1, parseInt(params.get('seed') || '7', 10) || 7);
const shotParam = params.get('shot') || null;

const W = {
  seed, shotMode: shotParam, shotFired: false,
  state: 'title', paused: false,
  now: 0, frameCount: 0, timeScale: 1,
  clockMinutes: START_CLOCK,
  camYaw: Math.PI, camPitch: 0.64,
  playerVel: { x: 0, z: 0 },
  cars: [], people: [],
  lastCar: null, hintDeliver: false, hudDirty: true,
  tracers: [], effects: [],
};
window.__gameError = null;

const renderer = new THREE.WebGLRenderer({ antialias: false, canvas: document.getElementById('game') });
renderer.setPixelRatio(1);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 3000);
W.scene = scene;
W.camera = camera;
W.canvas = renderer.domElement;
W.renderer = renderer;

W.audio = makeAudio();
W.city = buildCity(W);
W.save = makeSave(W);
W.player = makePlayer(W);
W.police = makePolice(W);
W.missions = makeMissions(W);
W.hud = makeHud(W);

// ---- world helpers wired onto W (used by the modules) ----
W.playerPos = function () {
  const p = W.player;
  if (p.inCar) return { x: p.inCar.x, z: p.inCar.z };
  return { x: p.x, z: p.z };
};
W.spawnCar = (type, x, z, heading, opts) => spawnCar(W, type, x, z, heading, opts);
W.spawnPerson = (kind, x, z, opts) => spawnPerson(W, kind, x, z, opts);
W.spawnPed = (x, z) => spawnPerson(W, 'ped', x, z, {});
W.spawnEnemies = function (n, x, z, tag) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const ex = x + (Math.random() - 0.5) * 14;
    const ez = z + (Math.random() - 0.5) * 14;
    const res = W.city.resolveCircle(ex, ez, 0.6);
    out.push(spawnPerson(W, 'enemy', res.x, res.z, { tag }));
  }
  return out;
};
W.spawnTargetCar = function (type, x, z) {
  const car = spawnCar(W, type, x, z, 0, { targetCar: true, owned: false });
  return car;
};
W.setMarker = (x, z, label) => W.city.setMarker(x, z, label);
W.clearMarker = () => W.city.clearMarker();
W.saveGame = () => W.save.write();
W.notify = (t) => W.hud.notify(t);
W.toast = (t) => W.hud.toast(t);
W.showDialog = (who, text, color, initials) => W.hud.showDialog(who, text, color, initials);
W.flashDamage = () => W.hud.flashDamage();
W.flashWanted = () => W.hud.flashWanted();
W.showJobDone = (job) => W.hud.showJobDone(job);

// ---- tracers & effects ----
W.showTracer = function (x1, y1, z1, x2, y2, z2, color) {
  const geo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(x1, y1, z1), new THREE.Vector3(x2, y2, z2),
  ]);
  const mat = new THREE.LineBasicMaterial({ color: color || 0xffd23f, transparent: true, opacity: 0.95 });
  const line = new THREE.Line(geo, mat);
  scene.add(line);
  W.tracers.push({ line, life: 0.16 });
};
W.updateTracers = function (dt) {
  for (const t of [...W.tracers]) {
    t.life -= dt;
    t.line.material.opacity = Math.max(0, t.life / 0.16);
    if (t.life <= 0) {
      scene.remove(t.line);
      t.line.geometry.dispose();
      t.line.material.dispose();
      W.tracers.splice(W.tracers.indexOf(t), 1);
    }
  }
};

// ---- shooting raycast: from the camera, through the screen centre, toward
// a point 6 m ahead of the player at 2.8 m height. Stops at buildings.
W.aimDir = new THREE.Vector3(0, 0, 1);
W.castShot = function (muzzle, spread) {
  const pp = W.playerPos();
  const origin = camera.position.clone();
  const ap = W.player.aimPoint();
  const dir = new THREE.Vector3(ap.x - origin.x, ap.y - origin.y, ap.z - origin.z).normalize();
  if (spread) {
    const rot = new THREE.Matrix4().makeRotationY(spread);
    dir.applyMatrix4(rot);
  }
  const wdef = WEAPONS[W.player.weaponId];
  const range = wdef.range;
  let bestT = range, best = null;
  // Buildings: 2D slab test on the XZ ray.
  let wallT = Infinity;
  const dx = dir.x, dz = dir.z;
  for (const c of W.city.colliders) {
    let tmin = 0, tmax = range;
    if (Math.abs(dx) < 1e-9) {
      if (origin.x < c.x - c.hx || origin.x > c.x + c.hx) continue;
    } else {
      let t1 = (c.x - c.hx - origin.x) / dx;
      let t2 = (c.x + c.hx - origin.x) / dx;
      if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
      tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
      if (tmin > tmax) continue;
    }
    if (Math.abs(dz) < 1e-9) {
      if (origin.z < c.z - c.hz || origin.z > c.z + c.hz) continue;
    } else {
      let t1 = (c.z - c.hz - origin.z) / dz;
      let t2 = (c.z + c.hz - origin.z) / dz;
      if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
      tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
      if (tmin > tmax) continue;
    }
    if (tmin < wallT && tmin >= 0) wallT = tmin;
  }
  // People: closest approach of the ray to the body axis (y 0..1.85).
  for (const person of W.people) {
    if (person.dead || person.car) continue;
    const ox = person.x - origin.x, oz = person.z - origin.z;
    const denom = dx * dx + dz * dz;
    if (denom < 1e-9) continue;
    const t = (ox * dx + oz * dz) / denom;
    if (t < 0 || t > range) continue;
    const cx = origin.x + dx * t, cz = origin.z + dz * t;
    const hd = Math.hypot(person.x - cx, person.z - cz);
    const y = origin.y + dir.y * t;
    if (hd < 0.7 && y >= -0.1 && y <= 1.9 && t < bestT) {
      bestT = t; best = { person, x: person.x, y: clamp(y, 0.2, 1.8), z: person.z };
    }
  }
  // Cars: horizontal radius 1.7, height 0..2.2 (skip the player's own car).
  for (const car of W.cars) {
    if (car.dead || car === W.player.inCar) continue;
    const ox = car.x - origin.x, oz = car.z - origin.z;
    const denom = dx * dx + dz * dz;
    if (denom < 1e-9) continue;
    const t = (ox * dx + oz * dz) / denom;
    if (t < 0 || t > range) continue;
    const cx = origin.x + dx * t, cz = origin.z + dz * t;
    const hd = Math.hypot(car.x - cx, car.z - cz);
    const y = origin.y + dir.y * t;
    if (hd < 1.7 && y >= -0.1 && y <= 2.2 && t < bestT) {
      bestT = t; best = { car, x: car.x, y: clamp(y, 0.3, 1.6), z: car.z };
    }
  }
  if (wallT < bestT) {
    const t = wallT;
    return { wall: true, x: origin.x + dir.x * t, y: origin.y + dir.y * t, z: origin.z + dir.z * t };
  }
  if (best) return best;
  return null;
};

  // ---- combat resolution ----
  W.damagePerson = function (person, dmg) {
    if (!person || person.dead) return;
    person.hp -= dmg;
    if (person.hp <= 0) {
      person.hp = 0;
      person.dead = true;
      person.deathAt = W.now;
      person.state = 'dead';
      W.onPersonShot(person, true, dmg);
    } else {
      if (person.kind === 'ped') person.fleeUntil = W.now + 4;
      W.onPersonShot(person, false, dmg);
    }
  };

  W.onPersonShot = function (p, killed, dmg) {
    if (!p) return;
    if (killed) {
      W.player.respect += p.kind === 'cop' ? 12 : 8;
      W.player.stats.knockouts++;
      if (p.payout) {
        W.player.cash += p.payout;
        W.notify('+$' + p.payout + ' looted');
      }
      if (p.kind === 'cop') W.police.addHeat(35);
      else if (p.kind === 'ped') W.police.addHeat(14);
      if (p.kind === 'enemy') W.missions.onMissionKill(p.missionTag);
      W.audio.coin();
    } else if (p.kind === 'ped') {
      W.police.addHeat(4);
    }
    W.hudDirty = true;
  };

  W.onCarShot = function (car, dmg) {
    if (!car || car.dead) return;
    damageCar(W, car, dmg * 0.6);
    if (car.ai === 'police') W.police.addHeat(8);
    else if (car.driver) W.police.addHeat(3);
    W.hudDirty = true;
  };

  W.onCarBurning = function (car) {
    if (!car || car.burning || car.dead) return;
    car.burning = true;
    car.burnTime = 0;
    const light = new THREE.PointLight(0xff7722, 3, 22);
    light.position.set(car.x, 2, car.z);
    scene.add(light);
    car.fireLight = light;
  };

  W.explodeCar = function (car) {
    if (car.dead) return;
    car.dead = true;
    car.burning = false;
    if (car.fireLight) { scene.remove(car.fireLight); car.fireLight = null; }
    W.audio.explosion();
    // Flash sphere.
    const flash = new THREE.Mesh(
      new THREE.SphereGeometry(2.2, 10, 8),
      new THREE.MeshBasicMaterial({ color: 0xffa030, transparent: true, opacity: 0.9 })
    );
    flash.position.set(car.x, 1.5, car.z);
    scene.add(flash);
    W.effects.push({ mesh: flash, life: 0.5, max: 0.5, grow: 14 });
    car.mesh.visible = false;
    car.removeAt = W.now + 6;
    if (car.ai === 'police') W.police.removeUnit(car);
    const wasPlayerCar = W.player.inCar === car;
    if (wasPlayerCar) {
      W.player.exitCar();
      W.player.takeDamage(30);
    }
    if (car.ai === 'traffic') {
      // A fresh traffic car joins the flow a moment later.
      setTimeout(() => { if (W.state !== 'title') spawnTrafficCar(); }, 4000);
    }
  };

  W.onEnemyShot = function (shot, from) {
    if (W.state !== 'playing') return;
    const dmg = shot && shot.damage ? shot.damage : 10;
    if (W.player.inCar) {
      damageCar(W, W.player.inCar, dmg * 0.4);
    } else {
      W.player.takeDamage(dmg);
    }
  };

  // Player driving wrapper: handbrake sharpens the turn.
  W.drivePlayerCar = function (car, drive, dt) {
    const d = { ...drive };
    if (d.handbrake) {
      d.steer *= 1.6;
      if (d.throttle === 0) car.speed *= (1 - 0.5 * dt);
    }
    return driveCar(W, car, d, dt);
  };

  // ---- game flow ----
  W.gameOver = function (kind) {
    if (W.state === 'gameover') return;
    W.state = 'gameover';
    if (kind === 'WASTED') W.player.cash = Math.round(W.player.cash * 0.9);
    else W.player.cash = Math.round(W.player.cash * 0.85);
    W.audio.busted();
    W.hud.showGameOver(kind, kind === 'WASTED'
      ? 'Dante is down. The bay keeps your 10% as a reminder.'
      : 'Busted by the PBPD. They keep 15% for paperwork.');
    W.save.write();
  };

  W.respawn = function () {
    const p = W.player;
    if (p.inCar) p.exitCar();
    p.x = LOCATIONS.safehouse.x;
    p.z = LOCATIONS.safehouse.z;
    p.y = 0; p.vy = 0;
    p.heading = Math.PI;
    p.hp = 100;
    p.armour = 0;
    W.camYaw = Math.PI;
    p.mesh.visible = true;
    p.mesh.position.set(p.x, 0, p.z);
    W.police.clearAll();
    W.hud.hideGameOver();
    W.hud.hideJobDone();
    W.state = 'playing';
    W.missions.restartCurrentJob();
    W.save.write();
    W.hudDirty = true;
  };

  function resetPlayerToStart(saveData) {
    const p = W.player;
    if (p.inCar) p.exitCar();
    p.cash = saveData ? saveData.cash : START_CASH;
    p.respect = saveData ? saveData.respect : 0;
    p.hp = saveData ? clamp(saveData.hp, 1, 100) : 100;
    p.armour = saveData ? saveData.armour : 0;
    p.x = saveData ? saveData.x : LOCATIONS.safehouse.x;
    p.z = saveData ? saveData.z : LOCATIONS.safehouse.z;
    p.y = 0; p.vy = 0;
    p.heading = Math.PI;
    p.weaponId = 'pistol';
    for (const id of Object.keys(p.weapons)) {
      p.weapons[id].owned = id === 'fists' || id === 'pistol';
      p.weapons[id].mag = WEAPONS[id].mag === Infinity ? Infinity : WEAPONS[id].mag;
      p.weapons[id].reserve = START_RESERVE[id] || 0;
    }
    p.weapons.fists.reserve = Infinity;
    if (saveData && saveData.weapons) {
      for (const id of Object.keys(saveData.weapons)) {
        if (p.weapons[id]) {
          p.weapons[id].owned = !!saveData.weapons[id].owned;
          if (typeof saveData.weapons[id].mag === 'number') p.weapons[id].mag = saveData.weapons[id].mag;
          if (typeof saveData.weapons[id].reserve === 'number') p.weapons[id].reserve = saveData.weapons[id].reserve;
        }
      }
      if (saveData.weaponId && p.weapons[saveData.weaponId] && p.weapons[saveData.weaponId].owned) {
        p.weaponId = saveData.weaponId;
      }
    }
    p.stats = saveData && saveData.stats ? {
      carsStolen: saveData.stats.carsStolen || 0,
      starsLost: saveData.stats.starsLost || 0,
      knockouts: saveData.stats.knockouts || 0,
      raceWins: saveData.stats.raceWins || 0,
      drivenKm: saveData.stats.drivenKm || 0,
      shotsFired: saveData.stats.shotsFired || 0,
    } : { carsStolen: 0, starsLost: 0, knockouts: 0, raceWins: 0, drivenKm: 0, shotsFired: 0 };
    p.crewCd = { nico: 0, tomas: 0, sofia: 0 };
    p.mesh.visible = true;
    p.mesh.position.set(p.x, 0, p.z);
    W.clockMinutes = saveData ? saveData.clockMinutes : START_CLOCK;
    W.camYaw = Math.PI;
    // Clear mission enemies / foot cops left over from a previous run.
    for (const person of [...W.people]) {
      if (person.kind !== 'ped') {
        const i = W.people.indexOf(person);
        if (i >= 0) { scene.remove(person.mesh); W.people.splice(i, 1); }
      }
    }
    W.police.clearAll();
    // Stashes from the save.
    if (saveData && saveData.stashesTaken) {
      W.city.stashes.forEach((s, i) => {
        s.taken = !!saveData.stashesTaken[i];
        s.mesh.visible = !s.taken;
        if (s.glow) s.glow.visible = !s.taken;
      });
    } else {
      W.city.stashes.forEach((s) => { s.taken = false; s.mesh.visible = true; if (s.glow) s.glow.visible = true; });
    }
    // Starter car must exist at the safehouse.
    if (!W.lastCar || W.lastCar.dead) {
      W.lastCar = spawnCar(W, 'sedan', LOCATIONS.safehouse.x + 8, LOCATIONS.safehouse.z, Math.PI / 2, { owned: true, color: 0x3f7d4e });
    } else {
      W.lastCar.x = LOCATIONS.safehouse.x + 8;
      W.lastCar.z = LOCATIONS.safehouse.z;
      W.lastCar.heading = Math.PI / 2;
      W.lastCar.speed = 0;
      W.lastCar.cond = 100;
      W.lastCar.mesh.position.set(W.lastCar.x, 0, W.lastCar.z);
      W.lastCar.mesh.rotation.y = W.lastCar.heading;
      W.lastCar.mesh.visible = true;
      W.lastCar.dead = false;
      W.lastCar.burning = false;
    }
    if (saveData && saveData.carMods) {
      const m = saveData.carMods;
      W.lastCar.type = m.type || W.lastCar.type;
      W.lastCar.tuned = !!m.tuned; W.lastCar.plated = !!m.plated; W.lastCar.nitro = !!m.nitro;
      W.lastCar.cond = clamp(m.cond !== undefined ? m.cond : 100, 0, 100);
    }
  }

  W.startNewGame = function () {
    W.save.clear();
    resetPlayerToStart(null);
    W.missions.jobIndex = 0;
    W.missions.completedJobs = 0;
    W.missions.startJob(0);
    W.state = 'playing';
    W.hud.hideTitle();
    W.hud.hideGameOver();
    W.hud.hideJobDone();
    W.save.write();
  };

  W.continueGame = function () {
    const data = W.save.read();
    if (!data) { W.startNewGame(); return; }
    resetPlayerToStart(data);
    W.missions.completedJobs = data.completedJobs;
    W.missions.startJob(data.jobIndex);
    W.state = 'playing';
    W.hud.hideTitle();
    W.hud.hideGameOver();
    W.hud.hideJobDone();
  };

  W.quitToTitle = function () {
    location.reload();
  };

  W.setPaused = function (paused) {
    if (paused && (W.state === 'playing')) {
      W.state = 'paused';
      W.paused = true;
      W.hud.openPause();
    } else if (!paused && W.state === 'paused') {
      W.state = 'playing';
      W.paused = false;
      W.hud.closePause();
    }
  };

  W.openShop = function () {
    if (W.state !== 'playing') return;
    W.state = 'shop';
    W.hud.openShop();
  };

  W.closeShop = function () {
    if (W.state !== 'shop') return;
    W.state = 'playing';
    W.hud.closeShop();
  };

  function shopCar() {
    return W.player.inCar || W.lastCar;
  }

  W.buyUpgrade = function (id) {
    const car = shopCar();
    const item = SHOP_UPGRADES.find((u) => u.id === id);
    if (!item || !car) return false;
    if (W.player.cash < item.price) { W.notify('Not enough cash'); return false; }
    if (id === 'tune' && car.tuned) { W.notify('Already tuned'); return false; }
    if (id === 'plating' && car.plated) { W.notify('Already plated'); return false; }
    if (id === 'nitro' && car.nitro) { W.notify('Nitro already fitted'); return false; }
    W.player.cash -= item.price;
    if (id === 'repair') { car.cond = 100; car.burning = false; }
    else if (id === 'respray') {
      car.color = Math.floor(Math.random() * 0xffffff);
      car.mesh.children.forEach((ch) => {
        if (ch.material && ch.material.color && ch.geometry && ch.geometry.type === 'BoxGeometry') {
          // Only repaint the body box (the widest, lowest box).
          if (ch.position.y === 0.75) ch.material.color.setHex(car.color);
        }
      });
      W.police.addHeat(-20);
    }
    else if (id === 'tune') car.tuned = true;
    else if (id === 'plating') car.plated = true;
    else if (id === 'nitro') { car.nitro = true; car.nitroFuel = 100; }
    W.audio.coin();
    W.notify(item.name + ' installed');
    W.hud.renderShop();
    return true;
  };

  W.buyGear = function (id) {
    const item = SHOP_GEAR.find((g) => g.id === id);
    if (!item) return false;
    if (W.player.cash < item.price) { W.notify('Not enough cash'); return false; }
    if (id === 'ammo') {
      for (const wid of Object.keys(START_RESERVE)) {
        if (W.player.weapons[wid].owned) W.player.weapons[wid].reserve = START_RESERVE[wid];
      }
    } else if (id === 'armour') {
      W.player.armour = 100;
    } else {
      const rankIdx = RANKS.indexOf(rankFor(W.player.respect));
      const need = WEAPONS[id].rank;
      if (rankIdx < need) { W.notify(item.name + ' unlocks at a higher rank'); return false; }
      W.player.weapons[id].owned = true;
      W.player.weapons[id].mag = WEAPONS[id].mag;
      W.player.weapons[id].reserve = START_RESERVE[id] || 0;
      W.player.weaponId = id;
    }
    W.player.cash -= item.price;
    W.audio.coin();
    W.notify(item.name + ' bought');
    W.hud.renderShop();
    return true;
  };

  W.buyShowroomCar = function (id) {
    const item = SHOP_SHOWROOM.find((s) => s.id === id);
    if (!item) return false;
    if (W.player.cash < item.price) { W.notify('Not enough cash'); return false; }
    W.player.cash -= item.price;
    const car = spawnCar(W, id, 352, 128, Math.PI / 2, { owned: true });
    W.notify(item.name + ' is yours \u2014 parked outside');
    W.audio.coin();
    W.hud.renderShop();
    return true;
  };

  // ---- keyboard actions ----
  W.onKeyDown = function (code) {
    if (code === 'KeyM' || code === 'KeyP' || code === 'Escape') {
      if (W.state === 'playing') { W.setPaused(true); return; }
      if (W.state === 'paused') { W.setPaused(false); return; }
      if (W.state === 'shop') { W.closeShop(); return; }
      return;
    }
    if (W.state === 'paused' || W.state === 'gameover' || W.state === 'title') return;
    const p = W.player;
    if (code === 'KeyE') {
      // Dismissing a dialogue never blocks the action underneath it.
      if (W.hud.dialogT > 0) W.hud.hideDialog();
      const pp = W.playerPos();
      const nearRace = Math.hypot(pp.x - LOCATIONS.raceStart.x, pp.z - LOCATIONS.raceStart.z) < 14;
      if (p.inCar) {
        if (nearRace && p.cash >= 500 && !W.missions.race) {
          W.missions.startSideRace();
          return;
        }
        p.exitCar();
        return;
      }
      const car = p.nearestCar(4);
      if (car) { p.enterCar(car, false); return; }
      return;
    }
    if (code === 'KeyG') {
      const pp = W.playerPos();
      if (W.state === 'shop') { W.closeShop(); return; }
      if (Math.hypot(pp.x - LOCATIONS.garage.x, pp.z - LOCATIONS.garage.z) < 16) W.openShop();
      return;
    }
    if (W.state === 'shop') return;
    if (code === 'KeyC') {
      const st = W.audio.cycleStation();
      W.notify(st.name + ' ' + st.freq + ' \u2014 ' + st.song);
      return;
    }
    if (code === 'KeyR') { p.startReload(); return; }
    if (code === 'KeyQ') { p.cycleWeapon(); return; }
    if (code === 'Digit1') { p.switchWeapon('fists'); return; }
    if (code === 'Digit2') { p.switchWeapon('pistol'); return; }
    if (code === 'Digit3') { p.switchWeapon('smg'); return; }
    if (code === 'Digit4') { p.switchWeapon('shotgun'); return; }
    if (code === 'Digit5') { p.switchWeapon('rifle'); return; }
    if (code === 'KeyZ') { p.useCrew('nico'); return; }
    if (code === 'KeyX') { p.useCrew('tomas'); return; }
    if (code === 'KeyV') { p.useCrew('sofia'); return; }
  };

  W.onCanvasMouseDown = function () {
    // Firing is driven by the held-mouse flag in the player update; the
    // click itself only wakes audio and pointer lock (done in input.js).
  };

  W.input = makeInput(W);

  // ---- traffic & peds ----
  function spawnTrafficCar() {
    const graph = W.city.graph;
    const node = graph.nodes[Math.floor(Math.random() * graph.nodes.length)];
    const type = ['sedan', 'sedan', 'taxi', 'van', 'coupe', 'truck', 'bike'][Math.floor(Math.random() * 7)];
    const car = spawnCar(W, type, node.x, node.z, Math.random() * Math.PI * 2, { ai: 'traffic' });
    const driver = spawnPerson(W, 'ped', node.x, node.z, { car });
    car.driver = driver;
    return car;
  }

  function spawnPedNear() {
    const graph = W.city.graph;
    const node = graph.nodes[Math.floor(Math.random() * graph.nodes.length)];
    const p = spawnPerson(W, 'ped', node.x + (Math.random() - 0.5) * 12, node.z + (Math.random() - 0.5) * 12, {});
    const res = W.city.resolveCircle(p.x, p.z, 0.6);
    p.x = res.x; p.z = res.z;
    return p;
  }

  // Starter car at the safehouse (+8 x, owned, green).
  W.lastCar = spawnCar(W, 'sedan', LOCATIONS.safehouse.x + 8, LOCATIONS.safehouse.z, Math.PI / 2, { owned: true, color: 0x3f7d4e });
  for (let i = 0; i < 13; i++) spawnTrafficCar();
  for (let i = 0; i < 22; i++) spawnPedNear();

  // ---- camera ----
  function updateCamera(dt) {
    const p = W.player;
    const mouse = W.input.takeMouse();
    if (mouse.dx !== 0 || mouse.dy !== 0) {
      W.camYaw = wrapAngle(W.camYaw - mouse.dx * 0.0028);
      W.camPitch = clamp(W.camPitch + mouse.dy * 0.0022, -0.05, 0.85);
      W.lastMouseAt = W.now;
    } else if (W.state === 'playing' && p.speed > 2 && W.now - (W.lastMouseAt || -99) > 1.5) {
      // No mouse input: the camera swings behind the direction of travel.
      const target = p.inCar ? p.inCar.heading : p.heading;
      W.camYaw = wrapAngle(W.camYaw + angleDiff(target, W.camYaw) * Math.min(1, dt * 1.6));
    }
    if (W.state === 'title' || W.state === 'gameover') {
      const t = W.now * 0.05;
      camera.position.set(Math.cos(t) * 320, 130, Math.sin(t) * 320);
      camera.lookAt(0, 10, 0);
      return;
    }
    const pp = W.playerPos();
    const inCar = !!p.inCar;
    const aiming = W.input.mouseDown && !inCar && p.weaponId !== 'fists';
    const dist = inCar ? 10.5 : aiming ? 5 : 7.5;
    const height = 2.6 + W.camPitch * 5;
    const fx = Math.sin(W.camYaw), fz = Math.cos(W.camYaw);
    const targetY = (p.y || 0) + 1.6;
    let cx = pp.x - fx * dist;
    let cz = pp.z - fz * dist;
    let cy = (p.y || 0) + height;
    // Keep the camera out of buildings: pull it in until it is free.
    for (const f of [1, 0.8, 0.6, 0.4, 0.25]) {
      const tx = pp.x - fx * dist * f;
      const tz = pp.z - fz * dist * f;
      const ty = (p.y || 0) + height * f + 1.2 * (1 - f);
      if (!W.city.collides(tx, tz, 0.6)) { cx = tx; cz = tz; cy = ty; break; }
    }
    camera.position.set(cx, cy, cz);
    // Look along the aim ray: through the screen centre toward the point
    // 6 m ahead of the player at 2.8 m height, so the crosshair is the shot.
    const ap = p.aimPoint();
    const dir = new THREE.Vector3(ap.x - cx, ap.y - cy, ap.z - cz).normalize();
    W.aimDir.copy(dir);
    camera.lookAt(cx + dir.x * 30, cy + dir.y * 30, cz + dir.z * 30);
    W.city.updateSun(pp.x, pp.z);
  }

  // ---- the automation contract ----
  const pb = {
    get state() { return W.state; },
    get paused() { return W.state === 'paused'; },
    player: W.player,
    police: W.police,
    missions: W.missions,
    city: W.city,
    cars: W.cars,
    people: W.people,
    get traffic() { return W.cars.filter((c) => c.ai === 'traffic' && !c.dead); },
    get camYaw() { return W.camYaw; },
    set camYaw(v) { W.camYaw = v; },
    get lastCar() { return W.lastCar; },
    get playerCar() { return W.player.inCar; },
    get playerVel() { return W.playerVel; },
    get clockMinutes() { return W.clockMinutes; },
    get shotMode() { return W.shotMode; },
    get shotFired() { return W.shotFired; },
    playerPos: () => W.playerPos(),
    spawnPed: (x, z) => W.spawnPed(x, z),
    spawnEnemies: (n, x, z, tag) => W.spawnEnemies(n, x, z, tag),
    spawnTargetCar: (type, x, z) => W.spawnTargetCar(type, x, z),
    enterCar: (car, silent) => W.player.enterCar(car, silent),
    respawn: () => W.respawn(),
    setMarker: (x, z, label) => W.setMarker(x, z, label),
    clearMarker: () => W.clearMarker(),
    saveGame: () => W.saveGame(),
    setPaused: (b) => W.setPaused(b),
    startNewGame: () => W.startNewGame(),
    continueGame: () => W.continueGame(),
    quitToTitle: () => W.quitToTitle(),
    buyUpgrade: (id) => W.buyUpgrade(id),
    buyGear: (id) => W.buyGear(id),
    buyShowroomCar: (id) => W.buyShowroomCar(id),
    closeShop: () => W.closeShop(),
    onPersonShot: (person, killed, dmg) => W.onPersonShot(person, killed, dmg),
    onCarShot: (car, dmg) => W.onCarShot(car, dmg),
    onCarBurning: (car) => W.onCarBurning(car),
    onEnemyShot: (shot, from) => W.onEnemyShot(shot, from),
  };
  window.__pb = pb;

  // ---- boot ----
  W.hud.wireButtons();
  if (shotParam) {
    stageShot(W, shotParam);
  } else {
    W.hud.showTitle();
  }
  window.__gameReady = true;

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // ---- main loop ----
  let last = performance.now();
  function frame(nowMs) {
    requestAnimationFrame(frame);
    let dt = (nowMs - last) / 1000;
    last = nowMs;
    try {
      dt = clamp(dt, 0.001, 0.05);
      W.now += dt;
      W.frameCount++;
      if (W.state === 'playing') {
        W.player.update(dt);
        for (const car of [...W.cars]) {
          if (car.ai === 'traffic') updateTraffic(W, car, dt, W.now);
          if (car.burning && !car.dead) {
            car.burnTime += dt;
            if (car.fireLight) car.fireLight.position.set(car.x, 2, car.z);
            if (car.burnTime > 2.2) W.explodeCar(car);
          }
          if (car.dead && car.removeAt && W.now > car.removeAt) {
            removeCar(W, car);
          }
        }
        collideCars(W);
        updatePeople(W, dt, W.now);
        W.police.update(dt, W.now);
        W.missions.update(dt, W.now);
        // Keep the streets populated.
        if (W.cars.filter((c) => c.ai === 'traffic' && !c.dead).length < 12) spawnTrafficCar();
        if (W.people.filter((p) => p.kind === 'ped' && !p.dead && !p.car).length < 18) spawnPedNear();
        // Marker gem bobs and spins.
        if (W.city.marker && W.city.marker.userData.gem) {
          const gem = W.city.marker.userData.gem;
          gem.rotation.y += dt * 2;
          gem.position.y = 6 + Math.sin(W.now * 2) * 0.7;
        }
        // Street shot: one real shot just before the screenshot is taken.
        if (W.shotMode === 'street' && W.frameCount === 105) {
          W.player.tryShoot();
          W.shotFired = true;
        }
      }
      // Effects (explosion flashes).
      for (const fx of [...W.effects]) {
        fx.life -= dt;
        const k = Math.max(0, fx.life / fx.max);
        fx.mesh.scale.setScalar(1 + (1 - k) * fx.grow * 0.2);
        fx.mesh.material.opacity = k * 0.9;
        if (fx.life <= 0) {
          scene.remove(fx.mesh);
          W.effects.splice(W.effects.indexOf(fx), 1);
        }
      }
      W.updateTracers(dt);
      updateCamera(dt);
      W.hud.update(dt);
      W.audio.radioTick();
      W.audio.sirenTick(W.state === 'playing' ? W.police.wanted : 0);
      if (W.shotMode && W.frameCount > 110 && !window.__shotReady) {
        window.__shotReady = true;
      }
      renderer.render(scene, camera);
    } catch (e) {
      window.__gameError = String(e && e.stack || e);
    }
  }
  requestAnimationFrame(frame);

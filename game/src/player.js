// Dante Cruz: on-foot movement, the weapon set with hitscan shooting,
// crew abilities, damage/armour/regen, and getting in and out of cars.
import { WEAPONS, WEAPON_ORDER, START_RESERVE, RELOAD_TIME, CREW, LOCATIONS } from './config.js';
import { clamp } from './random.js';
import { makePersonMesh, ejectDriver } from './people.js';
import { damageCar } from './vehicles.js';

const WALK_SPEED = 4.1;
const RUN_SPEED = 7.2;
const JUMP_VELOCITY = 8.5;
const GRAVITY = 22;
const REGEN_DELAY = 7;
const REGEN_RATE = 2.2;
const PUNCH_RANGE = 2.4;
const PUNCH_DMG = 12;

export function makePlayer(W) {
  const mesh = makePersonMesh(W, 'ped', 0x2e3440);
  W.scene.add(mesh);
  const p = {
    mesh,
    x: LOCATIONS.safehouse.x, z: LOCATIONS.safehouse.z, y: 0, vy: 0,
    heading: Math.PI, speed: 0,
    hp: 100, armour: 0,
    cash: 250, respect: 0,
    inCar: null, weaponId: 'pistol',
    weapons: {},
    crewCd: { nico: 0, tomas: 0, sofia: 0 },
    stats: { carsStolen: 0, starsLost: 0, knockouts: 0, raceWins: 0, drivenKm: 0, shotsFired: 0 },
    fireCd: 0, reloadT: 0, reloading: false,
    lastDamageAt: -99, onGround: true,
    safehouseT: 0, saveT: 0, walkPhase: 0,
  };
  for (const id of WEAPON_ORDER) {
    const w = WEAPONS[id];
    p.weapons[id] = {
      owned: id === 'fists' || id === 'pistol',
      mag: id === 'fists' ? Infinity : w.mag,
      reserve: START_RESERVE[id] || 0,
    };
  }
  p.weapons.fists.reserve = Infinity;

  p.pos = function () { return { x: p.x, z: p.z }; };

  // --- weapons ---
  p.switchWeapon = function (id) {
    const w = p.weapons[id];
    if (!w || !w.owned) return false;
    if (p.reloading) {
      p.reloading = false;
      p.reloadT = 0;
    }
    p.weaponId = id;
    W.hudDirty = true;
    return true;
  };

  p.cycleWeapon = function () {
    const owned = WEAPON_ORDER.filter((id) => p.weapons[id].owned);
    if (owned.length < 2) return;
    const i = owned.indexOf(p.weaponId);
    p.switchWeapon(owned[(i + 1) % owned.length]);
  };

  p.startReload = function () {
    const wdef = WEAPONS[p.weaponId];
    const w = p.weapons[p.weaponId];
    if (p.reloading || p.inCar) return false;
    if (!w || w.mag === Infinity) return false;
    if (w.mag >= wdef.mag) return false; // full mag: nothing happens, no lockout
    if (w.reserve <= 0) return false;
    p.reloading = true;
    p.reloadT = RELOAD_TIME;
    return true;
  };

  p.updateReload = function (dt) {
    if (!p.reloading) return;
    p.reloadT -= dt;
    if (p.reloadT > 0) return;
    p.reloading = false;
    const wdef = WEAPONS[p.weaponId];
    const w = p.weapons[p.weaponId];
    const take = Math.min(wdef.mag - w.mag, w.reserve);
    w.mag += take;
    w.reserve -= take;
    W.hudDirty = true;
  };

  p.aimPoint = function () {
    const pp = W.playerPos();
    return {
      x: pp.x + Math.sin(W.camYaw) * 6,
      y: 2.8,
      z: pp.z + Math.cos(W.camYaw) * 6,
    };
  };

  p.tryShoot = function () {
    if (W.state !== 'playing' || p.fireCd > 0 || p.reloading) return false;
    const wdef = WEAPONS[p.weaponId];
    const w = p.weapons[p.weaponId];
    if (p.weaponId === 'fists') {
      p.fireCd = wdef.rate;
      p.punch();
      return true;
    }
    if (w.mag <= 0) {
      // Empty mag: auto-reload.
      p.startReload();
      p.fireCd = 0.25;
      return false;
    }
    p.fireCd = wdef.rate;
    w.mag--;
    p.stats.shotsFired++;
    W.audio.shot(p.weaponId);
    const pp = W.playerPos();
    const muzzle = {
      x: pp.x + Math.sin(W.camYaw) * 0.6,
      y: 1.45,
      z: pp.z + Math.cos(W.camYaw) * 0.6,
    };
    const pellets = wdef.pellets || 1;
    for (let i = 0; i < pellets; i++) {
      const spread = pellets > 1 ? (Math.random() - 0.5) * 0.09 : 0;
      const hit = W.castShot(muzzle, spread);
      if (hit) {
        W.showTracer(muzzle.x, muzzle.y, muzzle.z, hit.x, hit.y, hit.z, 0xffd23f);
        if (hit.person) W.damagePerson(hit.person, wdef.dmg);
        else if (hit.car) W.onCarShot(hit.car, wdef.dmg);
      } else {
        const ap = p.aimPoint();
        const end = {
          x: ap.x + Math.sin(W.camYaw) * wdef.range,
          y: 1.0,
          z: ap.z + Math.cos(W.camYaw) * wdef.range,
        };
        W.showTracer(muzzle.x, muzzle.y, muzzle.z, end.x, end.y, end.z, 0xffd23f);
      }
    }
    if (w.mag <= 0) p.startReload();
    W.hudDirty = true;
    return true;
  };

  p.punch = function () {
    W.audio.punch();
    const pp = W.playerPos();
    const fx = Math.sin(W.camYaw);
    const fz = Math.cos(W.camYaw);
    let best = null;
    let bd = PUNCH_RANGE;
    for (const person of W.people) {
      if (person.dead || person.car) continue;
      const dx = person.x - pp.x;
      const dz = person.z - pp.z;
      const d = Math.hypot(dx, dz);
      if (d > PUNCH_RANGE) continue;
      const dot = (dx * fx + dz * fz) / (d || 1);
      if (dot < 0.5) continue;
      if (d < bd) {
        bd = d;
        best = person;
      }
    }
    if (best) {
      best.x += fx * 0.7;
      best.z += fz * 0.7;
      W.damagePerson(best, PUNCH_DMG);
    }
    W.hudDirty = true;
  };

  // --- damage / healing ---
  p.takeDamage = function (dmg) {
    if (W.state !== 'playing') return;
    const absorbed = Math.min(p.armour, dmg * 0.6);
    p.armour -= absorbed;
    p.hp -= (dmg - absorbed);
    p.lastDamageAt = W.now;
    W.flashDamage();
    if (p.hp <= 0) {
      p.hp = 0;
      W.gameOver('WASTED');
    }
    W.hudDirty = true;
  };

  p.heal = function (amount) {
    p.hp = clamp(p.hp + amount, 0, 100);
  };

  // --- crew ---
  p.useCrew = function (id) {
    const crew = CREW[id];
    if (!crew) return;
    if (p.crewCd[id] > 0) {
      W.notify(crew.name + ' is not ready yet');
      return;
    }
    if (id === 'nico') {
      if (W.police.wanted <= 0) {
        W.notify('Nico: "No heat to lose right now."');
        return;
      }
      W.police.addHeat(crew.heat);
      W.notify('Nico swapped the plates \u2014 heat down');
      p.crewCd.nico = crew.cd;
    } else if (id === 'tomas') {
      const car = p.inCar || W.lastCar;
      if (!car) {
        W.notify('Tomas: "Bring me a car first."');
        return;
      }
      car.cond = 100;
      car.burning = false;
      W.notify('Tomas fixed the car \u2014 condition 100');
      p.crewCd.tomas = crew.cd;
    } else if (id === 'sofia') {
      if (W.police.wanted <= 0) {
        W.notify('Sofia: "No heat to lose right now."');
        return;
      }
      W.police.addHeat(crew.heat);
      scatterPolice(W);
      if (W.police.heli) {
        W.scene.remove(W.police.heli.mesh);
        W.police.heli = null;
      }
      W.notify('Sofia fired a decoy flare \u2014 they lost you');
      p.crewCd.sofia = crew.cd;
    }
    W.audio.blip();
    W.hudDirty = true;
  };

  // --- cars ---
  p.nearestCar = function (maxD) {
    const pp = W.playerPos();
    let best = null;
    let bd = maxD;
    for (const car of W.cars) {
      if (car.dead || car.burning) continue;
      const d = Math.hypot(car.x - pp.x, car.z - pp.z);
      if (d < bd) {
        bd = d;
        best = car;
      }
    }
    return best;
  };

  p.enterCar = function (car, silent) {
    if (!car || car.dead || car.burning) return false;
    if (car.driver) ejectDriver(W, car);
    const wasOwned = car.owned;
    p.inCar = car;
    W.lastCar = car;
    p.mesh.visible = false;
    if (!wasOwned) {
      car.owned = true;
      p.stats.carsStolen++;
      W.police.addHeat(car.type === 'cruiser' ? 20 : 12);
      if (!silent) W.notify('You stole the ' + car.spec.name);
    }
    W.missions.onEnterCar(car);
    W.hudDirty = true;
    return true;
  };

  p.exitCar = function () {
    const car = p.inCar;
    if (!car) return false;
    p.inCar = null;
    p.x = car.x + Math.sin(car.heading + Math.PI / 2) * 2.4;
    p.z = car.z + Math.cos(car.heading + Math.PI / 2) * 2.4;
    p.y = 0;
    p.vy = 0;
    p.heading = car.heading;
    W.camYaw = car.heading;
    const res = W.city.resolveCircle(p.x, p.z, 0.6);
    p.x = res.x;
    p.z = res.z;
    p.mesh.visible = true;
    W.lastCar = car;
    W.hudDirty = true;
    return true;
  };

  // --- per-frame update ---
  p.update = function (dt) {
    p.fireCd = Math.max(0, p.fireCd - dt);
    for (const k of Object.keys(p.crewCd)) p.crewCd[k] = Math.max(0, p.crewCd[k] - dt);
    p.updateReload(dt);
    // Regen after 7 s without damage. Healing never lowers HP.
    if (W.now - p.lastDamageAt > REGEN_DELAY && p.hp > 0 && p.hp < 100) {
      p.hp = Math.min(100, p.hp + REGEN_RATE * dt);
    }
    if (p.inCar) driveStep(W, p, dt);
    else walkStep(W, p, dt);
    autosaveStep(W, p, dt);
    // Clock.
    W.clockMinutes += 0.35 * dt * (W.timeScale || 1);
    if (W.clockMinutes >= 1440) W.clockMinutes -= 1440;
  };

  return p;
}

// Sofia's decoy: scatter every police unit to a random road node ~160 m away.
function scatterPolice(W) {
  const pp = W.playerPos();
  for (const u of W.police.units) {
    let node = null;
    let tries = 0;
    while (tries++ < 30) {
      const cand = W.city.graph.nodes[Math.floor(Math.random() * W.city.graph.nodes.length)];
      const d = Math.hypot(cand.x - pp.x, cand.z - pp.z);
      if (d > 130 && d < 200) {
        node = cand;
        break;
      }
    }
    if (node) {
      u.x = node.x;
      u.z = node.z;
      u.path = null;
    }
  }
}

function driveStep(W, p, dt) {
  const I = W.input;
  const car = p.inCar;
  const throttle = I.any('KeyW', 'ArrowUp') ? 1 : I.any('KeyS', 'ArrowDown') ? -1 : 0;
  const steer = I.any('KeyD', 'ArrowRight') ? 1 : I.any('KeyA', 'ArrowLeft') ? -1 : 0;
  const hardHit = W.drivePlayerCar(car, {
    throttle,
    steer,
    nitro: I.any('ShiftLeft', 'ShiftRight'),
    handbrake: I.down('Space'),
  }, dt);
  if (hardHit) W.police.addHeat(1.5);
  p.x = car.x;
  p.z = car.z;
  p.heading = car.heading;
  p.speed = Math.abs(car.speed);
  p.stats.drivenKm += Math.abs(car.speed) * dt / 1000;
  W.playerVel = { x: Math.sin(car.heading) * car.speed, z: Math.cos(car.heading) * car.speed };
  if (I.mouseDown) p.tryShoot();
  W.audio.setEngine(Math.abs(car.speed) / (car.spec.top || 30), true);
}

function walkStep(W, p, dt) {
  const I = W.input;
  const fwd = (I.any('KeyW', 'ArrowUp') ? 1 : 0) - (I.any('KeyS', 'ArrowDown') ? 1 : 0);
  const strafe = (I.any('KeyD', 'ArrowRight') ? 1 : 0) - (I.any('KeyA', 'ArrowLeft') ? 1 : 0);
  const run = I.any('ShiftLeft', 'ShiftRight');
  const spd = run ? RUN_SPEED : WALK_SPEED;
  const fx = Math.sin(W.camYaw);
  const fz = Math.cos(W.camYaw);
  const rx = Math.cos(W.camYaw);
  const rz = -Math.sin(W.camYaw);
  let mx = fx * fwd + rx * strafe;
  let mz = fz * fwd + rz * strafe;
  const ml = Math.hypot(mx, mz);
  if (ml > 0.01) {
    mx /= ml;
    mz /= ml;
    p.heading = Math.atan2(mx, mz);
    p.speed = spd;
  } else {
    p.speed = 0;
  }
  p.x += mx * p.speed * dt;
  p.z += mz * p.speed * dt;
  // Jump + gravity.
  if (I.down('Space') && p.onGround) {
    p.vy = JUMP_VELOCITY;
    p.onGround = false;
  }
  if (!p.onGround) {
    p.vy -= GRAVITY * dt;
    p.y += p.vy * dt;
    if (p.y <= 0) {
      p.y = 0;
      p.vy = 0;
      p.onGround = true;
    }
  }
  const res = W.city.resolveCircle(p.x, p.z, 0.6);
  p.x = res.x;
  p.z = res.z;
  p.x = clamp(p.x, -478, 478);
  p.z = clamp(p.z, -478, 478);
  W.playerVel = { x: mx * p.speed, z: mz * p.speed };
  animatePlayerWalk(p, dt);
  p.mesh.position.set(p.x, p.y, p.z);
  p.mesh.rotation.y = p.heading;
  if (I.mouseDown) p.tryShoot();
  W.audio.setEngine(0, false);
}

function animatePlayerWalk(p, dt) {
  const u = p.mesh.userData;
  if (p.speed > 0.1) {
    p.walkPhase += dt * 9;
    const s = Math.sin(p.walkPhase) * 0.55;
    u.legL.rotation.x = s;
    u.legR.rotation.x = -s;
    u.armL.rotation.x = -s * 0.8;
    u.armR.rotation.x = s * 0.8;
  } else {
    u.legL.rotation.x *= 0.8;
    u.legR.rotation.x *= 0.8;
    u.armL.rotation.x *= 0.8;
    u.armR.rotation.x *= 0.8;
  }
}

function autosaveStep(W, p, dt) {
  // Safehouse idle save: standing near the safehouse on foot, quiet.
  const sh = LOCATIONS.safehouse;
  const nearSafe = Math.hypot(p.x - sh.x, p.z - sh.z) < 12 && !p.inCar;
  if (nearSafe && p.speed < 0.5) p.safehouseT += dt;
  else p.safehouseT = 0;
  if (p.safehouseT > 5) {
    p.safehouseT = 0;
    W.save.write();
    W.notify('Progress saved at the safehouse');
  }
  // Periodic autosave every 45 s of play.
  p.saveT += dt;
  if (p.saveT > 45) {
    p.saveT = 0;
    W.save.write();
  }
}

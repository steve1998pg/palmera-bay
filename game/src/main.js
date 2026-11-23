// PALMERA BAY — bootstrap, game loop, camera, interaction, and the world object
// every system shares. An original open-world crime game in the spirit of GTA 6.
import * as THREE from 'three';
import { WORLD, START_CASH, VEHICLE_TYPES } from './config.js';
import { mulberry32, clamp, pick, range } from './random.js';
import { Input } from './input.js';
import { AudioEngine } from './audio.js';
import { buildCity } from './city.js';
import { createCar, drivePlayerCar, updateTrafficCar, collideCars } from './vehicles.js';
import { createPerson, updatePed, updateFighter, damagePerson } from './people.js';
import { Player } from './player.js';
import { PoliceSystem } from './police.js';
import { MissionManager } from './missions.js';
import { HUD } from './hud.js';
import { hasSave, readSave, writeSave, saveLabel, clearSave } from './save.js';
import { stageShot } from './shots.js';

const params = new URLSearchParams(location.search);
const SHOT = params.get('shot');
const SEED = parseInt(params.get('seed') || '7', 10) || 7;

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 2600);
camera.position.set(-350, 8, 360);

const rng = mulberry32(SEED);
const input = new Input(canvas);
const audio = new AudioEngine();
const city = buildCity(scene, SEED);
const player = new Player(scene);
player.attachTracers(scene);

const world = {
  scene, city, rng, input, audio, player,
  cars: [], people: [], traffic: [],
  marker: null, markerMesh: null,
  clockMinutes: 17 * 60 + 41,
  paused: false, state: 'title',
  playerCar: null, lastCar: null, playerVel: { x: 0, z: 0 },
  shopOpen: false, race: null, shotMode: SHOT || null, shotFired: false,
  camYaw: Math.PI, camPitch: 0.32, camDist: 8,
  hud: null, police: null, missions: null,
  saveGame() { writeSave(world); },
  playerPos() { return player.inCar ? { x: player.inCar.x, z: player.inCar.z } : { x: player.x, z: player.z }; },
  setMarker(x, z, label) {
    this.clearMarker();
    this.marker = { x, z, label };
    const g = new THREE.Group();
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(1.2, 1.2, 90, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }),
    );
    beam.position.y = 45;
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(4.4, 0.35, 8, 32),
      new THREE.MeshBasicMaterial({ color: 0xfbbf24 }),
    );
    ring.rotation.x = Math.PI / 2; ring.position.y = 0.4;
    const gem = new THREE.Mesh(
      new THREE.OctahedronGeometry(1.6),
      new THREE.MeshBasicMaterial({ color: 0xfde68a }),
    );
    gem.position.y = 6;
    g.add(beam, ring, gem);
    g.position.set(x, 0, z);
    g.userData.gem = gem; g.userData.ring = ring;
    scene.add(g);
    this.markerMesh = g;
  },
  clearMarker() {
    if (this.markerMesh) { scene.remove(this.markerMesh); this.markerMesh = null; }
    this.marker = null;
  },
  spawnEnemies(count, x, z, tag) {
    const out = [];
    for (let i = 0; i < count; i++) {
      const e = createPerson('enemy', x + range(rng, -14, 14), z + range(rng, -14, 14), rng,
        { shirt: 0x7f1d1d, pants: 0x1f2937, cap: 0x111827 });
      e.missionTag = tag;
      scene.add(e.mesh);
      this.people.push(e);
      out.push(e);
    }
    return out;
  },
  spawnPed(x, z) {
    const p = createPerson('ped', x, z, rng);
    scene.add(p.mesh);
    this.people.push(p);
    return p;
  },
  spawnTargetCar(type, x, z) {
    const car = createCar(type, x, z, rng() * Math.PI, undefined, rng);
    car.targetCar = true;
    scene.add(car.mesh);
    this.cars.push(car);
    return car;
  },
  onPersonShot(person, killed, dmg) {
    if (killed) {
      player.stats.knockouts += 1;
      if (person.payout) { player.cash += person.payout; hud.notify(`+ $${person.payout}`, 'good'); }
      player.respect += person.kind === 'cop' ? 12 : 8;
      if (person.missionTag) this.missions.onKill();
      if (person.kind === 'cop') this.police.addHeat(35, this);
      else if (person.kind === 'ped') this.police.addHeat(14, this);
    } else if (person.kind === 'ped') {
      person.state = 'flee'; person.fleeTimer = 4;
      this.police.addHeat(4, this);
    }
  },
  onCarShot(car, dmg) {
    if (car.type === 'cruiser') this.police.addHeat(8, this);
    else if (!car.targetCar && car.driver) this.police.addHeat(3, this);
  },
  onCarBurning(car) {
    audio.explosion();
    spawnFireball(car.x, car.z);
    if (car === player.inCar) {
      exitCar(true);
      if (player.heal(30)) wasted();
      hud.notify('Your ride just blew up!', 'bad');
    }
  },
  onEnemyShot(shot, from) {
    const p = this.playerPos();
    const d = Math.hypot(from.x - p.x, from.z - p.z);
    const hitChance = clamp(0.62 - d * 0.008, 0.12, 0.55);
    spawnTracer3D(new THREE.Vector3(from.x, 1.5, from.z), new THREE.Vector3(p.x, 1.2, p.z));
    audio.shot('pistol');
    if (Math.random() < hitChance) {
      if (player.inCar) {
        player.inCar.cond = Math.max(0, player.inCar.cond - shot.damage * 0.4);
      } else {
        const dead = player.heal(shot.damage);
        hud.damageFlash();
        if (dead) wasted();
      }
    }
  },
  spawnSpark(pos) { spawnSpark(pos); },
  enterCar(car, silent) {
    if (player.inCar) return;
    if (car.driver) {
      car.driver.state = 'flee'; car.driver.fleeTimer = 5;
      car.driver.mesh.visible = true;
      car.driver = null;
    }
    player.inCar = car;
    this.playerCar = car;
    this.lastCar = car;
    player.mesh.visible = false;
    if (!silent) {
      player.stats.carsStolen += 1;
      if (!car.targetCar && !car.owned) this.police.addHeat(car.type === 'cruiser' ? 20 : 12, this);
      audio.blip(520, 0.08, 'square', 0.1);
    }
  },
  buyUpgrade(id) {
    const p = player, car = hud.shopCar;
    const price = { repair: 250, respray: 400, tune: 2400, plating: 3600, nitro: 3200 }[id];
    if (!car || p.cash < price) { hud.notify('Not enough cash.', 'bad'); return; }
    p.cash -= price;
    if (id === 'repair') car.cond = 100;
    if (id === 'respray') { car.color = pick(rng, [0xe74c3c, 0x3498db, 0x2ecc71, 0xf39c12, 0x9b59b6, 0xecf0f1]); car.mesh.children[0].material.color.setHex(car.color); this.police.heat = Math.max(0, this.police.heat - 20); }
    if (id === 'tune') car.tuned = true;
    if (id === 'plating') car.plated = true;
    if (id === 'nitro') { car.nitro = true; car.nitroFuel = 100; }
    audio.coin();
    hud.notify('Fitted. Tomas salutes you.', 'good');
    hud.renderShop();
  },
  buyGear(id) {
    const p = player;
    const price = { smg: 1800, shotgun: 2600, rifle: 6800, ammo: 200, vest: 350 }[id];
    if (p.cash < price) { hud.notify('Not enough cash.', 'bad'); return; }
    p.cash -= price;
    if (id === 'ammo') p.refillAmmo();
    else if (id === 'vest') p.armour = 100;
    else { p.giveWeapon(id); p.switchWeapon(id); }
    audio.coin();
    hud.notify('Pleasure doing business.', 'good');
    hud.renderShop();
  },
  buyShowroomCar(id) {
    const p = player;
    const v = VEHICLE_TYPES.find((x) => x.id === id);
    if (!v || p.cash < v.price) { hud.notify('Not enough cash.', 'bad'); return; }
    p.cash -= v.price;
    const car = createCar(id, 352, 120, Math.PI / 2, undefined, rng);
    car.owned = true;
    scene.add(car.mesh);
    this.cars.push(car);
    this.lastCar = car;
    audio.missionDone();
    hud.notify(`${v.name} is parked outside — yours.`, 'good');
    hud.renderShop();
  },
  closeShop() { this.shopOpen = false; hud.closeShop(); this.setPaused(false); },
  setPaused(v) {
    this.paused = v;
    if (v) { hud.showPause(this); this.state = 'paused'; }
    else { hud.hidePause(); this.state = 'playing'; if (document.pointerLockElement) document.exitPointerLock(); }
  },
  startNewGame() {
    clearSave();
    sessionStorage.setItem('pb-boot', 'new');
    location.reload();
  },
  continueGame() {
    sessionStorage.setItem('pb-boot', 'continue');
    location.reload();
  },
  quitToTitle() { location.reload(); },
  respawn() {
    hud.hideGameOver();
    player.hp = 100; player.armour = Math.max(0, player.armour);
    player.x = city.locations.safehouse.x; player.z = city.locations.safehouse.z;
    player.inCar = null; this.playerCar = null;
    player.mesh.visible = true;
    this.police.clearAll(this);
    this.state = 'playing';
    if (this.missions.active) this.missions.startJob(this.missions.jobIndex);
  },
};

const hud = new HUD(world);
world.hud = hud;
const police = new PoliceSystem(scene, city, rng);
world.police = police;
const missions = new MissionManager(world);
world.missions = missions;

// ---- sparks & fireballs (pooled meshes) ----
const sparkPool = [];
function spawnSpark(pos) {
  const m = new THREE.Mesh(
    new THREE.SphereGeometry(0.35, 6, 5),
    new THREE.MeshBasicMaterial({ color: 0xffe08a }),
  );
  m.position.copy(pos);
  m.userData.life = 0.16;
  scene.add(m);
  sparkPool.push(m);
}
const fireballs = [];
function spawnFireball(x, z) {
  const m = new THREE.Mesh(
    new THREE.SphereGeometry(2.2, 12, 10),
    new THREE.MeshBasicMaterial({ color: 0xff7b24, transparent: true, opacity: 0.95 }),
  );
  m.position.set(x, 2.2, z);
  m.userData.life = 1.4;
  scene.add(m);
  fireballs.push(m);
  const light = new THREE.PointLight(0xff8c2e, 60, 40);
  light.position.set(x, 4, z);
  light.userData.life = 0.9;
  scene.add(light);
  fireballs.push(light);
}
const tracerLines = [];
function spawnTracer3D(from, to) {
  const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
  const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0.9 }));
  line.userData.life = 0.09;
  scene.add(line);
  tracerLines.push(line);
}

// ---- population ----
function spawnTraffic(n) {
  for (let i = 0; i < n; i++) {
    const node = pick(rng, city.graph.nodes);
    const type = pick(rng, ['sedan', 'sedan', 'coupe', 'taxi', 'van', 'truck', 'sedan']);
    const car = createCar(type, node.x, node.z, rng() * Math.PI * 2, undefined, rng);
    car.ai = { kind: 'traffic', target: null, from: null, stuck: 0 };
    car.speed = range(rng, 6, 12);
    if (type === 'taxi' || type === 'sedan') {
      const driver = createPerson('ped', node.x, node.z, rng);
      driver.state = 'drive';
      scene.add(driver.mesh);
      world.people.push(driver);
      car.driver = driver;
    }
    scene.add(car.mesh);
    world.cars.push(car);
    world.traffic.push(car);
  }
}
function spawnPeds(n) {
  for (let i = 0; i < n; i++) {
    const s = pick(rng, city.streets);
    const along = range(rng, -430, 430);
    const p = rng() < 0.5 ? createPerson('ped', s + 11, along, rng) : createPerson('ped', along, s + 11, rng);
    if (p.x > 380) continue;
    scene.add(p.mesh);
    world.people.push(p);
  }
}
// Player's own sedan parked at the safehouse.
const starterCar = createCar('sedan', city.locations.safehouse.x + 8, city.locations.safehouse.z, Math.PI, 0x2ecc71, rng);
starterCar.owned = true;
scene.add(starterCar.mesh);
world.cars.push(starterCar);
world.lastCar = starterCar;
spawnTraffic(14);
spawnPeds(36);

// Stash pickups: small glowing crates.
const stashMeshes = [];
for (const s of city.locations.stashes) {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(1.1, 1.1, 1.1),
    new THREE.MeshBasicMaterial({ color: 0xfde68a }),
  );
  m.position.set(s.x, 0.8, s.z);
  m.userData.stash = s;
  scene.add(m);
  stashMeshes.push(m);
}

// ---- interaction ----
function exitCar(exploded) {
  const car = player.inCar;
  if (!car) return;
  car.speed = 0;
  player.inCar = null;
  world.playerCar = null;
  const fx = Math.sin(car.heading + Math.PI / 2), fz = Math.cos(car.heading + Math.PI / 2);
  player.x = car.x + fx * 2.4; player.z = car.z + fz * 2.4;
  player.y = 0;
  player.mesh.visible = true;
  player.mesh.position.set(player.x, 0, player.z);
  if (!exploded) audio.blip(440, 0.07, 'square', 0.1);
}
function nearestCar(maxD) {
  let best = null, bd = maxD;
  for (const c of world.cars) {
    if (c.dead || c.burning) continue;
    const d = Math.hypot(c.x - player.x, c.z - player.z);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}
function busted() {
  if (world.state !== 'playing') return;
  world.state = 'gameover';
  audio.busted();
  const lost = Math.floor(player.cash * 0.15);
  player.cash -= lost;
  hud.showGameOver('BUSTED', `The PBPD hauled you in. La Jefa posted bail — it cost you $${lost.toLocaleString('en-US')}.`);
  world.saveGame();
}
function wasted() {
  if (world.state !== 'playing') return;
  world.state = 'gameover';
  audio.busted();
  const lost = Math.floor(player.cash * 0.1);
  player.cash -= lost;
  hud.showGameOver('WASTED', `You woke up at the clinic on Harbor Steps, $${lost.toLocaleString('en-US')} lighter.`);
  world.saveGame();
}

// Crew abilities.
function useCrew(id) {
  const p = player;
  if (p.crewCd[id] > 0) return;
  if (id === 'nico') {
    if (police.wanted === 0) { hud.hint('No heat to lose right now.'); return; }
    p.crewCd.nico = 45;
    police.heat = Math.max(0, police.heat - 26);
    police._recalcStars();
    hud.notify('Nico swapped your plates — one star gone.', 'good');
  } else if (id === 'tomas') {
    const car = p.inCar || world.lastCar;
    if (!car) { hud.hint('No car to fix.'); return; }
    p.crewCd.tomas = 60;
    car.cond = 100;
    hud.notify('Tomas patched your ride — good as new.', 'good');
  } else if (id === 'sofia') {
    if (police.wanted === 0) { hud.hint('No heat to lose right now.'); return; }
    p.crewCd.sofia = 75;
    police.heat = Math.max(0, police.heat - 45);
    police._recalcStars();
    // Every unit chases the decoy flare across town.
    const a = rng() * Math.PI * 2;
    const dx = p.x + Math.sin(a) * 160, dz = p.z + Math.cos(a) * 160;
    for (const u of police.units) { u.x = dx + range(rng, -14, 14); u.z = dz + range(rng, -14, 14); u.speed = 8; }
    police._removeHeli();
    hud.notify('Sofia’s flare pulled every unit across town.', 'good');
  }
  audio.blip(980, 0.1, 'triangle', 0.14);
}

// Street race side activity.
function tryStartRace() {
  const L = city.locations.raceStart;
  const p = world.playerPos();
  if (Math.hypot(p.x - L.x, p.z - L.z) > 14 || !player.inCar) return false;
  if (player.cash < 500) { hud.notify('The race costs $500 to enter.', 'bad'); return true; }
  player.cash -= 500;
  const points = [[352, -320], [352, -40], [352, 220], [288, 288], [96, 288], [96, 96], [352, 96]];
  world.race = { points, i: 0, timer: 150 };
  world.setMarker(points[0][0], points[0][1], 'Race checkpoint 1/7');
  hud.objectiveToast('STREET RACE', 'SEVEN GATES · 150 SECONDS · WIN $1,200');
  audio.missionDone();
  return true;
}
function updateRace(dt) {
  const r = world.race;
  if (!r) return;
  r.timer -= dt;
  hud.setTimer(r.timer);
  const p = world.playerPos();
  const pt = r.points[r.i];
  if (pt && Math.hypot(p.x - pt[0], p.z - pt[1]) < 13) {
    r.i += 1;
    audio.coin();
    if (r.i >= r.points.length) {
      player.cash += 1200;
      player.respect += 60;
      player.stats.raceWins += 1;
      hud.notify('Race won! +$1,200 · +60 respect', 'good');
      audio.missionDone();
      world.race = null;
      world.clearMarker();
      world.saveGame();
      return;
    }
    world.setMarker(r.points[r.i][0], r.points[r.i][1], `Race checkpoint ${r.i + 1}/${r.points.length}`);
    hud.notify(`Checkpoint ${r.i}/${r.points.length}`, 'good');
  }
  if (r.timer <= 0) {
    hud.notify('Race over — out of time.', 'bad');
    world.race = null;
    world.clearMarker();
  }
}

// ---- camera ----
function updateCamera(dt) {
  const target = player.inCar
    ? { x: player.inCar.x, z: player.inCar.z, y: 1.6, heading: player.inCar.heading, speed: Math.abs(player.inCar.speed) }
    : { x: player.x, z: player.z, y: 1.6 + player.y, heading: player.heading, speed: player.speed };
  const { dx, dy } = input.consumeMouse();
  if (dx || dy) {
    world.camYaw -= dx * 0.0032;
    world.camPitch = clamp(world.camPitch + dy * 0.0022, -0.05, 0.85);
  }
  // Auto-follow: ease the camera yaw behind the direction of travel.
  const moving = target.speed > 2;
  if (moving && !input.mouseDown && !input.locked) {
    const want = Math.atan2(Math.sin(target.heading), Math.cos(target.heading));
    let diff = want - world.camYaw;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    world.camYaw += diff * Math.min(1, dt * (player.inCar ? 1.6 : 2.4));
  }
  const dist = player.inCar ? 10.5 : input.mouseDown ? 5 : 7.5;
  const height = 2.6 + world.camPitch * 5;
  let d = dist;
  for (let tries = 0; tries < 5; tries++) {
    const cx = target.x - Math.sin(world.camYaw) * d;
    const cz = target.z - Math.cos(world.camYaw) * d;
    if (!city.collides(cx, cz, 0.6) || d <= 2.5) {
      camera.position.set(cx, target.y + height, cz);
      break;
    }
    d *= 0.75;
  }
  camera.lookAt(target.x + Math.sin(world.camYaw) * 6, target.y + 1.2, target.z + Math.cos(world.camYaw) * 6);
}

// ---- per-frame update ----
let lastT = performance.now();
let hudT = 0, safehouseT = 0, autosaveT = 0;
let shotFrames = 0;
let shotSettled = false;

function step(dt) {
  if (world.paused) return;
  const p = world.playerPos();
  world.clockMinutes += dt * 0.35;
  // Player.
  if (player.inCar) {
    const car = player.inCar;
    const nitro = drivePlayerCar(car, input, dt, city, (dmg) => {
      if (dmg > 2) { audio.blip(120, 0.12, 'sawtooth', 0.2); police.addHeat(1.5, world); }
    });
    player.stats.drivenKm += Math.abs(car.speed) * dt / 1000;
    world.playerVel.x = Math.sin(car.heading) * car.speed;
    world.playerVel.z = Math.cos(car.heading) * car.speed;
    audio.setEngine(Math.abs(car.speed) / car.spec.top, true);
    if (input.pressed('KeyE')) exitCar(false);
  } else {
    player.updateOnFoot(dt, world, world.camYaw);
    world.playerVel.x = Math.sin(player.heading) * player.speed;
    world.playerVel.z = Math.cos(player.heading) * player.speed;
    audio.setEngine(0, false);
    if (input.mouseDown) player.tryShoot(camera, world);
    if (input.pressed('KeyF')) player.punch(world);
    if (input.pressed('KeyE')) {
      const car = nearestCar(4);
      if (car) world.enterCar(car);
    }
  }
  // Weapons / reload / crew / radio / map / pause.
  for (const w of [1, 2, 3, 4, 5]) {
    if (input.pressed('Digit' + w)) {
      const def = [null, 'fists', 'pistol', 'smg', 'shotgun', 'rifle'][w];
      if (player.switchWeapon(def)) audio.blip(700, 0.06, 'square', 0.1);
    }
  }
  if (input.pressed('KeyQ')) player.cycleWeapon();
  if (input.pressed('KeyR') && !player.inCar) player.reloadTimer = 0.9;
  if (input.pressed('KeyZ')) useCrew('nico');
  if (input.pressed('KeyX')) useCrew('tomas');
  if (input.pressed('KeyC')) {
    const st = audio.cycleStation();
    hud.notify(`♪ ${st.name} — ${st.song}`, 'good');
  }
  if (input.pressed('KeyG')) {
    const L = city.locations.garage;
    const pp = world.playerPos();
    if (Math.hypot(pp.x - L.x, pp.z - L.z) < 16) {
      world.shopOpen = true;
      world.state = 'shop';
      hud.openShop(world, player.inCar || world.lastCar);
    }
  }
  // Prompts.
  if (world.state === 'playing' && !player.inCar) {
    const car = nearestCar(4);
    const L = city.locations;
    const pp = world.playerPos();
    if (car) hud.setPrompt(`<b>E</b> STEAL ${car.spec.name}`);
    else if (Math.hypot(pp.x - L.garage.x, pp.z - L.garage.z) < 16) hud.setPrompt('<b>G</b> IBARRA CUSTOMS — GARAGE & GUNS');
    else if (Math.hypot(pp.x - L.raceStart.x, pp.z - L.raceStart.z) < 14) hud.setPrompt('<b>E</b> STREET RACE — $500 ENTRY · WIN $1,200');
    else if (Math.hypot(pp.x - L.safehouse.x, pp.z - L.safehouse.z) < 12) hud.setPrompt('SAFEHOUSE — PROGRESS SAVED');
    else hud.setPrompt(null);
    if (Math.hypot(pp.x - L.raceStart.x, pp.z - L.raceStart.z) < 14 && input.pressed('KeyE')) tryStartRace();
    if (Math.hypot(pp.x - L.safehouse.x, pp.z - L.safehouse.z) < 12) { safehouseT += dt; if (safehouseT > 5) { world.saveGame(); safehouseT = 0; } }
  } else if (world.state === 'playing' && player.inCar) {
    const L = city.locations;
    const pp = world.playerPos();
    if (Math.hypot(pp.x - L.garage.x, pp.z - L.garage.z) < 16) hud.setPrompt('<b>G</b> IBARRA CUSTOMS — GARAGE & GUNS');
    else if (Math.hypot(pp.x - L.raceStart.x, pp.z - L.raceStart.z) < 14) hud.setPrompt('<b>E</b> STREET RACE — $500 ENTRY · WIN $1,200');
    else hud.setPrompt(null);
    if (Math.hypot(pp.x - L.raceStart.x, pp.z - L.raceStart.z) < 14 && input.pressed('KeyE')) tryStartRace();
  } else hud.setPrompt(null);
  // Dialogue advance.
  if (input.pressed('KeyE') || input.consumeClick()) hud.hideDialogue();
  // Traffic + collisions.
  for (const c of world.traffic) {
    if (c.dead || c.burning) continue;
    updateTrafficCar(c, dt, city, world.cars, rng);
  }
  for (let i = 0; i < world.cars.length; i++) {
    for (let j = i + 1; j < world.cars.length; j++) {
      const a = world.cars[i], b = world.cars[j];
      if (a.dead || b.dead || a.burning || b.burning) continue;
      const dmg = collideCars(a, b);
      if (dmg > 4) audio.blip(90, 0.15, 'sawtooth', 0.25);
    }
  }
  // Burning / exploding cars.
  for (const c of [...world.cars]) {
    if (c.cond <= 0 && !c.burning && !c.dead) {
      c.burning = true; c.burnTime = 0;
      world.onCarBurning(c);
    }
    if (c.burning) {
      c.burnTime += dt;
      c.mesh.position.y = Math.sin(c.burnTime * 30) * 0.05;
      if (c.burnTime > 2.2 && !c.dead) {
        c.dead = true;
        scene.remove(c.mesh);
        const wi = world.cars.indexOf(c);
        if (wi >= 0) world.cars.splice(wi, 1);
        const ti = world.traffic.indexOf(c);
        if (ti >= 0) { world.traffic.splice(ti, 1); }
        if (c === world.lastCar) world.lastCar = null;
        // Fresh traffic keeps the streets alive.
        if (c.ai && c.ai.kind === 'traffic') spawnTraffic(1);
      }
    }
  }
  // People.
  const danger = police.wanted > 0 ? { x: p.x, z: p.z, level: police.wanted, radius: 26 } : null;
  for (const person of world.people) {
    if (person.dead || person.kind === 'player') continue;
    if (person.kind === 'ped') {
      if (person.state === 'drive') { /* rides along with their car, handled below */ }
      else updatePed(person, dt, city, danger, rng);
    } else if (person.kind === 'enemy') {
      const shot = updateFighter(person, dt, p, city, true);
      if (shot) world.onEnemyShot(shot, person);
    }
  }
  // Drivers ride along with their cars.
  for (const c of world.cars) {
    if (c.driver && !c.driver.dead) {
      c.driver.x = c.x; c.driver.z = c.z;
      c.driver.mesh.position.set(c.x, 0, c.z);
      c.driver.mesh.visible = false;
    }
  }
  // Stashes.
  for (const m of stashMeshes) {
    const s = m.userData.stash;
    if (s.taken) continue;
    m.rotation.y += dt;
    m.position.y = 0.8 + Math.sin(performance.now() / 300) * 0.15;
    if (Math.hypot(player.x - s.x, player.z - s.z) < 2.6 || (player.inCar && Math.hypot(player.inCar.x - s.x, player.inCar.z - s.z) < 3)) {
      s.taken = true;
      scene.remove(m);
      player.cash += 150;
      audio.coin();
      hud.notify('Stash found! +$150', 'good');
    }
  }
  // Marker beacon animation.
  if (world.markerMesh) {
    world.markerMesh.userData.gem.position.y = 6 + Math.sin(performance.now() / 280) * 0.8;
    world.markerMesh.userData.gem.rotation.y += dt * 2;
    world.markerMesh.userData.ring.scale.setScalar(1 + Math.sin(performance.now() / 280) * 0.08);
  }
  // Police, missions, race.
  police.update(dt, world);
  missions.update(dt, world);
  updateRace(dt);
  audio.setSiren(police.wanted >= 1, police.wanted);
  // FX pools.
  for (let i = sparkPool.length - 1; i >= 0; i--) {
    const m = sparkPool[i];
    m.userData.life -= dt;
    m.scale.setScalar(Math.max(0.1, m.userData.life * 6));
    if (m.userData.life <= 0) { scene.remove(m); sparkPool.splice(i, 1); }
  }
  for (let i = fireballs.length - 1; i >= 0; i--) {
    const m = fireballs[i];
    m.userData.life -= dt;
    if (m.geometry) m.scale.setScalar(1 + (1.4 - m.userData.life) * 2.2);
    if (m.userData.life <= 0) { scene.remove(m); fireballs.splice(i, 1); }
  }
  for (let i = tracerLines.length - 1; i >= 0; i--) {
    const l = tracerLines[i];
    l.userData.life -= dt;
    l.material.opacity = Math.max(0, l.userData.life / 0.09);
    if (l.userData.life <= 0) { scene.remove(l); l.geometry.dispose(); tracerLines.splice(i, 1); }
  }
  // Sun follows the player so shadows stay local.
  city.sunLight.position.set(p.x - 260, 190, p.z - 140);
  city.sunLight.target.position.set(p.x, 0, p.z);
  city.sunLight.target.updateMatrixWorld();
  // HUD (10 Hz).
  hudT += dt;
  if (hudT > 0.1) { hud.update(world, hudT); hudT = 0; }
  // Autosave.
  autosaveT += dt;
  if (autosaveT > 45 && world.state === 'playing') { world.saveGame(); autosaveT = 0; }
  updateCamera(dt);
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = clamp((now - lastT) / 1000, 0.001, 0.05);
  lastT = now;
  try {
    // Pause toggle lives here, not in step(): step() never runs while
    // paused, so M / Esc / P could pause the game but never resume it.
    if (input.pressed('KeyM') || input.pressed('Escape') || input.pressed('KeyP')) {
      if (world.state === 'playing') world.setPaused(true);
      else if (world.state === 'paused') world.setPaused(false);
    }
    if (world.state === 'playing') step(dt);
    else if (world.state === 'title' || world.state === 'gameover') {
      // Slow orbit behind the title screen.
      const t = now / 1000;
      camera.position.set(-336 + Math.sin(t * 0.05) * 60, 26 + Math.sin(t * 0.03) * 6, 336 + Math.cos(t * 0.05) * 60);
      camera.lookAt(0, 4, 0);
      hudT += dt;
      if (hudT > 0.5) { hudT = 0; }
    }
    renderer.render(scene, camera);
    if (SHOT && !shotSettled) {
      shotFrames += 1;
      if (shotFrames > 110) {
        shotSettled = true;
        window.__shotReady = true;
      }
    }
  } catch (err) {
    window.__gameError = String(err && err.stack || err);
    console.error(err);
  }
  input.endFrame();
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
// Debug handle for automated playtests (read-only state inspection).
window.__pb = world;
window.addEventListener('pointerdown', () => audio.ensure(), { once: false });
window.addEventListener('keydown', () => audio.ensure(), { once: false });

// ---- boot ----
function applySave(s) {
  if (!s) return;
  player.cash = s.cash ?? START_CASH;
  player.respect = s.respect ?? 0;
  player.hp = s.hp ?? 100;
  player.armour = s.armour ?? 0;
  player.x = s.x ?? city.locations.safehouse.x;
  player.z = s.z ?? city.locations.safehouse.z;
  player.weapons = Object.assign(player.weapons, s.weapons || {});
  if (s.weaponId) player.weaponId = s.weaponId;
  Object.assign(player.stats, s.stats || {});
  world.clockMinutes = s.clockMinutes ?? world.clockMinutes;
  (s.stashesTaken || []).forEach((taken, i) => {
    if (taken && city.locations.stashes[i]) {
      city.locations.stashes[i].taken = true;
      const m = stashMeshes[i];
      if (m) scene.remove(m);
    }
  });
  missions.completedJobs = s.completedJobs || 0;
  missions.jobIndex = s.jobIndex || 0;
}

function beginPlay() {
  hud.hideTitle();
  hud.show();
  world.state = 'playing';
  missions.startJob(missions.jobIndex);
  audio.ensure();
}

if (SHOT) {
  // Screenshot mode: no title, stage the scene, simulate, then flag ready.
  hud.hideTitle();
  hud.show();
  world.state = 'playing';
  stageShot(SHOT, world);
  if (SHOT === 'street' && world.shotFired) {
    setTimeout(() => { try { player.tryShoot(camera, world); } catch { /* ignore */ } }, 600);
  }
  // Scripted input for the chase: hold W so the car rolls down the boulevard.
  if (SHOT === 'chase') {
    const origAxes = input.axes.bind(input);
    input.axes = () => ({ x: 0, y: 1 });
  }
  window.__gameReady = true;
  requestAnimationFrame(frame);
} else {
  const boot = sessionStorage.getItem('pb-boot');
  sessionStorage.removeItem('pb-boot');
  if (boot === 'new') {
    beginPlay();
    hud.objectiveToast('PALMERA BAY', 'JOB 1/8 · FIRST WHEELS — GO TO IBARRA CUSTOMS');
  } else if (boot === 'continue') {
    const s = readSave();
    applySave(s);
    beginPlay();
    hud.notify('Welcome back, Dante.', 'good');
  } else {
    world.state = 'title';
    hud.showTitle(hasSave(), saveLabel());
    hud.hide();
  }
  window.__gameReady = true;
  requestAnimationFrame(frame);
}

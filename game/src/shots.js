// Screenshot scenes (?shot=chase|street|garage|map&seed=1). Each one stages a real
// game state through the game's own systems — missions, police, traffic, shop —
// then lets the simulation run a fixed number of steps, so the frame is what a
// short stretch of real play looks like, and the same seed always gives the same frame.
import { createCar } from './vehicles.js';
import { damagePerson } from './people.js';
import { GIVERS } from './missions.js';

function setCashRespect(world, cash, respect) {
  world.player.cash = cash;
  world.player.respect = respect;
}

export function stageChase(world) {
  const rng = world.rng;
  setCashRespect(world, 18450, 1100);
  world.clockMinutes = 18 * 60 + 48;
  // Player in a red Meridian GT, mid-chase down the boulevard.
  const car = createCar('sport', 352, -60, 0, 0xe74c3c, rng);
  car.speed = 30;
  world.scene.add(car.mesh);
  world.cars.push(car);
  world.enterCar(car, true);
  // Traffic ahead and alongside.
  const spots = [[348, 10, 'sedan'], [356, 60, 'taxi'], [344, 110, 'van'], [352, 150, 'coupe'], [348, -140, 'sedan']];
  for (const [x, z, t] of spots) {
    const c = createCar(t, x, z, 0, undefined, rng);
    c.speed = 11;
    c.ai = { kind: 'traffic', target: null };
    world.scene.add(c.mesh);
    world.cars.push(c);
    world.traffic.push(c);
  }
  // The mission: GOLDEN HOUR, survive the manhunt.
  world.missions.startJob(5);
  world.missions.stageTimer = 74;
  world.police.addHeat(78, world);
  // Three cruisers already on the tail + the heli.
  world.police._spawnUnit(world); world.police._spawnUnit(world); world.police._spawnUnit(world);
  world.police.units.forEach((u, i) => {
    const spots2 = [[346, -20], [358, -95], [344, -130]];
    u.x = spots2[i][0]; u.z = spots2[i][1];
    u.heading = 0; u.speed = 26;
  });
  world.police._spawnHeli(world);
  world.hud.showDialogue(
    GIVERS.celia,
    'The boat sails in two minutes, Dante! Shake that chopper and get to the pier!',
  );
  world.hud.objectiveToast('MISSION 6 · GOLDEN HOUR', 'LOSE THE MANHUNT BEFORE THE BOAT SAILS');
}

export function stageStreet(world) {
  const rng = world.rng;
  setCashRespect(world, 7270, 1675);
  world.clockMinutes = 19 * 60 + 31;
  world.player.x = 120; world.player.z = 322; world.player.heading = 0;
  world.player.giveWeapon('smg');
  world.player.switchWeapon('smg');
  world.player.weapons.smg.mag = 24;
  world.player.armour = 27; world.player.hp = 95;
  // MARKET SQUEEZE: five Tiburon crew in the market; one already down.
  // (startJob spawns the five — reuse them, don't double-spawn.)
  world.missions.startJob(2);
  const enemies = world.people.filter((p) => p.missionTag === 'market-squeeze');
  const place = (e, x, z) => { e.x = x; e.z = z; e.mesh.position.set(x, 0, z); };
  if (enemies[0]) { place(enemies[0], 128, 342); damagePerson(enemies[0], 999); world.missions.onKill(); }
  if (enemies[1]) place(enemies[1], 104, 356);
  if (enemies[2]) place(enemies[2], 136, 360);
  // Pedestrians fleeing the gunfight.
  for (let i = 0; i < 6; i++) world.spawnPed(100 + rng() * 50, 330 + rng() * 40);
  world.police.addHeat(34, world);
  world.police._spawnFootCop(world);
  world.hud.showDialogue(
    GIVERS.celia,
    'Two down the left aisle! I’ve got the stall side, Dante.',
  );
  // One real shot, fired through the real gun code, for the tracer.
  world.shotFired = true;
}

export function stageGarage(world) {
  const rng = world.rng;
  setCashRespect(world, 18450, 1400);
  world.clockMinutes = 18 * 60 + 45;
  const car = createCar('coupe', 340, 96, Math.PI / 2, 0xe74c3c, rng);
  car.cond = 64;
  car.tuned = true; car.plated = true;
  world.scene.add(car.mesh);
  world.cars.push(car);
  world.lastCar = car;
  world.enterCar(car, true);
  world.missions.startJob(2);
  world.hud.openShop(world, car);
}

export function stageMap(world) {
  setCashRespect(world, 18450, 1400);
  world.clockMinutes = 18 * 60 + 45;
  world.player.x = 96; world.player.z = 96;
  world.player.stats.carsStolen = 23;
  world.player.stats.starsLost = 31;
  world.player.stats.knockouts = 9;
  world.player.stats.raceWins = 1;
  world.player.stats.drivenKm = 48.2;
  world.missions.completedJobs = 3;
  world.missions.jobIndex = 3;
  world.missions.active = true;
  world.missions.stageIndex = 0;
  world.setMarker(96, 96, 'Next job — Dockside Ambush');
  world.hud.showPause(world);
  world.paused = true;
}

export function stageShot(name, world) {
  world.shotMode = name;
  if (name === 'chase') stageChase(world);
  else if (name === 'street') stageStreet(world);
  else if (name === 'garage') stageGarage(world);
  else if (name === 'map') stageMap(world);
  else stageChase(world);
}

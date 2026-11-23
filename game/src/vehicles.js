// Cars: low-poly factory, arcade driving physics, traffic AI that follows the road
// graph, and the pursuit steering police use. All original vehicle designs.
import * as THREE from 'three';
import { VEHICLE_TYPES, CAR_COLORS } from './config.js';
import { pick, range, clamp, angleDiff } from './random.js';

export function specOf(type) {
  return VEHICLE_TYPES.find((v) => v.id === type) || VEHICLE_TYPES[0];
}

function box(w, h, d, color, x, y, z, opts = {}) {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshLambertMaterial({ color, emissive: opts.emissive || 0x000000 }),
  );
  m.position.set(x, y, z);
  if (opts.ry) m.rotation.y = opts.ry;
  m.castShadow = true;
  return m;
}

export function makeCarMesh(type, colorHex) {
  const g = new THREE.Group();
  const isBike = type === 'bike';
  const isCruiser = type === 'cruiser';
  const isTaxi = type === 'taxi';
  const bodyColor = isCruiser ? 0xf1f5f9 : isTaxi ? 0xfacc15 : colorHex;
  if (isBike) {
    g.add(box(0.5, 0.5, 1.9, bodyColor, 0, 0.62, 0));
    g.add(box(0.4, 0.5, 0.5, 0x1f2937, 0, 1.0, -0.2));
    g.add(box(0.7, 0.08, 0.08, 0x374151, 0, 1.05, 0.75));
    const wg = new THREE.CylinderGeometry(0.32, 0.32, 0.16, 10);
    const wm = new THREE.MeshLambertMaterial({ color: 0x111827 });
    for (const [x, z] of [[0, 0.8], [0, -0.8]]) {
      const w = new THREE.Mesh(wg, wm);
      w.rotation.z = Math.PI / 2; w.position.set(x, 0.32, z); w.castShadow = true;
      g.add(w);
    }
    g.add(box(0.3, 0.12, 0.2, 0xffffff, 0, 0.72, 0.95, { emissive: 0xfff7cc }));
    g.userData.length = 2.0;
    return g;
  }
  const long = type === 'van' || type === 'truck';
  const L = long ? 5.4 : 4.4;
  const W = long ? 2.1 : 2.0;
  g.add(box(W, 0.62, L, bodyColor, 0, 0.62, 0));
  if (type === 'truck') {
    g.add(box(W - 0.2, 1.0, 2.6, 0x6b7280, 0, 1.3, -1.2));
    g.add(box(W - 0.3, 0.5, 1.4, 0x1f2937, 0, 1.15, 1.5));
  } else {
    g.add(box(W - 0.35, 0.55, L * 0.48, 0x111827, 0, 1.15, -L * 0.05));
  }
  if (isCruiser) {
    g.add(box(W + 0.02, 0.2, L * 0.9, 0x1d4ed8, 0, 0.62, 0));
    const bar = new THREE.Group();
    bar.add(box(0.5, 0.16, 0.3, 0xef4444, -0.35, 1.52, -0.2, { emissive: 0xef4444 }));
    bar.add(box(0.5, 0.16, 0.3, 0x3b82f6, 0.35, 1.52, -0.2, { emissive: 0x3b82f6 }));
    bar.userData.isLightBar = true;
    g.add(bar);
    g.userData.lightBar = bar;
  }
  if (isTaxi) g.add(box(0.9, 0.22, 0.5, 0x111827, 0, 1.5, -0.2));
  // headlights / taillights
  g.add(box(0.34, 0.14, 0.08, 0xfff7cc, -W / 2 + 0.3, 0.66, L / 2, { emissive: 0xfff2b0 }));
  g.add(box(0.34, 0.14, 0.08, 0xfff7cc, W / 2 - 0.3, 0.66, L / 2, { emissive: 0xfff2b0 }));
  g.add(box(0.34, 0.14, 0.08, 0xef4444, -W / 2 + 0.3, 0.66, -L / 2, { emissive: 0x7f1d1d }));
  g.add(box(0.34, 0.14, 0.08, 0xef4444, W / 2 - 0.3, 0.66, -L / 2, { emissive: 0x7f1d1d }));
  // wheels
  const wg = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 10);
  const wm = new THREE.MeshLambertMaterial({ color: 0x111827 });
  const wheels = [];
  for (const [x, z] of [[-W / 2 + 0.1, L / 2 - 0.9], [W / 2 - 0.1, L / 2 - 0.9], [-W / 2 + 0.1, -L / 2 + 0.9], [W / 2 - 0.1, -L / 2 + 0.9]]) {
    const w = new THREE.Mesh(wg, wm);
    w.rotation.z = Math.PI / 2; w.position.set(x, 0.36, z); w.castShadow = true;
    g.add(w); wheels.push(w);
  }
  g.userData.wheels = wheels;
  g.userData.length = L;
  g.userData.width = W;
  return g;
}

export function createCar(type, x, z, heading, colorHex, rng) {
  const spec = specOf(type);
  const color = colorHex ?? pick(rng || Math.random, CAR_COLORS);
  const mesh = makeCarMesh(type, color);
  mesh.position.set(x, 0, z);
  mesh.rotation.y = heading;
  const car = {
    type, spec, mesh, color,
    x, z, heading,
    speed: 0,
    cond: 100,
    maxCond: 100,
    tuned: false, plated: false, nitro: false, nitroFuel: 100,
    ai: null,            // { kind: 'traffic'|'police', target, stuck }
    driver: null,        // pedestrian driver, if any
    dead: false, burning: false, burnTime: 0,
    id: Math.floor(Math.random() * 1e9),
  };
  mesh.userData.car = car;
  return car;
}

// Condition damage in one place: armour plating halves it, condition never
// goes below 0. `factor` is the caller's damage multiplier (crash severity,
// bullet vs. collision), applied before the plating discount.
export function damageCar(car, dmg, factor = 1) {
  const amount = dmg * factor * (car.plated ? 0.5 : 1);
  car.cond = Math.max(0, car.cond - amount);
  return amount;
}
// A car is a wreck once it is dead, burning, or at 0 condition.
export function isWrecked(car) { return car.dead || car.burning || car.cond <= 0; }

// Steer a car toward a point at up to maxSpeed; returns true when close.
export function steerToward(car, tx, tz, dt, maxSpeed, reverseOk = true) {
  const dx = tx - car.x, dz = tz - car.z;
  const dist = Math.hypot(dx, dz);
  const want = Math.atan2(dx, dz);
  const diff = angleDiff(car.heading, want);
  const speedFac = clamp(Math.abs(car.speed) / 8, 0, 1);
  if (Math.abs(diff) > 2.2 && reverseOk && car.speed < 1) {
    car.speed = Math.max(car.speed - 14 * dt, -7);
    car.heading += clamp(diff, -1, 1) * -1.6 * dt;
  } else {
    car.speed += clamp(maxSpeed - car.speed, -26 * dt, 12 * dt);
    car.heading += clamp(diff, -1, 1) * car.spec.turn * 0.9 * speedFac * dt * Math.sign(car.speed || 1);
  }
  return dist;
}

export function moveCar(car, dt, city, onCrash) {
  const fx = Math.sin(car.heading), fz = Math.cos(car.heading);
  const nx = car.x + fx * car.speed * dt;
  const nz = car.z + fz * car.speed * dt;
  const r = 1.4;
  const hit = city.resolveCircle(nx, nz, r);
  const impact = Math.abs(car.speed);
  car.x = hit.x; car.z = hit.z;
  if (hit.hit && impact > 4) {
    car.speed *= -0.25;
    const dmg = damageCar(car, impact - 4, 0.7);
    if (onCrash) onCrash(dmg, impact);
  } else if (hit.hit) {
    car.speed *= 0.6;
  }
  car.mesh.position.set(car.x, 0, car.z);
  car.mesh.rotation.y = car.heading;
  const wheels = car.mesh.userData.wheels || [];
  for (const w of wheels) w.rotation.x += car.speed * dt * 2.2;
}

// Player-driven car: arcade handling with drift, nitro and handbrake.
export function drivePlayerCar(car, input, dt, city, onCrash) {
  const spec = car.spec;
  const ax = input.axes();
  const nitro = car.nitro && input.down('ShiftLeft') && car.nitroFuel > 0 && ax.y > 0;
  const top = spec.top * (car.tuned ? 1.12 : 1) * (nitro ? 1.45 : 1);
  const accel = spec.accel * (car.tuned ? 1.12 : 1) * (nitro ? 1.7 : 1);
  if (nitro) car.nitroFuel = Math.max(0, car.nitroFuel - 30 * dt);
  if (ax.y > 0) car.speed += accel * dt;
  else if (ax.y < 0) {
    if (car.speed > 0.5) car.speed -= 34 * dt; // brake
    else car.speed = Math.max(car.speed - 10 * dt, -11); // reverse
  } else {
    car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 7 * dt); // drag
  }
  if (input.down('Space')) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 30 * dt);
  car.speed = clamp(car.speed, -12, top);
  const steer = ax.x;
  const grip = input.down('Space') ? 1.7 : 1;
  car.heading += steer * spec.turn * grip * clamp(Math.abs(car.speed) / 9, 0, 1) * dt * Math.sign(car.speed || 1);
  moveCar(car, dt, city, onCrash);
  return nitro;
}

// Traffic: follow the road graph; slow for the car ahead; respawn if hopelessly stuck.
export function updateTrafficCar(car, dt, city, others, rng) {
  const ai = car.ai;
  if (!ai.target) {
    ai.target = pick(rng, city.graph.nodes);
  }
  const d = steerToward(car, ai.target.x, ai.target.z, dt, range(rng, 9, 13), true);
  // Slow down for a car directly ahead.
  const fx = Math.sin(car.heading), fz = Math.cos(car.heading);
  for (const o of others) {
    if (o === car || o.dead) continue;
    const dx = o.x - car.x, dz = o.z - car.z;
    const ahead = dx * fx + dz * fz;
    const side = Math.abs(dx * fz - dz * fx);
    if (ahead > 0 && ahead < 9 && side < 2.4) { car.speed = Math.min(car.speed, 2.5); break; }
  }
  moveCar(car, dt, city, null);
  if (d < 7) {
    const options = city.graph.neighbors(ai.target).filter((n) => n !== ai.from);
    ai.from = ai.target;
    ai.target = options.length ? pick(rng, options) : pick(rng, city.graph.nodes);
    ai.stuck = 0;
  } else {
    ai.stuck = (ai.stuck || 0) + dt;
    if (ai.stuck > 14) { // teleport to a fresh stretch of road
      const n = pick(rng, city.graph.nodes);
      car.x = n.x; car.z = n.z; car.speed = 0;
      ai.target = null; ai.stuck = 0;
    }
  }
}

export function collideCars(a, b) {
  const dx = b.x - a.x, dz = b.z - a.z;
  const d = Math.hypot(dx, dz);
  const min = 2.6;
  if (d >= min || d === 0) return 0;
  const push = (min - d) / 2;
  const nx = dx / d, nz = dz / d;
  a.x -= nx * push; a.z -= nz * push;
  b.x += nx * push; b.z += nz * push;
  const impact = Math.abs(a.speed - b.speed);
  const dmg = Math.max(0, impact - 3) * 0.55;
  if (dmg > 0) {
    damageCar(a, dmg);
    damageCar(b, dmg);
    const avg = (a.speed + b.speed) / 2;
    a.speed = avg * 0.55; b.speed = avg * 0.55;
  }
  return dmg;
}

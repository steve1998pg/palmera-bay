// Vehicles: low-poly box cars, arcade driving physics, traffic that
// follows the road graph, and car-vs-car / car-vs-building collisions.
import * as THREE from '../vendor/three.module.min.js';
import { VEHICLES } from './config.js';
import { clamp, angleDiff, wrapAngle } from './random.js';

let carSeq = 0;

const BODY_MAT = new THREE.MeshLambertMaterial({ color: 0x1a2028 });

function dimsFor(type) {
  if (type === 'van' || type === 'truck') return { len: 5.4, wide: 2.0, bodyH: 1.5 };
  if (type === 'bike') return { len: 2.2, wide: 0.9, bodyH: 0.85 };
  return { len: 4.4, wide: 2.0, bodyH: 0.85 };
}

function addLights(grp, wide, len) {
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
  for (const side of [-1, 1]) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.2, 0.1), headMat);
    head.position.set(side * (wide / 2 - 0.25), 0.8, len / 2 + 0.02);
    grp.add(head);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.2, 0.1), tailMat);
    tail.position.set(side * (wide / 2 - 0.25), 0.8, -len / 2 - 0.02);
    grp.add(tail);
  }
}

function addWheels(grp, wide, len) {
  const geo = new THREE.CylinderGeometry(0.42, 0.42, 0.3, 10);
  geo.rotateZ(Math.PI / 2);
  const mat = new THREE.MeshLambertMaterial({ color: 0x141414 });
  const wheels = [];
  const wz = len / 2 - 0.9;
  for (const [wx, wzz] of [[-wide / 2, wz], [wide / 2, wz], [-wide / 2, -wz], [wide / 2, -wz]]) {
    const wheel = new THREE.Mesh(geo, mat);
    wheel.position.set(wx, 0.42, wzz);
    grp.add(wheel);
    wheels.push(wheel);
  }
  return wheels;
}

function addLightBar(grp) {
  const bar = new THREE.Group();
  const red = new THREE.Mesh(
    new THREE.BoxGeometry(0.7, 0.25, 0.5),
    new THREE.MeshBasicMaterial({ color: 0xff2222 })
  );
  red.position.x = -0.4;
  const blue = new THREE.Mesh(
    new THREE.BoxGeometry(0.7, 0.25, 0.5),
    new THREE.MeshBasicMaterial({ color: 0x2244ff })
  );
  blue.position.x = 0.4;
  bar.add(red);
  bar.add(blue);
  bar.position.set(0, 1.95, 0);
  bar.userData.red = red;
  bar.userData.blue = blue;
  grp.add(bar);
  return bar;
}

export function makeCarMesh(W, type, color) {
  const spec = VEHICLES[type] || VEHICLES.sedan;
  const { len, wide, bodyH } = dimsFor(type);
  const grp = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color });
  const body = new THREE.Mesh(new THREE.BoxGeometry(wide, bodyH, len), paint);
  body.position.y = 0.75;
  body.castShadow = true;
  grp.add(body);
  if (type !== 'bike' && type !== 'truck') {
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(wide * 0.85, 0.7, len * 0.45), BODY_MAT);
    cabin.position.set(0, 1.45, -len * 0.05);
    cabin.castShadow = true;
    grp.add(cabin);
  }
  if (type === 'truck') {
    const bed = new THREE.Mesh(new THREE.BoxGeometry(wide * 0.9, 0.5, len * 0.5), BODY_MAT);
    bed.position.set(0, 1.6, -len * 0.22);
    grp.add(bed);
  }
  addLights(grp, wide, len);
  const wheels = addWheels(grp, wide, len);
  const lightBar = type === 'cruiser' ? addLightBar(grp) : null;
  grp.userData.wheels = wheels;
  grp.userData.lightBar = lightBar;
  grp.userData.len = len;
  void spec;
  return grp;
}

export function spawnCar(W, type, x, z, heading, opts = {}) {
  const spec = VEHICLES[type] || VEHICLES.sedan;
  const color = opts.color !== undefined ? opts.color : spec.color;
  const mesh = makeCarMesh(W, type, color);
  mesh.position.set(x, 0, z);
  mesh.rotation.y = heading;
  W.scene.add(mesh);
  const car = {
    id: ++carSeq,
    type, spec, mesh, color,
    x, z, heading, speed: 0,
    cond: opts.cond !== undefined ? opts.cond : 100,
    tuned: !!opts.tuned, plated: !!opts.plated,
    nitro: !!opts.nitro, nitroFuel: opts.nitroFuel !== undefined ? opts.nitroFuel : 100,
    ai: opts.ai || null, driver: opts.driver || null,
    dead: false, burning: false, burnTime: 0,
    owned: !!opts.owned, targetCar: !!opts.targetCar,
    unitName: opts.unitName || null, unitRole: opts.unitRole || null,
    path: null, pathIdx: 0, repathAt: 0, stuckAt: 0, stuckX: x, stuckZ: z,
    flash: 0, explodeAt: 0,
  };
  W.cars.push(car);
  return car;
}

export function removeCar(W, car) {
  W.scene.remove(car.mesh);
  const i = W.cars.indexOf(car);
  if (i >= 0) W.cars.splice(i, 1);
  if (W.lastCar === car) W.lastCar = W.player.inCar || null;
  if (W.player.inCar === car) W.player.inCar = null;
}

export function damageCar(W, car, amount) {
  if (car.dead || car.burning) return;
  const real = car.plated ? amount * 0.5 : amount;
  car.cond -= real;
  if (car.cond <= 0) {
    car.cond = 0;
    W.onCarBurning(car);
  }
}

function nitroBoost(car, drive, dt) {
  if (!drive.nitro || !car.nitro || car.nitroFuel <= 0 || drive.throttle <= 0) {
    return { topMul: 1, accelMul: 1 };
  }
  car.nitroFuel = Math.max(0, car.nitroFuel - 30 * dt);
  return { topMul: 1.45, accelMul: 1.7 };
}

// Arcade drive step for one car. `drive` = {throttle, steer, brake, nitro}.
// Returns true if the car hit a building hard this step.
export function driveCar(W, car, drive, dt) {
  if (car.dead || car.burning) return false;
  const spec = car.spec;
  const boost = nitroBoost(car, drive, dt);
  const tune = car.tuned ? 1.12 : 1;
  const top = spec.top * tune * boost.topMul;
  const accel = spec.accel * tune * boost.accelMul;
  const prevSpeed = car.speed;
  if (drive.throttle > 0) car.speed += accel * dt;
  else if (drive.throttle < 0) {
    // Brake while rolling forward, reverse once stopped.
    car.speed -= (car.speed > 0.5 ? spec.accel * 2.2 : spec.accel * 0.8) * dt;
  } else {
    car.speed -= car.speed * 0.6 * dt; // drag
    if (Math.abs(car.speed) < 0.15) car.speed = 0;
  }
  car.speed = clamp(car.speed, -11, top);
  // Hard steering at speed scrubs speed (arcade grip): the car slows into
  // a sharp turn instead of sweeping tens of metres wide through the block.
  if (Math.abs(drive.steer) >= 1 && Math.abs(car.speed) > 15) {
    car.speed -= Math.sign(car.speed) * 5 * dt;
  }
  // Steering: easier at moderate speed, harder flat-out; flips in reverse.
  // The rate is high enough that a 90-degree corner at top speed fits in a
  // 96 m road grid (radius ~12 m), instead of sweeping into the buildings.
  const spd = Math.abs(car.speed);
  const authority = clamp(spd / 8, 0, 1) * (1 / (1 + spd * 0.008));
  const reverse = car.speed >= 0 ? 1 : -1;
  car.heading = wrapAngle(car.heading + drive.steer * spec.handling * 1.4 * authority * dt * reverse);
  car.x += Math.sin(car.heading) * car.speed * dt;
  car.z += Math.cos(car.heading) * car.speed * dt;
  // Buildings: slide along them; a hard hit damages the car and bounces it.
  const res = W.city.resolveCircle(car.x, car.z, 2.1);
  car.x = res.x;
  car.z = res.z;
  let hardHit = false;
  if (res.hit) {
    const impact = Math.abs(prevSpeed);
    if (impact > 20) {
      car.speed *= -0.35;
      hardHit = true;
      damageCar(W, car, (impact - 18) * 1.1);
    } else if (impact > 0.5) {
      // Grind along the wall instead of bouncing straight back off it.
      car.speed *= 0.55;
    }
  }
  car.x = clamp(car.x, -478, 478);
  car.z = clamp(car.z, -478, 478);
  // Visuals.
  car.mesh.position.set(car.x, 0, car.z);
  car.mesh.rotation.y = car.heading;
  const spin = car.speed * dt * 2.4;
  for (const wh of car.mesh.userData.wheels) wh.rotation.x += spin;
  const bar = car.mesh.userData.lightBar;
  if (bar) {
    car.flash += dt;
    const on = Math.floor(car.flash * 2.4) % 2 === 0;
    bar.userData.red.material.color.setHex(on ? 0xff2222 : 0x550000);
    bar.userData.blue.material.color.setHex(on ? 0x111144 : 0x2244ff);
  }
  return hardHit;
}

function carAheadBlocked(W, car) {
  for (const other of W.cars) {
    if (other === car || other.dead) continue;
    const ox = other.x - car.x;
    const oz = other.z - car.z;
    if (Math.hypot(ox, oz) >= 9) continue;
    const fwd = Math.sin(car.heading) * ox + Math.cos(car.heading) * oz;
    const side = Math.cos(car.heading) * ox - Math.sin(car.heading) * oz;
    if (fwd > 0 && Math.abs(side) < 2.4) return true;
  }
  return false;
}

// Traffic AI: follow the road graph, slow for the car ahead, teleport away
// if stuck too long. `now` is game time in seconds.
export function updateTraffic(W, car, dt, now) {
  if (car.dead || car.burning || car.ai !== 'traffic') return;
  const graph = W.city.graph;
  if (!car.path || car.pathIdx >= car.path.length || now > car.repathAt) {
    const cur = graph.nodeAt(car.x, car.z);
    const nbrs = graph.neighbors(cur);
    const next = nbrs.length ? nbrs[Math.floor(Math.random() * nbrs.length)] : cur;
    car.path = [next];
    car.pathIdx = 0;
    car.repathAt = now + 6 + Math.random() * 4;
  }
  const target = car.path[car.pathIdx];
  const d = Math.hypot(target.x - car.x, target.z - car.z);
  if (d < 7) {
    car.pathIdx++;
    return;
  }
  const blocked = carAheadBlocked(W, car);
  const wantH = Math.atan2(target.x - car.x, target.z - car.z);
  const diff = angleDiff(wantH, car.heading);
  const steer = diff > 0.18 ? 1 : diff < -0.18 ? -1 : 0;
  const cruise = car.spec.top * 0.45 * (blocked ? 0 : 1);
  const drive = {
    throttle: car.speed < cruise ? 1 : 0,
    steer,
    brake: false,
    nitro: false,
  };
  if (blocked && car.speed < 1) drive.throttle = 0;
  driveCar(W, car, drive, dt);
  // Stuck detection.
  if (Math.hypot(car.x - car.stuckX, car.z - car.stuckZ) > 3) {
    car.stuckX = car.x;
    car.stuckZ = car.z;
    car.stuckAt = now;
  } else if (now - car.stuckAt > 14) {
    const node = graph.nodes[Math.floor(Math.random() * graph.nodes.length)];
    car.x = node.x;
    car.z = node.z;
    car.heading = Math.random() * Math.PI * 2;
    car.speed = 0;
    car.stuckAt = now;
    car.path = null;
  }
}

// Car-vs-car shoving + damage from the speed difference.
export function collideCars(W) {
  const cars = W.cars;
  for (let i = 0; i < cars.length; i++) {
    const a = cars[i];
    if (a.dead) continue;
    for (let j = i + 1; j < cars.length; j++) {
      const b = cars[j];
      if (b.dead) continue;
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.01 || d >= 4.2) continue;
      const nx = dx / d;
      const nz = dz / d;
      const push = (4.2 - d) / 2;
      a.x -= nx * push;
      a.z -= nz * push;
      b.x += nx * push;
      b.z += nz * push;
      const rel = Math.abs(a.speed - b.speed);
      if (rel > 6) {
        damageCar(W, a, rel * 0.5);
        damageCar(W, b, rel * 0.5);
        a.speed *= 0.7;
        b.speed *= 0.7;
      }
    }
  }
}

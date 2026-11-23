// Vehicles: low-poly box cars, arcade driving physics, traffic that follows
// the road graph, and car-vs-car / car-vs-building collisions.
import * as THREE from '../vendor/three.module.min.js';
import { VEHICLES } from './config.js';
import { clamp, angleDiff, wrapAngle } from './random.js';

let carSeq = 0;

export function makeCarMesh(W, type, color) {
  const spec = VEHICLES[type] || VEHICLES.sedan;
  const grp = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x1a2028 });
  const long = type === 'van' || type === 'truck' ? 5.4 : type === 'bike' ? 2.2 : 4.4;
  const wide = type === 'bike' ? 0.9 : 2.0;
  const bodyH = type === 'van' || type === 'truck' ? 1.5 : 0.85;
  const body = new THREE.Mesh(new THREE.BoxGeometry(wide, bodyH, long), bodyMat);
  body.position.y = 0.75;
  body.castShadow = true;
  grp.add(body);
  if (type !== 'bike' && type !== 'truck') {
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(wide * 0.85, 0.7, long * 0.45), darkMat);
    cabin.position.set(0, 1.45, -long * 0.05);
    cabin.castShadow = true;
    grp.add(cabin);
  }
  if (type === 'truck') {
    const bed = new THREE.Mesh(new THREE.BoxGeometry(wide * 0.9, 0.5, long * 0.5), darkMat);
    bed.position.set(0, 1.6, -long * 0.22);
    grp.add(bed);
  }
  // Headlights + taillights.
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
  for (const sx of [-1, 1]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.2, 0.1), headMat);
    h.position.set(sx * (wide / 2 - 0.25), 0.8, long / 2 + 0.02);
    grp.add(h);
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.2, 0.1), tailMat);
    t.position.set(sx * (wide / 2 - 0.25), 0.8, -long / 2 - 0.02);
    grp.add(t);
  }
  // Wheels.
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.3, 10);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x141414 });
  const wheels = [];
  const wz = long / 2 - 0.9;
  for (const [wx, wzz] of [[-wide / 2, wz], [wide / 2, wz], [-wide / 2, -wz], [wide / 2, -wz]]) {
    const wh = new THREE.Mesh(wheelGeo, wheelMat);
    wh.position.set(wx, 0.42, wzz);
    grp.add(wh);
    wheels.push(wh);
  }
  let lightBar = null;
  if (type === 'cruiser') {
    lightBar = new THREE.Group();
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.25, 0.5), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    red.position.x = -0.4;
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.25, 0.5), new THREE.MeshBasicMaterial({ color: 0x2244ff }));
    blue.position.x = 0.4;
    lightBar.add(red); lightBar.add(blue);
    lightBar.position.set(0, 1.95, 0);
    lightBar.userData.red = red; lightBar.userData.blue = blue;
    grp.add(lightBar);
  }
  grp.userData.wheels = wheels;
  grp.userData.lightBar = lightBar;
  grp.userData.len = long;
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

// Arcade drive step for one car. `drive` = {throttle, steer, brake, nitro}.
// Returns true if the car hit a building hard this step.
export function driveCar(W, car, drive, dt) {
  if (car.dead || car.burning) return false;
  const spec = car.spec;
  let top = spec.top * (car.tuned ? 1.12 : 1);
  let accel = spec.accel * (car.tuned ? 1.12 : 1);
  let nitroOn = false;
  if (drive.nitro && car.nitro && car.nitroFuel > 0 && drive.throttle > 0) {
    nitroOn = true;
    top *= 1.45; accel *= 1.7;
    car.nitroFuel = Math.max(0, car.nitroFuel - 30 * dt);
  }
  const prevSpeed = car.speed;
  if (drive.throttle > 0) car.speed += accel * dt;
  else if (drive.throttle < 0) {
    if (car.speed > 0.5) car.speed -= spec.accel * 2.2 * dt; // brake
    else car.speed -= spec.accel * 0.8 * dt; // reverse
  } else {
    car.speed -= car.speed * 0.6 * dt; // drag
    if (Math.abs(car.speed) < 0.15) car.speed = 0;
  }
  const revTop = 11;
  car.speed = clamp(car.speed, -revTop, top);
  // Hard steering at speed scrubs speed (arcade grip): the car slows into
  // a sharp turn instead of sweeping tens of metres wide through the block.
  if (Math.abs(drive.steer) >= 1 && Math.abs(car.speed) > 15) {
    car.speed -= Math.sign(car.speed) * 5 * dt;
  }
  // Steering: easier at moderate speed, harder flat-out; flips in reverse.
  // The rate is high enough that a 90-degree corner at top speed fits in a
  // 96 m road grid (radius ~12 m), instead of sweeping into the buildings.
  const spd = Math.abs(car.speed);
  const steerAuthority = clamp(spd / 8, 0, 1) * (1 / (1 + spd * 0.008));
  car.heading = wrapAngle(car.heading + drive.steer * spec.handling * 1.4 * steerAuthority * dt * (car.speed >= 0 ? 1 : -1));
  const fx = Math.sin(car.heading), fz = Math.cos(car.heading);
  car.x += fx * car.speed * dt;
  car.z += fz * car.speed * dt;
  // Buildings: slide along them; a hard hit damages the car and bounces it.
  const res = W.city.resolveCircle(car.x, car.z, 2.1);
  car.x = res.x; car.z = res.z;
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
  if (car.mesh.userData.lightBar) {
    car.flash += dt;
    const on = Math.floor(car.flash * 2.4) % 2 === 0;
    car.mesh.userData.lightBar.userData.red.material.color.setHex(on ? 0xff2222 : 0x550000);
    car.mesh.userData.lightBar.userData.blue.material.color.setHex(on ? 0x111144 : 0x2244ff);
  }
  return hardHit;
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
  if (d < 7) { car.pathIdx++; return; }
  // Slow down for a car directly ahead.
  let blocked = false;
  for (const other of W.cars) {
    if (other === car || other.dead) continue;
    const ox = other.x - car.x, oz = other.z - car.z;
    const od = Math.hypot(ox, oz);
    if (od < 9) {
      const fwd = Math.sin(car.heading) * ox + Math.cos(car.heading) * oz;
      const side = Math.cos(car.heading) * ox - Math.sin(car.heading) * oz;
      if (fwd > 0 && Math.abs(side) < 2.4) { blocked = true; break; }
    }
  }
  const wantH = Math.atan2(target.x - car.x, target.z - car.z);
  const diff = angleDiff(wantH, car.heading);
  const steer = diff > 0.18 ? 1 : diff < -0.18 ? -1 : 0;
  const cruise = (car.spec.top * 0.45) * (blocked ? 0 : 1);
  const drive = { throttle: car.speed < cruise ? 1 : 0, steer, brake: false, nitro: false };
  if (blocked && car.speed < 1) drive.throttle = 0;
  driveCar(W, car, drive, dt);
  // Stuck detection.
  if (Math.hypot(car.x - car.stuckX, car.z - car.stuckZ) > 3) {
    car.stuckX = car.x; car.stuckZ = car.z; car.stuckAt = now;
  } else if (now - car.stuckAt > 14) {
    const node = graph.nodes[Math.floor(Math.random() * graph.nodes.length)];
    car.x = node.x; car.z = node.z;
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
      const dx = b.x - a.x, dz = b.z - a.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.01 || d >= 4.2) continue;
      const nx = dx / d, nz = dz / d;
      const push = (4.2 - d) / 2;
      a.x -= nx * push; a.z -= nz * push;
      b.x += nx * push; b.z += nz * push;
      const rel = Math.abs(a.speed - b.speed);
      if (rel > 6) {
        damageCar(W, a, rel * 0.5);
        damageCar(W, b, rel * 0.5);
        a.speed *= 0.7; b.speed *= 0.7;
      }
    }
  }
}

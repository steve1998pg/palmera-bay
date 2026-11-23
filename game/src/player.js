// The player on foot: third-person movement, jumping, punching, hitscan gunplay
// with tracers, carjacking, and the weapon inventory. Original character: Dante Cruz.
import * as THREE from 'three';
import { WEAPONS, weaponDef } from './config.js';
import { clamp } from './random.js';
import { makePersonMesh, damagePerson } from './people.js';

const START_AMMO = { pistol: 60, smg: 120, shotgun: 24, rifle: 40 };
const RELOAD_SECONDS = 0.9;
// Health regen: 7 s out of combat, then 2.2 HP/s.
const REGEN_DELAY = 7;
const REGEN_RATE = 2.2;

// 2D ray vs AABB slab test — bullets stop at buildings.
function rayHitBuilding(ox, oz, dx, dz, city, maxDist) {
  let best = maxDist;
  for (const c of city.colliders) {
    const minX = c.x - c.hx, maxX = c.x + c.hx;
    const minZ = c.z - c.hz, maxZ = c.z + c.hz;
    let tmin = 0, tmax = best;
    if (Math.abs(dx) < 1e-8) { if (ox < minX || ox > maxX) continue; }
    else {
      let t1 = (minX - ox) / dx, t2 = (maxX - ox) / dx;
      if (t1 > t2) [t1, t2] = [t2, t1];
      tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
      if (tmin > tmax) continue;
    }
    if (Math.abs(dz) < 1e-8) { if (oz < minZ || oz > maxZ) continue; }
    else {
      let t1 = (minZ - oz) / dz, t2 = (maxZ - oz) / dz;
      if (t1 > t2) [t1, t2] = [t2, t1];
      tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
      if (tmin > tmax) continue;
    }
    if (tmin > 0 && tmin < best) best = tmin;
  }
  return best;
}

export class Player {
  constructor(scene) {
    this.mesh = makePersonMesh({ shirt: 0x1f2937, pants: 0x374151, skin: 0xe0ac69, cap: 0xdc2626 });
    // Dante's look: dark jacket, red cap.
    scene.add(this.mesh);
    this.x = -336; this.z = 336;
    this.y = 0; this.vy = 0;
    this.heading = Math.PI;
    this.speed = 0;
    this.hp = 100; this.armour = 0;
    this.cash = 250; this.respect = 0;
    this.inCar = null;
    this.weapons = {
      fists: { owned: true, mag: Infinity, reserve: Infinity },
      pistol: { owned: true, mag: 12, reserve: START_AMMO.pistol },
      smg: { owned: false, mag: 30, reserve: START_AMMO.smg },
      shotgun: { owned: false, mag: 6, reserve: START_AMMO.shotgun },
      rifle: { owned: false, mag: 20, reserve: START_AMMO.rifle },
    };
    this.weaponId = 'pistol';
    this.fireCd = 0; this.reloadTimer = 0; this.punchCd = 0;
    this.lastDamageAt = -99;
    this.crewCd = { nico: 0, tomas: 0, sofia: 0 };
    this.stats = { carsStolen: 0, starsLost: 0, knockouts: 0, raceWins: 0, drivenKm: 0, shotsFired: 0 };
    this.muzzle = new THREE.PointLight(0xffc46b, 0, 14);
    scene.add(this.muzzle);
    this.tracerMat = new THREE.LineBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.95 });
    this.tracers = [];
    this.raycaster = new THREE.Raycaster();
  }

  weapon() { return weaponDef(this.weaponId); }

  giveWeapon(id) {
    if (this.weapons[id]) { this.weapons[id].owned = true; this.weapons[id].reserve = START_AMMO[id] ?? 0; }
  }
  refillAmmo() {
    for (const id of Object.keys(this.weapons)) {
      if (this.weapons[id].owned && START_AMMO[id]) this.weapons[id].reserve = START_AMMO[id];
    }
  }
  // Take a hit: armour absorbs 60% of it first. Returns true if it killed you.
  takeDamage(dmg) {
    const absorbed = Math.min(this.armour, dmg * 0.6);
    this.armour -= absorbed;
    this.hp = Math.max(0, this.hp - (dmg - absorbed));
    this.lastDamageAt = performance.now() / 1000;
    return this.hp <= 0;
  }

  switchWeapon(id) {
    const w = weaponDef(id);
    if (w && this.weapons[id].owned) { this.weaponId = id; this.reloadTimer = 0; return true; }
    return false;
  }
  cycleWeapon() {
    const owned = WEAPONS.filter((w) => this.weapons[w.id].owned);
    const i = owned.findIndex((w) => w.id === this.weaponId);
    this.weaponId = owned[(i + 1) % owned.length].id;
    this.reloadTimer = 0;
  }
  // Start a reload — only when the mag is short and there is reserve ammo.
  // (The old R key started a 0.9 s lockout even with a full mag.)
  startReload() {
    if (this.inCar || this.reloadTimer > 0) return false;
    const w = this.weapon();
    const slot = this.weapons[w.id];
    if (w.id === 'fists' || slot.mag >= w.mag || slot.reserve <= 0) return false;
    this.reloadTimer = RELOAD_SECONDS;
    return true;
  }
  _finishReload() {
    const w = this.weapon();
    const slot = this.weapons[w.id];
    if (slot.reserve !== Infinity) {
      const need = w.mag - slot.mag;
      const take = Math.min(need, slot.reserve);
      slot.mag += take; slot.reserve -= take;
    } else slot.mag = w.mag;
  }

  // --- shooting ---
  tryShoot(camera, world) {
    const w = this.weapon();
    if (this.fireCd > 0 || this.reloadTimer > 0 || this.inCar) return;
    if (w.id !== 'fists') {
      const slot = this.weapons[w.id];
      if (slot.mag <= 0) { this.reloadTimer = RELOAD_SECONDS; world.audio.blip(220, 0.1, 'square', 0.12); return; }
      slot.mag -= 1;
      this.stats.shotsFired += 1;
      if (slot.mag === 0) this.reloadTimer = RELOAD_SECONDS;
    }
    this.fireCd = w.rate;
    this._fire(camera, world, w);
  }
  _fire(camera, world, w) {
    const pellets = w.pellets || 1;
    for (let p = 0; p < pellets; p++) {
      const spread = (Math.random() - 0.5) * 0.02 * (pellets > 1 ? 3 : 1);
      this.raycaster.setFromCamera({ x: spread, y: (Math.random() - 0.5) * 0.02 }, camera);
      const origin = this.raycaster.ray.origin;
      const dir = this.raycaster.ray.direction;
      const maxD = w.range;
      // Buildings first (cheap 2D slab test on the XZ projection).
      const bDist = rayHitBuilding(origin.x, origin.z, dir.x, dir.z, world.city, maxD);
      let hitDist = Math.min(bDist, maxD);
      let hitObj = null;
      // Shootable people and cars — raycaster returns hits nearest-first.
      const targets = [];
      for (const p of world.people) if (!p.dead && p.mesh.visible) targets.push(p.mesh);
      for (const c of world.cars) if (!c.dead) targets.push(c.mesh);
      const hits = this.raycaster.intersectObjects(targets, true);
      if (hits.length > 0 && hits[0].distance < hitDist) {
        hitDist = hits[0].distance;
        hitObj = hits[0].object;
      }
      const end = new THREE.Vector3(
        origin.x + dir.x * hitDist,
        origin.y + dir.y * hitDist,
        origin.z + dir.z * hitDist,
      );
      this._spawnTracer(origin, end);
      if (hitObj) {
        let node = hitObj;
        while (node && !node.userData.person && !node.userData.car) node = node.parent;
        if (node && node.userData.person) {
          const person = node.userData.person;
          const killed = damagePerson(person, w.dmg);
          world.onPersonShot(person, killed, w.dmg);
        } else if (node && node.userData.car) {
          const car = node.userData.car;
          car.cond = Math.max(0, car.cond - w.dmg * 0.6);
          world.onCarShot(car, w.dmg);
        }
        world.spawnSpark(end);
      } else if (hitDist < maxD) {
        world.spawnSpark(end);
      }
    }
    world.audio.shot(w.id === 'shotgun' ? 'shotgun' : w.id === 'rifle' ? 'rifle' : 'pistol');
    // Muzzle flash at the gun.
    const mp = new THREE.Vector3();
    this.mesh.userData.armR.getWorldPosition(mp);
    this.muzzle.position.copy(mp);
    this.muzzle.intensity = 26;
  }
  _spawnTracer(from, to) {
    const geo = new THREE.BufferGeometry().setFromPoints([from.clone(), to.clone()]);
    const line = new THREE.Line(geo, this.tracerMat);
    line.userData.life = 0.07;
    this.tracers.push(line);
    this._tracerScene.add(line);
  }
  attachTracers(scene) { this._tracerScene = scene; }
  updateTracers(dt) {
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i];
      t.userData.life -= dt;
      t.material.opacity = Math.max(0, t.userData.life / 0.07);
      if (t.userData.life <= 0) {
        this._tracerScene.remove(t);
        t.geometry.dispose();
        this.tracers.splice(i, 1);
      }
    }
    this.muzzle.intensity = Math.max(0, this.muzzle.intensity - dt * 300);
  }

  punch(world) {
    if (this.punchCd > 0 || this.inCar) return;
    this.punchCd = 0.45;
    world.audio.punch();
    const fx = Math.sin(this.heading), fz = Math.cos(this.heading);
    const dmg = weaponDef('fists').dmg;
    for (const p of world.people) {
      if (p.dead || p.kind === 'player') continue;
      const dx = p.x - this.x, dz = p.z - this.z;
      const d = Math.hypot(dx, dz);
      if (d < 2.4 && dx * fx + dz * fz > 0) {
        const killed = damagePerson(p, dmg);
        p.x += fx * 0.8; p.z += fz * 0.8;
        world.onPersonShot(p, killed, dmg);
        break;
      }
    }
  }

  // --- per-frame update on foot ---
  updateOnFoot(dt, world, cameraYaw) {
    const input = world.input;
    const ax = input.axes();
    const running = input.down('ShiftLeft') || input.down('ShiftRight');
    const targetSpeed = running ? 7.2 : 4.1;
    // Movement is relative to the camera yaw.
    let mx = 0, mz = 0;
    if (ax.y !== 0 || ax.x !== 0) {
      const sy = Math.sin(cameraYaw), cy = Math.cos(cameraYaw);
      mx = sy * ax.y + cy * ax.x;
      mz = cy * ax.y - sy * ax.x;
      const len = Math.hypot(mx, mz);
      mx /= len; mz /= len;
    }
    const want = Math.hypot(ax.x, ax.y) > 0 ? targetSpeed : 0;
    this.speed += clamp(want - this.speed, -30 * dt, 18 * dt);
    if (this.speed > 0.1) this.heading = Math.atan2(mx, mz);
    this.x += mx * this.speed * dt;
    this.z += mz * this.speed * dt;
    const hit = world.city.resolveCircle(this.x, this.z, 0.5);
    this.x = hit.x; this.z = hit.z;
    // Jump / gravity.
    if (input.pressed('Space') && this.y <= 0.01) this.vy = 6.2;
    this.vy -= 16 * dt;
    this.y = Math.max(0, this.y + this.vy * dt);
    if (this.y === 0) this.vy = 0;
    // Aim: face the camera direction when firing or aiming with mouse held.
    if (input.mouseDown || this.fireCd > 0.3) {
      this.heading = cameraYaw;
    }
    // Walk-cycle animation.
    const u = this.mesh.userData;
    u.walkPhase = (u.walkPhase || 0) + this.speed * dt * 2.2;
    const sw = Math.sin(u.walkPhase) * (this.speed > 0.1 ? 0.55 : 0);
    u.legL.rotation.x = sw; u.legR.rotation.x = -sw;
    const aiming = input.mouseDown && this.weaponId !== 'fists';
    u.armR.rotation.x = aiming ? -1.5 : -sw * 0.6;
    u.armL.rotation.x = aiming ? -1.5 : sw * 0.6;
    this.mesh.position.set(this.x, this.y, this.z);
    this.mesh.rotation.y = this.heading;
    // Timers.
    this.fireCd = Math.max(0, this.fireCd - dt);
    this.punchCd = Math.max(0, this.punchCd - dt);
    if (this.reloadTimer > 0) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) this._finishReload();
    }
    // Slow health regen out of combat.
    const now = performance.now() / 1000;
    if (now - this.lastDamageAt > REGEN_DELAY && this.hp > 0 && this.hp < 100) {
      this.hp = Math.min(100, this.hp + REGEN_RATE * dt);
    }
    for (const k of Object.keys(this.crewCd)) this.crewCd[k] = Math.max(0, this.crewCd[k] - dt);
    this.updateTracers(dt);
  }
}

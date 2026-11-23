// Wanted level & PBPD response: heat, stars, pursuit cars, foot cops, the AIR-1
// helicopter with its spotlight, roadblocks, and the search that lets you cool off.
import * as THREE from 'three';
import { createCar, steerToward, moveCar } from './vehicles.js';
import { createPerson, updateFighter } from './people.js';
import { pick, range, clamp } from './random.js';

const UNIT_NAMES = ['TARPON', 'GECKO', 'PELICAN', 'BARRACUDA', 'CORAL', 'MARLIN', 'TIDE', 'AZUL', 'REEF', 'DUNE'];
const STAR_HEAT = [0, 12, 32, 52, 72, 90];
const UNITS_FOR_STARS = [0, 2, 3, 4, 6, 8];
// Sight ranges: a cruiser spots you from further than a cop on foot.
const SIGHT_CAR = 62;
const SIGHT_FOOT = 42;
const HIDE_DELAY = 3; // seconds unseen before the state flips to "search"
const _coneUp = new THREE.Vector3(0, 1, 0);
const _coneDir = new THREE.Vector3();

function makeHeliMesh() {
  const g = new THREE.Group();
  const mat = (c, e = 0) => new THREE.MeshLambertMaterial({ color: c, emissive: e });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.6, 4.2), mat(0x1e3a5f));
  body.position.y = 0; body.castShadow = true;
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 4.5), mat(0x1e3a5f));
  tail.position.set(0, 0.3, -3.8);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.9, 1.4), mat(0x9fd8ff));
  glass.position.set(0, 0.2, 1.6);
  const skidL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 3.4), mat(0x111827));
  skidL.position.set(-0.9, -1.1, 0.2);
  const skidR = skidL.clone(); skidR.position.x = 0.9;
  const rotor = new THREE.Mesh(new THREE.BoxGeometry(9, 0.08, 0.5), mat(0x111827));
  rotor.position.y = 1.1;
  const tailRotor = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.2, 0.4), mat(0x111827));
  tailRotor.position.set(0.35, 0.4, -5.8);
  // Spotlight cone, additive so it reads at dusk.
  const cone = new THREE.Mesh(
    new THREE.ConeGeometry(7, 42, 20, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.13, side: THREE.DoubleSide, depthWrite: false }),
  );
  cone.position.y = -21;
  cone.rotation.x = Math.PI;
  g.add(body, tail, glass, skidL, skidR, rotor, tailRotor, cone);
  g.userData = { rotor, tailRotor, cone };
  return g;
}

export class PoliceSystem {
  constructor(scene, city, rng) {
    this.scene = scene; this.city = city; this.rng = rng;
    this.heat = 0;
    this.wanted = 0;
    this.state = 'clear'; // clear | sight | search
    this.unseenTimer = 0;
    this.searchTimer = 0;
    this.lastSeen = { x: 0, z: 0 };
    this.units = [];      // police cars (also in world.cars)
    this.footCops = [];   // people with kind 'cop'
    this.heli = null;
    this.heliMesh = null;
    this.roadblocks = [];
    this.spawnCd = 0;
    this.unitCounter = 0;
    this.flashT = 0;
  }

  stars() { return this.wanted; }

  addHeat(amount, world) {
    const before = this.wanted;
    this.heat = clamp(this.heat + amount, 0, 100);
    this._recalcStars();
    if (this.wanted > before && world) {
      world.hud.flashWanted(this.wanted);
      world.audio.blip(660, 0.15, 'square', 0.15);
      setTimeout(() => world.audio.blip(880, 0.15, 'square', 0.15), 140);
    }
  }
  // Cool the heat down (crew abilities, respray) and re-derive the stars.
  shedHeat(amount) {
    this.heat = Math.max(0, this.heat - amount);
    this._recalcStars();
  }
  _recalcStars() {
    let s = 0;
    for (let i = 5; i >= 1; i--) if (this.heat >= STAR_HEAT[i]) { s = i; break; }
    this.wanted = s;
  }
  clearAll(world) {
    this.heat = 0; this.wanted = 0; this.state = 'clear';
    this.unseenTimer = 0; this.searchTimer = 0;
    if (world) world.player.stats.starsLost += 1;
  }

  _spawnUnit(world) {
    const p = world.playerPos();
    // Spawn on a road node 70–130 m away, off the player's view where possible.
    let node = null;
    for (let tries = 0; tries < 12 && !node; tries++) {
      const n = pick(this.rng, this.city.graph.nodes);
      const d = Math.hypot(n.x - p.x, n.z - p.z);
      if (d > 70 && d < 140) node = n;
    }
    if (!node) node = pick(this.rng, this.city.graph.nodes);
    const car = createCar('cruiser', node.x, node.z, this.rng() * Math.PI * 2, 0xf1f5f9, this.rng);
    car.ai = { kind: 'police', target: null };
    car.unitName = pick(this.rng, UNIT_NAMES) + '-' + (10 + Math.floor(this.rng() * 89));
    car.unitRole = 'PURSUE';
    this.scene.add(car.mesh);
    this.units.push(car);
    world.cars.push(car);
    return car;
  }

  _spawnFootCop(world) {
    const p = world.playerPos();
    const a = this.rng() * Math.PI * 2;
    const x = p.x + Math.sin(a) * 26, z = p.z + Math.cos(a) * 26;
    const cop = createPerson('cop', x, z, this.rng, { shirt: 0x1d4ed8, pants: 0x1e293b, cap: 0x1d4ed8, vest: true });
    cop.unitName = 'FOOT ×1';
    this.scene.add(cop.mesh);
    this.footCops.push(cop);
    world.people.push(cop);
    return cop;
  }

  _spawnHeli(world) {
    if (this.heliMesh) return;
    const mesh = makeHeliMesh();
    const p = world.playerPos();
    mesh.position.set(p.x, 42, p.z - 30);
    this.scene.add(mesh);
    // The spotlight cone lives in the scene, not the spinning heli group, so
    // its world-space aim below is not swept around by the rotor yaw.
    this.scene.add(mesh.userData.cone);
    this.heliMesh = mesh;
    this.heli = { name: 'AIR-1', role: 'SPOTLIGHT', x: p.x, z: p.z };
  }

  _removeHeli() {
    if (!this.heliMesh) return;
    this.scene.remove(this.heliMesh.userData.cone);
    this.scene.remove(this.heliMesh);
    this.heliMesh = null; this.heli = null;
  }

  _spawnRoadblock(world) {
    const p = world.playerPos();
    const car = world.playerCar;
    const heading = car ? car.heading : world.player.heading;
    const fx = Math.sin(heading), fz = Math.cos(heading);
    const cx = p.x + fx * 55, cz = p.z + fz * 55;
    for (const side of [-1, 1]) {
      const px = cx - fz * side * 4, pz = cz + fx * side * 4;
      const rb = createCar('cruiser', px, pz, heading + Math.PI / 2, 0xf1f5f9, this.rng);
      rb.ai = { kind: 'roadblock' };
      rb.unitName = 'BULWARK ' + (1 + Math.floor(this.rng() * 8));
      rb.unitRole = 'ROADBLOCK';
      rb.roadblockTimer = 26;
      this.scene.add(rb.mesh);
      this.units.push(rb);
      world.cars.push(rb);
      this.roadblocks.push(rb);
    }
    world.hud.notify('PBPD roadblock ahead — find another way!', 'bad');
  }

  // Is any unit close enough to see the player? The heli always sees you.
  _isPlayerSeen(p) {
    for (const u of this.units) {
      if (Math.hypot(u.x - p.x, u.z - p.z) < SIGHT_CAR) return true;
    }
    for (const c of this.footCops) {
      if (!c.dead && Math.hypot(c.x - p.x, c.z - p.z) < SIGHT_FOOT) return true;
    }
    return !!this.heli;
  }

  // Grow the response toward what the current wanted level calls for.
  _maintainStrength(world) {
    const wantUnits = UNITS_FOR_STARS[this.wanted];
    if (this.units.length < wantUnits) this._spawnUnit(world);
    else if (this.wanted >= 2 && this.footCops.filter((c) => !c.dead).length < this.wanted - 1) this._spawnFootCop(world);
    if (this.wanted >= 3 && !this.heli) this._spawnHeli(world);
    if (this.wanted >= 4 && this.roadblocks.length === 0 && this.rng() < 0.4) this._spawnRoadblock(world);
    this.spawnCd = 2.2;
  }

  update(dt, world) {
    const p = world.playerPos();
    const player = world.player;
    this.flashT += dt;
    // Light bars flash.
    for (const u of this.units) {
      const bar = u.mesh.userData.lightBar;
      if (bar) {
        const on = Math.floor(this.flashT * 6) % 2 === 0;
        bar.children[0].material.emissive.setHex(on ? 0xef4444 : 0x330000);
        bar.children[1].material.emissive.setHex(on ? 0x111133 : 0x3b82f6);
      }
    }
    // --- visibility: any unit close, or the heli overhead ---
    const seen = this._isPlayerSeen(p);
    if (seen) {
      this.unseenTimer = 0;
      this.lastSeen = { x: p.x, z: p.z };
      if (this.wanted > 0) this.state = 'sight';
    } else {
      this.unseenTimer += dt;
      if (this.wanted > 0 && this.unseenTimer > HIDE_DELAY) this.state = 'search';
    }
    // --- heat decay when hidden ---
    if (this.wanted > 0 && !seen && this.unseenTimer > HIDE_DELAY) {
      this.heat -= dt * (this.wanted <= 2 ? 7 : 4.5);
      if (this.heat <= 0) { this.clearAll(world); world.hud.notify('You lost them. The heat is off — for now.', 'good'); }
      else this._recalcStars();
    }
    // --- spawn to strength ---
    this.spawnCd -= dt;
    if (this.wanted > 0 && this.spawnCd <= 0) this._maintainStrength(world);
    if (this.wanted < 3) this._removeHeli();
    // --- police car pursuit ---
    for (let i = this.units.length - 1; i >= 0; i--) {
      const u = this.units[i];
      if (u.dead || u.cond <= 0) {
        if (!u.burning) { u.burning = true; u.burnTime = 0; world.onCarBurning(u); }
        continue;
      }
      if (u.ai.kind === 'roadblock') {
        u.roadblockTimer -= dt;
        if (u.roadblockTimer <= 0 || Math.hypot(u.x - p.x, u.z - p.z) < 8) {
          u.ai.kind = 'police'; // joins the chase
          const rb = this.roadblocks.indexOf(u);
          if (rb >= 0) this.roadblocks.splice(rb, 1);
        }
        continue;
      }
      // Predict where the player will be, aim there; ram when close.
      const lead = 0.6;
      const px = p.x + (world.playerVel ? world.playerVel.x * lead : 0);
      const pz = p.z + (world.playerVel ? world.playerVel.z * lead : 0);
      const d = steerToward(u, px, pz, dt, u.spec.top * (this.wanted >= 4 ? 1.06 : 0.98), true);
      u.unitRole = d < 12 ? 'RAMMING' : d < 30 ? 'CLOSING IN' : 'PURSUE';
      moveCar(u, dt, this.city, null);
      // If the player is on foot and a cruiser gets close, a cop gets out.
      if (!world.player.inCar && d < 9 && this.footCops.filter((c) => !c.dead).length < 3 && this.rng() < dt * 0.25) {
        this._spawnFootCop(world);
      }
    }
    // --- foot cops fight ---
    for (let i = this.footCops.length - 1; i >= 0; i--) {
      const c = this.footCops[i];
      if (c.dead) continue;
      const shot = updateFighter(c, dt, p, this.city, true);
      if (shot) world.onEnemyShot(shot, c);
    }
    // --- helicopter follows, spotlight tracks the player ---
    if (this.heliMesh) {
      const h = this.heliMesh;
      const tx = p.x + 14, tz = p.z - 18;
      h.position.x += (tx - h.position.x) * Math.min(1, dt * 0.8);
      h.position.z += (tz - h.position.z) * Math.min(1, dt * 0.8);
      h.position.y = 42 + Math.sin(performance.now() / 900) * 1.5;
      h.rotation.y += dt * 0.25;
      h.userData.rotor.rotation.y += dt * 22;
      h.userData.tailRotor.rotation.x += dt * 18;
      this.heli.x = h.position.x; this.heli.z = h.position.z;
      // Spotlight cone: narrow at the heli, wide pool of light on the ground
      // at the player. Apex is the cone's local +Y, aimed from the player's
      // ground point up at the heli and stretched so the beam spans exactly
      // heli -> player. (The old code called lookAt and then overwrote
      // rotation.x with pi/2 + atan2(dz, 40) — measured from the horizontal,
      // so the beam pointed at the road well behind the player.)
      const cone = h.userData.cone;
      const dx = h.position.x - p.x, dz = h.position.z - p.z;
      const len = Math.hypot(dx, 42, dz);
      cone.position.set((h.position.x + p.x) / 2, 21, (h.position.z + p.z) / 2);
      cone.scale.set(1, len / 42, 1);
      _coneDir.set(dx, 42, dz).normalize();
      cone.quaternion.setFromUnitVectors(_coneUp, _coneDir);
    }
    // --- prune burnt-out units ---
    for (let i = this.units.length - 1; i >= 0; i--) {
      const u = this.units[i];
      if (u.burning) {
        u.burnTime += dt;
        if (u.burnTime > 6) {
          this.scene.remove(u.mesh);
          const wi = world.cars.indexOf(u);
          if (wi >= 0) world.cars.splice(wi, 1);
          this.units.splice(i, 1);
        }
      }
    }
  }

  // Dispatch panel rows for the HUD.
  dispatchRows(world) {
    const rows = [];
    const p = world.playerPos();
    for (const u of this.units) {
      if (u.dead) continue;
      rows.push({
        name: u.unitName || 'PBPD UNIT',
        dist: Math.round(Math.hypot(u.x - p.x, u.z - p.z)) + ' m',
        role: u.unitRole || 'PURSUE',
        cls: u.unitRole === 'RAMMING' ? '' : u.unitRole === 'ROADBLOCK' ? 'amber' : u.unitRole === 'SPOTLIGHT' ? 'blue' : 'grey',
      });
    }
    if (this.heli) rows.push({ name: 'AIR-1', dist: Math.round(Math.hypot(this.heli.x - p.x, this.heli.z - p.z)) + ' m', role: 'SPOTLIGHT', cls: 'blue' });
    for (const c of this.footCops) {
      if (c.dead) continue;
      rows.push({ name: 'FOOT ×1', dist: Math.round(Math.hypot(c.x - p.x, c.z - p.z)) + ' m', role: 'FOOT CHASE', cls: 'grey' });
    }
    return rows.slice(0, 6);
  }
}

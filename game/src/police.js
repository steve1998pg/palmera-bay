// Police & wanted: heat 0..100, stars from heat, cruiser units that chase
// along the road graph, foot cops, the AIR-1 helicopter with a spotlight,
// roadblocks at high wanted, and the "sight / search" visibility model.
import * as THREE from '../vendor/three.module.min.js';
import { UNIT_NAMES } from './config.js';
import { clamp, angleDiff, wrapAngle } from './random.js';
import { spawnCar, driveCar } from './vehicles.js';

export function wantedFromHeat(heat) {
  if (heat >= 90) return 5;
  if (heat >= 72) return 4;
  if (heat >= 52) return 3;
  if (heat >= 32) return 2;
  if (heat >= 12) return 1;
  return 0;
}

export function unitsForStars(stars) {
  return [0, 2, 3, 4, 6, 8][stars] || 0;
}

export function makePolice(W) {
  const P = {
    heat: 0, wanted: 0, state: 'clear',
    units: [], footCops: [], heli: null,
    unseenFor: 0, roadblockAt: 0, roadblockCars: [],
    unitCounter: 0, lastStars: 0,
  };

  function unitName() {
    P.unitCounter++;
    const base = UNIT_NAMES[(P.unitCounter - 1) % UNIT_NAMES.length];
    const num = 10 + ((P.unitCounter * 37) % 89);
    return base + '-' + num;
  }

  function spawnUnit() {
    const pp = W.playerPos();
    // Spawn on a road node 70-140 m away.
    let node = null, tries = 0;
    while (tries++ < 40) {
      const cand = W.city.graph.nodes[Math.floor(Math.random() * W.city.graph.nodes.length)];
      const d = Math.hypot(cand.x - pp.x, cand.z - pp.z);
      if (d >= 70 && d <= 140) { node = cand; break; }
    }
    if (!node) node = W.city.graph.nodeAt(pp.x + 100, pp.z);
    const car = spawnCar(W, 'cruiser', node.x, node.z, Math.random() * Math.PI * 2, {
      ai: 'police', unitName: unitName(), unitRole: 'PURSUE',
    });
    P.units.push(car);
    return car;
  }

  function removeUnit(car) {
    const i = P.units.indexOf(car);
    if (i >= 0) P.units.splice(i, 1);
    if (car.heliRef) car.heliRef = null;
  }
  P.removeUnit = removeUnit;

  P.addHeat = function (amount) {
    P.heat = clamp(P.heat + amount, 0, 100);
  };

  P.setHeat = function (v) {
    P.heat = clamp(v, 0, 100);
  };

  // Keep the live unit count matched to the wanted level.
  P.syncUnits = function () {
    const want = unitsForStars(P.wanted);
    const alive = P.units.filter((u) => !u.dead);
    while (alive.length < want) {
      const u = spawnUnit();
      alive.push(u);
    }
    // Extra units beyond the wanted level drive off and despawn.
    if (alive.length > want) {
      for (let i = want; i < alive.length; i++) {
        const u = alive[i];
        if (!u.leaving) {
          u.leaving = true;
          u.leaveAt = W.now + 6;
        }
      }
    }
    for (const u of [...P.units]) {
      if (u.leaving && W.now > u.leaveAt) {
        removeUnit(u);
        // Remove the car mesh from the world as well.
        const ci = W.cars.indexOf(u);
        if (ci >= 0) { W.scene.remove(u.mesh); W.cars.splice(ci, 1); }
      }
    }
  };

  // One police cruiser: follow the graph toward the player, ram up close.
  function updateUnit(u, dt, now) {
    if (u.dead || u.burning) return;
    const pp = W.playerPos();
    const px = pp.x + (W.playerVel.x || 0) * 0.6;
    const pz = pp.z + (W.playerVel.z || 0) * 0.6;
    const d = Math.hypot(pp.x - u.x, pp.z - u.z);
    u.unitRole = d < 12 ? 'RAMMING' : d < 30 ? 'CLOSING IN' : 'PURSUE';
    if (d < 12) {
      // Ram straight at the player.
      const wantH = Math.atan2(pp.x - u.x, pp.z - u.z);
      const diff = angleDiff(wantH, u.heading);
      driveCar(W, u, { throttle: 1, steer: diff > 0.15 ? 1 : diff < -0.15 ? -1 : 0, nitro: false }, dt);
    } else {
      if (!u.path || u.pathIdx >= u.path.length || now > u.repathAt) {
        // BFS over the road graph to the player's nearest node.
        const g = W.city.graph;
        const start = g.nodeAt(u.x, u.z);
        const goal = g.nodeAt(px, pz);
        const prev = new Map();
        const q = [start];
        prev.set(start, null);
        while (q.length) {
          const n = q.shift();
          if (n === goal) break;
          for (const m of g.neighbors(n)) {
            if (!prev.has(m)) { prev.set(m, n); q.push(m); }
          }
        }
        if (prev.has(goal)) {
          const path = [];
          let cur = goal;
          while (cur) { path.unshift(cur); cur = prev.get(cur); }
          u.path = path; u.pathIdx = 0;
        } else {
          u.path = [goal]; u.pathIdx = 0;
        }
        u.repathAt = now + 3;
      }
      const wp = u.path[Math.min(u.pathIdx, u.path.length - 1)];
      const wd = Math.hypot(wp.x - u.x, wp.z - u.z);
      if (wd < 8) u.pathIdx++;
      else {
        const wantH = Math.atan2(wp.x - u.x, wp.z - u.z);
        const diff = angleDiff(wantH, u.heading);
        driveCar(W, u, { throttle: 1, steer: diff > 0.15 ? 1 : diff < -0.15 ? -1 : 0, nitro: false }, dt);
      }
    }
    // A foot cop climbs out when the player is on foot and the cruiser is close.
    if (P.wanted >= 2 && !W.player.inCar && d < 9 && !u.droppedCop) {
      u.droppedCop = true;
      const cop = W.spawnPerson('cop', u.x + 2, u.z + 2, {});
      P.footCops.push(cop);
    }
  }

  function updateHeli(dt, now) {
    const pp = W.playerPos();
    if (P.wanted >= 3) {
      if (!P.heli) {
        const grp = new THREE.Group();
        const body = new THREE.Mesh(
          new THREE.BoxGeometry(3.4, 1.4, 6),
          new THREE.MeshLambertMaterial({ color: 0x223344 })
        );
        grp.add(body);
        const rotor = new THREE.Mesh(
          new THREE.BoxGeometry(9, 0.12, 0.6),
          new THREE.MeshLambertMaterial({ color: 0x111111 })
        );
        rotor.position.y = 1;
        grp.add(rotor);
        const cone = new THREE.Mesh(
          new THREE.ConeGeometry(9, 42, 16, 1, true),
          new THREE.MeshBasicMaterial({ color: 0xfff6c8, transparent: true, opacity: 0.16, side: THREE.DoubleSide })
        );
        cone.position.y = -21;
        grp.add(cone);
        grp.userData.rotor = rotor;
        grp.userData.cone = cone;
        grp.position.set(pp.x + 40, 46, pp.z - 30);
        W.scene.add(grp);
        P.heli = { name: 'AIR-1', x: grp.position.x, z: grp.position.z, mesh: grp };
      }
      const h = P.heli;
      // Hover ahead of the player and track them.
      const tx = pp.x + (W.playerVel.x || 0) * 2;
      const tz = pp.z + (W.playerVel.z || 0) * 2;
      h.mesh.position.x += (tx - h.mesh.position.x) * 0.4 * dt + Math.sin(now * 0.7) * 0.4 * dt;
      h.mesh.position.z += (tz - h.mesh.position.z) * 0.4 * dt + Math.cos(now * 0.5) * 0.4 * dt;
      h.mesh.position.y = 46 + Math.sin(now * 0.9) * 1.5;
      h.mesh.userData.rotor.rotation.y += dt * 18;
      h.x = h.mesh.position.x; h.z = h.mesh.position.z;
      // Spotlight cone: from the heli to the player, centred between them,
      // aimed with a quaternion from +Y toward the heli->player direction.
      const cone = h.mesh.userData.cone;
      const dir = new THREE.Vector3(pp.x - h.x, -h.mesh.position.y, pp.z - h.z).normalize();
      // The cone is a child of the (unrotated) heli group, so its local
      // position is just the world midpoint minus the heli position.
      cone.position.set((pp.x - h.x) / 2, -h.mesh.position.y / 2, (pp.z - h.z) / 2);
      const up = new THREE.Vector3(0, 1, 0);
      cone.quaternion.setFromUnitVectors(up, dir.clone().negate());
    } else if (P.heli) {
      W.scene.remove(P.heli.mesh);
      P.heli = null;
    }
  }

  function updateRoadblock(dt, now) {
    if (P.wanted >= 4 && now > P.roadblockAt) {
      P.roadblockAt = now + 26;
      const pp = W.playerPos();
      const fx = Math.sin(W.player.heading), fz = Math.cos(W.player.heading);
      for (const side of [-1, 1]) {
        const bx = pp.x + fx * 55 + (-fz) * side * 5;
        const bz = pp.z + fz * 55 + fx * side * 5;
        const car = spawnCar(W, 'cruiser', bx, bz, W.player.heading + Math.PI / 2, {
          ai: 'roadblock', unitName: unitName(), unitRole: 'ROADBLOCK',
        });
        P.units.push(car);
        P.roadblockCars.push(car);
      }
      W.notify('ROADBLOCK AHEAD');
    }
  }

  P.update = function (dt, now) {
    const pp = W.playerPos();
    const prevWanted = P.wanted;
    P.wanted = wantedFromHeat(P.heat);
    // Visibility: a cruiser within 62 m, a foot cop within 42 m, or the heli.
    let seen = !!P.heli;
    if (!seen) {
      for (const u of P.units) {
        if (!u.dead && Math.hypot(u.x - pp.x, u.z - pp.z) < 62) { seen = true; break; }
      }
    }
    if (!seen) {
      for (const c of P.footCops) {
        if (!c.dead && Math.hypot(c.x - pp.x, c.z - pp.z) < 42) { seen = true; break; }
      }
    }
    if (seen) {
      P.state = 'sight';
      P.unseenFor = 0;
    } else {
      P.unseenFor += dt;
      if (P.unseenFor > 3) {
        P.state = 'search';
        const rate = P.wanted >= 3 ? 4.5 : 7;
        const before = P.heat;
        P.heat = Math.max(0, P.heat - rate * dt);
        P.wanted = wantedFromHeat(P.heat);
        if (before > 0 && P.heat === 0 && prevWanted > 0) {
          W.player.stats.starsLost++;
          W.notify('You lost them');
        }
      }
    }
    P.syncUnits();
    for (const u of [...P.units]) updateUnit(u, dt, now);
    updateHeli(dt, now);
    updateRoadblock(dt, now);
    // Foot cops: keep at most wanted-1 alive.
    const maxCops = Math.max(0, P.wanted - 1);
    const liveCops = P.footCops.filter((c) => !c.dead);
    if (liveCops.length < maxCops && P.wanted >= 2) {
      const cop = W.spawnPerson('cop', pp.x + 26, pp.z + 18, {});
      P.footCops.push(cop);
    }
    P.footCops = P.footCops.filter((c) => !c.dead || W.now - c.deathAt < 14);
    if (P.wanted !== prevWanted) {
      if (P.wanted > prevWanted) W.flashWanted();
    }
  };

  P.clearAll = function () {
    for (const u of [...P.units]) {
      const i = W.cars.indexOf(u);
      if (i >= 0) { W.scene.remove(u.mesh); W.cars.splice(i, 1); }
    }
    P.units = [];
    P.roadblockCars = [];
    for (const c of [...P.footCops]) {
      const i = W.people.indexOf(c);
      if (i >= 0) { W.scene.remove(c.mesh); W.people.splice(i, 1); }
    }
    P.footCops = [];
    if (P.heli) { W.scene.remove(P.heli.mesh); P.heli = null; }
    P.heat = 0; P.wanted = 0; P.state = 'clear'; P.unseenFor = 0;
  };

  return P;
}

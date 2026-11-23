// Police & wanted: heat 0..100, stars from heat, cruiser units that chase
// along the road graph, foot cops, the AIR-1 helicopter with a spotlight,
// roadblocks at high wanted, and the "sight / search" visibility model.
import * as THREE from '../vendor/three.module.min.js';
import { UNIT_NAMES } from './config.js';
import { clamp, angleDiff } from './random.js';
import { spawnCar, driveCar, carAheadBlocked } from './vehicles.js';

const STAR_FLOORS = [90, 72, 52, 32, 12];
const UNITS_PER_STAR = [0, 2, 3, 4, 6, 8];
const SIGHT_CRUISE_M = 62;
const SIGHT_FOOT_M = 42;
const SPAWN_MIN_M = 70;
const SPAWN_MAX_M = 140;

export function wantedFromHeat(heat) {
  for (let i = 0; i < STAR_FLOORS.length; i++) {
    if (heat >= STAR_FLOORS[i]) return 5 - i;
  }
  return 0;
}

export function unitsForStars(stars) {
  return UNITS_PER_STAR[stars] || 0;
}

// Breadth-first route over the road graph, from `from` to `to` (nodes).
function findRoute(graph, from, to) {
  const prev = new Map([[from, null]]);
  const queue = [from];
  while (queue.length) {
    const n = queue.shift();
    if (n === to) break;
    for (const m of graph.neighbors(n)) {
      if (prev.has(m)) continue;
      prev.set(m, n);
      queue.push(m);
    }
  }
  if (!prev.has(to)) return [to];
  const path = [];
  for (let cur = to; cur; cur = prev.get(cur)) path.unshift(cur);
  return path;
}

function steerToward(car, tx, tz) {
  const diff = angleDiff(Math.atan2(tx - car.x, tz - car.z), car.heading);
  return diff > 0.15 ? 1 : diff < -0.15 ? -1 : 0;
}

function driveToward(W, car, tx, tz, dt) {
  // A cruiser rams the player's driven car, but it does not grind a parked
  // car to scrap: with another car directly ahead (a parked coupe, a
  // traffic car, a fellow cruiser) it lifts off the throttle and steers
  // around instead of holding full throttle into the obstacle. Without
  // this, three cruisers converging on a player on foot destroy the
  // player's parked car in seconds — the car is between them and the
  // player, and every frame of contact deals collision damage.
  const blocked = carAheadBlocked(W, car, W.player.inCar);
  driveCar(W, car, { throttle: blocked ? 0 : 1, steer: steerToward(car, tx, tz), nitro: false }, dt);
}

export function makePolice(W) {
  const P = {
    heat: 0, wanted: 0, state: 'clear',
    units: [], footCops: [], heli: null,
    unseenFor: 0, roadblockAt: 0, roadblockCars: [],
    unitCounter: 0, lastStars: 0,
  };

  function nextUnitName() {
    P.unitCounter += 1;
    const base = UNIT_NAMES[(P.unitCounter - 1) % UNIT_NAMES.length];
    const num = 10 + ((P.unitCounter * 37) % 89);
    return base + '-' + num;
  }

  function pickSpawnNode(pp) {
    for (let tries = 0; tries < 40; tries++) {
      const cand = W.city.graph.nodes[Math.floor(Math.random() * W.city.graph.nodes.length)];
      const d = Math.hypot(cand.x - pp.x, cand.z - pp.z);
      if (d >= SPAWN_MIN_M && d <= SPAWN_MAX_M) return cand;
    }
    return W.city.graph.nodeAt(pp.x + 100, pp.z);
  }

  function spawnUnit() {
    const node = pickSpawnNode(W.playerPos());
    const car = spawnCar(W, 'cruiser', node.x, node.z, Math.random() * Math.PI * 2, {
      ai: 'police', unitName: nextUnitName(), unitRole: 'PURSUE',
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

  function retireExtraUnits(alive, want) {
    for (let i = want; i < alive.length; i++) {
      const u = alive[i];
      if (u.leaving) continue;
      u.leaving = true;
      u.leaveAt = W.now + 6;
    }
    for (const u of [...P.units]) {
      if (!u.leaving || W.now <= u.leaveAt) continue;
      removeUnit(u);
      // Remove the car mesh from the world as well.
      const ci = W.cars.indexOf(u);
      if (ci >= 0) {
        W.scene.remove(u.mesh);
        W.cars.splice(ci, 1);
      }
    }
  }

  // Keep the live unit count matched to the wanted level.
  P.syncUnits = function () {
    const want = unitsForStars(P.wanted);
    const alive = P.units.filter((u) => !u.dead);
    while (alive.length < want) alive.push(spawnUnit());
    if (alive.length > want) retireExtraUnits(alive, want);
  };

  function chaseAlongGraph(W2, u, dt, now, px, pz) {
    if (!u.path || u.pathIdx >= u.path.length || now > u.repathAt) {
      const g = W2.city.graph;
      u.path = findRoute(g, g.nodeAt(u.x, u.z), g.nodeAt(px, pz));
      u.pathIdx = 0;
      u.repathAt = now + 3;
    }
    const wp = u.path[Math.min(u.pathIdx, u.path.length - 1)];
    const wd = Math.hypot(wp.x - u.x, wp.z - u.z);
    if (wd < 8) u.pathIdx++;
    else driveToward(W2, u, wp.x, wp.z, dt);
  }

  // One police cruiser: follow the graph toward the player, ram up close.
  function updateUnit(u, dt, now) {
    if (u.dead || u.burning) return;
    const pp = W.playerPos();
    const px = pp.x + (W.playerVel.x || 0) * 0.6;
    const pz = pp.z + (W.playerVel.z || 0) * 0.6;
    const d = Math.hypot(pp.x - u.x, pp.z - u.z);
    u.unitRole = d < 12 ? 'RAMMING' : d < 30 ? 'CLOSING IN' : 'PURSUE';
    if (d < 12) driveToward(W, u, pp.x, pp.z, dt);
    else chaseAlongGraph(W, u, dt, now, px, pz);
    // A foot cop climbs out when the player is on foot and the cruiser is close.
    // The drop point is pushed out of any building first, so the cop never
    // spawns inside a wall.
    if (P.wanted >= 2 && !W.player.inCar && d < 9 && !u.droppedCop) {
      u.droppedCop = true;
      const drop = W.city.resolveCircle(u.x + 2, u.z + 2, 0.6);
      P.footCops.push(W.spawnPerson('cop', drop.x, drop.z, {}));
    }
  }

  function buildHeli() {
    const grp = new THREE.Group();
    grp.add(new THREE.Mesh(
      new THREE.BoxGeometry(3.4, 1.4, 6),
      new THREE.MeshLambertMaterial({ color: 0x223344 })
    ));
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
    const pp = W.playerPos();
    grp.position.set(pp.x + 40, 46, pp.z - 30);
    W.scene.add(grp);
    P.heli = { name: 'AIR-1', x: grp.position.x, z: grp.position.z, mesh: grp };
  }

  function updateHeli(dt, now) {
    if (P.wanted < 3) {
      if (P.heli) {
        W.scene.remove(P.heli.mesh);
        P.heli = null;
      }
      return;
    }
    if (!P.heli) buildHeli();
    const h = P.heli;
    const pp = W.playerPos();
    // Hover ahead of the player and track them.
    const tx = pp.x + (W.playerVel.x || 0) * 2;
    const tz = pp.z + (W.playerVel.z || 0) * 2;
    h.mesh.position.x += (tx - h.mesh.position.x) * 0.4 * dt + Math.sin(now * 0.7) * 0.4 * dt;
    h.mesh.position.z += (tz - h.mesh.position.z) * 0.4 * dt + Math.cos(now * 0.5) * 0.4 * dt;
    h.mesh.position.y = 46 + Math.sin(now * 0.9) * 1.5;
    h.mesh.userData.rotor.rotation.y += dt * 18;
    h.x = h.mesh.position.x;
    h.z = h.mesh.position.z;
    // Spotlight cone: from the heli to the player, centred between them,
    // aimed with a quaternion from +Y toward the heli->player direction.
    const cone = h.mesh.userData.cone;
    const dir = new THREE.Vector3(pp.x - h.x, -h.mesh.position.y, pp.z - h.z).normalize();
    // The cone is a child of the (unrotated) heli group, so its local
    // position is just the world midpoint minus the heli position.
    cone.position.set((pp.x - h.x) / 2, -h.mesh.position.y / 2, (pp.z - h.z) / 2);
    cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().negate());
  }

  function updateRoadblock(now) {
    if (P.wanted < 4 || now <= P.roadblockAt) return;
    P.roadblockAt = now + 26;
    const pp = W.playerPos();
    const fx = Math.sin(W.player.heading);
    const fz = Math.cos(W.player.heading);
    for (const side of [-1, 1]) {
      const car = spawnCar(W, 'cruiser',
        pp.x + fx * 55 + (-fz) * side * 5,
        pp.z + fz * 55 + fx * side * 5,
        W.player.heading + Math.PI / 2,
        { ai: 'roadblock', unitName: nextUnitName(), unitRole: 'ROADBLOCK' });
      P.units.push(car);
      P.roadblockCars.push(car);
    }
    W.notify('ROADBLOCK AHEAD');
  }

  function seenByAnyone(pp) {
    if (P.heli) return true;
    for (const u of P.units) {
      if (!u.dead && Math.hypot(u.x - pp.x, u.z - pp.z) < SIGHT_CRUISE_M) return true;
    }
    for (const c of P.footCops) {
      if (!c.dead && Math.hypot(c.x - pp.x, c.z - pp.z) < SIGHT_FOOT_M) return true;
    }
    return false;
  }

  function decayHeat(dt, prevWanted) {
    const rate = P.wanted >= 3 ? 4.5 : 7;
    const before = P.heat;
    P.heat = Math.max(0, P.heat - rate * dt);
    P.wanted = wantedFromHeat(P.heat);
    if (before > 0 && P.heat === 0 && prevWanted > 0) {
      W.player.stats.starsLost += 1;
      W.notify('You lost them');
    }
  }

  function topUpFootCops(pp) {
    // Foot cops: keep at most wanted-1 alive. The reinforcement spawns
    // beside the player, pushed out of any building first.
    const maxCops = Math.max(0, P.wanted - 1);
    const liveCops = P.footCops.filter((c) => !c.dead);
    if (liveCops.length < maxCops && P.wanted >= 2) {
      const drop = W.city.resolveCircle(pp.x + 26, pp.z + 18, 0.6);
      P.footCops.push(W.spawnPerson('cop', drop.x, drop.z, {}));
    }
    P.footCops = P.footCops.filter((c) => !c.dead || W.now - c.deathAt < 14);
  }

  P.update = function (dt, now) {
    const pp = W.playerPos();
    const prevWanted = P.wanted;
    P.wanted = wantedFromHeat(P.heat);
    // Visibility: a cruiser within 62 m, a foot cop within 42 m, or the heli.
    if (seenByAnyone(pp)) {
      P.state = 'sight';
      P.unseenFor = 0;
    } else {
      P.unseenFor += dt;
      if (P.unseenFor > 3) {
        P.state = 'search';
        decayHeat(dt, prevWanted);
      }
    }
    P.syncUnits();
    for (const u of [...P.units]) updateUnit(u, dt, now);
    updateHeli(dt, now);
    updateRoadblock(now);
    topUpFootCops(pp);
    if (P.wanted > prevWanted) W.flashWanted();
  };

  P.clearAll = function () {
    for (const u of [...P.units]) {
      const i = W.cars.indexOf(u);
      if (i >= 0) {
        W.scene.remove(u.mesh);
        W.cars.splice(i, 1);
      }
    }
    P.units = [];
    P.roadblockCars = [];
    for (const c of [...P.footCops]) {
      const i = W.people.indexOf(c);
      if (i >= 0) {
        W.scene.remove(c.mesh);
        W.people.splice(i, 1);
      }
    }
    P.footCops = [];
    if (P.heli) {
      W.scene.remove(P.heli.mesh);
      P.heli = null;
    }
    P.heat = 0;
    P.wanted = 0;
    P.state = 'clear';
    P.unseenFor = 0;
  };

  return P;
}

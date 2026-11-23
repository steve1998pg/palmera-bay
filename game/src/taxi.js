// Taxi fares — a free-roam side job for Dante. When no story stage needs
// him (no race, no manhunt, no firefight), a resident in a yellow shirt
// may appear on a sidewalk waving for a cab. Walk up (or drive up) and
// press T to pick them up, then drive them to a random corner of the bay
// before the meter runs out. A smooth ride pays the quoted fare; a quick
// one adds a tip. A hard crash, a wrecked cab, or an empty meter sends the
// passenger walking away angry. Fares never touch the 8 story jobs: the
// system only spawns while the mission tracker reports free roam, and a
// fare is dropped the moment a job stage turns into a race or a fight.
import * as THREE from '../vendor/three.module.min.js';
import { TAXI } from './config.js';
import { clamp, fmtCash, fmtTime } from './random.js';
import { spawnPerson, removePerson } from './people.js';

export function makeTaxi(W) {
  const T = {
    phase: 'none', // 'none' | 'waiting' | 'riding'
    passenger: null,
    passengerHp0: 0,
    dest: null, // {x, z, d}
    destName: '',
    fare: 0,
    timeLeft: 0,
    timeTotal: 0,
    distToDest: 0,
    rideDist: 0,
    spawnIn: 8,
    waitLeft: 0,
    prevSpeed: 0,
    marker: null,
  };

  // ---- markers ----
  function clearMarker() {
    if (!T.marker) return;
    W.scene.remove(T.marker);
    T.marker = null;
  }

  // A small bobbing gem + ground ring, gold for a waiting fare and green
  // for the destination, so the player can spot the job from the street.
  function showBeaconAt(x, z, color) {
    clearMarker();
    const grp = new THREE.Group();
    const gem = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.9),
      new THREE.MeshBasicMaterial({ color })
    );
    gem.position.y = 3.2;
    grp.add(gem);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(2.2, 0.18, 8, 24),
      new THREE.MeshBasicMaterial({ color })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.3;
    grp.add(ring);
    grp.position.set(x, 0, z);
    grp.userData.gem = gem;
    W.scene.add(grp);
    T.marker = grp;
  }

  // ---- spawning ----
  function freeRoam() {
    return W.state === 'playing' && !W.shotMode && W.missions.isFreeRoam();
  }

  // Keep fares out of the places the story and the playthrough care about:
  // the safehouse, the garage, the market, the pier and the race start.
  function farFromHotspots(x, z) {
    const spots = [
      W.city.locations.safehouse,
      W.city.locations.garage,
      W.city.locations.market,
      W.city.locations.pier,
      W.city.locations.raceStart,
    ];
    for (const s of spots) {
      if (Math.hypot(x - s.x, z - s.z) < 40) return false;
    }
    return true;
  }

  function pickSpot() {
    const nodes = W.city.graph.nodes;
    const pp = W.playerPos();
    for (let tries = 0; tries < 40; tries++) {
      const n = nodes[Math.floor(Math.random() * nodes.length)];
      const pt = W.city.sidewalkPoint(n.x, n.z);
      if (Math.hypot(pt.x - pp.x, pt.z - pp.z) < TAXI.minSpawnDist) continue;
      if (!farFromHotspots(pt.x, pt.z)) continue;
      return pt;
    }
    return null;
  }

  function pickDestination(fromX, fromZ) {
    const nodes = W.city.graph.nodes;
    let fallback = null;
    let fallbackD = 0;
    for (let tries = 0; tries < 60; tries++) {
      const n = nodes[Math.floor(Math.random() * nodes.length)];
      const d = Math.hypot(n.x - fromX, n.z - fromZ);
      if (d > fallbackD) {
        fallbackD = d;
        fallback = { x: n.x, z: n.z, d };
      }
      if (d >= TAXI.minDestDist && d <= 650) return { x: n.x, z: n.z, d };
    }
    return fallback;
  }

  function spawnPassenger() {
    const spot = pickSpot();
    if (!spot) return false;
    const p = spawnPerson(W, 'ped', spot.x, spot.z, { tint: TAXI.passengerTint });
    // Face the road: a fare waves at passing cars, not at the buildings.
    const near = W.city.graph.nodeAt(spot.x, spot.z);
    p.heading = Math.atan2(near.x - spot.x, near.z - spot.z);
    p.taxiFare = true;
    p.taxiFollowing = false;
    T.passenger = p;
    T.passengerHp0 = p.hp;
    T.phase = 'waiting';
    T.waitLeft = TAXI.waitTimeout;
    showBeaconAt(spot.x, spot.z, 0xe8b93a);
    return true;
  }

  // ---- fare lifecycle ----
  function endFare(reason) {
    clearMarker();
    const p = T.passenger;
    if (p && !p.dead) {
      const wasRiding = !!p.car;
      p.taxiFare = false;
      p.taxiFollowing = false;
      p.car = null;
      if (wasRiding) {
        // The passenger steps out beside the player and walks away.
        const pp = W.playerPos();
        const res = W.city.resolveCircle(pp.x + 3, pp.z + 3, 0.6);
        p.x = res.x;
        p.z = res.z;
        p.mesh.visible = true;
      }
      p.fleeUntil = W.now + 5;
    }
    T.passenger = null;
    T.dest = null;
    T.phase = 'none';
    T.spawnIn = TAXI.spawnDelayMin + Math.random() * (TAXI.spawnDelayMax - TAXI.spawnDelayMin);
    if (reason) W.notify(reason);
  }

  T.cancel = function (reason) {
    if (T.phase === 'none') return;
    W.audio.taxiCancel();
    endFare(reason);
  };

  // Silent cleanup for respawn / new game / continue: no notify, no fuss.
  T.abort = function () {
    clearMarker();
    if (T.passenger && !T.passenger.dead) {
      T.passenger.taxiFare = false;
      T.passenger.taxiFollowing = false;
      T.passenger.car = null;
      removePerson(W, T.passenger);
    }
    T.passenger = null;
    T.dest = null;
    T.phase = 'none';
    T.spawnIn = TAXI.spawnDelayMin;
  };

  // Called when the player steps out of a car mid-fare.
  T.onExitCar = function () {
    if (T.phase !== 'riding') return;
    T.cancel('You left the cab \u2014 fare lost');
  };

  // T near a waiting fare: pick them up, quote the fare, start the meter.
  T.tryPickup = function () {
    if (W.state !== 'playing' || T.phase !== 'waiting' || !T.passenger) return false;
    const p = W.player;
    const pp = W.playerPos();
    const pas = T.passenger;
    const range = p.inCar ? TAXI.pickupRangeCar : TAXI.pickupRange;
    if (Math.hypot(pp.x - pas.x, pp.z - pas.z) > range) return false;
    const dest = pickDestination(pp.x, pp.z);
    if (!dest) return false;
    T.dest = dest;
    T.destName = W.city.districtAt(dest.x, dest.z).name;
    T.fare = clamp(Math.round(TAXI.baseFare + dest.d * TAXI.perMeter), TAXI.baseFare, TAXI.maxFare);
    T.timeTotal = dest.d * TAXI.timePerMeter + TAXI.timeSlack;
    T.timeLeft = T.timeTotal;
    T.rideDist = 0;
    T.distToDest = dest.d;
    T.phase = 'riding';
    T.prevSpeed = p.inCar ? p.inCar.speed : 0;
    if (p.inCar) {
      // Picked up from the driver's seat: straight into the back seat.
      pas.car = p.inCar;
      pas.mesh.visible = false;
    }
    clearMarker();
    showBeaconAt(dest.x, dest.z, 0x7be495);
    W.audio.taxiPickup();
    W.notify('Fare picked up \u2014 ' + T.destName + ' \u00b7 ' + fmtCash(T.fare));
    W.toast('TAXI FARE \u2014 drive to ' + T.destName);
    W.hudDirty = true;
    return true;
  };

  function completeFare() {
    const quick = T.timeLeft > T.timeTotal * 0.5;
    const tip = quick ? Math.round(T.fare * TAXI.tipFraction) : 0;
    const total = T.fare + tip;
    W.player.cash += total;
    W.player.respect += TAXI.respectPerFare;
    W.player.stats.faresCompleted += 1;
    W.player.stats.faresEarned += total;
    W.audio.taxiDropoff();
    W.audio.coin();
    W.notify('Fare complete \u2014 +' + fmtCash(total) + (tip ? ' (includes ' + fmtCash(tip) + ' tip)' : ''));
    W.hudDirty = true;
    endFare(null);
  }

  // ---- per-frame animation helpers for the passenger ----
  function walkAnimate(pas, dt) {
    const u = pas.mesh.userData;
    pas.walkPhase += dt * 9;
    const s = Math.sin(pas.walkPhase) * 0.55;
    u.legL.rotation.x = s;
    u.legR.rotation.x = -s;
    u.armL.rotation.x = -s * 0.8;
    u.armR.rotation.x = s * 0.8;
    pas.mesh.position.set(pas.x, pas.y, pas.z);
    pas.mesh.rotation.y = pas.heading;
  }

  function idleAnimate(pas, dt) {
    const u = pas.mesh.userData;
    u.legL.rotation.x *= 0.8;
    u.legR.rotation.x *= 0.8;
    u.armL.rotation.x *= 0.8;
    u.armR.rotation.x *= 0.8;
    pas.mesh.position.set(pas.x, pas.y, pas.z);
    pas.mesh.rotation.y = pas.heading;
  }

  // The fare walks with the player to the car once picked up on foot.
  function followPlayer(dt, pas) {
    const p = W.player;
    const d = Math.hypot(p.x - pas.x, p.z - pas.z);
    if (d < 1.6) {
      pas.taxiFollowing = false;
      idleAnimate(pas, dt);
      return;
    }
    pas.taxiFollowing = true;
    pas.heading = Math.atan2(p.x - pas.x, p.z - pas.z);
    const step = Math.min(d, TAXI.followSpeed * dt);
    pas.x += Math.sin(pas.heading) * step;
    pas.z += Math.cos(pas.heading) * step;
    const res = W.city.resolveCircle(pas.x, pas.z, 0.55);
    pas.x = res.x;
    pas.z = res.z;
    walkAnimate(pas, dt);
  }

  // ---- per-frame update (called from the main loop while playing) ----
  T.update = function (dt) {
    if (W.shotMode || W.state !== 'playing') return;
    if (T.marker && T.marker.userData.gem) {
      const gem = T.marker.userData.gem;
      gem.rotation.y += dt * 2.4;
      gem.position.y = 3.2 + Math.sin(W.now * 2.2) * 0.5;
    }
    if (T.phase === 'none') {
      T.spawnIn -= dt;
      if (T.spawnIn <= 0 && freeRoam()) {
        T.spawnIn = spawnPassenger() ? 0 : 8;
      }
      return;
    }
    if (T.phase === 'waiting') {
      const pas = T.passenger;
      if (!pas || pas.dead) {
        endFare(null);
        return;
      }
      // Shot at while waiting: the fare wants nothing to do with Dante.
      if (pas.hp < T.passengerHp0) {
        endFare('Your fare ran off after the shot');
        return;
      }
      T.waitLeft -= dt;
      if (T.waitLeft <= 0) endFare('The fare gave up waiting');
      return;
    }
    // Riding: the fare ends the moment the story needs Dante elsewhere.
    if (!W.missions.isFreeRoam() || W.missions.race) {
      T.cancel('Job calls \u2014 fare dropped');
      return;
    }
    const pas = T.passenger;
    if (!pas || pas.dead) {
      endFare(null);
      return;
    }
    const p = W.player;
    if (!p.inCar) {
      // On foot after pickup: the fare trails Dante to the car.
      if (pas.car) {
        pas.car = null;
        pas.mesh.visible = true;
      }
      followPlayer(dt, pas);
      T.prevSpeed = 0;
      return;
    }
    const car = p.inCar;
    if (pas.car !== car) {
      pas.car = car;
      pas.mesh.visible = false;
    }
    if (car.dead || car.burning) {
      T.cancel('The cab is wrecked \u2014 fare lost');
      return;
    }
    const d = Math.hypot(car.x - T.dest.x, car.z - T.dest.z);
    T.distToDest = d;
    T.rideDist += Math.abs(car.speed) * dt;
    T.timeLeft -= dt;
    if (d < TAXI.arriveRange) {
      completeFare();
      return;
    }
    if (T.timeLeft <= 0) {
      T.cancel('Too slow \u2014 the fare walked away');
      return;
    }
    // A hard crash: a wall hit this frame, or the speed fell off a cliff
    // in a single step (a car-to-car smash). Either one spooks the fare.
    const wallHit = W.now - (car.lastHardHitAt || -99) < 0.12;
    const speedCliff = T.prevSpeed - car.speed > TAXI.hardCrashDrop;
    if (wallHit || speedCliff) {
      T.cancel('That crash scared your passenger off');
      return;
    }
    T.prevSpeed = car.speed;
  };

  // HUD data: the meter while riding, the waiting distance otherwise.
  T.hudInfo = function () {
    if (T.phase === 'riding' && T.dest) {
      return {
        phase: 'riding',
        fare: T.fare,
        timeLeft: Math.max(0, T.timeLeft),
        dist: Math.round(T.distToDest),
        destName: T.destName,
      };
    }
    if (T.phase === 'waiting' && T.passenger) {
      const pp = W.playerPos();
      return {
        phase: 'waiting',
        dist: Math.round(Math.hypot(pp.x - T.passenger.x, pp.z - T.passenger.z)),
      };
    }
    return null;
  };

  // Close enough to hail: used by the HUD prompt.
  T.nearPassenger = function () {
    if (T.phase !== 'waiting' || !T.passenger) return false;
    const pp = W.playerPos();
    return Math.hypot(pp.x - T.passenger.x, pp.z - T.passenger.z) < TAXI.pickupRange + 3;
  };

  return T;
}

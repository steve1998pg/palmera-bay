// People: low-poly box characters with a walk-cycle animation — peds who
// stroll the sidewalks and flee danger, mission enemies who hunt the
// player, and foot cops. Enemies and cops shoot back with a distance-based
// hit chance and visible tracers.
import * as THREE from '../vendor/three.module.min.js';
import { clamp, angleDiff, wrapAngle, pick } from './random.js';

const SHIRTS = [0xd95f4e, 0x4e7dd9, 0x53b06a, 0xd9a94e, 0x9a5fd9, 0xd94e8a, 0x4eb8c4, 0xe8e2d4];
const PANTS = [0x2c3550, 0x3a3a3a, 0x5a4632, 0x24382a];
const SKINS = [0xe8b98a, 0xc98a5a, 0x8a5a34, 0xf2c9a0];
const ENEMY_SHIRT = 0x8a1f2a;
const COP_SHIRT = 0x1d3a5f;
const COP_PANTS = 0x141c28;

let personSeq = 0;

function lambert(color) {
  return new THREE.MeshLambertMaterial({ color });
}

function partBox(w, h, d, mat, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  return m;
}

export function makePersonMesh(W, kind, tint) {
  const grp = new THREE.Group();
  const shirtColor = kind === 'enemy' ? ENEMY_SHIRT : kind === 'cop' ? COP_SHIRT : tint;
  const pantsColor = kind === 'cop' ? COP_PANTS : pick(Math.random, PANTS);
  const shirtMat = lambert(shirtColor);
  const pantsMat = lambert(pantsColor);
  const skinMat = lambert(pick(Math.random, SKINS));
  const torso = partBox(0.62, 0.72, 0.34, shirtMat, 0, 1.12, 0);
  torso.castShadow = true;
  const head = partBox(0.36, 0.36, 0.34, skinMat, 0, 1.68, 0);
  head.castShadow = true;
  grp.add(torso, head);
  if (kind === 'cop') {
    grp.add(partBox(0.4, 0.12, 0.38, lambert(0x0f1a2c), 0, 1.9, 0)); // cap
  } else if (kind === 'enemy') {
    grp.add(partBox(0.66, 0.4, 0.38, lambert(0x222222), 0, 1.18, 0)); // vest
  } else if (Math.random() < 0.3) {
    const hat = new THREE.Mesh(
      new THREE.CylinderGeometry(0.26, 0.3, 0.12, 8),
      lambert(0xd9c58a)
    );
    hat.position.y = 1.92;
    grp.add(hat);
  }
  const legL = partBox(0.22, 0.78, 0.24, pantsMat, -0.16, 0.39, 0);
  const legR = partBox(0.22, 0.78, 0.24, pantsMat, 0.16, 0.39, 0);
  const armL = partBox(0.16, 0.62, 0.18, shirtMat, -0.4, 1.15, 0);
  const armR = partBox(0.16, 0.62, 0.18, shirtMat, 0.4, 1.15, 0);
  grp.add(legL, legR, armL, armR);
  grp.userData = { legL, legR, armL, armR, torso, head };
  return grp;
}

const KIND_STATS = {
  enemy: { hp: 60, payout: 40 },
  cop: { hp: 50, payout: 0 },
  ped: { hp: 30, payout: null }, // peds sometimes carry $25
};

export function spawnPerson(W, kind, x, z, opts = {}) {
  const stats = KIND_STATS[kind] || KIND_STATS.ped;
  const shirt = opts.tint !== undefined ? opts.tint : pick(Math.random, SHIRTS);
  const mesh = makePersonMesh(W, kind, shirt);
  mesh.position.set(x, 0, z);
  W.scene.add(mesh);
  const payout = kind === 'ped' ? (Math.random() < 0.25 ? 25 : 0) : stats.payout;
  const p = {
    id: ++personSeq,
    kind, mesh,
    x, z, y: 0, heading: Math.random() * Math.PI * 2,
    hp: stats.hp,
    dead: false, state: 'walk',
    speed: 0, walkPhase: Math.random() * 6,
    missionTag: opts.tag || null,
    payout,
    fleeUntil: 0, shootAt: 0,
    target: null, targetX: x, targetZ: z,
    car: opts.car || null, // driver seated in a car
    deathAt: 0,
  };
  W.people.push(p);
  return p;
}

export function removePerson(W, p) {
  W.scene.remove(p.mesh);
  const i = W.people.indexOf(p);
  if (i >= 0) W.people.splice(i, 1);
}

// Walk-cycle: swing legs and arms in opposition.
function animateWalk(p, dt, moving) {
  const u = p.mesh.userData;
  if (moving) {
    p.walkPhase += dt * 9;
    const s = Math.sin(p.walkPhase) * 0.55;
    u.legL.rotation.x = s;
    u.legR.rotation.x = -s;
    u.armL.rotation.x = -s * 0.8;
    u.armR.rotation.x = s * 0.8;
  } else {
    u.legL.rotation.x *= 0.8;
    u.legR.rotation.x *= 0.8;
    u.armL.rotation.x *= 0.8;
    u.armR.rotation.x *= 0.8;
  }
  p.mesh.position.set(p.x, p.y, p.z);
  p.mesh.rotation.y = p.heading;
}

function stepPerson(W, p, dt) {
  p.x += Math.sin(p.heading) * p.speed * dt;
  p.z += Math.cos(p.heading) * p.speed * dt;
  const res = W.city.resolveCircle(p.x, p.z, 0.55);
  p.x = res.x;
  p.z = res.z;
  if (res.hit) p.heading = wrapAngle(p.heading + Math.PI * 0.7);
  p.x = clamp(p.x, -478, 478);
  p.z = clamp(p.z, -478, 478);
}

function turnToward(p, wantH, rate, dt) {
  const diff = clamp(angleDiff(wantH, p.heading), -rate * dt, rate * dt);
  p.heading = wrapAngle(p.heading + diff);
}

function pickStrollTarget(W, p) {
  const node = W.city.graph.nodeAt(p.x + (Math.random() - 0.5) * 160, p.z + (Math.random() - 0.5) * 160);
  p.targetX = node.x + (Math.random() - 0.5) * 10;
  p.targetZ = node.z + (Math.random() - 0.5) * 10;
}

// Ped AI: stroll between nearby road nodes; run from danger.
export function updatePed(W, p, dt, now) {
  const pp = W.playerPos();
  const inDanger = W.police.wanted > 0 && Math.hypot(p.x - pp.x, p.z - pp.z) < 26;
  if (inDanger || now < p.fleeUntil) {
    p.state = 'flee';
    const away = Math.atan2(p.x - pp.x, p.z - pp.z);
    p.heading = wrapAngle(away + Math.sin(now * 2 + p.id) * 0.3);
    p.speed = 5.2;
    stepPerson(W, p, dt);
    animateWalk(p, dt, true);
    return;
  }
  p.state = 'walk';
  if (Math.hypot(p.targetX - p.x, p.targetZ - p.z) < 3 || !p.target) pickStrollTarget(W, p);
  turnToward(p, Math.atan2(p.targetX - p.x, p.targetZ - p.z), 2.4, dt);
  p.speed = 1.3;
  stepPerson(W, p, dt);
  animateWalk(p, dt, true);
}

// Enemy / foot-cop AI: close in on the player and shoot.
export function updateHostile(W, p, dt, now) {
  const pp = W.playerPos();
  const d = Math.hypot(pp.x - p.x, pp.z - p.z);
  turnToward(p, Math.atan2(pp.x - p.x, pp.z - p.z), 3.2, dt);
  if (d > 7) {
    p.speed = d > 26 ? 4.6 : 2.2;
    p.state = 'chase';
    stepPerson(W, p, dt);
    animateWalk(p, dt, true);
  } else {
    p.speed = 0;
    animateWalk(p, dt, false);
  }
  // Shoot at the player.
  if (d >= 62 || now < p.shootAt) return;
  p.shootAt = now + 1.1 + Math.random() * 0.7;
  const hitChance = clamp(0.62 - d * 0.008, 0.12, 0.55);
  const dmg = p.kind === 'cop' ? 9 : 11;
  W.showTracer(p.x, 1.5, p.z, pp.x, 1.3, pp.z, 0xff5533);
  if (Math.random() < hitChance) W.onEnemyShot({ damage: dmg }, p);
}

function updateDead(W, p, dt, now) {
  // Sink the body, then remove it.
  if (now - p.deathAt > 14) {
    removePerson(W, p);
    return;
  }
  p.mesh.position.y = Math.max(-0.9, p.mesh.position.y - dt * 0.15);
  p.mesh.rotation.x = Math.min(Math.PI / 2, p.mesh.rotation.x + dt * 2);
}

export function updatePeople(W, dt, now) {
  for (const p of [...W.people]) {
    if (p.dead) {
      updateDead(W, p, dt, now);
      continue;
    }
    if (p.car) {
      // Seated driver: ride along invisibly with the car.
      p.x = p.car.x;
      p.z = p.car.z;
      p.mesh.visible = false;
      continue;
    }
    p.mesh.visible = true;
    if (p.kind === 'ped') updatePed(W, p, dt, now);
    else updateHostile(W, p, dt, now);
  }
}

// A driver whose car is stolen climbs out and runs.
export function ejectDriver(W, car) {
  if (!car.driver) return null;
  const d = car.driver;
  d.car = null;
  const side = car.heading + Math.PI / 2;
  d.x = car.x + Math.sin(side) * 2.2;
  d.z = car.z + Math.cos(side) * 2.2;
  d.fleeUntil = W.now + 5;
  d.mesh.visible = true;
  car.driver = null;
  return d;
}

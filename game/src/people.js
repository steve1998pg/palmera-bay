// People: low-poly pedestrians, gang members and foot cops, with walk / flee /
// chase / shoot behaviours and health bars. Original characters, original clothes.
import * as THREE from 'three';
import { pick, range, clamp } from './random.js';

const SHIRTS = [0xe74c3c, 0x3498db, 0x2ecc71, 0xf39c12, 0x9b59b6, 0x1abc9c, 0xecf0f1, 0xfd79a8, 0x00cec9, 0xe67e22];
const SKINS = [0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524, 0xffdbac];
const PANTS = [0x2c3e50, 0x34495e, 0x5d4037, 0x1a1a2e, 0x4a4e69];
// Health by kind — enemies take a little more, bystanders go down fast.
const KIND_HP = { enemy: 60, cop: 50, ped: 30, player: 100 };

function box(w, h, d, color, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color }));
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

// A person: torso, head, two legs, two arms. Arms raise when aiming / fleeing.
export function makePersonMesh(opts = {}) {
  const g = new THREE.Group();
  const shirt = opts.shirt ?? pick(Math.random, SHIRTS);
  const skin = opts.skin ?? pick(Math.random, SKINS);
  const pants = opts.pants ?? pick(Math.random, PANTS);
  const torso = box(0.62, 0.72, 0.34, opts.vest ? 0x1d4ed8 : shirt, 0, 1.12, 0);
  const head = box(0.34, 0.36, 0.32, skin, 0, 1.68, 0);
  if (opts.cap) head.add(box(0.38, 0.1, 0.36, opts.cap, 0, 0.2, 0));
  if (opts.hat) head.add(box(0.4, 0.12, 0.4, opts.hat, 0, 0.22, 0));
  const legL = box(0.22, 0.72, 0.24, pants, -0.16, 0.36, 0);
  const legR = box(0.22, 0.72, 0.24, pants, 0.16, 0.36, 0);
  const armL = box(0.16, 0.62, 0.18, shirt, -0.4, 1.12, 0);
  const armR = box(0.16, 0.62, 0.18, shirt, 0.4, 1.12, 0);
  g.add(torso, head, legL, legR, armL, armR);
  g.userData = { torso, head, legL, legR, armL, armR, walkPhase: Math.random() * 6 };
  return g;
}

export function createPerson(kind, x, z, rng, opts = {}) {
  const mesh = makePersonMesh(opts);
  mesh.position.set(x, 0, z);
  const hp = KIND_HP[kind] ?? 30;
  const p = {
    kind, // 'ped' | 'enemy' | 'cop' | 'player'
    mesh,
    x, z,
    heading: rng ? rng() * Math.PI * 2 : 0,
    speed: 0,
    hp, maxHp: hp,
    state: 'walk', // walk | flee | chase | shoot | down | drive
    target: null,
    shootCd: 0,
    fleeTimer: 0,
    walkTarget: null,
    walkTimer: 0,
    dead: false,
    name: opts.name || '',
    payout: kind === 'enemy' ? 40 : 0,
  };
  mesh.userData.person = p;
  return p;
}

// Shared per-frame body work: walk-cycle swing, then move + collide + sync mesh.
function animateWalk(p, dt) {
  const u = p.mesh.userData;
  u.walkPhase += p.speed * dt * 2.4;
  const sw = Math.sin(u.walkPhase) * 0.5;
  u.legL.rotation.x = sw; u.legR.rotation.x = -sw;
  return sw;
}
function stepPerson(p, dt, city) {
  p.x += Math.sin(p.heading) * p.speed * dt;
  p.z += Math.cos(p.heading) * p.speed * dt;
  const hit = city.resolveCircle(p.x, p.z, 0.5);
  p.x = hit.x; p.z = hit.z;
  p.mesh.position.set(p.x, 0, p.z);
  p.mesh.rotation.y = p.heading;
}

// Pedestrian AI: stroll the sidewalks; flee from gunfire and speeding cars.
export function updatePed(p, dt, city, danger, rng) {
  if (p.dead) return;
  const u = p.mesh.userData;
  if (danger && danger.level > 0) {
    const d = Math.hypot(p.x - danger.x, p.z - danger.z);
    if (d < danger.radius) {
      p.state = 'flee';
      p.fleeTimer = 2.5;
    }
  }
  if (p.state === 'flee') {
    p.fleeTimer -= dt;
    if (p.fleeTimer <= 0) p.state = 'walk';
    const away = Math.atan2(p.x - (danger ? danger.x : 0), p.z - (danger ? danger.z : 0));
    p.heading = away;
    p.speed = 5.2;
    u.armL.rotation.x = -2.4; u.armR.rotation.x = -2.4;
  } else {
    p.walkTimer -= dt;
    if (!p.walkTarget || p.walkTimer <= 0 || Math.hypot(p.x - p.walkTarget.x, p.z - p.walkTarget.z) < 4) {
      // Pick a nearby sidewalk point: just off a street.
      const s = city.streets[Math.floor(rng() * city.streets.length)];
      const along = range(rng, -430, 430);
      p.walkTarget = rng() < 0.5 ? { x: s + 11, z: along } : { x: along, z: s + 11 };
      p.walkTimer = range(rng, 6, 14);
    }
    const dx = p.walkTarget.x - p.x, dz = p.walkTarget.z - p.z;
    p.heading = Math.atan2(dx, dz);
    p.speed = 1.6;
    u.armL.rotation.x = 0; u.armR.rotation.x = 0;
  }
  stepPerson(p, dt, city);
  const sw = animateWalk(p, dt);
  if (p.state !== 'flee') { u.armL.rotation.x = -sw * 0.6; u.armR.rotation.x = sw * 0.6; }
}

// Enemy / foot-cop AI: chase the player and shoot when close enough.
export function updateFighter(p, dt, playerPos, city, canShoot) {
  if (p.dead) return null;
  const u = p.mesh.userData;
  const dx = playerPos.x - p.x, dz = playerPos.z - p.z;
  const d = Math.hypot(dx, dz);
  let fired = false;
  p.shootCd -= dt;
  if (d > 26) {
    p.state = 'chase';
    p.heading = Math.atan2(dx, dz);
    p.speed = p.kind === 'cop' ? 4.6 : 4.0;
    u.armL.rotation.x = 0; u.armR.rotation.x = 0;
  } else if (d > 9) {
    p.state = 'chase';
    p.heading = Math.atan2(dx, dz);
    p.speed = 2.2;
    u.armL.rotation.x = 0; u.armR.rotation.x = 0;
  } else {
    p.state = 'shoot';
    p.speed = 0;
    p.heading = Math.atan2(dx, dz);
    // Both arms forward, aiming.
    u.armL.rotation.x = -1.5; u.armR.rotation.x = -1.5;
    if (p.shootCd <= 0 && canShoot) {
      p.shootCd = p.kind === 'cop' ? 1.1 : 1.5;
      fired = true;
    }
  }
  stepPerson(p, dt, city);
  animateWalk(p, dt);
  return fired ? { from: p, damage: p.kind === 'cop' ? 6 : 9, spread: 0.09 } : null;
}

export function damagePerson(p, dmg) {
  if (p.dead) return false;
  p.hp -= dmg;
  if (p.hp <= 0) {
    p.hp = 0; p.dead = true; p.state = 'down';
    p.mesh.rotation.x = -Math.PI / 2;
    p.mesh.position.y = 0.35;
    return true;
  }
  return false;
}

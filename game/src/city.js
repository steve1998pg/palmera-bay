// PALMERA BAY — the city itself: dusk sky, ocean and beach, street grid, towers,
// palms, lamps, pier, props. Built once from a seed; exports colliders, the road
// graph traffic drives on, district lookup and the key locations missions use.
import * as THREE from 'three';
import { WORLD, DISTRICTS, STREET_NAMES } from './config.js';
import { mulberry32, pick, range, clamp } from './random.js';

// Merge several non-indexed BufferGeometries into one, carrying position/normal/color.
export function mergeGeometries(geoms) {
  let vCount = 0;
  const parts = geoms.map((g) => {
    const ng = g.index ? g.toNonIndexed() : g;
    vCount += ng.attributes.position.count;
    return ng;
  });
  const pos = new Float32Array(vCount * 3);
  const nor = new Float32Array(vCount * 3);
  const col = new Float32Array(vCount * 3);
  let o = 0;
  for (const g of parts) {
    const p = g.attributes.position.array, n = g.attributes.normal.array;
    const c = g.attributes.color ? g.attributes.color.array : null;
    pos.set(p, o * 3); nor.set(n, o * 3);
    for (let i = 0; i < g.attributes.position.count; i++) {
      col[(o + i) * 3] = c ? c[i * 3] : 1;
      col[(o + i) * 3 + 1] = c ? c[i * 3 + 1] : 1;
      col[(o + i) * 3 + 2] = c ? c[i * 3 + 2] : 1;
    }
    o += g.attributes.position.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return out;
}

function paint(geom, hex) {
  const c = new THREE.Color(hex);
  const count = geom.attributes.position.count;
  const arr = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
  geom.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geom;
}

function xform(geom, px, py, pz, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  const m = new THREE.Matrix4();
  m.compose(
    new THREE.Vector3(px, py, pz),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)),
    new THREE.Vector3(sx, sy, sz),
  );
  geom.applyMatrix4(m);
  return geom;
}

// One low-poly palm: curved trunk + 6 fronds, vertex-coloured.
export function makePalmGeometry() {
  const parts = [];
  parts.push(paint(xform(new THREE.CylinderGeometry(0.22, 0.38, 7, 6), 0, 3.5, 0, 0, 0, 0.08), 0x8a6b46));
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const leaf = paint(
      xform(new THREE.ConeGeometry(0.9, 5.4, 4), 0, 0, 0, Math.PI / 2.6, 0, 0, 1, 1, 0.32),
      i % 2 ? 0x2f9e44 : 0x37b24d,
    );
    xform(leaf, Math.cos(a) * 2.1, 7.1, Math.sin(a) * 2.1, 0, -a + Math.PI / 2, 0);
    parts.push(leaf);
  }
  parts.push(paint(xform(new THREE.SphereGeometry(0.55, 6, 5), 0, 7, 0), 0x6b4f2a));
  return mergeGeometries(parts);
}

// Canvas texture of lit windows for building facades.
function buildingTexture(rng) {
  const cv = document.createElement('canvas');
  cv.width = 128; cv.height = 256;
  const g = cv.getContext('2d');
  g.fillStyle = '#cfd6dd'; g.fillRect(0, 0, 128, 256);
  for (let y = 10; y < 246; y += 22) {
    for (let x = 10; x < 118; x += 20) {
      const lit = rng() < 0.55;
      g.fillStyle = lit ? (rng() < 0.5 ? '#ffd166' : '#ffe8a3') : '#2b3542';
      g.fillRect(x, y, 12, 14);
    }
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function textTexture(text, sub, bg, fg) {
  const cv = document.createElement('canvas');
  cv.width = 512; cv.height = 160;
  const g = cv.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, 512, 160);
  g.strokeStyle = fg; g.lineWidth = 6; g.strokeRect(8, 8, 496, 144);
  g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = '900 64px Arial, sans-serif';
  g.fillText(text, 256, 66);
  g.font = '700 30px Arial, sans-serif';
  g.fillText(sub, 256, 122);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function districtAt(x, z) {
  let best = DISTRICTS[0], bd = Infinity;
  for (const d of DISTRICTS) {
    const dd = (x - d.x) ** 2 + (z - d.z) ** 2;
    if (dd < bd) { bd = dd; best = d; }
  }
  return best;
}

export function buildCity(scene, seed = 7) {
  const rng = mulberry32(seed);
  const colliders = [];   // {x,z,hx,hz} axis-aligned boxes
  const locations = {};
  const dummy = new THREE.Object3D();

  // ----- sky, sun, fog -----
  scene.fog = new THREE.Fog(0xf7a072, 220, 980);
  const skyCv = document.createElement('canvas');
  skyCv.width = 4; skyCv.height = 256;
  const sg = skyCv.getContext('2d');
  const grad = sg.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#2b1b52'); grad.addColorStop(0.42, '#7b4b94');
  grad.addColorStop(0.62, '#e76f51'); grad.addColorStop(0.78, '#f4a261');
  grad.addColorStop(1, '#ffd6a5');
  sg.fillStyle = grad; sg.fillRect(0, 0, 4, 256);
  const skyTex = new THREE.CanvasTexture(skyCv);
  skyTex.colorSpace = THREE.SRGBColorSpace;
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(1500, 24, 16),
    new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false }),
  );
  scene.add(sky);
  // Sun disc low in the west, and a few flat clouds.
  const sun = new THREE.Mesh(
    new THREE.CircleGeometry(46, 24),
    new THREE.MeshBasicMaterial({ color: 0xffdf8a, fog: false }),
  );
  sun.position.set(-900, 190, -620); sun.lookAt(0, 60, 0);
  scene.add(sun);
  const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffd9c2, transparent: true, opacity: 0.85 });
  for (let i = 0; i < 14; i++) {
    const c = new THREE.Mesh(new THREE.BoxGeometry(range(rng, 60, 150), range(rng, 6, 12), range(rng, 18, 30)), cloudMat);
    c.position.set(range(rng, -900, 900), range(rng, 210, 320), range(rng, -900, 500));
    c.rotation.y = rng() * Math.PI;
    scene.add(c);
  }
  const hemi = new THREE.HemisphereLight(0xb9a8e8, 0x8a6b4a, 0.85);
  scene.add(hemi);
  const sunLight = new THREE.DirectionalLight(0xffb36b, 1.9);
  sunLight.position.set(-260, 190, -140);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(2048, 2048);
  sunLight.shadow.camera.left = -160; sunLight.shadow.camera.right = 160;
  sunLight.shadow.camera.top = 160; sunLight.shadow.camera.bottom = -160;
  sunLight.shadow.camera.far = 900;
  sunLight.shadow.bias = -0.0006;
  scene.add(sunLight);
  scene.add(sunLight.target);

  // ----- ground: city slab, sand, ocean -----
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD.size * 2.4, WORLD.size * 2.4),
    new THREE.MeshLambertMaterial({ color: 0x5a6b52 }),
  );
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.05;
  ground.receiveShadow = true;
  scene.add(ground);
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(220, WORLD.size * 2.2),
    new THREE.MeshLambertMaterial({ color: 0xe8c98f }),
  );
  sand.rotation.x = -Math.PI / 2; sand.position.set(490, 0, 0);
  sand.receiveShadow = true;
  scene.add(sand);
  const ocean = new THREE.Mesh(
    new THREE.PlaneGeometry(900, WORLD.size * 2.4),
    new THREE.MeshLambertMaterial({ color: 0x2a7f8f, transparent: true, opacity: 0.94 }),
  );
  ocean.rotation.x = -Math.PI / 2; ocean.position.set(950, -0.4, 0);
  scene.add(ocean);
  // Boardwalk strip along the beach.
  const walk = new THREE.Mesh(
    new THREE.BoxGeometry(10, 0.3, WORLD.size),
    new THREE.MeshLambertMaterial({ color: 0xb08a5e }),
  );
  walk.position.set(386, 0.15, 0); walk.receiveShadow = true;
  scene.add(walk);

  // ----- roads -----
  const roadMat = new THREE.MeshLambertMaterial({ color: 0x2e3440 });
  const lineMat = new THREE.MeshLambertMaterial({ color: 0xfacc15 });
  const streets = [-384, -288, -192, -96, 0, 96, 192, 288];
  const roadMeshes = [];
  for (const s of streets) {
    const h = new THREE.Mesh(new THREE.PlaneGeometry(WORLD.size, WORLD.roadWidth), roadMat);
    h.rotation.x = -Math.PI / 2; h.position.set(0, 0.02, s); h.receiveShadow = true;
    scene.add(h);
    const v = new THREE.Mesh(new THREE.PlaneGeometry(WORLD.roadWidth, WORLD.size), roadMat);
    v.rotation.x = -Math.PI / 2; v.position.set(s, 0.02, 0); v.receiveShadow = true;
    scene.add(v);
    roadMeshes.push(h, v);
  }
  // Boulevard along the beach.
  const blvd = new THREE.Mesh(new THREE.PlaneGeometry(WORLD.roadWidth + 10, WORLD.size), roadMat);
  blvd.rotation.x = -Math.PI / 2; blvd.position.set(352, 0.02, 0); blvd.receiveShadow = true;
  scene.add(blvd);
  // Dashed centre lines (instanced thin boxes).
  const dashGeo = new THREE.BoxGeometry(0.7, 0.06, 5);
  const dashCount = streets.length * 2 * 26 + 26;
  const dashes = new THREE.InstancedMesh(dashGeo, lineMat, dashCount);
  let di = 0;
  for (const s of streets) {
    for (let t = -440; t < 440; t += 36) {
      dummy.position.set(t, 0.06, s); dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1);
      dummy.updateMatrix(); dashes.setMatrixAt(di++, dummy.matrix);
      dummy.position.set(s, 0.06, t);
      dummy.updateMatrix(); dashes.setMatrixAt(di++, dummy.matrix);
    }
  }
  for (let t = -440; t < 440; t += 36) {
    dummy.position.set(352, 0.06, t); dummy.rotation.set(0, 0, 0); dummy.updateMatrix();
    dashes.setMatrixAt(di++, dummy.matrix);
  }
  dashes.count = di;
  scene.add(dashes);

  // ----- buildings (instanced boxes, window texture, per-instance tint) -----
  const facadeTex = buildingTexture(mulberry32(seed + 11));
  const bMat = new THREE.MeshLambertMaterial({ map: facadeTex });
  const placements = [];
  const isRoad = (v) => streets.some((s) => Math.abs(v - s) < WORLD.roadWidth / 2 + 7);
  // Keep-clear discs: the safehouse spawn + starter car and the market kill
  // zone must be open ground. Without this, seed 7 puts three buildings on
  // top of the safehouse — the player spawns inside a collider and the
  // starter car sits inside a building, unreachable (nearestCar is 4 m).
  // Coordinates match locations.safehouse / locations.market below.
  const KEEP_CLEAR = [
    { x: -336, z: 336, r: 24 },
    { x: 120, z: 352, r: 20 },
  ];
  const nearKeepClear = (x, z, w, d) => KEEP_CLEAR.some((k) => {
    const dx = Math.max(x - w / 2 - k.x, 0, k.x - (x + w / 2));
    const dz = Math.max(z - d / 2 - k.z, 0, k.z - (z + d / 2));
    return Math.hypot(dx, dz) < k.r;
  });
  for (let gx = -4; gx <= 3; gx++) {
    for (let gz = -4; gz <= 3; gz++) {
      const bx = gx * WORLD.roadGap + WORLD.roadGap / 2;
      const bz = gz * WORLD.roadGap + WORLD.roadGap / 2;
      if (bx > 330) continue; // beach: no buildings
      // Sundial Square: central plaza with a clock tower instead of blocks.
      if (gx === -1 && gz === -1) continue;
      if (rng() < 0.1) continue; // empty lot / park
      const n = 1 + Math.floor(rng() * 3);
      for (let k = 0; k < n; k++) {
        const w = range(rng, 18, 34), d = range(rng, 18, 34);
        const h = gx >= -1 && gx <= 1 && gz >= -1 && gz <= 1
          ? range(rng, 30, 85) : range(rng, 10, 34);
        const x = bx + range(rng, -16, 16), z = bz + range(rng, -16, 16);
        if (isRoad(x) || isRoad(z)) continue;
        // Roll rotation before the keep-clear skip so the rng stream — and
        // every other building — stays exactly as it was.
        const rot = rng() < 0.3 ? Math.PI / 2 : 0;
        if (nearKeepClear(x, z, w, d)) continue;
        placements.push({ x, z, w, d, h, rot });
      }
    }
  }
  const bMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), bMat, placements.length);
  const palette = [0xffffff, 0xf3d9b8, 0xf8c8c0, 0xcfe0e8, 0xe8dcc8, 0xd8b4fe, 0xffe4b5];
  placements.forEach((p, i) => {
    dummy.position.set(p.x, p.h / 2, p.z);
    dummy.rotation.set(0, p.rot, 0);
    dummy.scale.set(p.w, p.h, p.d);
    dummy.updateMatrix();
    bMesh.setMatrixAt(i, dummy.matrix);
    bMesh.setColorAt(i, new THREE.Color(pick(rng, palette)));
    colliders.push({ x: p.x, z: p.z, hx: p.w / 2 + 0.5, hz: p.d / 2 + 0.5 });
  });
  bMesh.castShadow = true; bMesh.receiveShadow = true;
  bMesh.instanceMatrix.needsUpdate = true;
  if (bMesh.instanceColor) bMesh.instanceColor.needsUpdate = true;
  scene.add(bMesh);
  // Flat roofs.
  const roofMesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshLambertMaterial({ color: 0x4b5563 }),
    placements.length,
  );
  placements.forEach((p, i) => {
    dummy.position.set(p.x, p.h + 0.4, p.z);
    dummy.rotation.set(0, p.rot, 0);
    dummy.scale.set(p.w + 1, 0.8, p.d + 1);
    dummy.updateMatrix();
    roofMesh.setMatrixAt(i, dummy.matrix);
  });
  roofMesh.instanceMatrix.needsUpdate = true;
  scene.add(roofMesh);

  // Clock tower at Sundial Square.
  const tower = new THREE.Mesh(new THREE.BoxGeometry(14, 64, 14), new THREE.MeshLambertMaterial({ color: 0xe8dcc8 }));
  tower.position.set(-48, 32, -48); tower.castShadow = true;
  scene.add(tower);
  const clockFace = new THREE.Mesh(
    new THREE.CircleGeometry(5, 24),
    new THREE.MeshBasicMaterial({ color: 0xfff7cc }),
  );
  clockFace.position.set(-48, 56, -40.8);
  scene.add(clockFace);
  colliders.push({ x: -48, z: -48, hx: 8, hz: 8 });

  // ----- palms along the boulevard, beach and squares -----
  const palmGeo = makePalmGeometry();
  const palmMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const palmSpots = [];
  for (let z = -440; z <= 440; z += 44) {
    palmSpots.push([368, z + range(rng, -6, 6)]);
    palmSpots.push([404, z + 22 + range(rng, -6, 6)]);
    if (rng() < 0.6) palmSpots.push([330, z + range(rng, -8, 8)]);
  }
  for (let i = 0; i < 46; i++) palmSpots.push([range(rng, -380, 320), range(rng, -440, 440)]);
  const palms = new THREE.InstancedMesh(palmGeo, palmMat, palmSpots.length);
  palmSpots.forEach((p, i) => {
    dummy.position.set(p[0], 0, p[1]);
    dummy.rotation.set(0, rng() * Math.PI * 2, 0);
    const s = range(rng, 0.8, 1.35);
    dummy.scale.set(s, s, s);
    dummy.updateMatrix();
    palms.setMatrixAt(i, dummy.matrix);
  });
  palms.castShadow = true;
  palms.instanceMatrix.needsUpdate = true;
  scene.add(palms);

  // ----- street lamps (emissive heads glow at dusk) -----
  const lampPoleMat = new THREE.MeshLambertMaterial({ color: 0x1f2937 });
  const lampHeadMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  const lampGeo = new THREE.CylinderGeometry(0.12, 0.16, 7, 5);
  const lampHeads = [];
  for (let z = -420; z <= 420; z += 96) {
    for (const x of [342, 362]) lampHeads.push([x, z]);
    if (rng() < 0.5) lampHeads.push([range(rng, -380, 320), z + 48]);
  }
  const poles = new THREE.InstancedMesh(lampGeo, lampPoleMat, lampHeads.length);
  const heads = new THREE.InstancedMesh(new THREE.SphereGeometry(0.55, 8, 6), lampHeadMat, lampHeads.length);
  lampHeads.forEach((p, i) => {
    dummy.position.set(p[0], 3.5, p[1]); dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1);
    dummy.updateMatrix(); poles.setMatrixAt(i, dummy.matrix);
    dummy.position.set(p[0], 7.1, p[1]); dummy.updateMatrix(); heads.setMatrixAt(i, dummy.matrix);
  });
  poles.instanceMatrix.needsUpdate = true; heads.instanceMatrix.needsUpdate = true;
  scene.add(poles); scene.add(heads);

  // ----- billboards & shop signs (invented businesses only) -----
  function billboard(x, z, ry, w, text, sub, bg, fg) {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, w * 0.3125),
      new THREE.MeshBasicMaterial({ map: textTexture(text, sub, bg, fg) }),
    );
    m.position.set(x, 14, z); m.rotation.y = ry;
    scene.add(m);
    const posts = new THREE.Mesh(new THREE.BoxGeometry(1, 12, 1), new THREE.MeshLambertMaterial({ color: 0x374151 }));
    posts.position.set(x, 6, z); scene.add(posts);
  }
  billboard(330, -320, Math.PI / 2, 30, 'CASINO PERLA', 'SLOTS · SHOWS · ALL NIGHT', '#0f766e', '#fef3c7');
  billboard(-288, 300, 0, 26, 'CINE SOL', 'TWO SCREENS · AIR CONDITIONED', '#7c2d12', '#ffedd5');
  billboard(120, 352, Math.PI, 24, 'MERCADO VERDE', 'FRESH FISH · FLOWERS · GOSSIP', '#166534', '#fef9c3');
  billboard(-96, -352, 0, 26, 'TALLER TOMAS', 'IBARRA CUSTOMS · OPEN LATE', '#1e3a8a', '#dbeafe');

  // ----- pier into the ocean -----
  const pier = new THREE.Mesh(new THREE.BoxGeometry(120, 1, 14), new THREE.MeshLambertMaterial({ color: 0x8a6b46 }));
  pier.position.set(500, 0.6, 200); pier.castShadow = true;
  scene.add(pier);
  for (let i = 0; i < 8; i++) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 4, 6), new THREE.MeshLambertMaterial({ color: 0x6b4f2a }));
    post.position.set(452 + i * 14, -0.5, 200 + (i % 2 ? 6 : -6));
    scene.add(post);
  }

  // ----- key locations -----
  locations.garage = { x: 340, z: 96, name: 'Ibarra Customs' };
  locations.safehouse = { x: -336, z: 336, name: 'Safehouse' };
  locations.precinct = { x: 0, z: -96, name: 'PBPD Precinct' };
  locations.raceStart = { x: 352, z: -240, name: 'Boulevard Race' };
  locations.pier = { x: 500, z: 200, name: 'The Pier' };
  locations.plaza = { x: -48, z: -48, name: 'Sundial Square' };
  locations.market = { x: 120, z: 352, name: 'Mercado Verde' };
  locations.port = { x: -80, z: -400, name: 'Saltflats Port' };
  locations.stashes = [];
  for (let i = 0; i < 12; i++) {
    locations.stashes.push({ x: range(rng, -380, 340), z: range(rng, -420, 420), taken: false });
  }
  // A stash inside a building can never be picked up (2.6 m radius) — with
  // seed 7, four of twelve land inside colliders. Nudge each one to the
  // nearest clear ground (fixed ring search, no rng, so later stashes keep
  // their positions).
  for (const s of locations.stashes) {
    if (!collides(s.x, s.z, 2)) continue;
    let placed = false;
    for (let r = 4; r <= 60 && !placed; r += 4) {
      for (let a = 0; a < 8 && !placed; a++) {
        const nx = s.x + Math.sin((a / 8) * Math.PI * 2) * r;
        const nz = s.z + Math.cos((a / 8) * Math.PI * 2) * r;
        if (!collides(nx, nz, 2)) { s.x = nx; s.z = nz; placed = true; }
      }
    }
  }

  // ----- road graph for traffic & police -----
  const nodes = [];
  const nodeAt = (x, z) => nodes.find((n) => n.x === x && n.z === z);
  for (const sx of [...streets, 352]) {
    for (const sz of streets) {
      nodes.push({ x: sx, z: sz });
    }
  }
  function neighbors(n) {
    const out = [];
    for (const m of nodes) {
      if (m === n) continue;
      const sameX = m.x === n.x && Math.abs(m.z - n.z) === WORLD.roadGap;
      const sameZ = m.z === n.z && Math.abs(m.x - n.x) === WORLD.roadGap;
      const blvdLink = (n.x === 352 || m.x === 352) && m.z === n.z && Math.abs(m.x - n.x) <= 72 && Math.abs(m.x - n.x) > 0;
      if (sameX || sameZ || blvdLink) out.push(m);
    }
    return out;
  }
  const graph = { nodes, neighbors, nodeAt };

  function collides(x, z, r) {
    if (x < -470 || x > 470 || z < -470 || z > 470) return true;
    for (let i = 0; i < colliders.length; i++) {
      const c = colliders[i];
      if (Math.abs(x - c.x) < c.hx + r && Math.abs(z - c.z) < c.hz + r) return c;
    }
    return null;
  }
  function resolveCircle(x, z, r) {
    const c = collides(x, z, r);
    if (!c) return { x, z, hit: false };
    const dx = x - c.x, dz = z - c.z;
    const px = c.hx + r - Math.abs(dx), pz = c.hz + r - Math.abs(dz);
    if (px < pz) return { x: c.x + Math.sign(dx || 1) * (c.hx + r), z, hit: true };
    return { x, z: c.z + Math.sign(dz || 1) * (c.hz + r), hit: true };
  }
  function onRoad(x, z) {
    if (Math.abs(x - 352) < 14) return true;
    return streets.some((s) => Math.abs(x - s) < 9 || Math.abs(z - s) < 9);
  }

  return { colliders, locations, graph, districtAt, collides, resolveCircle, onRoad, sunLight, streets, districts: DISTRICTS };
}

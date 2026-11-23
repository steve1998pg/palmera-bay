// The city of Palmera Bay: deterministic low-poly three.js world built
// from one seeded RNG stream. Roads, buildings, palms, the clock tower,
// the pier, the beach and the sea, plus the road graph traffic and the
// playthrough drive on, circle-vs-box colliders, and the district lookup.
//
// The RNG calls happen in a fixed order (buildings, billboards, clouds,
// stashes) so a given seed always builds the same city.
import * as THREE from '../vendor/three.module.min.js';
import { mulberry32, pick, range, clamp } from './random.js';
import { STREETS, BOULEVARD_X, DISTRICTS, LOCATIONS } from './config.js';

function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function windowTexture(base, lit) {
  return canvasTexture(128, 256, (g) => {
    g.fillStyle = base;
    g.fillRect(0, 0, 128, 256);
    g.fillStyle = 'rgba(0,0,0,0.18)';
    g.fillRect(0, 0, 128, 10);
    for (let y = 18; y < 244; y += 22) {
      for (let x = 10; x < 118; x += 20) {
        const warm = ((x * 7 + y * 13) % 10) < 4;
        g.fillStyle = warm ? lit : 'rgba(20,26,44,0.85)';
        g.fillRect(x, y, 12, 14);
      }
    }
  });
}

function textTexture(lines, bg, fg) {
  return canvasTexture(256, 128, (g) => {
    g.fillStyle = bg;
    g.fillRect(0, 0, 256, 128);
    g.fillStyle = fg;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = 'bold 44px system-ui, sans-serif';
    lines.forEach((ln, i) => g.fillText(ln, 128, 44 + i * 44));
  });
}

function flatMesh(w, d, color, y, receive) {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(w, d),
    new THREE.MeshLambertMaterial({ color })
  );
  m.rotation.x = -Math.PI / 2;
  m.position.y = y;
  if (receive) m.receiveShadow = true;
  return m;
}

export function buildCity(W) {
  const scene = W.scene;
  const rng = mulberry32(W.seed);
  const city = {
    colliders: [],
    stashes: [],
    streets: [...STREETS],
    locations: JSON.parse(JSON.stringify(LOCATIONS)),
    graph: null,
    sunLight: null,
    marker: null,
    _scene: scene,
  };

  // ---- colliders (defined early: stash placement below already uses them) ----
  city.collides = function (x, z, r) {
    for (const c of city.colliders) {
      const cx = clamp(x, c.x - c.hx, c.x + c.hx);
      const cz = clamp(z, c.z - c.hz, c.z + c.hz);
      const dx = x - cx;
      const dz = z - cz;
      if (dx * dx + dz * dz < r * r) return true;
    }
    return false;
  };

  // Push a circle out of every building it overlaps. Returns whether any
  // collision happened and the push-out normal of the deepest hit.
  city.resolveCircle = function (x, z, r) {
    let hit = false;
    let nx = 0;
    let nz = 0;
    let deepest = 0;
    for (let pass = 0; pass < 2; pass++) {
      for (const c of city.colliders) {
        const cx = clamp(x, c.x - c.hx, c.x + c.hx);
        const cz = clamp(z, c.z - c.hz, c.z + c.hz);
        let dx = x - cx;
        let dz = z - cz;
        const d2 = dx * dx + dz * dz;
        if (d2 >= r * r) continue;
        hit = true;
        let d = Math.sqrt(d2);
        if (d < 0.001) {
          dx = 1;
          dz = 0;
          d = 1;
        } else {
          dx /= d;
          dz /= d;
        }
        const push = r - d;
        x += dx * push;
        z += dz * push;
        if (push > deepest) {
          deepest = push;
          nx = dx;
          nz = dz;
        }
      }
    }
    return { x, z, hit, nx, nz, depth: deepest };
  };

  buildSky(scene, city);
  buildGround(scene);
  buildRoads(scene);
  W.buildingCount = buildBuildings(scene, city, rng);
  buildClockTower(scene, city);
  buildBillboards(scene, city, rng);
  buildPalms(scene, city);
  buildLamps(scene);
  buildPier(scene);
  buildClouds(scene, rng);
  city.graph = buildGraph();
  placeStashes(scene, city, W.seed);
  attachCityHelpers(city);

  return city;
}

function buildSky(scene, city) {
  const skyTex = canvasTexture(4, 256, (g) => {
    const grad = g.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, '#241640');
    grad.addColorStop(0.45, '#6b2d5e');
    grad.addColorStop(0.75, '#e8703a');
    grad.addColorStop(1, '#f7c948');
    g.fillStyle = grad;
    g.fillRect(0, 0, 4, 256);
  });
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(1400, 16, 12),
    new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false })
  );
  scene.add(sky);
  scene.fog = new THREE.Fog(0xd97a3f, 180, 900);

  scene.add(new THREE.HemisphereLight(0x8a6bb8, 0x7a5230, 0.85));
  const sun = new THREE.DirectionalLight(0xffb36b, 1.6);
  sun.position.set(-260, 180, 120);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -90;
  sun.shadow.camera.right = 90;
  sun.shadow.camera.top = 90;
  sun.shadow.camera.bottom = -90;
  sun.shadow.camera.far = 700;
  scene.add(sun);
  scene.add(sun.target);
  city.sunLight = sun;
  scene.add(new THREE.AmbientLight(0x604a7a, 0.5));

  // Low sun disc in the west.
  const sunBall = new THREE.Mesh(
    new THREE.SphereGeometry(26, 12, 10),
    new THREE.MeshBasicMaterial({ color: 0xffd27a, fog: false })
  );
  sunBall.position.set(-1100, 150, 260);
  scene.add(sunBall);
}

function buildGround(scene) {
  const ground = flatMesh(960, 960, 0x8f8570, 0, true);
  scene.add(ground);
  const sand = flatMesh(100, 960, 0xe2cb8f, 0.02, true);
  sand.position.x = 430;
  scene.add(sand);
  const sea = flatMesh(460, 1000, 0x2b6f8e, 0.04, false);
  sea.position.x = 680;
  scene.add(sea);
}

function roadTexture() {
  const tex = canvasTexture(64, 256, (g) => {
    g.fillStyle = '#33333a';
    g.fillRect(0, 0, 64, 256);
    g.fillStyle = '#f2c230';
    g.fillRect(29, 20, 6, 70);
    g.fillRect(29, 150, 6, 70);
    g.fillStyle = 'rgba(255,255,255,0.5)';
    g.fillRect(3, 0, 3, 256);
    g.fillRect(58, 0, 3, 256);
  });
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function buildRoads(scene) {
  const base = roadTexture();
  function strip(x, z, w, len, horizontal) {
    const tex = base.clone();
    tex.needsUpdate = true;
    tex.repeat.set(1, len / 64);
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(len, w),
      new THREE.MeshLambertMaterial({ map: tex })
    );
    m.rotation.x = -Math.PI / 2;
    if (horizontal) m.rotation.z = Math.PI / 2;
    m.position.set(x, 0.03, z);
    m.receiveShadow = true;
    scene.add(m);
    // Sidewalk shoulders.
    const walk = flatMesh(len, w + 7, 0xa89a80, 0.015, false);
    if (horizontal) walk.rotation.z = Math.PI / 2;
    walk.position.set(x, 0.015, z);
    scene.add(walk);
  }
  for (const s of STREETS) {
    strip(0, s, 16, 960, true);
    strip(s, 0, 16, 960, false);
  }
  strip(BOULEVARD_X, 0, 26, 960, false);
}

const BLOCK_XS = [[-472, -392], [-376, -296], [-280, -200], [-184, -104], [-88, -8], [8, 88], [104, 184], [200, 280], [296, 339]];
const BLOCK_ZS = [[-472, -392], [-376, -296], [-280, -200], [-184, -104], [-88, -8], [8, 88], [104, 184], [200, 280], [296, 376]];
const FREE_ZONES = [
  { x: -336, z: 336, r: 26 },
  { x: 120, z: 352, r: 22 },
  { x: -48, z: -48, r: 42 },
];

function overlapsFreeZone(x, z, hx, hz) {
  for (const fz of FREE_ZONES) {
    const cx = clamp(x, fz.x - fz.r, fz.x + fz.r);
    const cz = clamp(z, fz.z - fz.r, fz.z + fz.r);
    if ((x - cx) * (x - cx) + (z - cz) * (z - cz) < 1) return true;
    const dx = Math.max(Math.abs(x - fz.x) - hx, 0);
    const dz = Math.max(Math.abs(z - fz.z) - hz, 0);
    if (dx * dx + dz * dz < fz.r * fz.r) return true;
  }
  return false;
}

function buildBuildings(scene, city, rng) {
  const facades = [
    windowTexture('#7a6a8a', '#ffd98a'),
    windowTexture('#5f7488', '#ffe9b0'),
    windowTexture('#8a6a5a', '#ffd98a'),
    windowTexture('#4f5a6a', '#ffb36b'),
  ];
  const mats = facades.map((t) => new THREE.MeshLambertMaterial({ map: t }));
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x3a3340 });
  let count = 0;
  for (const [bx0, bx1] of BLOCK_XS) {
    for (const [bz0, bz1] of BLOCK_ZS) {
      const bw = bx1 - bx0;
      const bd = bz1 - bz0;
      if (bw < 30 || bd < 30) continue;
      const nB = rng() < 0.55 ? 2 : 1;
      for (let i = 0; i < nB; i++) {
        const w = range(rng, 22, Math.min(52, bw - 6));
        const d = range(rng, 22, Math.min(52, bd - 6));
        const cx = range(rng, bx0 + w / 2 + 2, bx1 - w / 2 - 2);
        const cz = range(rng, bz0 + d / 2 + 2, bz1 - d / 2 - 2);
        if (overlapsFreeZone(cx, cz, w / 2, d / 2)) continue;
        const distDowntown = Math.hypot(cx, cz);
        const h = distDowntown < 220 ? range(rng, 26, 58) : range(rng, 10, 30);
        const mat = mats[Math.floor(rng() * mats.length)];
        const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
        b.position.set(cx, h / 2, cz);
        b.castShadow = true;
        b.receiveShadow = true;
        scene.add(b);
        const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 1, 1.2, d + 1), roofMat);
        roof.position.set(cx, h + 0.6, cz);
        scene.add(roof);
        city.colliders.push({ x: cx, z: cz, hx: w / 2, hz: d / 2 });
        count++;
      }
    }
  }
  return count;
}

function buildClockTower(scene, city) {
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x3a3340 });
  const tower = new THREE.Mesh(
    new THREE.BoxGeometry(12, 64, 12),
    new THREE.MeshLambertMaterial({ color: 0xd8cdb4 })
  );
  tower.position.set(-48, 32, -48);
  tower.castShadow = true;
  scene.add(tower);
  const face = new THREE.Mesh(
    new THREE.BoxGeometry(13, 10, 0.6),
    new THREE.MeshLambertMaterial({ map: textTexture(['12', '3  9', '6'], '#f5eeda', '#22222a') })
  );
  face.position.set(-48, 56, -41.6);
  scene.add(face);
  const spire = new THREE.Mesh(new THREE.ConeGeometry(7, 10, 4), roofMat);
  spire.position.set(-48, 69, -48);
  spire.rotation.y = Math.PI / 4;
  scene.add(spire);
  city.colliders.push({ x: -48, z: -48, hx: 6, hz: 6 });
}

// Billboards (fictional businesses). All four stand inside city blocks,
// clear of the driving lanes — a pole in the road once wedged a car
// against it forever.
function buildBillboards(scene, city, rng) {
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x3a3340 });
  const ads = [
    { x: -116, z: 116, lines: ['CASINO', 'PERLA'], bg: '#7c1d3f', fg: '#ffd98a' },
    { x: 116, z: -116, lines: ['CINE SOL'], bg: '#14324a', fg: '#9fd8ff' },
    { x: 112, z: 344, lines: ['MERCADO', 'VERDE'], bg: '#1d5c33', fg: '#eaffd0' },
    { x: 336, z: 116, lines: ['TALLER', 'TOMAS'], bg: '#8a5a1d', fg: '#fff3d6' },
  ];
  for (const ad of ads) {
    const pole = new THREE.Mesh(new THREE.BoxGeometry(1.5, 12, 1.5), roofMat);
    pole.position.set(ad.x, 6, ad.z);
    scene.add(pole);
    const board = new THREE.Mesh(
      new THREE.BoxGeometry(20, 9, 0.8),
      new THREE.MeshLambertMaterial({ map: textTexture(ad.lines, ad.bg, ad.fg) })
    );
    board.position.set(ad.x, 16, ad.z);
    board.rotation.y = rng() * Math.PI;
    scene.add(board);
    city.colliders.push({ x: ad.x, z: ad.z, hx: 1, hz: 1 });
  }
}

function buildPalms(scene, city) {
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x7a5a38 });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x3f8a4a });
  function palm(x, z) {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.55, 7, 6), trunkMat);
    trunk.position.set(x, 3.5, z);
    trunk.castShadow = true;
    scene.add(trunk);
    const crown = new THREE.Mesh(new THREE.SphereGeometry(2.6, 7, 5), leafMat);
    crown.scale.y = 0.55;
    crown.position.set(x, 7.4, z);
    crown.castShadow = true;
    scene.add(crown);
    city.colliders.push({ x, z, hx: 0.6, hz: 0.6 });
  }
  for (let z = -440; z <= 440; z += 44) {
    palm(336, z + 6);
    palm(368, z - 10);
    if (z % 88 === 0) palm(398, z + 20);
  }
}

function buildLamps(scene) {
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x2c2f36 });
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  for (const s of STREETS) {
    for (let v = -384; v <= 384; v += 96) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 7, 5), poleMat);
      pole.position.set(v + 10, 3.5, s + 10);
      scene.add(pole);
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.3, 0.5), lampMat);
      lamp.position.set(v + 10, 7.1, s + 10);
      scene.add(lamp);
    }
  }
}

function buildPier(scene) {
  const deckMat = new THREE.MeshLambertMaterial({ color: 0x8a6a42 });
  const deck = new THREE.Mesh(new THREE.BoxGeometry(80, 1, 10), deckMat);
  deck.position.set(480, 0.6, 200);
  deck.receiveShadow = true;
  scene.add(deck);
  for (let x = 452; x <= 516; x += 8) {
    for (const dz of [-4, 4]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 3, 6), deckMat);
      post.position.set(x, -0.5, 200 + dz);
      scene.add(post);
    }
  }
}

function buildClouds(scene, rng) {
  const cloudMat = new THREE.MeshLambertMaterial({ color: 0xfff2dd, transparent: true, opacity: 0.85 });
  for (let i = 0; i < 14; i++) {
    const cw = range(rng, 30, 70);
    const cloud = new THREE.Mesh(new THREE.BoxGeometry(cw, 5, range(rng, 14, 26)), cloudMat);
    cloud.position.set(range(rng, -500, 500), range(rng, 120, 190), range(rng, -500, 500));
    scene.add(cloud);
  }
}

function buildGraph() {
  const xs = [...STREETS, BOULEVARD_X];
  const nodes = [];
  const byKey = new Map();
  for (const x of xs) {
    for (const z of STREETS) {
      const n = { x, z, nbrs: [] };
      nodes.push(n);
      byKey.set(x + ',' + z, n);
    }
  }
  function link(a, b) {
    if (!a || !b) return;
    if (!a.nbrs.includes(b)) a.nbrs.push(b);
    if (!b.nbrs.includes(a)) b.nbrs.push(a);
  }
  for (const n of nodes) {
    link(n, byKey.get(n.x + ',' + (n.z - 96)));
    link(n, byKey.get(n.x + ',' + (n.z + 96)));
    link(n, byKey.get((n.x - 96) + ',' + n.z));
    link(n, byKey.get((n.x + 96) + ',' + n.z));
    if (n.x === BOULEVARD_X) link(n, byKey.get('288,' + n.z));
    if (n.x === 288) link(n, byKey.get(BOULEVARD_X + ',' + n.z));
  }
  return {
    nodes,
    neighbors(node) {
      return node.nbrs || [];
    },
    nodeAt(x, z) {
      let best = nodes[0];
      let bd = Infinity;
      for (const n of nodes) {
        const d = (n.x - x) * (n.x - x) + (n.z - z) * (n.z - z);
        if (d < bd) {
          bd = d;
          best = n;
        }
      }
      return best;
    },
  };
}

// 12 glowing stash boxes, seeded, never inside a building.
function placeStashes(scene, city, seed) {
  const stashRng = mulberry32(seed * 31 + 5);
  const stashGeo = new THREE.BoxGeometry(1.6, 1.2, 1.6);
  const stashMat = new THREE.MeshBasicMaterial({ color: 0xffd23f });
  let placed = 0;
  let guard = 0;
  while (placed < 12 && guard++ < 400) {
    const x = range(stashRng, -460, 460);
    const z = range(stashRng, -460, 460);
    if (city.collides(x, z, 3)) continue;
    let nearLoc = false;
    for (const k of Object.keys(LOCATIONS)) {
      if (Math.hypot(x - LOCATIONS[k].x, z - LOCATIONS[k].z) < 12) {
        nearLoc = true;
        break;
      }
    }
    if (nearLoc) continue;
    const mesh = new THREE.Mesh(stashGeo, stashMat);
    mesh.position.set(x, 0.9, z);
    scene.add(mesh);
    const glow = new THREE.PointLight(0xffd23f, 0.7, 12);
    glow.position.set(x, 2, z);
    scene.add(glow);
    city.stashes.push({ x, z, taken: false, mesh, glow });
    placed++;
  }
}

function attachCityHelpers(city) {
  city.districtAt = function (x, z) {
    for (const d of DISTRICTS) {
      if (Math.hypot(x - d.x, z - d.z) <= d.r) return d;
    }
    let best = DISTRICTS[0];
    let bd = Infinity;
    for (const d of DISTRICTS) {
      const dd = Math.hypot(x - d.x, z - d.z);
      if (dd < bd) {
        bd = dd;
        best = d;
      }
    }
    return best;
  };

  city.updateSun = function (px, pz) {
    const sun = city.sunLight;
    sun.position.set(px - 260, 180, pz + 120);
    sun.target.position.set(px, 0, pz);
  };

  city.setMarker = function (x, z, label) {
    city.clearMarker();
    const grp = new THREE.Group();
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.5, 42, 8, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.35, side: THREE.DoubleSide })
    );
    beam.position.y = 21;
    grp.add(beam);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(5, 0.35, 8, 28),
      new THREE.MeshBasicMaterial({ color: 0xffd23f })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.4;
    grp.add(ring);
    const gem = new THREE.Mesh(
      new THREE.OctahedronGeometry(1.1),
      new THREE.MeshBasicMaterial({ color: 0xffe97a })
    );
    gem.position.y = 6;
    grp.add(gem);
    grp.position.set(x, 0, z);
    grp.userData.gem = gem;
    grp.userData.label = label || '';
    city._scene.add(grp);
    city.marker = grp;
  };

  city.clearMarker = function () {
    if (city.marker) {
      city._scene.remove(city.marker);
      city.marker = null;
    }
  };
}

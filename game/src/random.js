// Seeded randomness and the small math/format helpers every Palmera Bay
// module leans on. One mulberry32 stream per purpose keeps the city,
// stashes and spawns identical for a given seed.
const TAU = Math.PI * 2;

export function mulberry32(seed) {
  let state = seed | 0;
  return function nextRandom() {
    state = (state + 0x6d2b79f5) | 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick(rng, list) {
  return list[Math.floor(rng() * list.length)];
}

export function range(rng, lo, hi) {
  return lo + rng() * (hi - lo);
}

export function intRange(rng, lo, hi) {
  return lo + Math.floor(rng() * (hi - lo + 1));
}

export function clamp(value, lo, hi) {
  if (value < lo) return lo;
  if (value > hi) return hi;
  return value;
}

export function lerp(from, to, t) {
  return from + (to - from) * t;
}

export function dist2(ax, az, bx, bz) {
  const dx = ax - bx;
  const dz = az - bz;
  return dx * dx + dz * dz;
}

// Shortest signed turn from heading b to heading a, in (-PI, PI].
export function angleDiff(a, b) {
  const wrapped = (((a - b + Math.PI) % TAU) + TAU) % TAU;
  const d = wrapped - Math.PI;
  return d === -Math.PI ? Math.PI : d;
}

export function wrapAngle(a) {
  const wrapped = (((a + Math.PI) % TAU) + TAU) % TAU;
  const r = wrapped - Math.PI;
  return r === -Math.PI ? Math.PI : r;
}

function pad2(n) {
  return n < 10 ? '0' + n : String(n);
}

function groupThousands(n) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function fmtCash(n) {
  return '$' + groupThousands(Math.round(n));
}

export function fmtTime(sec) {
  const total = Math.max(0, Math.floor(sec));
  return pad2(Math.floor(total / 60)) + ':' + pad2(total % 60);
}

// Game-clock minutes since midnight -> "HH:MM".
export function clockString(minutes) {
  const m = ((Math.floor(minutes) % 1440) + 1440) % 1440;
  return pad2(Math.floor(m / 60)) + ':' + pad2(m % 60);
}

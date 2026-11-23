// Save / load for Palmera Bay. The save lives in localStorage under
// SAVE_KEY and is written on job completion, on game over, every 45 s of
// play, and after standing quietly at the safehouse for 5 s. Loading is
// defensive: a corrupt or mistyped save is ignored, never a crash.
import { SAVE_KEY } from './config.js';

const DEFAULT_POS = { x: -336, z: 336 };
const DEFAULT_CLOCK = 17 * 60 + 41;

function finiteNumber(value, fallback) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function wholeIn(value, lo, hi, fallback) {
  return Math.max(lo, Math.min(hi, Math.floor(finiteNumber(value, fallback))));
}

function objectOrNull(value) {
  return value && typeof value === 'object' ? value : null;
}

export function makeSave(W) {
  const S = {};

  function snapshot() {
    const p = W.player;
    const last = W.lastCar;
    return {
      cash: Math.round(p.cash),
      respect: Math.round(p.respect),
      hp: Math.round(p.hp),
      armour: Math.round(p.armour),
      x: +p.x.toFixed(2),
      z: +p.z.toFixed(2),
      jobIndex: W.missions.jobIndex,
      completedJobs: W.missions.completedJobs,
      weaponId: p.weaponId,
      weapons: JSON.parse(JSON.stringify(p.weapons)),
      stats: JSON.parse(JSON.stringify(p.stats)),
      clockMinutes: Math.round(W.clockMinutes),
      stashesTaken: W.city.stashes.map((s) => !!s.taken),
      carMods: last
        ? {
            type: last.type,
            color: last.color,
            tuned: !!last.tuned,
            plated: !!last.plated,
            nitro: !!last.nitro,
            cond: Math.round(last.cond),
          }
        : null,
      savedAt: new Date().toISOString(),
    };
  }

  S.collect = snapshot;

  S.write = function () {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(snapshot()));
      return true;
    } catch (err) {
      return false;
    }
  };

  S.read = function () {
    let raw = null;
    try {
      raw = localStorage.getItem(SAVE_KEY);
    } catch (err) {
      return null;
    }
    if (!raw) return null;
    let data = null;
    try {
      data = JSON.parse(raw);
    } catch (err) {
      return null;
    }
    if (!data || typeof data !== 'object') return null;
    // Any numeric field that is not a finite number falls back to a safe
    // default instead of crashing the game.
    return {
      cash: finiteNumber(data.cash, 250),
      respect: finiteNumber(data.respect, 0),
      hp: finiteNumber(data.hp, 100),
      armour: finiteNumber(data.armour, 0),
      x: finiteNumber(data.x, DEFAULT_POS.x),
      z: finiteNumber(data.z, DEFAULT_POS.z),
      jobIndex: wholeIn(data.jobIndex, 0, 7, 0),
      completedJobs: wholeIn(data.completedJobs, 0, 8, 0),
      weaponId: typeof data.weaponId === 'string' ? data.weaponId : 'pistol',
      weapons: objectOrNull(data.weapons),
      stats: objectOrNull(data.stats),
      clockMinutes: finiteNumber(data.clockMinutes, DEFAULT_CLOCK),
      stashesTaken: Array.isArray(data.stashesTaken) ? data.stashesTaken : null,
      carMods: objectOrNull(data.carMods),
      savedAt: typeof data.savedAt === 'string' ? data.savedAt : '',
    };
  };

  S.exists = function () {
    try {
      return !!localStorage.getItem(SAVE_KEY);
    } catch (err) {
      return false;
    }
  };

  S.clear = function () {
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch (err) {
      /* storage may be unavailable; nothing to clear */
    }
  };

  return S;
}

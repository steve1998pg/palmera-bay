// Save / load for Palmera Bay. The save lives in localStorage under
// SAVE_KEY and is written on job completion, game over, every 45 s of play,
// and after standing quietly at the safehouse for 5 s. Loading is defensive:
// a corrupt or mistyped save is ignored, never a crash.
import { SAVE_KEY } from './config.js';

export function makeSave(W) {
  const S = {};

  S.collect = function () {
    const p = W.player;
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
      carMods: W.lastCar ? {
        type: W.lastCar.type, color: W.lastCar.color,
        tuned: !!W.lastCar.tuned, plated: !!W.lastCar.plated,
        nitro: !!W.lastCar.nitro, cond: Math.round(W.lastCar.cond),
      } : null,
      savedAt: new Date().toISOString(),
    };
  };

  S.write = function () {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(S.collect()));
      return true;
    } catch (e) {
      return false;
    }
  };

  S.read = function () {
    let raw = null;
    try { raw = localStorage.getItem(SAVE_KEY); } catch (e) { return null; }
    if (!raw) return null;
    let data = null;
    try { data = JSON.parse(raw); } catch (e) { return null; }
    if (!data || typeof data !== 'object') return null;
    // Validate the numeric fields; anything that is not a finite number is
    // dropped back to a safe default instead of crashing the game.
    const num = (v, dflt) => (typeof v === 'number' && Number.isFinite(v) ? v : dflt);
    return {
      cash: num(data.cash, 250),
      respect: num(data.respect, 0),
      hp: num(data.hp, 100),
      armour: num(data.armour, 0),
      x: num(data.x, -336),
      z: num(data.z, 336),
      jobIndex: Math.max(0, Math.min(7, Math.floor(num(data.jobIndex, 0)))),
      completedJobs: Math.max(0, Math.min(8, Math.floor(num(data.completedJobs, 0)))),
      weaponId: typeof data.weaponId === 'string' ? data.weaponId : 'pistol',
      weapons: (data.weapons && typeof data.weapons === 'object') ? data.weapons : null,
      stats: (data.stats && typeof data.stats === 'object') ? data.stats : null,
      clockMinutes: num(data.clockMinutes, 17 * 60 + 41),
      stashesTaken: Array.isArray(data.stashesTaken) ? data.stashesTaken : null,
      carMods: (data.carMods && typeof data.carMods === 'object') ? data.carMods : null,
      savedAt: typeof data.savedAt === 'string' ? data.savedAt : '',
    };
  };

  S.exists = function () {
    try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; }
  };

  S.clear = function () {
    try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }
  };

  return S;
}

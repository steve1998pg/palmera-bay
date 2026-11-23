// Save / load: one localStorage slot. Cash, respect, jobs, weapons, garage mods,
// stats and where you stood. Nothing leaves the browser.
import { SAVE_KEY } from './config.js';

const SAVE_VERSION = 1;

export function hasSave() {
  try { return !!localStorage.getItem(SAVE_KEY); } catch { return false; }
}

// A save only counts if it parses and looks like ours — a half-written or
// foreign value under the same key must not crash the boot path.
export function readSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s || typeof s !== 'object') return null;
    if (typeof s.cash !== 'number' || typeof s.jobIndex !== 'number') return null;
    if (!Number.isFinite(s.cash) || !Number.isFinite(s.jobIndex)) return null;
    return s;
  } catch { return null; }
}
export function saveLabel() {
  const s = readSave();
  if (!s) return '';
  return `JOB ${Math.min(8, (s.jobIndex || 0) + 1)}/8 · $${Math.floor(s.cash || 0).toLocaleString('en-US')} · ${new Date(s.savedAt).toLocaleDateString()}`;
}
export function writeSave(world) {
  try {
    const p = world.player;
    const data = {
      version: SAVE_VERSION,
      savedAt: Date.now(),
      cash: p.cash, respect: p.respect,
      hp: p.hp, armour: p.armour,
      x: p.x, z: p.z,
      jobIndex: world.missions.jobIndex,
      completedJobs: world.missions.completedJobs,
      weapons: p.weapons,
      weaponId: p.weaponId,
      stats: p.stats,
      clockMinutes: world.clockMinutes,
      stashesTaken: world.city.locations.stashes.map((s) => s.taken),
      carMods: world.lastCar ? { tuned: world.lastCar.tuned, plated: world.lastCar.plated, nitro: world.lastCar.nitro, cond: world.lastCar.cond, type: world.lastCar.type, color: world.lastCar.color } : null,
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch { return false; }
}
export function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch { /* no storage */ }
}

// Save / load: one localStorage slot. Cash, respect, jobs, weapons, garage mods,
// stats and where you stood. Nothing leaves the browser.
import { SAVE_KEY } from './config.js';

export function hasSave() {
  try { return !!localStorage.getItem(SAVE_KEY); } catch { return false; }
}
export function readSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
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

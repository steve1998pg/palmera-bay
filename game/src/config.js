// PALMERA BAY — world constants, districts, names, weapons, vehicles, ranks.
// Everything original: an invented coastal city, invented people, invented cars.
export const WORLD = {
  size: 960,            // city spans -480..480 on x and z
  roadGap: 96,          // block size
  roadWidth: 16,
  beachX: 384,          // sand starts here (east edge)
  seaX: 452,            // ocean starts here
  sunsetHour: 17.68,   // golden hour, fixed for the art direction
};

// Districts: name, centre, radius, flavour, danger.
export const DISTRICTS = [
  { name: 'Marina Row', sub: 'Palmera Bay', x: 300, z: 120, r: 130, blurb: 'Boats, bait shops and La Jefa’s table' },
  { name: 'Sundial Square', sub: 'Downtown', x: 0, z: 0, r: 150, blurb: 'Glass towers and the big clock' },
  { name: 'Old Cannery', sub: 'Northside', x: -240, z: -260, r: 140, blurb: 'Warehouses, smoke and old scores' },
  { name: 'Palm Heights', sub: 'Hillside', x: -260, z: 220, r: 130, blurb: 'Mansions above the smog' },
  { name: 'Seaglass Beach', sub: 'The Strand', x: 420, z: -40, r: 150, blurb: 'Sand, surf and stolen convertibles' },
  { name: 'Saltflats Port', sub: 'Docks', x: -80, z: -400, r: 140, blurb: 'Containers, cranes and Tiburon turf' },
  { name: 'Harbor Steps', sub: 'West End', x: -380, z: 60, r: 120, blurb: 'Stairs, markets and watchful eyes' },
  { name: 'Calle Verde', sub: 'Old Town', x: 120, z: -280, r: 130, blurb: 'Neon, cafés and fast talkers' },
];

// Streets run on the grid; the Strand boulevard hugs the beach.
export const STREET_NAMES = [
  'Palmera Blvd', 'Sundial Ave', 'Cannery Row', 'Hibiscus St', 'Marina Way', 'Coral St',
  'Harbor St', 'Tidewater Ave', 'Lantern St', 'Breakwater Rd', 'Amber Ave', 'Gull St',
  'Old Mill St', 'Seaglass Parade', 'Ridge Rd', 'Verde Lane',
];

// Wanted ranks (respect) — name, respect needed, crew unlocked.
export const RANKS = [
  { name: 'NOBODY', need: 0 },
  { name: 'DOCK HAND', need: 250 },
  { name: 'WHEELMAN', need: 600 },
  { name: 'FIXER', need: 1100 },
  { name: 'SHOT CALLER', need: 1800 },
  { name: 'BAY BOSS', need: 2600 },
];

// Weapons: key, name, damage, range, fire interval, mag, price, unlock rank.
export const WEAPONS = [
  { key: 1, id: 'fists', name: 'FISTS', dmg: 12, range: 2.6, rate: 0.38, mag: Infinity, price: 0, rank: 0, auto: false },
  { key: 2, id: 'pistol', name: 'P9 PISTOL', dmg: 22, range: 55, rate: 0.3, mag: 12, price: 400, rank: 0, auto: false },
  { key: 3, id: 'smg', name: 'KOBRA SMG', dmg: 14, range: 48, rate: 0.09, mag: 30, price: 1800, rank: 1, auto: true },
  { key: 4, id: 'shotgun', name: '12G BREACHER', dmg: 70, range: 22, rate: 0.9, mag: 6, price: 2600, rank: 2, auto: false, pellets: 6 },
  { key: 5, id: 'rifle', name: 'HARRIER LR', dmg: 55, range: 110, rate: 0.55, mag: 20, price: 6800, rank: 3, auto: false },
];

// Vehicle models: name, top speed (m/s), accel, handling, price (showroom), colour palette.
export const VEHICLE_TYPES = [
  { id: 'sedan', name: 'CALYX SEDAN', top: 30, accel: 13, turn: 1.9, price: 0 },
  { id: 'coupe', name: 'VELOZ COMET RS', top: 42, accel: 19, turn: 2.3, price: 12000 },
  { id: 'taxi', name: 'PALMERA CAB', top: 28, accel: 12, turn: 2.0, price: 0 },
  { id: 'van', name: 'CARGO VAN', top: 24, accel: 9, turn: 1.5, price: 0 },
  { id: 'truck', name: 'FLATBED HAULER', top: 22, accel: 8, turn: 1.3, price: 0 },
  { id: 'cruiser', name: 'PBPD CRUISER', top: 38, accel: 17, turn: 2.2, price: 0 },
  { id: 'sport', name: 'MERIDIAN GT', top: 46, accel: 21, turn: 2.5, price: 22000 },
  { id: 'bike', name: 'DUNE SCOOTER', top: 26, accel: 15, turn: 2.8, price: 0 },
];

export const CAR_COLORS = [
  0xe74c3c, 0xf39c12, 0x2ecc71, 0x3498db, 0x9b59b6, 0xecf0f1, 0x1abc9c, 0xe67e22,
  0xfd79a8, 0x00cec9, 0xfdcb6e, 0x6c5ce7, 0x636e72, 0xd63031, 0x00b894, 0x0984e3,
];

// Radio stations: name, tagline, tempo, scale — all procedurally sequenced, no recordings.
export const STATIONS = [
  { id: 'palmera', name: 'PALMERA FM 98.6', song: '“Golden Static”', bpm: 96, root: 55, minor: true, wave: 'sawtooth' },
  { id: 'mango', name: 'RADIO MANGO 101.2', song: '“Guava Sunrise”', bpm: 116, root: 65.41, minor: false, wave: 'square' },
  { id: 'coast', name: 'STATIC COAST 88.4', song: '“Night Tide”', bpm: 76, root: 49, minor: true, wave: 'triangle' },
];

// Crew abilities: key, name, role, cooldown seconds, description.
export const CREW = [
  { key: 'z', id: 'nico', name: 'NICO VEGA', role: 'GETAWAY · DRIVER', cd: 45, desc: 'Nico swaps your plates — wanted drops one star instantly.' },
  { key: 'x', id: 'tomas', name: 'TOMAS “WRENCH” IBARRA', role: 'QUICK FIX · MECHANIC', cd: 60, desc: 'Tomas patches your ride back to full condition, wherever you are.' },
  { key: 'c', id: 'sofia', name: 'SOFIA “EYES” RIVAS', role: 'DECOY · LOOKOUT', cd: 75, desc: 'Sofia fires a flare across town — every unit chases the decoy.' },
];

// Shop catalogue.
export const SHOP_CAR = [
  { id: 'repair', tag: 'FIX', name: 'FULL REPAIR', price: 250, desc: 'Your ride leaves the lift like new. Condition back to 100%.' },
  { id: 'respray', tag: 'PAINT', name: 'RESPRAY', price: 400, desc: 'A fresh coat in any colour. The PBPD description goes stale — heat cools faster.' },
  { id: 'tune', tag: '+12%', name: 'STAGE 2 TUNE', price: 2400, desc: 'Top speed and acceleration up 12%. One tune per car, fitted for good.' },
  { id: 'plating', tag: 'PLATE', name: 'ARMOUR PLATING', price: 3600, desc: 'Every car you drive takes half damage from crashes, bullets and blasts.' },
  { id: 'nitro', tag: 'N2O', name: 'NITRO KIT', price: 3200, desc: 'Hold SHIFT for a nitrous burst. Burns out fast, refills at the shop.' },
];
export const SHOP_GEAR = [
  { id: 'smg', tag: 'SMG', name: 'KOBRA SMG', price: 1800, desc: 'Fast, loud, hungry. 30-round mag, full auto.' },
  { id: 'shotgun', tag: '12G', name: '12G BREACHER', price: 2600, desc: 'Six pellets of argument at close range.' },
  { id: 'rifle', tag: 'LR', name: 'HARRIER LR', price: 6800, desc: 'Long-range precision. Reaches across the whole square.' },
  { id: 'ammo', tag: 'AMMO', name: 'AMMO, ALL GUNS', price: 200, desc: 'Full mags for every weapon you own.' },
  { id: 'vest', tag: 'VEST', name: 'BODY ARMOUR', price: 350, desc: 'Armour back to 100. Stops the first few mistakes.' },
];

export const START_CASH = 250;
export const SAVE_KEY = 'palmera-bay-save-v1';

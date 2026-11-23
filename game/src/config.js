// All tuning numbers, names and story data for Palmera Bay in one place.
// Nothing here is code logic; the other modules read these tables.
// Tables are written as arrays and indexed by id where lookups are needed,
// so a table can be read top to bottom in the order the game presents it.

export const SAVE_KEY = 'palmera-bay-save-v1';
export const WORLD = { min: -480, max: 480 };
export const STREETS = [-384, -288, -192, -96, 0, 96, 192, 288];
export const BOULEVARD_X = 352;
export const ROAD_W = 16;
export const START_CLOCK = 17 * 60 + 41; // 17:41
export const CLOCK_RATE = 0.35; // game minutes per real second of play
export const START_CASH = 250;

function keyed(rows) {
  const out = {};
  for (const row of rows) out[row.id] = row;
  return out;
}

export const RANKS = [
  { name: 'NOBODY', min: 0 },
  { name: 'DOCK HAND', min: 250 },
  { name: 'WHEELMAN', min: 600 },
  { name: 'FIXER', min: 1100 },
  { name: 'SHOT CALLER', min: 1800 },
  { name: 'BAY BOSS', min: 2600 },
];

export function rankFor(respect) {
  let best = RANKS[0];
  for (let i = 1; i < RANKS.length; i++) {
    if (respect >= RANKS[i].min) best = RANKS[i];
  }
  return best;
}

export const DISTRICTS = [
  { x: 300, z: 120, r: 130, name: 'Marina Row', sub: 'Palmera Bay', blurb: 'Boats, bait shops and La Jefa\u2019s table.' },
  { x: 0, z: 0, r: 150, name: 'Sundial Square', sub: 'Downtown', blurb: 'Glass towers and the big clock.' },
  { x: -240, z: -260, r: 140, name: 'Old Cannery', sub: 'Northside', blurb: 'Warehouses, smoke and old grudges.' },
  { x: -260, z: 220, r: 130, name: 'Palm Heights', sub: 'Hillside', blurb: 'Mansions above the fog.' },
  { x: 420, z: -40, r: 150, name: 'Seaglass Beach', sub: 'The Strand', blurb: 'Sand, surf and a stolen convertible.' },
  { x: -80, z: -400, r: 140, name: 'Saltflats Port', sub: 'Docks', blurb: 'Containers, cranes, Tiburon turf.' },
  { x: -380, z: 60, r: 120, name: 'Harbor Steps', sub: 'West End', blurb: 'Stairs, markets, watching eyes.' },
  { x: 120, z: -280, r: 130, name: 'Calle Verde', sub: 'Old Town', blurb: 'Neon, cafes, fast talk.' },
];

export const STREET_NAMES = [
  'Palmera Blvd', 'Sundial Ave', 'Cannery Row', 'Hibiscus St', 'Marina Way',
  'Coral St', 'Harbor St', 'Tidewater Ave', 'Lantern St', 'Breakwater Rd',
  'Amber Ave', 'Gull St', 'Old Mill St', 'Seaglass Parade', 'Ridge Rd', 'Verde Lane',
];

export const LOCATIONS = {
  garage: { label: 'Ibarra Customs', x: 340, z: 96 },
  safehouse: { label: 'Safehouse', x: -336, z: 336 },
  precinct: { label: 'PBPD Precinct', x: 0, z: -96 },
  raceStart: { label: 'Street Race', x: 352, z: -240 },
  pier: { label: 'The Pier', x: 500, z: 200 },
  plaza: { label: 'Sundial Square', x: -48, z: -48 },
  market: { label: 'Mercado Verde', x: 120, z: 352 },
  port: { label: 'Saltflats Port', x: -80, z: -400 },
};

// Weapons: key, id, name, damage, range (m), fire delay (s), mag size,
// price, respect rank that unlocks it, auto-fire, pellets per shot.
const WEAPON_ROWS = [
  { key: '1', id: 'fists', name: 'FISTS', dmg: 12, range: 2.6, rate: 0.38, mag: Infinity, price: 0, rank: 0, auto: false, pellets: 1 },
  { key: '2', id: 'pistol', name: 'P9 PISTOL', dmg: 22, range: 55, rate: 0.3, mag: 12, price: 400, rank: 0, auto: false, pellets: 1 },
  { key: '3', id: 'smg', name: 'KOBRA SMG', dmg: 14, range: 48, rate: 0.09, mag: 30, price: 1800, rank: 1, auto: true, pellets: 1 },
  { key: '4', id: 'shotgun', name: '12G BREACHER', dmg: 70, range: 22, rate: 0.9, mag: 6, price: 2600, rank: 2, auto: false, pellets: 6 },
  { key: '5', id: 'rifle', name: 'HARRIER LR', dmg: 55, range: 110, rate: 0.55, mag: 20, price: 6800, rank: 3, auto: false, pellets: 1 },
];
export const WEAPONS = keyed(WEAPON_ROWS);
export const WEAPON_ORDER = WEAPON_ROWS.map((w) => w.id);
export const START_RESERVE = { pistol: 60, smg: 120, shotgun: 24, rifle: 40 };
export const RELOAD_TIME = 0.9;

// Vehicles: id, name, top speed (m/s), acceleration, handling, showroom
// price, default paint.
const VEHICLE_ROWS = [
  { id: 'sedan', name: 'CALYX SEDAN', top: 30, accel: 13, handling: 1.9, price: 0, color: 0x3f7d4e },
  { id: 'coupe', name: 'VELOZ COMET RS', top: 42, accel: 19, handling: 2.3, price: 12000, color: 0xc22424 },
  { id: 'taxi', name: 'PALMERA CAB', top: 28, accel: 12, handling: 2.0, price: 0, color: 0xe8b93a },
  { id: 'van', name: 'CARGO VAN', top: 24, accel: 9, handling: 1.5, price: 0, color: 0xd8d3c8 },
  { id: 'truck', name: 'FLATBED HAULER', top: 22, accel: 8, handling: 1.3, price: 0, color: 0x5a6b7d },
  { id: 'cruiser', name: 'PBPD CRUISER', top: 38, accel: 17, handling: 2.2, price: 0, color: 0x1d3a5f },
  { id: 'sport', name: 'MERIDIAN GT', top: 46, accel: 21, handling: 2.5, price: 22000, color: 0xb01e3c },
  { id: 'bike', name: 'DUNE SCOOTER', top: 26, accel: 15, handling: 2.8, price: 0, color: 0x2fb3a3 },
];
export const VEHICLES = keyed(VEHICLE_ROWS);

// Crew: key, id, name, role, cooldown (s), heat change when used.
export const CREW = keyed([
  { key: 'Z', id: 'nico', name: 'NICO VEGA', role: 'GETAWAY \u00b7 DRIVER', cd: 45, heat: -26 },
  { key: 'X', id: 'tomas', name: 'TOMAS "WRENCH" IBARRA', role: 'QUICK FIX \u00b7 MECHANIC', cd: 60, heat: 0 },
  { key: 'V', id: 'sofia', name: 'SOFIA "EYES" RIVAS', role: 'DECOY \u00b7 LOOKOUT', cd: 75, heat: -45 },
]);

export const GIVERS = keyed([
  { id: 'celia', name: 'CELIA "LA JEFA" DUARTE', role: 'FIXER \u00b7 MARINA ROW', initials: 'CJ', color: '#f59e0b' },
  { id: 'tomas', name: 'TOMAS "WRENCH" IBARRA', role: 'MECHANIC \u00b7 IBARRA CUSTOMS', initials: 'TI', color: '#14b8a6' },
  { id: 'nico', name: 'NICO VEGA', role: 'DRIVER \u00b7 GETAWAY', initials: 'NV', color: '#38bdf8' },
  { id: 'sofia', name: 'SOFIA "EYES" RIVAS', role: 'LOOKOUT \u00b7 PALM HEIGHTS', initials: 'SR', color: '#fb7185' },
]);

// Job stages. x/z are world coords. kill stages carry `count`; race stages
// carry `checkpoints` + `time`; survive stages carry `time` + `heat`.
function mkJob(id, name, giver, reward, respect, stages) {
  return { id, name, giver, reward, respect, stages };
}

export const JOBS = [
  mkJob('first-wheels', 'FIRST WHEELS', 'tomas', 800, 150, [
    { type: 'go', x: 340, z: 96, label: 'Go to Ibarra Customs in Marina Row',
      say: 'Dante. You are back, and already you owe everybody. Come to my shop. I have a job that pays.' },
    { type: 'steal', x: 352, z: -40, carType: 'coupe', label: 'Steal the Veloz Comet RS',
      say: 'There is a red Comet parked on the boulevard. Take it. Quietly, if you can. Quickly, if you cannot.' },
    { type: 'deliver', x: 340, z: 96, label: 'Deliver the Comet to Ibarra Customs',
      say: 'Bring her home in one piece. Scratches I can fix. A police escort I cannot.' },
  ]),
  mkJob('repo-rodeo', 'REPO RODEO', 'celia', 1600, 220, [
    { type: 'steal', x: 288, z: 288, carType: 'sport', label: 'Steal the Meridian GT in Palm Heights',
      say: 'A little bird in Palm Heights stopped paying his debts. His Meridian GT is mine now. Go collect it.' },
    { type: 'deliver', x: 500, z: 200, label: 'Deliver the GT to the pier \u2014 lose the police',
      say: 'My boat is waiting at the pier. If the police follow you there, the deal is off. Lose them first.' },
  ]),
  mkJob('market-squeeze', 'MARKET SQUEEZE', 'nico', 2400, 300, [
    { type: 'kill', x: 120, z: 352, count: 5, label: 'Clear the Tiburon crew from the market',
      say: 'Tiburon boys are taxing my auntie\u2019s stall at the market. Five of them. Make the market safe again.' },
    { type: 'collect', x: 96, z: 300, label: 'Collect the stash behind the flower stall',
      say: 'They hid a stash behind the flower stall. It is yours now. Consider it a tip.' },
  ]),
  mkJob('dockside-ambush', 'DOCKSIDE AMBUSH', 'sofia', 3200, 380, [
    { type: 'kill', x: -80, z: -400, count: 7, label: 'Clear the Tiburon crew from the docks',
      say: 'Eyes on the docks: seven Tiburon guns guarding a shipment. I will call their positions. You do the rest.' },
    { type: 'steal', x: -80, z: -360, carType: 'van', label: 'Take the Tiburon cargo van',
      say: 'The van is the prize. Keys in the ignition, driver is... busy. Take it.' },
    { type: 'deliver', x: -336, z: 336, label: 'Deliver the van to the safehouse',
      say: 'Bring the van to the safehouse. Slow and steady \u2014 the cargo does not like bumps.' },
  ]),
  mkJob('high-tide', 'HIGH TIDE', 'nico', 4000, 450, [
    { type: 'race', time: 150, label: 'Hit every checkpoint before the clock dies',
      checkpoints: [[352, -320], [352, -120], [352, 80], [352, 280], [288, 288], [96, 288], [96, 96]],
      say: 'The tide run, Dante. Seven gates, two and a half minutes, the whole bay watching. Do not embarrass me.' },
  ]),
  mkJob('golden-hour', 'GOLDEN HOUR', 'celia', 5200, 520, [
    { type: 'survive', time: 90, heat: 78, label: 'Survive the manhunt \u2014 90 seconds',
      say: 'Every cop in the bay is coming for you, cari\u00f1o. Ninety seconds. Survive them, and the boat is yours.' },
    { type: 'go', x: 500, z: 200, label: 'Reach the boat at the pier',
      say: 'The boat is at the pier. Run, Dante. Do not look back.' },
  ]),
  mkJob('long-way-home', 'THE LONG WAY HOME', 'tomas', 6500, 600, [
    { type: 'deliver', x: 0, z: 0, label: 'Drop 1/3 \u2014 Sundial Square',
      say: 'Three packages, three corners of the bay. First stop: Sundial Square. Do not open them. Do not ask.' },
    { type: 'deliver', x: -288, z: -288, label: 'Drop 2/3 \u2014 Old Cannery',
      say: 'Second drop, Old Cannery. You are doing fine. The car is doing fine. Keep it that way.' },
    { type: 'deliver', x: 288, z: -288, label: 'Drop 3/3 \u2014 Calle Verde',
      say: 'Last one, Calle Verde. After this, you and I are square. Almost.' },
  ]),
  mkJob('bay-boss', 'BAY BOSS', 'celia', 20000, 900, [
    { type: 'kill', x: -48, z: -48, count: 8, label: 'Take Sundial Square back',
      say: 'Tiburon thinks the Square is theirs. Eight of them standing between you and this city. Take it back, Dante.' },
    { type: 'go', x: 500, z: 200, label: 'Meet La Jefa at the pier \u2014 the finale',
      say: 'Meet me at the pier. The whole bay is watching. Tonight, it becomes yours.' },
  ]),
];

export const RACE_SIDE = {
  entry: 500,
  winCash: 1200,
  winRespect: 60,
  time: 150,
  start: { x: 352, z: -240 },
  checkpoints: [[352, -320], [352, -40], [352, 220], [288, 288], [96, 288], [96, 96], [352, 96]],
};

// Taxi fares: the free-roam side job. A fare is quoted from the straight
// distance to the destination, the meter is the distance divided by a
// relaxed cruising speed plus slack, and a quick arrival earns a tip.
export const TAXI = {
  baseFare: 25, // flat pickup fee, $
  perMeter: 0.35, // $ per metre of straight-line distance
  maxFare: 400, // the longest ride never pays more than this
  timePerMeter: 1 / 12, // seconds of meter per metre (12 m/s cruise)
  timeSlack: 30, // extra seconds on every meter
  tipFraction: 0.25, // +25% when more than half the meter is left
  respectPerFare: 5, // respect for a completed fare
  pickupRange: 5, // press T within this many metres on foot
  pickupRangeCar: 7, // ...or this many metres from the driver's seat
  arriveRange: 12, // within this many metres of the destination: paid
  spawnDelayMin: 18, // seconds between fares, minimum
  spawnDelayMax: 40, // seconds between fares, maximum
  waitTimeout: 75, // a waiting fare gives up after this many seconds
  minSpawnDist: 60, // fares never spawn closer than this to the player
  minDestDist: 150, // destinations are at least this far away
  passengerTint: 0xe8b93a, // the yellow shirt a fare waves in
  followSpeed: 4.6, // m/s: a fare trails Dante to the car
  hardCrashDrop: 14, // m/s lost in one frame counts as a hard crash
};

export const RADIO = [
  { id: 'palmera', freq: '98.6', name: 'PALMERA FM', song: 'Golden Static', bpm: 96, root: 55, minor: true, wave: 'sawtooth' },
  { id: 'mango', freq: '101.2', name: 'RADIO MANGO', song: 'Guava Sunrise', bpm: 116, root: 65.41, minor: false, wave: 'square' },
  { id: 'static', freq: '88.4', name: 'STATIC COAST', song: 'Night Tide', bpm: 76, root: 49, minor: true, wave: 'triangle' },
];

export const SHOP_UPGRADES = [
  { id: 'repair', name: 'FULL REPAIR', price: 250, desc: 'Restore the car to perfect condition.' },
  { id: 'respray', name: 'RESPRAY', price: 400, desc: 'Fresh paint, fresh plates. Heat -20.' },
  { id: 'tune', name: 'STAGE 2 TUNE', price: 2400, desc: '+12% top speed and acceleration.' },
  { id: 'plating', name: 'ARMOUR PLATING', price: 3600, desc: 'Damage to your car is halved.' },
  { id: 'nitro', name: 'NITRO KIT', price: 3200, desc: 'Hold Shift for a nitro boost.' },
];

export const SHOP_GEAR = [
  { id: 'smg', name: 'KOBRA SMG', price: 1800, desc: 'Fast, loud, hungry. 30-round mag.' },
  { id: 'shotgun', name: '12G BREACHER', price: 2600, desc: 'Six pellets of bad news, up close.' },
  { id: 'rifle', name: 'HARRIER LR', price: 6800, desc: 'Long-range precision rifle.' },
  { id: 'ammo', name: 'AMMO ALL GUNS', price: 200, desc: 'Refill every reserve to full.' },
  { id: 'armour', name: 'BODY ARMOUR', price: 350, desc: 'Armour 100. Soaks 60% of damage.' },
];

export const SHOP_SHOWROOM = [
  { id: 'coupe', name: 'VELOZ COMET RS', price: 12000, desc: 'Red, quick, and already yours to keep.' },
  { id: 'sport', name: 'MERIDIAN GT', price: 22000, desc: 'The fastest thing on the boulevard.' },
];

export const UNIT_NAMES = ['TARPON', 'GECKO', 'HERON', 'MACKEREL', 'PELICAN', 'BARRACUDA', 'CORAL', 'MANATEE', 'OSPREY', 'SHARK'];

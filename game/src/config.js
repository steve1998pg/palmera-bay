// All tuning numbers, names and story data for Palmera Bay in one place.
// Nothing here is code logic; the other modules read these tables.

export const SAVE_KEY = 'palmera-bay-save-v1';
export const WORLD = { min: -480, max: 480 };
export const STREETS = [-384, -288, -192, -96, 0, 96, 192, 288];
export const BOULEVARD_X = 352;
export const ROAD_W = 16;
export const START_CLOCK = 17 * 60 + 41; // 17:41
export const CLOCK_RATE = 0.35; // game minutes per real second of play
export const START_CASH = 250;

export const RANKS = [
  { name: 'NOBODY', min: 0 },
  { name: 'DOCK HAND', min: 250 },
  { name: 'WHEELMAN', min: 600 },
  { name: 'FIXER', min: 1100 },
  { name: 'SHOT CALLER', min: 1800 },
  { name: 'BAY BOSS', min: 2600 },
];

export function rankFor(respect) {
  let r = RANKS[0];
  for (const cand of RANKS) if (respect >= cand.min) r = cand;
  return r;
}

export const DISTRICTS = [
  { name: 'Marina Row', sub: 'Palmera Bay', x: 300, z: 120, r: 130, blurb: 'Boats, bait shops and La Jefa\u2019s table.' },
  { name: 'Sundial Square', sub: 'Downtown', x: 0, z: 0, r: 150, blurb: 'Glass towers and the big clock.' },
  { name: 'Old Cannery', sub: 'Northside', x: -240, z: -260, r: 140, blurb: 'Warehouses, smoke and old grudges.' },
  { name: 'Palm Heights', sub: 'Hillside', x: -260, z: 220, r: 130, blurb: 'Mansions above the fog.' },
  { name: 'Seaglass Beach', sub: 'The Strand', x: 420, z: -40, r: 150, blurb: 'Sand, surf and a stolen convertible.' },
  { name: 'Saltflats Port', sub: 'Docks', x: -80, z: -400, r: 140, blurb: 'Containers, cranes, Tiburon turf.' },
  { name: 'Harbor Steps', sub: 'West End', x: -380, z: 60, r: 120, blurb: 'Stairs, markets, watching eyes.' },
  { name: 'Calle Verde', sub: 'Old Town', x: 120, z: -280, r: 130, blurb: 'Neon, cafes, fast talk.' },
];

export const STREET_NAMES = [
  'Palmera Blvd', 'Sundial Ave', 'Cannery Row', 'Hibiscus St', 'Marina Way',
  'Coral St', 'Harbor St', 'Tidewater Ave', 'Lantern St', 'Breakwater Rd',
  'Amber Ave', 'Gull St', 'Old Mill St', 'Seaglass Parade', 'Ridge Rd', 'Verde Lane',
];

export const LOCATIONS = {
  garage: { x: 340, z: 96, label: 'Ibarra Customs' },
  safehouse: { x: -336, z: 336, label: 'Safehouse' },
  precinct: { x: 0, z: -96, label: 'PBPD Precinct' },
  raceStart: { x: 352, z: -240, label: 'Street Race' },
  pier: { x: 500, z: 200, label: 'The Pier' },
  plaza: { x: -48, z: -48, label: 'Sundial Square' },
  market: { x: 120, z: 352, label: 'Mercado Verde' },
  port: { x: -80, z: -400, label: 'Saltflats Port' },
};

export const WEAPONS = {
  fists:   { key: '1', id: 'fists',   name: 'FISTS',        dmg: 12, range: 2.6, rate: 0.38, mag: Infinity, price: 0,    rank: 0, auto: false, pellets: 1 },
  pistol:  { key: '2', id: 'pistol',  name: 'P9 PISTOL',    dmg: 22, range: 55,  rate: 0.30, mag: 12,       price: 400,  rank: 0, auto: false, pellets: 1 },
  smg:     { key: '3', id: 'smg',     name: 'KOBRA SMG',    dmg: 14, range: 48,  rate: 0.09, mag: 30,       price: 1800, rank: 1, auto: true,  pellets: 1 },
  shotgun: { key: '4', id: 'shotgun', name: '12G BREACHER',dmg: 70, range: 22,  rate: 0.90, mag: 6,        price: 2600, rank: 2, auto: false, pellets: 6 },
  rifle:   { key: '5', id: 'rifle',   name: 'HARRIER LR',   dmg: 55, range: 110, rate: 0.55, mag: 20,       price: 6800, rank: 3, auto: false, pellets: 1 },
};

export const WEAPON_ORDER = ['fists', 'pistol', 'smg', 'shotgun', 'rifle'];
export const START_RESERVE = { pistol: 60, smg: 120, shotgun: 24, rifle: 40 };
export const RELOAD_TIME = 0.9;

export const VEHICLES = {
  sedan:   { id: 'sedan',   name: 'CALYX SEDAN',      top: 30, accel: 13, handling: 1.9, price: 0,     color: 0x3f7d4e },
  coupe:   { id: 'coupe',   name: 'VELOZ COMET RS',   top: 42, accel: 19, handling: 2.3, price: 12000, color: 0xc22424 },
  taxi:    { id: 'taxi',    name: 'PALMERA CAB',      top: 28, accel: 12, handling: 2.0, price: 0,     color: 0xe8b93a },
  van:     { id: 'van',     name: 'CARGO VAN',        top: 24, accel: 9,  handling: 1.5, price: 0,     color: 0xd8d3c8 },
  truck:   { id: 'truck',   name: 'FLATBED HAULER',   top: 22, accel: 8,  handling: 1.3, price: 0,     color: 0x5a6b7d },
  cruiser: { id: 'cruiser', name: 'PBPD CRUISER',     top: 38, accel: 17, handling: 2.2, price: 0,     color: 0x1d3a5f },
  sport:   { id: 'sport',   name: 'MERIDIAN GT',      top: 46, accel: 21, handling: 2.5, price: 22000, color: 0xb01e3c },
  bike:    { id: 'bike',    name: 'DUNE SCOOTER',     top: 26, accel: 15, handling: 2.8, price: 0,     color: 0x2fb3a3 },
};

export const CREW = {
  nico:  { key: 'Z', id: 'nico',  name: 'NICO VEGA',          role: 'GETAWAY \u00b7 DRIVER',   cd: 45, heat: -26 },
  tomas: { key: 'X', id: 'tomas', name: 'TOMAS "WRENCH" IBARRA', role: 'QUICK FIX \u00b7 MECHANIC', cd: 60, heat: 0 },
  sofia: { key: 'V', id: 'sofia', name: 'SOFIA "EYES" RIVAS', role: 'DECOY \u00b7 LOOKOUT',     cd: 75, heat: -45 },
};

export const GIVERS = {
  celia: { id: 'celia', name: 'CELIA "LA JEFA" DUARTE', role: 'FIXER \u00b7 MARINA ROW', initials: 'CJ', color: '#f59e0b' },
  tomas: { id: 'tomas', name: 'TOMAS "WRENCH" IBARRA', role: 'MECHANIC \u00b7 IBARRA CUSTOMS', initials: 'TI', color: '#14b8a6' },
  nico:  { id: 'nico',  name: 'NICO VEGA', role: 'DRIVER \u00b7 GETAWAY', initials: 'NV', color: '#38bdf8' },
  sofia: { id: 'sofia', name: 'SOFIA "EYES" RIVAS', role: 'LOOKOUT \u00b7 PALM HEIGHTS', initials: 'SR', color: '#fb7185' },
};

// Job stages. x/z are world coords. kill stages carry `count`; race stages
// carry `checkpoints` + `time`; survive stages carry `time` + `heat`.
export const JOBS = [
  {
    id: 'first-wheels', name: 'FIRST WHEELS', giver: 'tomas', reward: 800, respect: 150,
    stages: [
      { type: 'go', x: 340, z: 96, label: 'Go to Ibarra Customs in Marina Row',
        say: 'Dante. You are back, and already you owe everybody. Come to my shop. I have a job that pays.' },
      { type: 'steal', x: 352, z: -40, carType: 'coupe', label: 'Steal the Veloz Comet RS',
        say: 'There is a red Comet parked on the boulevard. Take it. Quietly, if you can. Quickly, if you cannot.' },
      { type: 'deliver', x: 340, z: 96, label: 'Deliver the Comet to Ibarra Customs',
        say: 'Bring her home in one piece. Scratches I can fix. A police escort I cannot.' },
    ],
  },
  {
    id: 'repo-rodeo', name: 'REPO RODEO', giver: 'celia', reward: 1600, respect: 220,
    stages: [
      { type: 'steal', x: 288, z: 288, carType: 'sport', label: 'Steal the Meridian GT in Palm Heights',
        say: 'A little bird in Palm Heights stopped paying his debts. His Meridian GT is mine now. Go collect it.' },
      { type: 'deliver', x: 500, z: 200, label: 'Deliver the GT to the pier \u2014 lose the police',
        say: 'My boat is waiting at the pier. If the police follow you there, the deal is off. Lose them first.' },
    ],
  },
  {
    id: 'market-squeeze', name: 'MARKET SQUEEZE', giver: 'nico', reward: 2400, respect: 300,
    stages: [
      { type: 'kill', x: 120, z: 352, count: 5, label: 'Clear the Tiburon crew from the market',
        say: 'Tiburon boys are taxing my auntie\u2019s stall at the market. Five of them. Make the market safe again.' },
      { type: 'collect', x: 96, z: 300, label: 'Collect the stash behind the flower stall',
        say: 'They hid a stash behind the flower stall. It is yours now. Consider it a tip.' },
    ],
  },
  {
    id: 'dockside-ambush', name: 'DOCKSIDE AMBUSH', giver: 'sofia', reward: 3200, respect: 380,
    stages: [
      { type: 'kill', x: -80, z: -400, count: 7, label: 'Clear the Tiburon crew from the docks',
        say: 'Eyes on the docks: seven Tiburon guns guarding a shipment. I will call their positions. You do the rest.' },
      { type: 'steal', x: -80, z: -360, carType: 'van', label: 'Take the Tiburon cargo van',
        say: 'The van is the prize. Keys in the ignition, driver is... busy. Take it.' },
      { type: 'deliver', x: -336, z: 336, label: 'Deliver the van to the safehouse',
        say: 'Bring the van to the safehouse. Slow and steady \u2014 the cargo does not like bumps.' },
    ],
  },
  {
    id: 'high-tide', name: 'HIGH TIDE', giver: 'nico', reward: 4000, respect: 450,
    stages: [
      { type: 'race', time: 150, label: 'Hit every checkpoint before the clock dies',
        checkpoints: [[352, -320], [352, -120], [352, 80], [352, 280], [288, 288], [96, 288], [96, 96]],
        say: 'The tide run, Dante. Seven gates, two and a half minutes, the whole bay watching. Do not embarrass me.' },
    ],
  },
  {
    id: 'golden-hour', name: 'GOLDEN HOUR', giver: 'celia', reward: 5200, respect: 520,
    stages: [
      { type: 'survive', time: 90, heat: 78, label: 'Survive the manhunt \u2014 90 seconds',
        say: 'Every cop in the bay is coming for you, cari\u00f1o. Ninety seconds. Survive them, and the boat is yours.' },
      { type: 'go', x: 500, z: 200, label: 'Reach the boat at the pier',
        say: 'The boat is at the pier. Run, Dante. Do not look back.' },
    ],
  },
  {
    id: 'long-way-home', name: 'THE LONG WAY HOME', giver: 'tomas', reward: 6500, respect: 600,
    stages: [
      { type: 'deliver', x: 0, z: 0, label: 'Drop 1/3 \u2014 Sundial Square',
        say: 'Three packages, three corners of the bay. First stop: Sundial Square. Do not open them. Do not ask.' },
      { type: 'deliver', x: -288, z: -288, label: 'Drop 2/3 \u2014 Old Cannery',
        say: 'Second drop, Old Cannery. You are doing fine. The car is doing fine. Keep it that way.' },
      { type: 'deliver', x: 288, z: -288, label: 'Drop 3/3 \u2014 Calle Verde',
        say: 'Last one, Calle Verde. After this, you and I are square. Almost.' },
    ],
  },
  {
    id: 'bay-boss', name: 'BAY BOSS', giver: 'celia', reward: 20000, respect: 900,
    stages: [
      { type: 'kill', x: -48, z: -48, count: 8, label: 'Take Sundial Square back',
        say: 'Tiburon thinks the Square is theirs. Eight of them standing between you and this city. Take it back, Dante.' },
      { type: 'go', x: 500, z: 200, label: 'Meet La Jefa at the pier \u2014 the finale',
        say: 'Meet me at the pier. The whole bay is watching. Tonight, it becomes yours.' },
    ],
  },
];

export const RACE_SIDE = {
  entry: 500, winCash: 1200, winRespect: 60, time: 150,
  start: { x: 352, z: -240 },
  checkpoints: [[352, -320], [352, -40], [352, 220], [288, 288], [96, 288], [96, 96], [352, 96]],
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

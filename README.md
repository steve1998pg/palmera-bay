# 🌅 PALMERA BAY

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/steve1998pg/palmera-bay/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/steve1998pg/palmera-bay/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![make.fun bounty](https://img.shields.io/badge/make.fun-GTA%206%20bounty-f59e0b)](https://make.fun/bounty/gta6-01)
[![license: MIT](https://img.shields.io/badge/license-MIT-14b8a6)](LICENSE)
[![play offline](https://img.shields.io/badge/play-offline%20in%20Chrome-38bdf8)](https://github.com/steve1998pg/palmera-bay)

**An original open-world crime game in a sun-soaked coastal city — built for the
[make.fun GTA 6 bounty](https://make.fun/bounty/gta6-01).** No Rockstar assets,
names, characters or music: the city, the people, the cars, the story and the
radio are all invented here.

Dante Cruz is back in Palmera Bay with $250, a borrowed pistol and a debt to
Celia “La Jefa” Duarte. Eight jobs stand between him and the whole city — if
the PBPD doesn’t get him first.

## Play

```sh
node serve.ts
# open http://localhost:8080
```

Static files only, no network request, no build step. Desktop Chrome, keyboard + mouse.

## What’s in the city

- **A living open world** — 8 districts (Marina Row, Sundial Square, Old Cannery,
  Palm Heights, Seaglass Beach, Saltflats Port, Harbor Steps, Calle Verde), a
  beach boulevard, a pier, traffic that follows the street grid, and pedestrians
  who flee a gunfight.
- **On foot and by car** — steal anything with four wheels (E), from taxis to the
  Meridian GT; arcade handling with drift, handbrake and nitro.
- **Wanted level 1–5** — PBPD dispatch with named pursuit units, roadblocks,
  foot cops and the AIR-1 helicopter with its spotlight. Break line of sight and
  the search zone shrinks until the heat is off.
- **8 story jobs** with staged objectives, timers, dialogue and payouts, plus a
  street race, 12 cash stashes and a garage.
- **Combat** — fists, pistol, SMG, shotgun and long rifle; hitscan gunplay with
  tracers, muzzle flashes and exploding cars.
- **Crew abilities** — Nico swaps your plates (Z), Tomas patches your ride (X),
  Sofia fires a decoy flare (V).
- **HUD with minimap** — mission card, PBPD dispatch panel, weapon slots, wanted
  stars, respect ranks, health/armour, speedometer, radio and a full city map (M).
- **Ibarra Customs** — repair, respray, tune, armour plating, nitro, guns, ammo
  and body armour, plus a showroom.
- **Save** — progress autosaves to the browser; continue from the title screen.
- **Radio** — three procedurally sequenced stations (Palmera FM, Radio Mango,
  Static Coast). All sound is synthesized live with WebAudio; there are no audio files.

## Controls

| Key | Action |
| --- | --- |
| W A S D | Move / drive |
| Mouse | Look & aim (click canvas to lock) |
| E | Enter / steal car · exit car |
| Space | Jump · handbrake in a car |
| Shift | Sprint · nitro (if fitted) |
| Click / F | Shoot / punch |
| 1–5, Q, R | Weapons · cycle · reload (R only reloads when the mag is short) |
| Z X V | Crew: getaway · repair · decoy |
| M | City map & stats (completion: 80% jobs + 20% respect) |
| P / Esc | Pause |
| C | Change radio station |
| G | Garage, at Ibarra Customs |

## Tech

- `three.js` (vendored `three.module.min.js` under `game/vendor/`) — low-poly
  golden-hour 3D, instanced buildings, palms and lamps, shadow-mapped sun.
- Vanilla ES modules, split by job: `city`, `vehicles`, `people`, `player`,
  `police`, `missions`, `hud`, `audio`, `save`, `shots`, `main`.
- `?shot=chase|street|garage|map&seed=1` stages deterministic screenshot scenes
  through the game’s own systems (see `shots.json`). The city layout, stash
  spots and screenshots are deterministic for a given seed — `city.js` builds
  its sections in a fixed order so the seeded RNG stream never shifts.
- `main.ts` hands the game in: it copies `game/` + `screenshots/` to `/output`
  and writes `dossier.json` with the kit’s `vendor/makefun-game.ts`.

## License

MIT — see [LICENSE](LICENSE).

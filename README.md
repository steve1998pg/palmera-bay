[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/steve1998pg/palmera-bay/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/steve1998pg/palmera-bay/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

# PALMERA BAY

A GTA-style open-world crime game that runs entirely in a desktop browser,
straight from its own files. Golden hour over a fictional coastal city:
Dante Cruz is back in Palmera Bay with $250, a borrowed pistol, and a debt
to Celia "La Jefa" Duarte. Eight story jobs stand between him and the
whole bay.

## Play it

```bash
node serve.ts
# then open http://localhost:8080
```

No build step and no network — three.js is vendored locally under
`game/vendor/`. Keyboard + mouse.

## What is in the game

- **A living city** — 960×960 m of streets, 8 districts, a beach, a pier, a
  clock tower, palms, billboards, traffic and pedestrians, all built
  deterministically from a seed (`?seed=7` by default).
- **8 story jobs** — steal cars, clear Tiburon crews, win a 7-gate street
  race, survive a 90-second manhunt at wanted level 4, and take Sundial
  Square back to become Bay Boss.
- **Driving** — arcade handling with a drift handbrake, nitro, tuning,
  armour plating and resprays at Ibarra Customs.
- **Wanted system** — heat, 5 stars, pursuing cruisers, foot cops, the
  AIR-1 helicopter with a spotlight, and roadblocks.
- **Combat** — 5 weapons (fists, pistol, SMG, shotgun, rifle) with hitscan
  tracers, reloads and armour.
- **Crew** — Nico (lose heat), Tomas (repair your car), Sofia (decoy flare
  that scatters the police).
- **Side activities** — a $500 street race and 12 hidden stashes worth
  $150 each.
- **Radio** — three fully synthesized WebAudio stations: Palmera FM, Radio
  Mango, Static Coast.
- **Progression** — respect ranks from NOBODY to BAY BOSS, cash, saves in
  localStorage, and a completion percentage on the map screen.

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | Walk / drive (camera relative) |
| Mouse | Look & aim (click the game to lock the mouse) |
| E | Enter / steal a car, exit a car |
| Space | Jump / handbrake |
| Shift | Run / nitro |
| Click / F | Shoot / punch |
| 1–5 | Weapons · Q cycle · R reload |
| Z / X / V | Nico / Tomas / Sofia |
| M | Map & stats · P / Esc pause · C radio · G garage |

## Tech

- three.js r160 (vendored, `game/vendor/three.module.min.js`)
- Plain ES modules, no build step; Node stdlib only for `serve.ts` and `main.ts`
- All music and sound effects are synthesized with WebAudio — no audio files

## Repo layout

- `game/index.html` + `game/css/style.css` — page and HUD
- `game/src/` — one module per system: `city`, `player`, `police`,
  `missions`, `people`, `vehicles`, `audio`, `hud`, `input`, `save`,
  `shots`, `config`, `random`, `main`
- `main.ts` / `serve.ts` — dossier builder and static server
- `screenshots/` — the 4 bounty screenshots

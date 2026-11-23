// PALMERA BAY — entry program for the make.fun GTA 6 bounty (Node 22, stdlib only).
// The game is this directory's game/ folder: plain static files a desktop browser
// loads offline (game/index.html and its ES modules, three.js vendored under
// game/vendor/), and the program hands it in. It copies game/ and screenshots/
// from beside this file to /output and writes /output/dossier.json, the summary
// the judge reads, with the vendored make.fun library.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes;
// the others refuse an entry the scorer would refuse (more than 4 screenshots or
// one over 256 KiB; more than 993 files in game/ or 48 MiB of game files, in all,
// or a path under game/ over 1000 bytes).
const DOSSIER_CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

function fail(message: string): never {
  console.error(`main.ts: ${message}`);
  process.exit(1);
}

// Copy the playable game and its screenshots into the output directory.
function copyGame() {
  const gameDir = join(here, 'game');
  if (!existsSync(gameDir) || !statSync(gameDir).isDirectory()) {
    fail(`game/ not found beside main.ts (looked in ${gameDir}) — nothing to hand in.`);
  }
  mkdirSync(out, { recursive: true });
  cpSync(gameDir, join(out, 'game'), { recursive: true });
  mkdirSync(join(out, 'screenshots'), { recursive: true });
  const shotsDir = join(here, 'screenshots');
  if (existsSync(shotsDir)) cpSync(shotsDir, join(out, 'screenshots'), { recursive: true });
}

function writeDossier() {
  writeFileSync(join(out, 'dossier.json'), buildDossier(out, DOSSIER_CAPS));
}

copyGame();
writeDossier();
console.log(`PALMERA BAY handed in: ${out} (dossier.json written)`);

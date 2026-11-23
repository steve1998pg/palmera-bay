// Palmera Bay entrypoint (Node 22+, stdlib only). Copies the game/ folder
// and the screenshots/ folder into the output directory and writes the
// dossier the judge reads, using make.fun's vendored library.
//
//   MAKEFUN_OUTPUT_DIR=/tmp/out node main.ts
//
// Without the variable, /output is used, as in the grader's container.
import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR || '/output';

// The scorer's own caps: only text_max_bytes shapes the outline; the rest
// refuse an entry the scorer would refuse anyway (too many / too large
// screenshots, too many game files, game too big, or a path too long).
const CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

function stageOutput() {
  mkdirSync(outDir, { recursive: true });
  cpSync(join(repoRoot, 'game'), join(outDir, 'game'), { recursive: true });
  const shotsInRepo = join(repoRoot, 'screenshots');
  const shotsOut = join(outDir, 'screenshots');
  mkdirSync(shotsOut, { recursive: true });
  if (existsSync(shotsInRepo)) {
    cpSync(shotsInRepo, shotsOut, { recursive: true });
  }
}

function writeDossier() {
  const dossier = buildDossier(outDir, CAPS);
  const target = join(outDir, 'dossier.json');
  writeFileSync(target, dossier);
  return target;
}

stageOutput();
const dossierPath = writeDossier();
console.log(`Palmera Bay dossier written to ${dossierPath}`);

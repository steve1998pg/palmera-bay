// Palmera Bay entrypoint (Node 22+, stdlib only): gather the game/ folder
// and the screenshots/ folder into the output directory and write the
// dossier the judge reads, using make.fun's vendored library.
//   MAKEFUN_OUTPUT_DIR=/tmp/out node main.ts
// (Without the variable, /output is used, as in the grader's container.)
import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const destination = process.env.MAKEFUN_OUTPUT_DIR || '/output';

mkdirSync(destination, { recursive: true });
cpSync(join(repoRoot, 'game'), join(destination, 'game'), { recursive: true });
mkdirSync(join(destination, 'screenshots'), { recursive: true });
const shotsDir = join(repoRoot, 'screenshots');
if (existsSync(shotsDir)) {
  cpSync(shotsDir, join(destination, 'screenshots'), { recursive: true });
}

// The scorer's own caps: only text_max_bytes shapes the outline; the rest
// refuse an entry the scorer would refuse anyway (too many / too large
// screenshots, too many game files, game too big, or a path too long).
const dossier = buildDossier(destination, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(destination, 'dossier.json'), dossier);
console.log(`Palmera Bay dossier written to ${join(destination, 'dossier.json')}`);

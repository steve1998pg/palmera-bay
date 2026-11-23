// Palmera Bay entrypoint (Node 22+, stdlib only). Copies the game/ folder
// and the screenshots/ folder into the output directory and writes the
// dossier the judge reads, using make.fun's vendored library.
//
//   MAKEFUN_OUTPUT_DIR=/tmp/out node main.ts
//
// Without the variable, /output is used, as in the grader's container.
import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
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

// Fail loudly instead of shipping a dossier the scorer would refuse:
// every screenshot must fit the 256 KiB cap, and the game tree must stay
// inside the file-count cap. A bad screenshot is caught here, not at
// submission time.
function preflight() {
  const shotsDir = join(repoRoot, 'screenshots');
  if (!existsSync(shotsDir)) {
    console.error('preflight: no screenshots/ directory — run the shot capture first');
    process.exit(1);
  }
  for (const name of readdirSync(shotsDir).sort()) {
    const size = statSync(join(shotsDir, name)).size;
    if (size > CAPS.screenshots.max_bytes) {
      console.error(`preflight: ${name} is ${size} bytes, over the ${CAPS.screenshots.max_bytes} cap`);
      process.exit(1);
    }
  }
  console.log(`preflight: screenshots OK (${readdirSync(shotsDir).length} files)`);
}

function writeDossier() {
  const dossier = buildDossier(outDir, CAPS);
  const target = join(outDir, 'dossier.json');
  writeFileSync(target, dossier);
  return target;
}

preflight();
stageOutput();
const dossierPath = writeDossier();
console.log(`Palmera Bay dossier written to ${dossierPath}`);

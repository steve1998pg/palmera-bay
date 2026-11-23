// Palmera Bay static server (Node stdlib only).
// Serves the game/ folder on http://localhost:<port> for local playtesting.
//   node serve.ts [--port 8080] [--host 127.0.0.1]
// Paths that escape game/ are refused with 403; missing files give 404;
// HEAD is answered with headers only, like GET.
import { createServer } from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import { join, resolve, normalize, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(join(fileURLToPath(new URL('.', import.meta.url)), 'game'));

const TYPES = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.gif', 'image/gif'],
  ['.webp', 'image/webp'],
  ['.svg', 'image/svg+xml'],
  ['.ico', 'image/x-icon'],
  ['.txt', 'text/plain; charset=utf-8'],
  ['.wasm', 'application/wasm'],
]);

function pickPort(argv) {
  const i = argv.indexOf('--port');
  const n = i === -1 ? 8080 : Number(argv[i + 1]);
  return Number.isInteger(n) && n > 0 && n < 65536 ? n : 8080;
}

function pickHost(argv) {
  const i = argv.indexOf('--host');
  return i === -1 ? '127.0.0.1' : argv[i + 1] || '127.0.0.1';
}

const port = pickPort(process.argv.slice(2));
const host = pickHost(process.argv.slice(2));

const server = createServer((req, res) => {
  const raw = req.url || '/';
  let path = '/';
  try {
    path = decodeURIComponent(new URL(raw, 'http://x').pathname);
  } catch {
    res.writeHead(400).end('bad request');
    return;
  }
  if (path.endsWith('/')) path += 'index.html';
  const file = resolve(join(root, normalize(path)));
  if (file !== root && !file.startsWith(root + sep)) {
    res.writeHead(403).end('forbidden');
    return;
  }
  let bytes = 0;
  try {
    const st = statSync(file);
    if (!st.isFile()) throw new Error('not a file');
    bytes = st.size;
  } catch {
    res.writeHead(404).end('not found');
    return;
  }
  const headers = {
    'content-type': TYPES.get(extname(file).toLowerCase()) || 'application/octet-stream',
    'content-length': bytes,
    'cache-control': 'no-store',
  };
  res.writeHead(200, headers);
  if (req.method === 'HEAD') { res.end(); return; }
  createReadStream(file).pipe(res);
});

server.listen(port, host, () => {
  console.log(`Palmera Bay: game/ is on http://${host}:${port}`);
});

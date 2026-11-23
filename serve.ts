// Palmera Bay static server (Node stdlib only).
// Serves the game/ folder for local playtesting:
//   node serve.ts [--port 8080] [--host 127.0.0.1]
// Paths that escape game/ are refused with 403; missing files give 404;
// HEAD is answered with headers only, like GET.
import { createServer } from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import { join, resolve, normalize, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(join(fileURLToPath(new URL('.', import.meta.url)), 'game'));

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.wasm': 'application/wasm',
};

function flagValue(argv, flag, fallback) {
  const at = argv.indexOf(flag);
  if (at === -1) return fallback;
  const value = argv[at + 1];
  return value === undefined || value === '' ? fallback : value;
}

function validPort(raw) {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 && n < 65536 ? n : 8080;
}

const args = process.argv.slice(2);
const port = validPort(flagValue(args, '--port', '8080'));
const host = flagValue(args, '--host', '127.0.0.1');

function requestPath(rawUrl) {
  try {
    return decodeURIComponent(new URL(rawUrl || '/', 'http://x').pathname);
  } catch {
    return null;
  }
}

function resolveInside(requested) {
  const withIndex = requested.endsWith('/') ? requested + 'index.html' : requested;
  const file = resolve(join(root, normalize(withIndex)));
  if (file !== root && !file.startsWith(root + sep)) return null;
  return file;
}

function serveFile(file, req, res) {
  let size = 0;
  try {
    const info = statSync(file);
    if (!info.isFile()) throw new Error('not a file');
    size = info.size;
  } catch {
    res.writeHead(404).end('not found');
    return;
  }
  res.writeHead(200, {
    'content-type': MIME[extname(file).toLowerCase()] || 'application/octet-stream',
    'content-length': size,
    'cache-control': 'no-store',
  });
  if (req.method === 'HEAD') {
    res.end();
    return;
  }
  createReadStream(file).pipe(res);
}

const server = createServer((req, res) => {
  const path = requestPath(req.url);
  if (path === null) {
    res.writeHead(400).end('bad request');
    return;
  }
  const file = resolveInside(path);
  if (file === null) {
    res.writeHead(403).end('forbidden');
    return;
  }
  serveFile(file, req, res);
});

server.listen(port, host, () => {
  console.log(`Palmera Bay: game/ is on http://${host}:${port}`);
});

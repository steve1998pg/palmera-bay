// A tiny static server for game/ (Node 22, standard library only), so the game can
// be played locally without a build step: `node serve.ts` serves game/ on
// http://localhost:8080. It sends the MIME types a browser game needs, refuses any
// path outside game/, and otherwise does nothing clever: a development convenience.
//   node serve.ts [--port 8080] [--host 127.0.0.1]
import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('./game', import.meta.url)));
const args = process.argv.slice(2);

function flagValue(name: string): string | undefined {
  const i = args.indexOf(name);
  if (i !== -1 && args[i + 1] !== undefined) return args[i + 1];
  const eq = args.find((a) => a.startsWith(name + '='));
  return eq ? eq.slice(name.length + 1) : undefined;
}

if (args.includes('--help') || args.includes('-h')) {
  console.log('Usage: node serve.ts [--port 8080] [--host 127.0.0.1]\nServes game/ on http://<host>:<port> (default 127.0.0.1:8080).');
  process.exit(0);
}

const requestedPort = Number(flagValue('--port') ?? 8080);
const port = Number.isInteger(requestedPort) && requestedPort > 0 && requestedPort < 65536 ? requestedPort : 8080;
const host = flagValue('--host') ?? '127.0.0.1';

const MIME: Record<string, string> = {
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
  '.woff2': 'font/woff2',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.bin': 'application/octet-stream',
  '.wasm': 'application/wasm',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.txt': 'text/plain; charset=utf-8',
};

const server = createServer((request, response) => {
  const url = new URL(request.url ?? '/', 'http://localhost');
  let pathname: string;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    response.writeHead(400).end('bad request');
    return;
  }
  if (pathname.endsWith('/')) pathname += 'index.html';
  const file = resolve(join(root, normalize(pathname)));
  if (file !== root && !file.startsWith(root + sep)) {
    response.writeHead(403).end('forbidden');
    return;
  }
  let size: number;
  try {
    const stats = statSync(file);
    if (!stats.isFile()) throw new Error('not a file');
    size = stats.size;
  } catch {
    response.writeHead(404).end('not found');
    return;
  }
  const headers = {
    'content-type': MIME[extname(file).toLowerCase()] ?? 'application/octet-stream',
    'content-length': size,
    'cache-control': 'no-store',
  };
  // HEAD answers with headers only — useful for health checks and link probes.
  if (request.method === 'HEAD') {
    response.writeHead(200, headers).end();
    return;
  }
  response.writeHead(200, headers);
  createReadStream(file).pipe(response);
});

server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`serve.ts: port ${port} is already in use — stop the other server or pass --port <free port>.`);
  } else {
    console.error(`serve.ts: ${err.message}`);
  }
  process.exit(1);
});

server.listen(port, host, () => {
  console.log(`game/ is on http://${host}:${port}`);
});

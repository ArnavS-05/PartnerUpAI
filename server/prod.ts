// Production server: serves the built SPA from dist/ and the API from the same
// origin (no CORS, no secrets in the browser). Run with `npm start`.
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { apiMiddleware } from './app';

try {
  process.loadEnvFile?.('.env');
} catch {
  // No .env file — rely on the real environment.
}

const DIST = resolve(process.cwd(), 'dist');
const PORT = Number(process.env.PORT) || 8787;
if(process.env.NODE_ENV==='production' && (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length<32)){
  throw new Error('Set a random SESSION_SECRET of at least 32 characters before publishing.');
}
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
};

const server = createServer(async (req, res) => {
  try {
    if (await apiMiddleware(req, res)) return;
    const url = new URL(req.url ?? '/', 'http://localhost');
    const requested = normalize(join(DIST, decodeURIComponent(url.pathname)));
    const safe = requested.startsWith(DIST + sep) && existsSync(requested) && statSync(requested).isFile();
    const file = safe ? requested : join(DIST, 'index.html');
    res.setHeader('Content-Type', TYPES[extname(file)] ?? 'application/octet-stream');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    if (file.includes(`${join('dist', 'assets')}`)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    createReadStream(file).pipe(res);
  } catch (error) {
    console.error(error);
    res.statusCode = 500;
    res.end('Server error');
  }
});

server.listen(PORT, () => console.log(`Partner Up AI running on http://localhost:${PORT}`));

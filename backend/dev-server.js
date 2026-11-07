/* Local development server (Node 18+, no packages needed).
   Serves the Pause website AND the AI backend on http://localhost:8787
     node backend/dev-server.js
   Settings come from backend/.dev.vars (copy .dev.vars.example). */
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { join, extname, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { handle } from './worker.js';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const PORT = +process.env.PORT || 8787;

const env = { ALLOWED_ORIGINS: `http://localhost:${PORT}`, PROVIDER: 'mock' };
const varsFile = join(here, '.dev.vars');
if (existsSync(varsFile)) {
  for (const line of readFileSync(varsFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*"?(.*?)"?\s*$/);
    if (m && !line.trim().startsWith('#')) env[m[1]] = m[2];
  }
}
Object.assign(env, Object.fromEntries(Object.entries(process.env).filter(([k]) => /^(PROVIDER|MODEL|ANTHROPIC_API_KEY|OPENAI_API_KEY|OPENAI_BASE_URL|ALLOWED_ORIGINS|RATE_LIMIT)$/.test(k))));

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.md': 'text/plain' };

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
    const chunks = []; for await (const c of req) chunks.push(c);
    const request = new Request(url, { method: req.method, headers: { ...req.headers, origin: req.headers.origin || `http://localhost:${PORT}` }, body: ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks) });
    const r = await handle(request, env);
    res.writeHead(r.status, Object.fromEntries(r.headers)); res.end(Buffer.from(await r.arrayBuffer()));
    return;
  }
  let path = normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, '');
  if (!path || path.endsWith('/')) path += 'index.html';
  if (path.includes('..') || path.startsWith('backend')) { res.writeHead(404); return res.end('Not found'); }
  try {
    const data = await readFile(join(root, path));
    res.writeHead(200, { 'Content-Type': TYPES[extname(path)] || 'application/octet-stream', 'Cache-Control': 'no-cache' }); res.end(data);
  } catch { res.writeHead(404); res.end('Not found'); }
}).listen(PORT, () => {
  console.log(`Pause is running at http://localhost:${PORT}`);
  console.log(`AI provider: ${env.PROVIDER}${env.PROVIDER === 'mock' ? ' (test mode: replies are placeholders, not AI)' : ''}`);
});

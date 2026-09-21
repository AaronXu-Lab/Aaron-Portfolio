// Run npm run build and npm run dev:stash first. Serves dist with the local API.
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
const root = resolve('dist');
const types = { '.webmanifest': 'application/manifest+json', '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' };
http.createServer(async (req, res) => {
  if (req.url.startsWith('/api/stash')) {
    const proxy = http.request({ hostname: '127.0.0.1', port: 8787, path: req.url, method: req.method, headers: req.headers }, upstream => {
      res.writeHead(upstream.statusCode, upstream.headers); upstream.pipe(res);
    });
    proxy.on('error', () => { res.writeHead(502); res.end('Local Worker unavailable'); });
    req.pipe(proxy); return;
  }
  try {
    let file = resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
    if (!file.startsWith(root + '/')) { res.writeHead(403); res.end(); return; }
    if ((await stat(file)).isDirectory()) file += '/index.html';
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream' }); res.end(body);
  } catch { res.writeHead(404); res.end(); }
}).listen(4322, '127.0.0.1', () => console.log('Stash preview: http://127.0.0.1:4322/tools/stash/'));

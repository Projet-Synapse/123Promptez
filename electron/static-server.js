// Minimal static file server for the packaged app.
//
// Why this exists: `expo export --platform web` emits root-absolute asset
// paths (e.g. `/_expo/static/js/web/entry-....js`). Those resolve fine when
// served from an HTTP origin, but under `file://` there is no origin to
// resolve "/" against, so the JS bundle silently 404s, React never
// hydrates, and the app is stuck on the static "Loading..." placeholder
// forever. Serving `dist/` over `http://127.0.0.1:<port>/` instead makes
// those absolute paths resolve exactly like a normal static web deploy.
const http = require('http');
const fs = require('fs');
const path = require('path');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.mp4': 'video/mp4',
  '.wasm': 'application/wasm',
};

/**
 * Serves `rootDir` as static files on 127.0.0.1 (loopback only — never
 * exposed to the network). Resolves on an ephemeral free port.
 * @param {string} rootDir
 * @returns {Promise<{ server: import('http').Server, url: string }>}
 */
function startStaticServer(rootDir) {
  const root = path.resolve(rootDir);

  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      let pathname;
      try {
        pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      } catch {
        res.writeHead(400).end('Bad request');
        return;
      }
      if (pathname === '/' || pathname === '') pathname = '/index.html';

      const resolved = path.normalize(path.join(root, pathname));
      // Guard against path traversal escaping the exported bundle.
      if (!resolved.startsWith(root)) {
        res.writeHead(403).end('Forbidden');
        return;
      }

      fs.readFile(resolved, (err, data) => {
        if (err) {
          // expo-router's static export produces one .html file per route
          // (no client-side history fallback needed) — a genuine 404.
          res.writeHead(404).end('Not found');
          return;
        }
        const ext = path.extname(resolved).toLowerCase();
        res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
        res.end(data);
      });
    });

    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({ server, url: `http://127.0.0.1:${port}/` });
    });
  });
}

module.exports = { startStaticServer };

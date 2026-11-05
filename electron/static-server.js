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

// Ports fixes : l'origine http fait partie de l'URL OAuth ET du localStorage
// (session Supabase). Une plage courte évite de basculer sur un port
// éphémère (origine différente → session « perdue ») dès qu'un seul port
// est pris. En dernier recours seulement, port 0 + avertissement.
const PREFERRED_PORTS = [47823, 47824, 47825, 47826, 47827];

/**
 * Serves `rootDir` as static files on 127.0.0.1 (loopback only — never
 * exposed to the network). Tries PREFERRED_PORTS in order so the origin
 * stays stable across launches; only falls back to an ephemeral port if
 * every preferred port is busy (session may not survive that launch).
 * @param {string} rootDir
 * @returns {Promise<{ server: import('http').Server, url: string }>}
 */
async function startStaticServer(rootDir) {
  const root = path.resolve(rootDir);

  for (const port of PREFERRED_PORTS) {
    try {
      return await listenOn(root, port);
    } catch (err) {
      if (err && err.code === 'EADDRINUSE') continue;
      throw err;
    }
  }

  console.warn(
    '[static-server] Tous les ports fixes sont pris ; port éphémère ' +
      '(la session Supabase de ce lancement ne sera pas réutilisée).',
  );
  return listenOn(root, 0);
}

function listenOn(root, port) {
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

      const serveShell = (res) => {
        // SPA fallback — même logique que le 404.html du déploiement GitHub
        // Pages : toute URL inconnue (ex. /login?code=… au retour OAuth)
        // doit servir l'app pour que le routeur et l'échange du code PKCE
        // puissent s'exécuter.
        fs.readFile(path.join(root, 'index.html'), (shellErr, shell) => {
          if (shellErr) {
            res.writeHead(404).end('Not found');
            return;
          }
          res.writeHead(200, { 'Content-Type': MIME_TYPES['.html'] });
          res.end(shell);
        });
      };

      fs.readFile(resolved, (err, data) => {
        if (err) {
          // L'export expo-router produit un fichier .html par route
          // (login.html, chat.html…) mais les URL réelles n'ont pas
          // d'extension : on essaie `<pathname>.html` avant le fallback.
          const withHtml = path.normalize(path.join(root, `${pathname}.html`));
          if (withHtml.startsWith(root)) {
            fs.readFile(withHtml, (htmlErr, html) => {
              if (htmlErr) {
                serveShell(res);
                return;
              }
              res.writeHead(200, { 'Content-Type': MIME_TYPES['.html'] });
              res.end(html);
            });
            return;
          }
          serveShell(res);
          return;
        }
        const ext = path.extname(resolved).toLowerCase();
        res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
        res.end(data);
      });
    });

    server.on('error', reject);
    server.listen(port, '127.0.0.1', () => {
      const { port: bound } = server.address();
      resolve({ server, url: `http://127.0.0.1:${bound}/` });
    });
  });
}

module.exports = { startStaticServer };

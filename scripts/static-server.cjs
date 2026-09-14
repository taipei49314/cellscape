'use strict';
/* Tiny static server for pool browser-acceptance. Node stdlib only; no Python. */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const port = Number(process.argv[2] || 8643);
const root = path.resolve(process.argv[3] || '.');
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.cjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.md': 'text/plain; charset=utf-8',
};
const server = http.createServer((req, res) => {
  const u = decodeURIComponent((req.url || '/').split('?')[0].split('#')[0]);
  const rel = u === '/' ? 'index.html' : u.replace(/^\/+/, '');
  const file = path.resolve(root, rel);
  if (!file.startsWith(root)) { res.writeHead(403); res.end('forbidden'); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'Content-Type': mime[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    res.end(data);
  });
});
server.listen(port, '127.0.0.1', () => {
  console.log('static ' + root + ' on 127.0.0.1:' + port);
});

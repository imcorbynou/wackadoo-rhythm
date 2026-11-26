import net from 'node:net';
import { createPhotoService } from './photo-service.mjs';
import http from 'node:http';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { launchFullscreen } from '../shared/fullscreen-browser.mjs';

const root = fileURLToPath(new URL('.', import.meta.url));
const desktop = process.env.BLUEY_DESKTOP || path.dirname(root);
// Serve the connection screen and existing games from one local origin.
const mounts = {
  '/shared/': path.join(desktop, 'shared'),
  '/phone/': process.env.BLUEY_PHONE_DIRECTORY || path.join(desktop, 'bluey phone'),
  '/vest-connect/': process.env.BLUEY_VEST_DIRECTORY || path.join(desktop, 'Bluey Vest Connect'),
  '/spinny-roundy/': path.join(desktop, 'bluey select song'),
  '/keepy-uppy/': process.env.BLUEY_GAME_DIRECTORY || path.join(desktop, 'Bluey Keepy Uppy Game', 'dist'),
};
const mime = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.mjs':'text/javascript; charset=utf-8', '.json':'application/json', '.mp4':'video/mp4', '.mov':'video/quicktime', '.mp3':'audio/mpeg', '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg', '.webp':'image/webp', '.gif':'image/gif', '.otf':'font/otf', '.wasm':'application/wasm' };

const localName = (process.env.BLUEY_HOSTNAME || os.hostname()).replace(/\.local$/, '');
const photoService = createPhotoService({ phoneURL: () => `${process.env.BLUEY_PUBLIC_ORIGIN || `http://${localName}.local:${port}`}/phone/` });

const server = http.createServer(async (req, res) => {
  try {
    const requestURL = new URL(req.url, 'http://localhost');
    if (await photoService.handle(req, res, requestURL)) return;
    const pathname = decodeURIComponent(requestURL.pathname);
    if (!['GET','HEAD'].includes(req.method)) { res.writeHead(405).end(); return; }
    if (pathname === '/__bluey_homepage') {
      res.writeHead(200, {'Content-Type':'text/plain'}).end('bluey-homepage'); return;
    }
    for (const route of Object.keys(mounts)) {
      if (pathname === route.slice(0, -1)) { res.writeHead(302, {Location:route}).end(); return; }
    }
    const route = Object.keys(mounts).find(route => pathname.startsWith(route));
    const base = route ? mounts[route] : root;
    const relative = route ? pathname.slice(route.length) : pathname.slice(1);
    const file = path.resolve(base, relative || 'index.html');
    if (file !== path.resolve(base) && !file.startsWith(path.resolve(base) + path.sep)) {
      res.writeHead(403).end('Forbidden'); return;
    }
    const info = await stat(file);
    if (!info.isFile()) { res.writeHead(404).end('Not found'); return; }
    let start = 0, end = info.size - 1;
    const headers = {'Content-Type':mime[path.extname(file)] || 'application/octet-stream', 'Accept-Ranges':'bytes', 'Cache-Control':'no-cache'};
    if (req.headers.range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
      if (!match || (!match[1] && !match[2])) { res.writeHead(416, {'Content-Range':`bytes */${info.size}`}).end(); return; }
      if (!match[1]) start = Math.max(0, info.size - Number(match[2]));
      else { start = Number(match[1]); if (match[2]) end = Math.min(end, Number(match[2])); }
      if (start > end || start >= info.size) { res.writeHead(416, {'Content-Range':`bytes */${info.size}`}).end(); return; }
      headers['Content-Range'] = `bytes ${start}-${end}/${info.size}`;
    }
    headers['Content-Length'] = end - start + 1;
    res.writeHead(req.headers.range ? 206 : 200, headers);
    if (req.method === 'HEAD') { res.end(); return; }
    const stream = createReadStream(file, {start, end});
    stream.on('error', () => res.destroy());
    res.on('close', () => stream.destroy());
    stream.pipe(res);
  } catch {
    res.writeHead(404, {'Content-Type':'text/plain; charset=utf-8'}).end('未找到网页或素材。请确认两个游戏文件夹与 bluey homepage 同在桌面。');
  }
});

let port = Number(process.env.PORT || 8940);
server.on('error', error => {
  console.error(error.code === 'EADDRINUSE' ? `Port ${port} is busy. Stop the previous Bluey server and restart; the QR address uses a fixed port.` : error.message); process.exit(1);
});
server.on('listening', () => {
  const url = `http://127.0.0.1:${port}${process.env.BLUEY_START_PATH || '/'}`;
  const lanAddress = Object.values(os.networkInterfaces()).flat().find(item => item.family === 'IPv4' && !item.internal && /^192\.168\.|^10\.|^172\.(1[6-9]|2\d|3[01])\./.test(item.address))?.address;
  if (lanAddress) console.log(`Phone fallback (same Wi-Fi): http://${lanAddress}:${port}/phone/`);
  console.log(`Bluey homepage: ${url}\nPhone photo page (same Wi-Fi): ${process.env.BLUEY_PUBLIC_ORIGIN || `http://${localName}.local:${port}`}/phone/\n保持此窗口开启。按 Control-C 停止服务。`);
  if (process.argv.includes('--open')) launchFullscreen(url);
});
server.on('close', () => photoService.close());
// Refuse an existing loopback-only server as well as wildcard listeners.
const probe = net.connect({host:'127.0.0.1',port});
probe.once('connect', async () => {
  probe.destroy();
  if(process.argv.includes('--open')) {
    try {
      const response=await fetch(`http://127.0.0.1:${port}/__bluey_homepage`,{signal:AbortSignal.timeout(2000)});
      if(response.ok&&await response.text()==='bluey-homepage') {
        photoService.close();
        launchFullscreen(`http://127.0.0.1:${port}${process.env.BLUEY_START_PATH||'/'}`);
        return;
      }
    } catch {}
  }
  console.error(`Port ${port} is busy. Stop the previous Bluey server, then restart.`);process.exit(1);
});
probe.once('error', error => { probe.destroy(); if(error.code === 'ECONNREFUSED') server.listen(port,'0.0.0.0'); else {console.error(error.message);process.exit(1);} });

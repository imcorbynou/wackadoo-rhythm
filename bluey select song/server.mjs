import http from 'node:http';
import {createReadStream} from 'node:fs';
import {stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('.', import.meta.url));
const port = Number(process.env.PORT || 8938);
const mime = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.mp4':'video/mp4','.mp3':'audio/mpeg','.png':'image/png','.otf':'font/otf'};
http.createServer(async (req,res) => {
  try {
    const requested = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = path.resolve(root, '.' + (requested === '/' ? '/index.html' : requested));
    if (!file.startsWith(root)) {res.writeHead(403).end(); return;}
    const info = await stat(file);
    if (!info.isFile()) {res.writeHead(404).end(); return;}
    const headers = {'Content-Type':mime[path.extname(file)] || 'application/octet-stream','Accept-Ranges':'bytes','Cache-Control':'no-cache'};
    let start = 0, end = info.size - 1;
    if (req.headers.range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
      if (!match || (!match[1] && !match[2])) {res.writeHead(416,{'Content-Range':`bytes */${info.size}`}).end(); return;}
      if (!match[1]) start = Math.max(0, info.size - Number(match[2]));
      else {start = Number(match[1]); if (match[2]) end = Math.min(end, Number(match[2]));}
      if (start > end || start >= info.size) {res.writeHead(416,{'Content-Range':`bytes */${info.size}`}).end(); return;}
      headers['Content-Range'] = `bytes ${start}-${end}/${info.size}`;
    }
    headers['Content-Length'] = end-start+1;
    res.writeHead(req.headers.range ? 206 : 200, headers);
    if (req.method === 'HEAD') res.end();
    else {const stream = createReadStream(file,{start,end}); stream.on('error',()=>res.destroy()); res.on('close',()=>stream.destroy()); stream.pipe(res);}
  } catch {res.writeHead(404).end('Not found');}
}).listen(port,'127.0.0.1',()=>console.log(`Bluey homepage: http://127.0.0.1:${port}`));

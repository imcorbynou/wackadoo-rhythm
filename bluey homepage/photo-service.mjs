import { randomUUID } from 'node:crypto';

// One exhibition station, one current photo. Nothing is written to disk.
export function createPhotoService({ ttl = 15 * 60 * 1000, now = Date.now, phoneURL } = {}) {
  let session = '', current = null;
  const headers = { 'Cache-Control': 'no-store, max-age=0', 'X-Content-Type-Options': 'nosniff' };
  function expire() { if (current && now() >= current.expiresAt) current = null; }
  function json(res, status, value) { res.writeHead(status, { ...headers, 'Content-Type':'application/json' }).end(JSON.stringify(value)); }
  function writer(req) {
    const address = req.socket.remoteAddress;
    if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(address)) return false;
    return (!req.headers.origin || req.headers.origin === `http://${req.headers.host}` || req.headers.origin === `https://${req.headers.host}`) && req.headers['sec-fetch-site'] !== 'cross-site';
  }
  async function body(req, max) {
    const chunks = []; let length = 0;
    for await (const chunk of req) { length += chunk.length; if (length > max) throw new Error('too-large'); chunks.push(chunk); }
    return Buffer.concat(chunks);
  }
  const sweep = setInterval(expire, Math.min(ttl, 30000)); sweep.unref();
  return {
    close() { clearInterval(sweep); current = null; session = ''; },
    async handle(req, res, url) {
      if (!url.pathname.startsWith('/api/photo')) return false;
      expire();
      if (['POST','PUT','DELETE'].includes(req.method) && !writer(req)) { json(res,403,{error:'Only the game computer can change photos.'}); return true; }
      try {
        if (url.pathname === '/api/photo/session' && req.method === 'POST') {
          session = randomUUID(); current = null; json(res,200,{session});
        } else if (url.pathname === '/api/photo/link' && req.method === 'GET') {
          json(res,200,{url:typeof phoneURL === 'function' ? phoneURL() : phoneURL});
        } else if (url.pathname === '/api/photo/clear' && req.method === 'POST') {
          const data = JSON.parse((await body(req,1024)).toString());
          if (data.session === session) { current = null; session = ''; }
          json(res,200,{ok:true});
        } else if (url.pathname === '/api/photo' && req.method === 'PUT') {
          const token = req.headers['x-photo-session'];
          if (!session || token !== session) { json(res,409,{error:'Photo session expired.'}); return true; }
          const bytes = await body(req,5*1024*1024);
          if (token !== session) { json(res,409,{error:'Photo session expired.'}); return true; }
          const png = Buffer.from([137,80,78,71,13,10,26,10]);
          if (req.headers['content-type'] !== 'image/png' || bytes.length < 33 || !bytes.subarray(0,8).equals(png) || bytes.toString('ascii',12,16) !== 'IHDR' || bytes.readUInt32BE(16) > 4096 || bytes.readUInt32BE(20) > 4096) {
            json(res,415,{error:'A PNG photo is required.'}); return true;
          }
          current = {id:randomUUID(),bytes,expiresAt:now()+ttl};
          json(res,200,{id:current.id,expiresAt:current.expiresAt});
        } else if (url.pathname === '/api/photo' && req.method === 'GET') {
          json(res,200,current ? {id:current.id,imageUrl:`/api/photo/image?id=${current.id}`,expiresAt:current.expiresAt} : {id:null});
        } else if (url.pathname === '/api/photo/image' && ['GET','HEAD'].includes(req.method)) {
          if (!current || url.searchParams.get('id') !== current.id) json(res,404,{error:'This photo is no longer available.'});
          else {
            res.writeHead(200,{...headers,'Content-Type':'image/png','Content-Length':current.bytes.length,'Content-Disposition':`${url.searchParams.has('download')?'attachment':'inline'}; filename="Bluey-and-me.png"`});
            res.end(req.method === 'HEAD' ? undefined : current.bytes);
          }
        } else json(res,404,{error:'Not found.'});
      } catch (error) { if (!res.headersSent) json(res,error.message==='too-large'?413:400,{error:'Unable to process photo.'}); }
      return true;
    },
  };
}

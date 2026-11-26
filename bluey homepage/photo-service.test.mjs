import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createPhotoService } from './photo-service.mjs';

const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a0p0AAAAASUVORK5CYII=','base64');

test('photo lifecycle: upload, mobile fetch, reset, stale uploads, expiry and no caching',async t=>{
 let clock=1000;
 const service=createPhotoService({ttl:500,now:()=>clock,phoneURL:'http://bluey.local:8940/phone/'});
 const server=http.createServer(async(req,res)=>{if(!await service.handle(req,res,new URL(req.url,'http://test')))res.writeHead(404).end();});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(async()=>{service.close();await new Promise(resolve=>server.close(resolve));});
 const origin=`http://127.0.0.1:${server.address().port}`;
 const call=(path,options={})=>fetch(origin+path,options);
 const newSession=async()=> (await (await call('/api/photo/session',{method:'POST'})).json()).session;
 const upload=(session,bytes=png)=>call('/api/photo',{method:'PUT',headers:{'Content-Type':'image/png','X-Photo-Session':session},body:bytes});
 assert.deepEqual(await(await call('/api/photo')).json(),{id:null});
 assert.equal((await(await call('/api/photo/link')).json()).url,'http://bluey.local:8940/phone/');
 const one=await newSession(); assert.equal((await upload(one)).status,200);
 const meta=await(await call('/api/photo')).json(); assert.ok(meta.id);assert.equal(meta.expiresAt,1500);
 const image=await call(meta.imageUrl);assert.equal(image.headers.get('cache-control'),'no-store, max-age=0');
 assert.deepEqual(Buffer.from(await image.arrayBuffer()),png);
 const two=await newSession(); assert.equal((await call(meta.imageUrl)).status,404);
 assert.equal((await upload(one)).status,409); // A previous game cannot overwrite a new game.
 assert.equal((await upload(two,Buffer.from('not a photo'))).status,415);
 assert.equal((await upload(two)).status,200);
 await call('/api/photo/clear',{method:'POST',body:JSON.stringify({session:one})});
 assert.ok((await(await call('/api/photo')).json()).id,'late unload must not delete newer photo');
 clock=1501;assert.deepEqual(await(await call('/api/photo')).json(),{id:null});
 assert.equal((await upload(two)).status,200);
 await call('/api/photo/clear',{method:'POST',body:JSON.stringify({session:two})});
 assert.deepEqual(await(await call('/api/photo')).json(),{id:null});
 assert.equal((await call('/api/photo/session',{method:'POST',headers:{Origin:'https://unrelated.example'}})).status,403);
 assert.equal((await call('/api/photo/session',{method:'POST',headers:{'Sec-Fetch-Site':'cross-site'}})).status,403);
});

test('reset during an unfinished upload rejects the old photo',async t=>{
 const service=createPhotoService();
 const server=http.createServer(async(req,res)=>{await service.handle(req,res,new URL(req.url,'http://test'));});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(async()=>{service.close();await new Promise(resolve=>server.close(resolve));});
 const origin=`http://127.0.0.1:${server.address().port}`;
 const begin=async()=> (await(await fetch(origin+'/api/photo/session',{method:'POST'})).json()).session;
 const old=await begin();
 let request;
 const response=new Promise((resolve,reject)=>{
  request=http.request(origin+'/api/photo',{method:'PUT',headers:{'Content-Type':'image/png','X-Photo-Session':old}},res=>{res.resume();resolve(res.statusCode);});
  request.on('error',reject);request.write(png.subarray(0,24));
 });
 await begin();request.end(png.subarray(24));
 assert.equal(await response,409);
 assert.deepEqual(await(await fetch(origin+'/api/photo')).json(),{id:null});
});

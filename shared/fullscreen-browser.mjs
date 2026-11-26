// A dedicated browser window keeps fullscreen across page navigation.
// Its isolated Escape handler does not change any page markup, styles or app code.
import {spawn} from 'node:child_process';
import {access,readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export function launchFullscreen(url) {
  const child=spawn(process.execPath,[fileURLToPath(import.meta.url),url],{detached:true,stdio:'ignore'});
  child.unref();
}

async function openFullscreen(url) {
  if(typeof WebSocket==='undefined')throw new Error('Fullscreen launch requires Node.js 22 or newer.');
  const chrome='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  await access(chrome);
  const profile=await mkdtemp(path.join(tmpdir(),'bluey-fullscreen-'));
  const child=spawn(chrome,[`--app=${url}`,'--start-fullscreen','--no-first-run','--no-default-browser-check',`--user-data-dir=${profile}`,'--remote-debugging-address=127.0.0.1','--remote-debugging-port=0'],{stdio:'ignore'});
  let socket;
  child.once('exit',()=>{socket?.close();void rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200});});
  const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  let target;
  for(let i=0;i<100;i++){
    if(child.exitCode!==null)throw new Error('The fullscreen browser closed before opening.');
    try{
      const port=(await readFile(path.join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0];
      const pages=await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      target=pages.find(page=>page.type==='page'&&page.url.startsWith(new URL(url).origin));
      if(target)break;
    }catch{}
    await delay(100);
  }
  if(!target){child.kill();throw new Error('Could not connect to the Bluey fullscreen window.');}
  socket=new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
  let sequence=0;
  let escapeTimer,contextId;
  const pending=new Map();
  function send(method,params={}){
    return new Promise((resolve,reject)=>{
      const id=++sequence;
      const timer=setTimeout(()=>{pending.delete(id);reject(new Error(`Browser command timed out: ${method}`));},5000);
      pending.set(id,{resolve,reject,timer});
      socket.send(JSON.stringify({id,method,params}));
    });
  }
  socket.addEventListener('message',({data})=>{
    const message=JSON.parse(data);
    if(message.id){
      const request=pending.get(message.id);
      if(!request)return;
      pending.delete(message.id);clearTimeout(request.timer);
      message.error?request.reject(new Error(message.error.message)):request.resolve(message.result);
    }else if(message.method==='Runtime.executionContextCreated'&&message.params.context.name==='bluey-launcher'){
      contextId=message.params.context.id;
    }
  });
  socket.addEventListener('close',()=>{
    clearInterval(escapeTimer);
    for(const request of pending.values()){clearTimeout(request.timer);request.reject(new Error('Browser closed.'));}
    pending.clear();
  });
  await send('Page.enable');
  await send('Runtime.enable');
  const source=`globalThis.blueyEscapeRequested=false;addEventListener('keydown',event=>{if(event.key==='Escape'){if(document.fullscreenElement)document.exitFullscreen().catch(()=>{});globalThis.blueyEscapeRequested=true;}},true);`;
  await send('Page.addScriptToEvaluateOnNewDocument',{source,worldName:'bluey-launcher'});
  const {frameTree}=await send('Page.getFrameTree');
  const {executionContextId}=await send('Page.createIsolatedWorld',{frameId:frameTree.frame.id,worldName:'bluey-launcher'});
  contextId=executionContextId;
  await send('Runtime.evaluate',{expression:source,contextId});
  const {windowId}=await send('Browser.getWindowForTarget');
  await send('Browser.setWindowBounds',{windowId,bounds:{windowState:'fullscreen'}});
  let checking=false;
  escapeTimer=setInterval(async()=>{
    if(checking||!contextId)return;
    checking=true;
    try{
      const {result}=await send('Runtime.evaluate',{expression:'(()=>{const requested=globalThis.blueyEscapeRequested;globalThis.blueyEscapeRequested=false;return requested})()',contextId,returnByValue:true});
      if(result.value===true)await send('Browser.setWindowBounds',{windowId,bounds:{windowState:'normal'}});
    }catch{/* A navigation briefly replaces the isolated context. */}
    finally{checking=false;}
  },150);
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  openFullscreen(process.argv[2]||'http://127.0.0.1:8940/').catch(error=>{console.error(error.message);process.exitCode=1;});
}

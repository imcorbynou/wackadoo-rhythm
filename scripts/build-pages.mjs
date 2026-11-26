import {cp, mkdir, readdir, readFile, writeFile, rm} from 'node:fs/promises';
import path from 'node:path';
const root=process.cwd(), out=path.join(root,'_site');
const raw=process.env.PAGES_BASE_PATH || '';
if(raw && (!raw.startsWith('/') || raw.includes('..') || !/^\/[a-zA-Z0-9_./-]*$/.test(raw))) throw new Error('Invalid PAGES_BASE_PATH');
const base=raw.replace(/\/$/,'');
const mounts={'bluey homepage':'home','bluey select song':'spinny-roundy','Bluey Vest Connect':'vest-connect','Bluey Keepy Uppy Game/dist':'keepy-uppy','bluey phone':'phone','shared':'shared'};
await rm(out,{recursive:true,force:true});await mkdir(out,{recursive:true});
for(const [source,dest] of Object.entries(mounts)) await cp(path.join(root,source),path.join(out,dest),{recursive:true,filter:p=>!/(?:^|\/)(?:\.DS_Store|server\.mjs|photo-service.*|.*\.test\.mjs|README.*)$/.test(p)});
async function walk(dir){for(const entry of await readdir(dir,{withFileTypes:true})){
 const file=path.join(dir,entry.name);
 if(entry.isDirectory()){if(entry.name!=='vendor')await walk(file);continue;}
 if(!/\.(html|css|mjs|js)$/.test(file))continue;
 let text=await readFile(file,'utf8');
 text=text.replace(/(["'`])\/(shared|keepy-uppy|spinny-roundy|vest-connect|phone)\//g,(_,quote,route)=>`${quote}${base}/${route}/`);
 // File-mode fallbacks are also rewritten so all navigation stays in the published tree.
 text=text.replace(/\.\.\/bluey%20select%20song\/index\.html/g,`${base}/spinny-roundy/`)
 .replace(/\.\.\/Bluey%20Vest%20Connect\/index\.html/g,`${base}/vest-connect/`)
 .replace(/\.\.\/\.\.\/bluey%20homepage\/index\.html/g,`${base}/`)
 .replace(/\.\.\/Bluey%20Keepy%20Uppy%20Game\/dist\/index\.html/g,`${base}/keepy-uppy/`);
 if(file.endsWith('/keepy-uppy/game.mjs'))text=text.replace(": '/');",`: '${base}/');`);
 if(file.endsWith('/keepy-uppy/photo-share.mjs')){
 text=text.replace("const online = /^https?:$/.test(location.protocol);",'const online = false; // GitHub Pages: photos stay on this device.');
 text=text.replace("status.textContent = 'Preparing your phone photo…';","status.textContent = 'Photo ready. Select Save photo to download on this device.';\n    return;");
 text=text.replace("card.classList.add('is-pinned'); button.setAttribute('aria-expanded','true');","button.setAttribute('aria-expanded','false');");
 }
 if(file.endsWith('/phone/app.mjs'))text="document.getElementById('photo-status')?.replaceChildren(document.createTextNode('Download your photo on the device where you played.'));\n";
 if(file.endsWith('.html') && !file.startsWith(path.join(out,'phone')+path.sep)) {
   text=text.replace('<head>',`<head><script src="${base}/shared/site-entry.js"></script>`);
 }
 await writeFile(file,text);
}}
await walk(out);await writeFile(path.join(out,'.nojekyll'),'');
await cp(path.join(root,'scripts/site-shell.html'),path.join(out,'index.html'));
console.log(`Built GitHub Pages site in _site with base ${base || '/'}`);

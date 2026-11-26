'use strict';
const $=id=>document.getElementById(id),audio=$('audio'),canvas=$('scene'),ctx=canvas.getContext('2d');
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
const characters=[{id:'bingo',name:'Bingo',color:'#df9d4c',src:'assets/bingo.png'},{id:'muffin',name:'Muffin',color:'#505363',src:'assets/muffin.png'},{id:'dougie',name:'Dougie',color:'#b66c36',src:'assets/dougie.png'},{id:'bluey',name:'Bluey',color:'#6aadd3',src:'assets/bluey-cutout.png'}];
const images=new Map(characters.map(c=>{const image=new Image();image.src=c.src;return[c.id,image]}));
let mode='volume',selectedCharacter='bluey',characterPage=0,ac,analyser,timeData,frequencyData,angle=0,last=0,width=0,height=0;
const levels=Array(7).fill(0);
let currentSongTitle='Bluey Theme Tune',artworkRequest=0;
const songArtworkCache=new Map();
const themes={
  bluey:{sky:'#a8ddfa',panel:'#ace1f5',ink:'#74a7c3',focus:'#397baf',background:'assets/background.png',label:'assets/theme-label.png',play:'assets/theme-play.png',pause:'assets/game%201%20pause.png',settings:'assets/game%201%20setting.png',fullscreen:'assets/game%201%20full%20screen.png',return:'assets/return.png'},
  bingo:{sky:'#ffbc82',panel:'#ffcea4',ink:'#ffbc82',focus:'#a95c26',background:'assets/Desktop%20-%202.png',label:'assets/themes/bingo/label.png',play:'assets/themes/bingo/play.png',pause:'assets/themes/bingo/pause.png',settings:'assets/bingo%20setting.png',fullscreen:'assets/bingo%20ui.png',return:'assets/return.png'},
  muffin:{sky:'#a7b3c9',panel:'#cdd9e9',ink:'#858fa8',focus:'#454858',background:'assets/themes/muffin/background.png',label:'assets/themes/muffin/label.png',play:'assets/themes/muffin/play.png',pause:'assets/themes/muffin/pause.png',settings:'assets/themes/muffin/settings.png',fullscreen:'assets/themes/muffin/fullscreen.png',return:'assets/return.png'},
  dougie:{sky:'#c59973',panel:'#e3be9c',ink:'#b58255',focus:'#784b2b',background:'assets/themes/dougie/background.png',label:'assets/themes/dougie/label.png',play:'assets/themes/dougie/play.png',pause:'assets/themes/dougie/pause.png',settings:'assets/themes/dougie/settings.png',fullscreen:'assets/themes/dougie/fullscreen.png',return:'assets/return.png'}
};
// Preload themes so character changes also update the artwork immediately.
const themeImages=Object.values(themes).flatMap(theme=>['background','label','play','pause','settings','fullscreen','return'].map(key=>{const image=new Image();image.src=theme[key];return image}));
// Recolor the blue artwork to the same fill as the song button.
// The matrix preserves neutral white borders, white glyphs and gray shadows.
function updateCharacterIconColor(theme){
  const hex=selectedCharacter==='bluey'?'#ace1f9':theme.panel;
  const target=[1,3,5].map(start=>parseInt(hex.slice(start,start+2),16));
  const [r,g,b]=target.map((value,index)=>(value-[172,225,249][index])/77);
  $('characterIconColorMatrix').setAttribute('values',[1-r,0,r,0,0,-g,1,g,0,0,-b,0,1+b,0,0,0,0,0,1,0].join(' '));
}
function applyTheme(){const theme=themes[selectedCharacter];updateCharacterIconColor(theme);$('stage').dataset.character=selectedCharacter;for(const key of ['sky','panel','ink','focus'])document.documentElement.style.setProperty('--'+key,theme[key]);$('stage').style.backgroundImage=`url("${theme.background}")`;updateSongArtwork(theme);$('settings').firstElementChild.src=theme.settings;$('closeSettings').firstElementChild.src=theme.return;document.querySelector('meta[name="theme-color"]').content=theme.sky;updatePlay()}
// Keep the original asset's pill, outline and shadow. Replace only its
// embedded title, fitting the new text inside the original title area.
async function updateSongArtwork(theme){
  const request=++artworkRequest,title=currentSongTitle,artwork=$('songArtwork');
  artwork.alt=title;
  if(title==='Bluey Theme Tune'){artwork.src=theme.label;return}
  const key=theme.label+'|'+title;
  if(songArtworkCache.has(key)){artwork.src=songArtworkCache.get(key);return}
  try{
    const image=new Image();
    await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=reject;image.src=theme.label});
    await document.fonts.load('100px BlueCustard');
    const surface=document.createElement('canvas');
    surface.width=image.naturalWidth;surface.height=image.naturalHeight;
    const c=surface.getContext('2d',{willReadFrequently:true}),w=surface.width,h=surface.height;
    c.drawImage(image,0,0);
    const pixel=c.getImageData(Math.floor(w*.80),Math.floor(h*.45),1,1).data;
    c.fillStyle=`rgb(${pixel[0]},${pixel[1]},${pixel[2]})`;
    c.fillRect(w*.037,h*.19,w*.612,h*.56);
    let fontSize=h*.56;
    c.font=`${fontSize}px BlueCustard`;
    fontSize*=Math.min(1,w*.598/c.measureText(title).width);
    c.font=`${fontSize}px BlueCustard`;
    c.fillStyle='#fff';c.textAlign='left';c.textBaseline='middle';
    c.fillText(title,w*.043,h*.447);
    const result=surface.toDataURL('image/png');
    songArtworkCache.set(key,result);
    if(request===artworkRequest){artwork.src=result;artwork.alt=title}
  }catch(error){console.warn('Unable to update song artwork',error)}
}
const characterOptions=$('characterOptions'),characterHover=$('characterHover');
let hoveredCharacter=null;
function hideCharacterHover(){hoveredCharacter=null;characterHover.hidden=true}
function showCharacterHover(button){if(!button||$('settingsPanel').hidden){hideCharacterHover();return}hoveredCharacter=button;characterHover.style.width=button.offsetWidth+'px';characterHover.style.height=button.offsetHeight+'px';characterHover.style.transform=`translate(${button.offsetLeft}px,${button.offsetTop}px)`;characterHover.hidden=false}
function trackCharacterPointer(event){document.documentElement.classList.remove('keyboard-navigation');if(event.pointerType!=='mouse'){hideCharacterHover();return}const button=event.target.closest('.character-button');showCharacterHover(button&&characterOptions.contains(button)?button:null)}
characterOptions.addEventListener('pointerover',trackCharacterPointer);
characterOptions.addEventListener('pointermove',trackCharacterPointer);
characterOptions.addEventListener('pointerleave',hideCharacterHover);
characterOptions.addEventListener('pointercancel',hideCharacterHover);
characterOptions.addEventListener('pointerdown',event=>{if(event.pointerType!=='mouse')hideCharacterHover()});
document.addEventListener('pointermove',event=>{document.documentElement.classList.remove('keyboard-navigation');if(!characterOptions.contains(event.target))hideCharacterHover()});
document.addEventListener('pointerdown',()=>document.documentElement.classList.remove('keyboard-navigation'));
document.addEventListener('keydown',event=>{if(['Tab','Enter',' ','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)){document.documentElement.classList.add('keyboard-navigation');hideCharacterHover()}});
window.addEventListener('blur',hideCharacterHover);
document.addEventListener('visibilitychange',()=>{if(document.hidden)hideCharacterHover()});
new ResizeObserver(()=>{if(hoveredCharacter)showCharacterHover(hoveredCharacter)}).observe(characterOptions);
function renderCharacters(){const available=characters.slice(0,3).map(c=>c.id===selectedCharacter?characters[3]:c);let buttons=[...characterOptions.querySelectorAll('.character-button')];
// Keep each hit area in place when switching characters; never redirect mouse focus.
if(!buttons.length){for(let i=0;i<3;i++){const button=document.createElement('button');button.className='character-button';const image=new Image();image.alt='';button.append(image,document.createElement('span'));button.onclick=()=>{const c=characters.find(item=>item.id===button.dataset.character);selectedCharacter=c.id;characterPage=0;canvas.setAttribute('aria-label',`Seven ${c.name} characters dancing in a circle`);applyTheme();renderCharacters()};characterOptions.append(button)}buttons=[...characterOptions.querySelectorAll('.character-button')]}
for(let i=0;i<buttons.length;i++){const c=available[(characterPage+i)%available.length],button=buttons[i];button.dataset.character=c.id;button.setAttribute('aria-label',`Switch to ${c.name}`);button.style.setProperty('--character-color',c.color);button.querySelector('img').src=c.src;button.querySelector('span').textContent=c.name}if(hoveredCharacter)showCharacterHover(hoveredCharacter)}
renderCharacters();applyTheme();$('nextCharacters').onclick=()=>{hideCharacterHover();characterPage=(characterPage+1)%3;renderCharacters()};
// Hover is a removable overlay, never an image filter or a pressed/focus state.
const assetButtons=[$('settings'),$('closeSettings')];
function clearIconHover(){assetButtons.forEach(button=>button.classList.remove('is-hovered'))}
for(const button of assetButtons){button.addEventListener('pointerenter',event=>{if(event.pointerType==='mouse')button.classList.add('is-hovered')});button.addEventListener('pointerleave',()=>button.classList.remove('is-hovered'));button.addEventListener('pointercancel',()=>button.classList.remove('is-hovered'))}
document.addEventListener('pointermove',event=>{if(event.pointerType!=='mouse')return;for(const button of assetButtons)button.classList.toggle('is-hovered',button.contains(event.target))});
document.addEventListener('pointerout',event=>{if(!event.relatedTarget)clearIconHover()});
document.documentElement.addEventListener('mouseleave',clearIconHover);
window.addEventListener('pagehide',clearIconHover);
window.addEventListener('blur',clearIconHover);
document.addEventListener('visibilitychange',()=>{if(document.hidden)clearIconHover()});
document.addEventListener('fullscreenchange',clearIconHover);
const settingsButtons=[$('settings')];
function setSettings(open){hideCharacterHover();$('settingsPanel').hidden=!open;$('stage').classList.toggle('settings-open',open);if(open)$('settings').classList.remove('is-hovered');settingsButtons.forEach(button=>{button.setAttribute('aria-expanded',String(open));button.setAttribute('aria-label',open?'Close settings':'Open settings')});updateSceneLayout()}
$('closeSettings').onclick=()=>{setSettings(false);$('settings').focus({preventScroll:true})};
settingsButtons.forEach(button=>button.onclick=()=>setSettings($('settingsPanel').hidden));
document.addEventListener('pointerdown',event=>{if(!$('settingsPanel').hidden&&!$('settingsPanel').contains(event.target)&&!settingsButtons.some(b=>b.contains(event.target)))setSettings(false)});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!$('settingsPanel').hidden){setSettings(false);$('settings').focus()}});
document.querySelectorAll('[data-mode]').forEach(button=>button.onclick=()=>{mode=button.dataset.mode;document.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)))});
function status(message){$('status').textContent=message;$('status').hidden=!message}
function initAudio(){if(ac)return;ac=new(window.AudioContext||window.webkitAudioContext)();analyser=ac.createAnalyser();analyser.fftSize=2048;analyser.smoothingTimeConstant=.72;ac.createMediaElementSource(audio).connect(analyser);analyser.connect(ac.destination);timeData=new Float32Array(analyser.fftSize);frequencyData=new Uint8Array(analyser.frequencyBinCount)}
$('play').onclick=async()=>{try{initAudio();await ac.resume();if(audio.paused)await audio.play();else audio.pause()}catch(error){status('Unable to play. Please try again.')}};
function updatePlay(){const playing=!audio.paused;$('play').firstElementChild.src=themes[selectedCharacter][playing?'pause':'play'];$('play').setAttribute('aria-label',playing?'Pause music':'Play music');$('play').title=playing?'Pause music':'Play music';$('stage').classList.toggle('is-playing',playing)}
audio.addEventListener('play',()=>{updatePlay();status('')});audio.addEventListener('pause',updatePlay);audio.addEventListener('error',()=>status('Unable to load audio. Please refresh and try again.'));
// The homepage server mounts this game at /spinny-roundy/.
// Direct file opening instead returns to the sibling desktop homepage folder.
$('home').href=location.protocol==='file:'
  ?new URL('../../bluey%20homepage/index.html',location.href).href
  :new URL('../../',location.href).href;
const musicWave=$('musicWave'),waveContext=musicWave.getContext('2d');
const waveIdle=[.52,.72,.42,.84,.47,.64,.84,.46,.70,.51,.84,.72,.44,.70,.55,.42];
const waveLevels=[...waveIdle];let waveWidth=0,waveHeight=0;
function resizeWave(){const rect=musicWave.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2);waveWidth=rect.width;waveHeight=rect.height;musicWave.width=Math.round(waveWidth*dpr);musicWave.height=Math.round(waveHeight*dpr);waveContext.setTransform(dpr,0,0,dpr,0,0)}
new ResizeObserver(resizeWave).observe(musicWave);
function drawMusicWave(playing,dt){waveContext.clearRect(0,0,waveWidth,waveHeight);waveContext.fillStyle='#fff';const step=waveWidth/16,barWidth=step*.70;
let rms=0;if(playing&&timeData&&!reducedMotion){for(const value of timeData)rms+=value*value;rms=Math.min(1,Math.sqrt(rms/timeData.length)*3.2)}
for(let i=0;i<16;i++){if(playing&&frequencyData&&!reducedMotion){const lo=45*Math.pow(12000/45,i/16),hi=45*Math.pow(12000/45,(i+1)/16),energy=band(lo,hi),target=.10+Math.min(1,energy*.78+rms*.30)*.84;waveLevels[i]+=(target-waveLevels[i])*(1-Math.exp(-dt*(target>waveLevels[i]?22:9)))}const h=Math.max(barWidth,waveLevels[i]*waveHeight),x=i*step+(step-barWidth)/2;waveContext.beginPath();waveContext.roundRect(x,(waveHeight-h)/2,barWidth,h,barWidth/2);waveContext.fill()}}
let sceneTarget=null,sceneCurrent=null;
function updateSceneLayout(){if(!width||!height)return;const mobile=width<=600,stageRect=$('stage').getBoundingClientRect(),edge=parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--edge'))||24;
let left=edge,right=width-edge,top=mobile?96:36,bottom=height-(mobile?100:100);
if(!$('settingsPanel').hidden){const panel=$('settingsPanel').getBoundingClientRect(),freeWidth=width-(panel.right-stageRect.left)-edge-24;
if(freeWidth>=250){left=panel.right-stageRect.left+24}else{top=90;bottom=panel.top-stageRect.top-16;left=edge;right=width-edge-20}}
const freeW=Math.max(80,right-left),freeH=Math.max(80,bottom-top),size=Math.max(25,Math.min(width*(mobile?.16:.105),freeH*.28,freeW*.23,145)),radius=Math.max(0,Math.min(width*(mobile?.30:.18),(freeH-size*1.45)/2,(freeW-size*1.45)/2));
sceneTarget={cx:(left+right)/2,cy:top+freeH/2,size,radius};if(!sceneCurrent)sceneCurrent={...sceneTarget}}
// Keep the panel exactly 16px above the responsive artwork/player height.
new ResizeObserver(()=>{const dockHeight=document.querySelector('.music-dock').getBoundingClientRect().height;document.documentElement.style.setProperty('--dock-height',dockHeight+'px');updateSceneLayout()}).observe(document.querySelector('.music-dock'));
new ResizeObserver(updateSceneLayout).observe(document.querySelector('.settings-card'));
function resize(){const r=canvas.getBoundingClientRect();width=r.width;height=r.height;const dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);updateSceneLayout()}new ResizeObserver(resize).observe($('stage'));
function band(low,high){const hz=ac.sampleRate/analyser.fftSize,a=Math.max(1,Math.floor(low/hz)),b=Math.min(frequencyData.length-1,Math.ceil(high/hz));let sum=0;for(let i=a;i<=b;i++)sum+=frequencyData[i]/255;return b>=a?Math.min(1,sum/(b-a+1)*1.35):0}
function frame(t){const dt=Math.min((t-last)/1000||0,.05);last=t;const playing=!audio.paused&&!audio.ended,targets=Array(7).fill(0);if(analyser&&playing){analyser.getFloatTimeDomainData(timeData);analyser.getByteFrequencyData(frequencyData);if(mode==='volume'){let sum=0;for(const v of timeData)sum+=v*v;targets.fill(Math.min(1,Math.sqrt(sum/timeData.length)*3.2))}else if(mode==='bass')targets.fill(band(35,220));else{const edges=[40,110,250,550,1200,2600,5500,12000];for(let i=0;i<7;i++)targets[i]=band(edges[i],edges[i+1])}if(!reducedMotion)angle+=dt*Math.PI*2/30}
drawMusicWave(playing,dt);ctx.clearRect(0,0,width,height);if(!sceneTarget)updateSceneLayout();if(!sceneCurrent){requestAnimationFrame(frame);return}const blend=reducedMotion?1:1-Math.exp(-dt*10);for(const key of ['cx','cy','size','radius'])sceneCurrent[key]+=(sceneTarget[key]-sceneCurrent[key])*blend;const {cx,cy,size,radius}=sceneCurrent,image=images.get(selectedCharacter);
for(let i=0;i<7;i++){levels[i]+=(targets[i]-levels[i])*(1-Math.exp(-dt*(targets[i]>levels[i]?16:7)));const a=angle+i*Math.PI*2/7-Math.PI/2,scale=reducedMotion?1:1+levels[i]*.45;ctx.save();ctx.translate(cx+Math.cos(a)*radius,cy+Math.sin(a)*radius);ctx.rotate(a+Math.PI/2);ctx.scale(scale,scale);if(image.complete&&image.naturalWidth){const ratio=image.naturalWidth/image.naturalHeight;ctx.drawImage(image,-size*ratio/2,-size/2,size*ratio,size)}ctx.restore()}requestAnimationFrame(frame)}requestAnimationFrame(frame);

// Song selected on the homepage; keep one audio source for visualization.
const incomingTracks={
  'theme':{title:'Bluey Theme Tune',src:'../assets/bluey.mp4'},
  'burger-dog':{title:'Burger Dog',src:'../assets/Burger%20Dog%20.mp3'},
  'dance-mode':{title:'Dance Mode',src:'../assets/Dance%20Mode.mp3'},
  'verandah-santa':{title:"Let's Play Verandah Santa",src:"../assets/Let's%20Play%20Verandah%20Santa.mp3"},
  'sleepytime':{title:'Sleepytime',src:'../assets/Sleepytime.mp3'}
};
const incomingTrack=incomingTracks[new URLSearchParams(location.search).get('song')];
if(incomingTrack){
  currentSongTitle=incomingTrack.title;
  updateSongArtwork(themes[selectedCharacter]);
  audio.src=incomingTrack.src;
  audio.load();
  document.title=`${incomingTrack.title} · Bluey Music Circle`;
  (async()=>{try{initAudio();await ac.resume();await audio.play()}catch{status('Press play to start your selected song.')}})();
}

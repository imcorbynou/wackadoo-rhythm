const tracks = [
  {title:'Bluey Theme Tune', cover:'bluey theme tune.png', audio:'bluey.mp4', id:'theme', color:'#73A6C7', playColor:'#83C7F8'},
  {title:'Burger Dog', cover:'burger dog.png', audio:'Burger Dog .mp3', id:'burger-dog', color:'#E63E5A'},
  {title:'Dance Mode', cover:'dance mode.png', audio:'Dance Mode.mp3', id:'dance-mode', color:'#6513C5'},
  {title:"Let's Play Verandah Santa", cover:"Let's play verandah santa.png", audio:"Let's Play Verandah Santa.mp3", id:'verandah-santa', color:'#3E3797'},
  {title:'Sleepytime', cover:'sleepytime.png', audio:'Sleepytime.mp3', id:'sleepytime', color:'#12143B'}
];
const music = document.querySelector('#song-audio');
const cover = document.querySelector('#cover');
const playNow = document.querySelector('#play-now');
const musicStatus = document.querySelector('#music-status');
const songButtons = [...document.querySelectorAll('.song')];
const assetUrl = filename => new URL(`assets/${encodeURIComponent(filename)}`, document.baseURI).href;
let selected = 0, request = 0;

// Preload artwork; song colors are the explicit design palette.
const covers = tracks.map(track => {const image=new Image();image.src=assetUrl(track.cover);return image;});
function fitSongLabels() {
  songButtons.forEach(button => {
    button.style.fontSize='';
    const available=button.parentElement.clientWidth;
    if(button.scrollWidth>available){
      const size=parseFloat(getComputedStyle(button).fontSize);
      button.style.fontSize=`${size*(available-42)/(button.scrollWidth-40)}px`;
    }
  });
}
new ResizeObserver(fitSongLabels).observe(document.querySelector('.song-list'));
document.fonts.ready.then(fitSongLabels);
function syncPlayback() {
  playNow.textContent='play now!';
  playNow.setAttribute('aria-label',`Open Music Circle with ${tracks[selected].title}`);
  if(!music.paused) musicStatus.textContent=`Previewing ${tracks[selected].title}`;
}
async function playSong() {
  const id=++request;
  try {
    await music.play();
    if (id===request) {musicStatus.textContent=`Playing ${tracks[selected].title}`;syncPlayback();}
  } catch (error) {
    if (id===request && error.name!=='AbortError') {
      musicStatus.textContent='Click a song to hear its preview.';
      syncPlayback();
    }
  }
}
function selectSong(index, autoplay=true) {
  const changed=index!==selected;
  if (changed) {
    ++request;
    // One audio element guarantees the old track is paused before the next loads.
    music.pause();
    selected=index;
    music.src=assetUrl(tracks[index].audio);
    music.load();
  }
  const track=tracks[index];
  cover.src=assetUrl(track.cover);
  cover.alt=track.title;
  document.documentElement.style.setProperty('--accent',track.color);
  document.documentElement.style.setProperty('--song-ink',track.color);
  document.documentElement.style.setProperty('--play-accent',track.playColor||track.color);
  songButtons.forEach((button,i)=>{
    button.classList.toggle('is-selected',i===index);
    button.setAttribute('aria-pressed',String(i===index));
  });
  syncPlayback();
  if (autoplay && (changed || music.paused)) playSong();
}
songButtons.forEach((button,index)=>{
  button.addEventListener('pointerenter',event=>{if(event.pointerType!=='touch')selectSong(index);});
  button.addEventListener('focus',()=>selectSong(index));
  button.addEventListener('click',()=>selectSong(index));
});
playNow.addEventListener('click',()=>{
  ++request;music.pause();
  const destination=new URL('music-circle/index.html',document.baseURI);
  destination.searchParams.set('song',tracks[selected].id);
  window.location.assign(destination.href);
});
for (const event of ['play','pause','ended']) music.addEventListener(event,syncPlayback);
music.addEventListener('error',()=>{musicStatus.textContent='This song could not load. Please try again.';syncPlayback();});
window.addEventListener('pagehide',()=>music.pause());
window.addEventListener('keydown',event=>{
  if (event.target.closest('button,input')) return;
  if (event.code==='Space') {event.preventDefault();music.paused ? playSong() : music.pause();}
  if (event.key.toLowerCase()==='m') music.muted=!music.muted;
});
music.src=assetUrl(tracks[0].audio);
selectSong(0,false);

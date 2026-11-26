import { showFinalPage, resetFinalPage } from './final-page.mjs';
import { COLORS, validateScore, createResponse, tapResponse, expireNotes, gradeResponse, midiFrequency } from './core.mjs';
import { publishTimeline, publishCue, publishTransport } from './cue-stream.mjs';
import { practiceRound, nextDifficulty } from './practice.mjs';
import { BALLOON_WIDTH, BALLOON_HEIGHT, balloonRoute, balloonPosition, fitBalloon } from './play-area.mjs';

const $ = id => document.getElementById(id);
const dom = Object.fromEntries(['game','stage','music','phase-art','pause','transport-art','phrase-dots','balloons','particles','feedback','ready-cue','round-label','overlay','overlay-title','overlay-message','primary','secondary','loading','announcer'].map(id => [id, $(id)]));
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const BALLOON_TRAVEL_TIME = 3.2;

// Reuse the PNG's own lettering; the hover filter swaps white and #73A6C7.
function pauseButtonArtwork(button,viewBox,label){
  const ns='http://www.w3.org/2000/svg';
  const art=document.createElementNS(ns,'svg'),image=document.createElementNS(ns,'image');
  art.setAttribute('viewBox',viewBox);art.setAttribute('class','pause-button-art');art.setAttribute('aria-hidden','true');
  image.setAttribute('href','assets/take%20a%20breather.png');image.setAttribute('width','3452');image.setAttribute('height','1854');
  image.setAttribute('filter','url(#pause-color-swap)');art.append(image);button.replaceChildren(art);
  button.setAttribute('aria-label',label);
}

class KeepyUppy {
  constructor() {
    this.score = null;
    this.difficulty = 0;
    this.successStreak = 0;
    this.round = null;
    this.roundIndex = 0;
    this.phase = 'loading';
    this.paused = false;
    this.response = null;
    this.phaseStarted = 0;
    this.elapsedBeforePause = 0;
    this.audioContext = null;
    this.master = null;
    this.balloons = [];
    this.dots = [];
    this.lastCue = -1;
    this.sessionHits = 0;
    this.sessionNotes = 0;
    this.operation = 0;
    this.completedRound = false;
    this.pendingAudio = false;
    this.muted = false;
    this.introComplete = false;
    this.initEvents();
    window.addEventListener('keepy:layout',()=>{
      this.balloons.forEach(b=>{const route=balloonRoute(this.roundIndex,b.index);b.home=route.home;b.landing=route.landing;b.hitFrom=fitBalloon(b.hitFrom);});
    });
    this.frame = this.frame.bind(this);
    requestAnimationFrame(this.frame);
  }

  initEvents() {
    dom.pause.addEventListener('click', () => this.togglePause());
    dom.primary.addEventListener('click', () => this.primaryAction());
    dom.secondary.addEventListener('click', () => location.reload());
    document.addEventListener('keydown', event => {
      if (event.repeat) return;
      if (event.code === 'Space' && !['BUTTON','INPUT'].includes(document.activeElement?.tagName)) {
        event.preventDefault();
        if (this.phase === 'ready') this.primaryAction();
        else this.togglePause();
      }
      if (this.phase === 'reply' && !this.paused) {
        const color = Object.keys(COLORS).find(name => COLORS[name].key === event.key);
        if (color) { event.preventDefault(); this.hit(color); }
      }
      if (event.key === 'Escape' && !this.paused && ['intro','listen','reply','result'].includes(this.phase)) this.togglePause();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && !this.paused && ['intro','listen','reply','result'].includes(this.phase)) this.togglePause();
    });
    dom.music.addEventListener('waiting', () => { if (['intro','listen'].includes(this.phase) && !this.paused) this.pendingAudio = true; });
    dom.music.addEventListener('playing', () => { this.pendingAudio = false; });
    dom.music.addEventListener('error', () => {
      if (this.phase !== 'loading') this.fail('The song could not be loaded. Check that Keepy Uppy.mp3 is in the assets folder.');
    });
  }

  async init() {
    try {
      const response = await fetch('score.json');
      if (!response.ok) throw new Error('The music pattern could not be loaded.');
      this.score = validateScore(await response.json());
      dom.music.src = this.score.audio;
      dom.music.defaultMuted = false;
      dom.music.muted = false;
      dom.music.volume = 1;
      await Promise.all([
        document.fonts.load('24px BlueCustard'),
        this.waitForMusic(),
        ...['assets/backyard.png','assets/red.png','assets/blue.png','assets/green.png','assets/yellow.png','assets/keepy-uppy.png','assets/beforegame/intro%20blackboard.png'].map(src => new Promise((resolve, reject) => {
          const image = new Image(); image.onload = resolve; image.onerror = () => reject(new Error('An image is missing: ' + src)); image.src = src;
        })),
      ]);
      dom.loading.hidden = true;
      dom.pause.disabled = false;
      // A trusted start click unlocks the song and Web Audio before camera taps.
      this.paused = true;
      this.setPhase('ready');
      this.showOverlay('Ready to play?', 'Feel the music. Then tap the colours!', "Let's play!", false);
    } catch (error) {
      this.fail(error.message);
    }
  }

  waitForMusic() {
    if (dom.music.readyState >= 2) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const clean = () => { clearTimeout(timer); dom.music.removeEventListener('loadeddata', loaded); dom.music.removeEventListener('error', failed); };
      const loaded = () => { clean(); resolve(); };
      const failed = () => { clean(); reject(new Error('Keepy Uppy.mp3 could not be loaded.')); };
      const timer = setTimeout(() => { clean(); reject(new Error('The music is taking too long to load. Please try again.')); }, 20000);
      dom.music.addEventListener('loadeddata', loaded, { once: true });
      dom.music.addEventListener('error', failed, { once: true });
      dom.music.load();
    });
  }

  async unlockAudio() {
    try {
      this.muted = false;
      dom.music.muted = false;
      dom.music.volume = 1;
      if (!this.audioContext || this.audioContext.state === 'closed') {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.master = this.audioContext.createGain();
        this.master.gain.value = this.muted ? 0 : .28;
        this.master.connect(this.audioContext.destination);
        // Analyse the existing music element without changing its output gain.
        this.musicAnalyser=this.audioContext.createAnalyser();
        this.musicAnalyser.fftSize=2048;
        this.musicAnalyser.smoothingTimeConstant=.72;
        this.musicSource=this.audioContext.createMediaElementSource(dom.music);
        this.musicSource.connect(this.musicAnalyser);
        this.musicAnalyser.connect(this.audioContext.destination);
      }
      if (this.audioContext.state !== 'running') await this.audioContext.resume();
      this.master.gain.value = .28;
    } catch { /* The game remains fully playable with visual feedback. */ }
  }

  setPhase(phase) {
    this.phase = phase;
    dom.game.dataset.phase = phase;
    dom.game.dataset.round = String(this.roundIndex + 1);
    const listening = ['intro','listen','ready','loading'].includes(phase);
    dom['phase-art'].src = listening ? 'assets/feel-the-rhythm.png' : 'assets/keepy-uppy.png';
    dom['phase-art'].alt = listening ? 'Feel the Rhythm! Watch the lights and feel the beat.' : 'Keepy Uppy! Keep the balloon up to the beat!';
    this.refreshTransport();
    this.clearFeedback();
  }

  refreshTransport() {
    const stopped = this.paused || ['ready','finished','error'].includes(this.phase);
    dom['transport-art'].src = stopped ? 'assets/play.png' : 'assets/pause.png';
    dom.pause.setAttribute('aria-label', stopped ? 'Resume game' : 'Pause game');
    dom.game.dataset.paused = String(this.paused);
  }

  makeDots(round) {
    dom['phrase-dots'].replaceChildren();
    this.dots = round.notes.map((note, index) => {
      const dot = document.createElement('div');
      dot.className = 'pattern-note';
      dot.style.setProperty('--note', COLORS[note.color].hex);
      dot.setAttribute('aria-label', `Note ${index + 1}: ${COLORS[note.color].name}`);
      const image = document.createElement('img');
      image.src = `assets/${note.color}.png`; image.alt = ''; image.draggable = false;
      dot.dataset.color = note.color;
      dot.append(image);
      dom['phrase-dots'].append(dot);
      return dot;
    });
  }

  async beginIntro(autoplay = false) {
    if (!(this.score.introDuration > 0)) { this.introComplete = true; await this.beginListen(0, autoplay); return; }
    const operation = ++this.operation;
    this.introComplete = false;
    this.roundIndex = 0;
    this.paused = false;
    this.response = null;
    this.pendingAudio = false;
    this.removeBalloons();
    this.dots = [];
    dom['phrase-dots'].replaceChildren();
    dom['ready-cue'].textContent = '';
    dom['round-label'].textContent = `Round 1/${this.score.rounds.length}`;
    dom.overlay.hidden = true;
    this.setPhase('intro');
    dom.announcer.textContent = `Enjoy the introduction. The music game starts after ${this.score.introDuration} seconds.`;
    dom.music.currentTime = 0;
    try {
      await dom.music.play();
      if (operation !== this.operation) return;
      if (this.paused || this.phase !== 'intro') dom.music.pause();
    } catch (error) {
      if (operation !== this.operation) return;
      dom.music.pause();
      if (autoplay || error.name === 'NotAllowedError') {
        this.paused = true;
        this.setPhase('ready');
        this.showOverlay('Ready to play?', 'Feel the music. Then tap the colours!', "Let's play!", false);
      } else this.fail('The music could not start. Tap below to try again.');
    }
  }

  async beginListen(index, autoplay = false, continuePlaying = false) {
    if (index >= this.score.rounds.length) { this.finish(); return; }
    const operation = ++this.operation;
    this.roundIndex = index;
    this.completedRound = false;
    this.response = null;
    this.paused = false;
    this.lastCue = -1;
    this.pendingAudio = false;
    this.removeBalloons();
    dom.overlay.hidden = true;
    dom['ready-cue'].textContent = '';
    const round = this.round = practiceRound(this.score.rounds[index], this.difficulty, index >= Math.floor(this.score.rounds.length / 2));
    this.setPhase('listen');
    this.makeDots(round);
    publishTimeline(round, index, continuePlaying ? dom.music.currentTime : round.start);
    dom['round-label'].textContent = `Round ${index + 1}/${this.score.rounds.length}`;
    dom.announcer.textContent = `Feel the Rhythm. Watch the ${round.notes.length} colours. Round ${index + 1}.`;
    if (continuePlaying) return;
    dom.music.currentTime = round.start;
    try {
      await dom.music.play();
      if (operation !== this.operation) return;
      if (this.paused || this.phase !== 'listen') dom.music.pause();
    } catch (error) {
      if (operation !== this.operation) return;
      dom.music.pause();
      if (autoplay || error.name === 'NotAllowedError') {
        this.paused = true;
        this.setPhase('ready');
        this.showOverlay('Ready to play?', 'Feel the music. Then tap the colours!', "Let's play!", false);
      } else this.fail('The music could not start. Tap below to try again.');
    }
  }

  beginReply() {
    dom.music.pause();
    const round = this.round;
    dom.music.currentTime = round.end;
    publishTransport('reply', round.end);
    this.setPhase('reply');
    this.phaseStarted = performance.now();
    this.elapsedBeforePause = 0;
    this.response = createResponse(round, { leadIn: Math.max(2.4, 3 * 60 / this.score.bpm), tolerance: .55, sequenceTolerance: .9, alignFirst: true });
    this.lastCue = -1;
    this.countInBeat = 60 / this.score.bpm;
    this.dots.forEach(dot => dot.classList.remove('current','played','missed'));
    this.makeBalloons();
    dom.announcer.textContent = 'Keepy Uppy! Your turn. Tap the balloons in the same colour order and rhythm. Keys 1 to 4 also work.';
  }

  makeBalloons() {
    this.removeBalloons();
    this.spawnedNotes = new Set();
    this.syncBalloons(0);
  }

  syncBalloons(time) {
    for (const note of this.response.notes) {
      if (note.result !== null || this.spawnedNotes.has(note.index) || note.due - time > BALLOON_TRAVEL_TIME) continue;
      this.spawnedNotes.add(note.index);
      const button = document.createElement('button');
      button.className = 'balloon';
      button.dataset.color = note.color;
      button.dataset.noteIndex = String(note.index);
      button.setAttribute('aria-label', `${COLORS[note.color].name} balloon, note ${note.index + 1}, key ${COLORS[note.color].key}`);
      button.title = `${COLORS[note.color].name} balloon`;
      const ring = document.createElement('span'); ring.className = 'balloon-ring';
      const image = document.createElement('img'); image.className = 'balloon-art'; image.src = `assets/${note.color}.png`; image.alt = ''; image.draggable = false;
      const approach = image.cloneNode();
      ring.setAttribute('aria-hidden', 'true');ring.append(approach);
      button.append(ring, image);
      button.addEventListener('pointerdown', event => { if (event.button > 0) return; event.preventDefault(); this.hit(note.color, note.index); });
      button.addEventListener('keydown', event => {
        if (['Enter',' '].includes(event.key)) { event.preventDefault(); if (!event.repeat) this.hit(note.color, note.index); }
      });
      dom.balloons.append(button);
      const route = balloonRoute(this.roundIndex, note.index);
      this.balloons.push({ color: note.color, tilt: [-12,-10,8,10][note.index % 4], note, ...route, current: route.home, hitFrom: route.home, element: button, index: note.index, hitAt: -10, px: 0, py: 0 });
    }
  }

  removeBalloons() { dom.balloons.replaceChildren(); this.balloons = []; }

  elapsed() { return this.elapsedBeforePause + (this.paused ? 0 : (performance.now() - this.phaseStarted) / 1000); }

  hit(color, noteIndex = null) {
    if (this.phase !== 'reply' || this.paused || !this.response) return;
    void this.unlockAudio();
    const time = this.elapsed();
    expireNotes(this.response, time);
    const result = tapResponse(this.response, color, time, noteIndex);
    const balloon = this.balloons.find(balloon => balloon.index === (result.note?.index ?? noteIndex))
      ?? this.balloons.find(balloon => balloon.color === color && balloon.note.result === null);
    if (balloon) {
      if (result.note) {
        this.flyBalloon(balloon);
        balloon.hitFrom = { ...balloon.current };
        balloon.hitAt = time;
        balloon.element.disabled = true;
        balloon.element.style.pointerEvents = 'none';
      }
      balloon.element.classList.remove('popped');
      void balloon.element.offsetWidth;
      balloon.element.classList.add('popped');
    }
    if (result.kind === 'hit') {
      this.playNote(color, result.note.duration ?? .25);
      this.spark(balloon);
      this.dots[result.note.index]?.classList.add('played');
      dom.announcer.textContent = result.perfect ? 'Perfect timing!' : 'Well done!';
    } else if (result.kind === 'wrong') {
      // Sound remains immediate and musical; incorrect extra taps do not score.
      this.playNote(color, .14, .32);
    }
    this.updateReply(time);
    // A hit advances immediately to the next individual note, including a
    // second balloon of exactly the same colour.
    if (this.phase === 'reply') this.animateBalloons(time);
  }

  flyBalloon(balloon) {
    const flying = balloon.element.cloneNode(true);
    flying.classList.remove('target', 'gesture-hover', 'popped');
    flying.classList.add('balloon-flying');
    flying.removeAttribute('aria-current');
    flying.setAttribute('aria-hidden', 'true');
    flying.disabled = true;
    flying.style.pointerEvents = 'none';
    flying.querySelector('.balloon-ring')?.remove();
    flying.querySelector('.balloon-label')?.remove();
    dom.particles.append(flying);
    const x = balloon.px, y = balloon.py;
    const animation = flying.animate([
      { transform: `translate(${x}px,${y}px) rotate(${balloon.tilt}deg)` },
      { transform: `translate(${x}px,${-dom.stage.clientHeight * .2}px) rotate(${balloon.tilt - 8}deg)` },
    ], { duration: 2800, easing: 'cubic-bezier(.2,.35,.55,1)', fill: 'forwards' });
    animation.onfinish = animation.oncancel = () => flying.remove();
    balloon.element.style.visibility = 'hidden';
  }

  playNote(color, duration, volume = 1) {
    const context = this.audioContext;
    if (!context || context.state !== 'running' || !this.master) return;
    const now = context.currentTime;
    const length = clamp(duration, .13, .8);
    const envelope = context.createGain();
    envelope.gain.setValueAtTime(0, now);
    envelope.gain.linearRampToValueAtTime(.48 * volume, now + .012);
    envelope.gain.exponentialRampToValueAtTime(.001, now + length + .16);
    envelope.connect(this.master);
    const frequency = midiFrequency(COLORS[color].midi);
    for (const [multiple, strength] of [[1,1],[2,.18],[3,.07]]) {
      const oscillator = context.createOscillator();
      const partial = context.createGain();
      oscillator.type = 'sine'; oscillator.frequency.value = frequency * multiple; partial.gain.value = strength;
      oscillator.connect(partial).connect(envelope);
      oscillator.start(now); oscillator.stop(now + length + .2);
      oscillator.onended = () => { oscillator.disconnect(); partial.disconnect(); };
    }
    setTimeout(() => envelope.disconnect(), (length + .3) * 1000);
  }

  updateIntro() {
    if (!this.pendingAudio && dom.music.currentTime >= this.score.introDuration) {
      this.introComplete = true;
      // Preserve continuous playback at second eight; no pause, seek or count-in.
      void this.beginListen(0, false, true);
    }
  }

  updateListen() {
    const round = this.round;
    const time = dom.music.currentTime - round.start;
    let current = -1;
    round.notes.forEach((note, index) => { if (time >= note.time) current = index; });
    if (current !== this.lastCue) {
      if (current >= 0 && time - round.notes[current].time < .32) publishCue(round, current, dom.music.currentTime);
      this.lastCue = current;
      this.dots.forEach((dot, index) => {
        dot.classList.toggle('current', index === current && time - round.notes[current].time < .32);
        dot.classList.toggle('played', index <= current);
      });
    }
    this.dots.forEach((dot, index) => dot.classList.toggle('current', index === current && time - round.notes[index].time < .32));
    if (!this.pendingAudio && (dom.music.currentTime >= round.end - .012 || dom.music.ended)) this.beginReply();
  }

  updateReply(time) {
    if (!this.response || this.phase !== 'reply') return;
    expireNotes(this.response, time);
    this.syncBalloons(time);
    const next = this.response.notes.find(note => note.result === null);
    this.response.notes.forEach((note, index) => {
      const dot = this.dots[index];
      dot?.classList.toggle('current', next?.index === index);
      dot?.classList.toggle('played', note.result === 'hit');
      dot?.classList.toggle('missed', ['miss','wrong-color'].includes(note.result));
    });
    const firstDue = this.response.notes[0].due;
    dom['ready-cue'].textContent = time < firstDue ? String(Math.min(3, Math.ceil((firstDue - time) / this.countInBeat))) : '';
    this.balloons.forEach(balloon => {
      const target = next?.index === balloon.index;
      balloon.element.classList.toggle('target', target);
      if (target) balloon.element.setAttribute('aria-current', 'step');
      else balloon.element.removeAttribute('aria-current');
      balloon.element.style.zIndex = target ? '2' : '1';
      balloon.element.disabled = this.paused || balloon.note.result !== null;
    });
    if (time >= this.response.duration) this.endReply();
  }

  animateBalloons(time) {
    const width = dom.stage.clientWidth;
    const height = dom.stage.clientHeight;
    const balloonHeight = BALLOON_WIDTH * width / height * 269 / 342;
    const remaining = [];
    for (const balloon of this.balloons) {
      const spawn = Math.max(0, balloon.note.due - BALLOON_TRAVEL_TIME);
      const travel = balloon.note.due - spawn;
      const position = balloonPosition(balloon, time - spawn, travel);
      let { x, y } = position;
      const remainingApproach = clamp((balloon.note.due - time) / 1.15, 0, 1);
      balloon.element.style.setProperty('--approach', String(1 + remainingApproach * .69));
      balloon.element.style.setProperty('--approach-opacity', String(1 - remainingApproach * .72));
      const sinceHit = time - balloon.hitAt;
      let opacity = 1;
      if (['hit','wrong-color'].includes(balloon.note.result)) {
        const amount = clamp(sinceHit / 1.8, 0, 1);
        const bounce = balloonPosition(balloon, 0, 1, balloon.hitFrom, sinceHit);
        x = bounce.x;
        y = reducedMotion ? balloon.hitFrom.y : bounce.y;
        opacity = 1 - clamp((amount - .65) / .35, 0, 1);
        if (amount >= 1) { balloon.element.remove(); continue; }
      } else if (balloon.note.result === 'miss') {
        const amount = clamp((time - balloon.note.due - this.response.sequenceTolerance) / .4, 0, 1);
        opacity = 1 - amount;
        if (amount >= 1) { balloon.element.remove(); continue; }
      }
      balloon.current = balloon.note.result === 'miss' ? { x, y } : fitBalloon({ x, y }, balloon.home);
      balloon.px = (balloon.current.x - BALLOON_WIDTH / 2) / 100 * width;
      balloon.py = (balloon.current.y - balloonHeight / 2) / 100 * height;
      balloon.element.style.opacity = String(opacity);
      balloon.element.style.transform = `translate(${balloon.px}px,${balloon.py}px) rotate(${balloon.tilt + (reducedMotion ? 0 : Math.sin(time + balloon.index) * 4)}deg)`;
      remaining.push(balloon);
    }
    this.balloons = remaining;
  }

  endReply() {
    if (this.completedRound || !this.response) return;
    this.completedRound = true;
    const grade = gradeResponse(this.response);
    const difficulty = nextDifficulty(this.difficulty, this.successStreak, grade);
    this.difficulty = difficulty.level;
    this.successStreak = difficulty.streak;
    this.sessionHits += grade.hits;
    this.sessionNotes += grade.total;
    this.setPhase('result');
    this.phaseStarted = performance.now();
    this.elapsedBeforePause = 0;
    dom['ready-cue'].textContent = '';
    this.balloons.forEach(balloon => { balloon.element.disabled = true; balloon.element.classList.remove('target'); });
    this.showFeedback(grade.message, grade.celebration);
    dom.announcer.textContent = `${grade.message} ${grade.hits} of ${grade.total} notes. The next part is coming.`;
  }

  showFeedback(message, celebrate = false) {
    dom.feedback.textContent = message;
    dom.feedback.className = 'feedback visible' + (message.length > 12 ? ' small' : '');
    if (celebrate && !reducedMotion) this.confetti();
  }

  clearFeedback() { dom.feedback.className = 'feedback'; dom.feedback.textContent = ''; dom.particles.querySelectorAll(':scope > :not(.balloon-flying)').forEach(node => node.remove()); }

  spark(balloon) {
    if (!balloon || reducedMotion) return;
    const spark = document.createElement('span');
    spark.className = 'hit-spark';
    spark.style.left = `${balloon.px + dom.stage.clientWidth * BALLOON_WIDTH / 200}px`;
    spark.style.top = `${balloon.py + dom.stage.clientWidth * BALLOON_WIDTH * 269 / 342 / 200}px`;
    dom.particles.append(spark); spark.addEventListener('animationend', () => spark.remove(), { once: true });
  }

  confetti() {
    const width = dom.stage.clientWidth;
    const height = dom.stage.clientHeight;
    const colors = Object.values(COLORS).map(color => color.hex);
    for (let index = 0; index < 32; index++) {
      const piece = document.createElement('i'); piece.className = 'particle';
      piece.style.background = colors[index % colors.length];
      const left = index % 2 === 0;
      piece.style.setProperty('--x', `${width * (left ? .22 : .76)}px`);
      piece.style.setProperty('--y', `${height * .49}px`);
      piece.style.setProperty('--dx', `${(Math.random() - .5) * width * .55}px`);
      piece.style.setProperty('--dy', `${(Math.random() - .5) * height * .9}px`);
      piece.style.setProperty('--rotate', `${Math.random() * 600 - 300}deg`);
      piece.style.setProperty('--delay', `${Math.random() * .1}s`);
      dom.particles.append(piece); piece.addEventListener('animationend', () => piece.remove(), { once: true });
    }
  }

  async togglePause() {
    if (this.phase === 'ready') { await this.primaryAction(); return; }
    if (['finished','error','loading'].includes(this.phase)) return;
    if (this.paused) { await this.resume(); return; }
    if (['reply','result'].includes(this.phase)) this.elapsedBeforePause = this.elapsed();
    this.paused = true;
    publishTransport('pause', dom.music.currentTime);
    dom.music.pause();
    this.refreshTransport();
    dom.particles.querySelectorAll('.balloon-flying').forEach(node => node.getAnimations().forEach(a => a.pause()));
    this.showOverlay('Take a breather!', 'Your music and balloons will wait right here.', 'Keep playing', true);
    dom.announcer.textContent = 'Game paused.';
  }

  async resume() {
    await this.unlockAudio();
    this.paused = false;
    this.phaseStarted = performance.now();
    dom.overlay.hidden = true;
    this.refreshTransport();
    dom.particles.querySelectorAll('.balloon-flying').forEach(node => node.getAnimations().forEach(a => a.play()));
    publishTransport('resume', dom.music.currentTime);
    if (['intro','listen'].includes(this.phase)) {
      try { await dom.music.play(); }
      catch { this.paused = true; this.refreshTransport(); this.showOverlay('Ready?', 'Tap to continue the music.', 'Keep playing', true); }
    }
  }

  showOverlay(title, message, action, secondary) {
    const introduction = this.phase === 'ready' && title === 'Ready to play?';
    dom.overlay.classList.toggle('overlay--intro', introduction);
    dom.primary.setAttribute('aria-label', introduction ? 'Close introduction and start game' : action);
    dom.overlay.classList.toggle('overlay--breather', title === 'Take a breather!');
    dom.overlay.setAttribute('aria-label', introduction ? 'Game introduction' : title);
    dom['overlay-title'].textContent = title;
    dom['overlay-message'].textContent = message;
    dom.primary.textContent = action;
    dom.secondary.textContent = 'Start again';
    dom.secondary.hidden = !secondary;
    if(title === 'Take a breather!'){
      pauseButtonArtwork(dom.primary,'1312 1230 1092 210','Keep playing');
      pauseButtonArtwork(dom.secondary,'1533 1508 650 146','Start again');
    }
    dom.overlay.hidden = false;
  }

  async primaryAction() {
    await this.unlockAudio();
    if (this.phase === 'error') { location.reload(); return; }
    if (this.phase === 'finished') { this.restart(); return; }
    if (this.phase === 'ready') {
      if (!this.introComplete) await this.beginIntro();
      else await this.beginListen(this.roundIndex);
      return;
    }
    if (this.paused) await this.resume();
  }

  restart() {
    resetFinalPage();
    dom.particles.querySelectorAll('.balloon-flying').forEach(node => { node.getAnimations().forEach(a => a.cancel()); node.remove(); });
    ++this.operation;
    publishTransport('reset', dom.music.currentTime);
    dom.music.pause();
    this.sessionHits = 0; this.sessionNotes = 0;
    this.difficulty = 0; this.successStreak = 0;
    void this.beginIntro();
  }

  finish() {
    publishTransport('stop', dom.music.currentTime);
    dom.music.pause();
    this.removeBalloons();
    this.paused = false;
    this.setPhase('finished');
    dom['ready-cue'].textContent = '';
    dom['round-label'].textContent = 'You played the whole song!';
    dom.overlay.hidden = true;
    this.clearFeedback();
    void showFinalPage({ hits: this.sessionHits, total: this.sessionNotes, onReplay: () => location.reload(), onHome: () => this.backToHome() });
    dom.announcer.textContent = 'Wackadoo! You finished the whole song.';
  }

  backToHome() {
    location.assign(location.protocol === 'file:'
      ? new URL('../../bluey%20homepage/index.html', location.href).href
      : '/');
  }

  fail(message) {
    dom.music.pause(); dom.loading.hidden = true; this.paused = true; this.phase = 'error'; dom.game.dataset.phase = 'error'; dom.pause.disabled = true;
    this.showOverlay('One little hiccup!', message, 'Try again', false);
  }

  frame() {
    if (this.score && !this.paused) {
      if (this.phase === 'intro') this.updateIntro();
      else if (this.phase === 'listen') this.updateListen();
      else if (this.phase === 'reply') {
        const time = this.elapsed(); this.updateReply(time);
        if (this.phase === 'reply') this.animateBalloons(time);
      } else if (this.phase === 'result' && this.elapsed() > 2.8) {
        void this.beginListen(this.roundIndex + 1);
      }
    }
    requestAnimationFrame(this.frame);
  }
}

const game = new KeepyUppy();
void game.init();

export { game };

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { COLORS, validateScore, createResponse, tapResponse, expireNotes, gradeResponse } from '../dist/core.mjs';
import { containsPoint, containsBalloon, fitBalloon, balloonRoute, BALLOON_WIDTH } from '../dist/play-area.mjs';

const score = JSON.parse(readFileSync(new URL('../dist/score.json', import.meta.url), 'utf8'));

test('all phrases form a continuous timeline covering the complete recording', () => {
  validateScore(score);
  assert.equal(score.rounds[0].start, score.introDuration);
  assert.ok(Math.abs(score.rounds.at(-1).end - score.duration) < .01);
  assert.ok(score.rounds.length > 10);
  for (const round of score.rounds) for (const note of round.notes) assert.ok(COLORS[note.color]);
});

test('the eight-second monologue contains no scored notes or practice rounds', () => {
  assert.equal(score.introDuration, 8);
  assert.equal(score.rounds[0].start, 8);
  for (const round of score.rounds) {
    assert.ok(round.start >= 8);
    for (const note of round.notes) assert.ok(round.start + note.time >= 8);
  }
  if (['natural-phrases','musical-bars'].includes(score.segmentation)) {
    const report = JSON.parse(readFileSync(new URL('../dist/music-analysis.json', import.meta.url)));
    assert.equal(score.analysis.engine, 'all-in-one');
    for (const round of score.rounds) {
      if(score.segmentation==='natural-phrases')assert.ok(round.end-round.start <= 10.001);
      else assert.ok(round.barCount>=4&&round.barCount<=5);
      if(score.segmentation==='musical-bars' && round.end!==score.duration) assert.ok(report.beats.some(b=>b.position===1 && Math.abs(b.time-round.end)<.001));
      for (const note of round.notes) assert.ok(report.beats.some(beat => Math.abs(beat.time-round.start-note.time)<.001));
    }
    return;
  }
  assert.equal(score.barsPerRound, 4);
  if (score.analysis?.engine === 'madmom') {
    const report = JSON.parse(readFileSync(new URL('../dist/music-analysis.json', import.meta.url), 'utf8'));
    assert.equal(score.rounds[0].barCount, 4);
    assert.equal(score.rounds[0].end, report.bars[4].start);
    assert.equal(score.rounds[0].notes.length, report.bars.slice(0,4).reduce((sum, bar) => sum + bar.beatsPerBar, 0));
    for (const round of score.rounds) {
      assert.ok(round.barCount >= 1 && round.barCount <= 4);
      for (const note of round.notes) {
        assert.ok(report.beats.some(beat => Math.abs(beat.time - (round.start + note.time)) < .001));
      }
    }
  } else {
    assert.equal(score.rounds[0].notes.length, 16);
    assert.ok(Math.abs(score.rounds[0].end - 8 - 4 * score.beatsPerBar * 60 / score.bpm) < .001);
  }
});

test('the rectangular right-hand activity area excludes the left HUD and includes the former right-side gap',()=>{
  assert.ok(containsPoint(45,15));assert.ok(containsPoint(90,20));assert.ok(containsPoint(90,85));
  assert.equal(containsPoint(15,55),false);assert.equal(containsPoint(28,80),false);
  assert.equal(containsPoint(99,55),false);assert.equal(BALLOON_WIDTH,5.7);
});

test('all balloon routes keep the complete balloon inside the user-defined area', () => {
  let minX = 100, maxX = 0, minY = 100, maxY = 0;
  for (let round = 0; round < score.rounds.length; round++) {
    for (let index = 0; index < score.rounds[round].notes.length; index++) {
      const { home, landing } = balloonRoute(round, index);
      assert.ok(containsBalloon(home));
      assert.ok(containsBalloon(landing));
      minX = Math.min(minX, home.x, landing.x); maxX = Math.max(maxX, home.x, landing.x);
      minY = Math.min(minY, home.y, landing.y); maxY = Math.max(maxY, home.y, landing.y);
      for (let step = 0; step <= 40; step++) {
        const t = step / 40;
        const falling = fitBalloon({ x: home.x + (landing.x - home.x) * t, y: home.y + (landing.y - home.y) * t }, home);
        const bouncing = fitBalloon({ x: landing.x + (home.x - landing.x) * t, y: landing.y + (home.y - landing.y) * t - Math.sin(t * Math.PI) * 12 }, home);
        assert.ok(containsBalloon(falling));
        assert.ok(containsBalloon(bouncing));
      }
    }
  }
  assert.ok(maxX - minX >= 18 && maxY - minY > 40, 'High launch lanes give balloons a long clear fall.');
});

test('each same-colour balloon has its own note identity and can only score once', () => {
  const reply = createResponse({start:0,end:3,notes:[{time:0,color:'green'},{time:.65,color:'green'}]});
  assert.equal(tapResponse(reply,'green',1.2,1).kind,'wrong');
  assert.equal(tapResponse(reply,'green',1.2,0).kind,'hit');
  assert.equal(tapResponse(reply,'green',1.85,0).kind,'wrong');
  assert.equal(tapResponse(reply,'green',1.85,1).kind,'hit');
  assert.equal(gradeResponse(reply).hits,2);
});

test('every phrase can be replayed and achieve Excellent with accurate taps', () => {
  for (const round of score.rounds) {
    const reply = createResponse(round);
    for (const note of reply.notes) {
      expireNotes(reply, note.due);
      assert.equal(tapResponse(reply, note.color, note.due).kind, 'hit');
    }
    assert.equal(gradeResponse(reply).message, 'Excellent!');
  }
});

test('early, duplicate and out-of-order balloon identities do not consume the next note', () => {
  const reply = createResponse({ end: 3, start: 0, notes: [{ time: 0, color: 'blue' }, { time: .65, color: 'red' }] });
  assert.equal(tapResponse(reply, 'blue', 0).kind, 'wrong');
  assert.equal(tapResponse(reply, 'red', 1.2, 1).kind, 'wrong');
  assert.equal(tapResponse(reply, 'blue', 1.2, 0).kind, 'hit');
  assert.equal(tapResponse(reply, 'blue', 1.2, 0).kind, 'wrong');
  assert.equal(tapResponse(reply, 'red', 1.85, 1).kind, 'hit');
  assert.equal(gradeResponse(reply).hits, 2);
  assert.notEqual(gradeResponse(reply).message, 'Excellent!');
});

test('missed notes expire, and later notes can still be played', () => {
  const reply = createResponse({ end: 3, start: 0, notes: [{ time: 0, color: 'blue' }, { time: .65, color: 'red' }] });
  assert.equal(expireNotes(reply, 1.7).length, 1);
  assert.equal(tapResponse(reply, 'red', 1.85).kind, 'hit');
  assert.equal(gradeResponse(reply).hits, 1);
});

test('repeated colours each require one separate timed tap', () => {
  const reply = createResponse({ end: 3, start: 0, notes: [{ time: 0, color: 'blue' }, { time: .65, color: 'blue' }] });
  tapResponse(reply, 'blue', 1.2);
  assert.equal(tapResponse(reply, 'blue', 1.2).kind, 'wrong');
  assert.equal(tapResponse(reply, 'blue', 1.85).kind, 'hit');
  assert.equal(gradeResponse(reply).hits, 2);
});

test('silent playback does not produce a positive celebration', () => {
  const reply = createResponse(score.rounds[0]);
  expireNotes(reply, 99);
  const result = gradeResponse(reply);
  assert.equal(result.hits, 0);
  assert.equal(result.celebration, false);
  assert.equal(result.message, 'Keep going!');
});

test('invalid colours and gaps in the score fail clearly', () => {
  assert.throws(() => validateScore({ ...score, rounds: [{ start: 0, end: 1, notes: [{ time: 0, color: 'unknown' }] }] }));
  assert.throws(() => validateScore({ ...score, rounds: [{ start: 1, end: 2, notes: [{ time: 0, color: 'red' }] }] }));
});

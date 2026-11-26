import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { practiceRound, nextDifficulty } from '../dist/practice.mjs';
import { createResponse, tapResponse, expireNotes, gradeResponse } from '../dist/core.mjs';
import { balloonRoute, balloonPosition, containsBalloon } from '../dist/play-area.mjs';
const score = JSON.parse(readFileSync(new URL('../dist/score.json', import.meta.url)));
test('longer bar groups reduce rounds, while practice cues stay between earlier sparse and dense versions', () => {
  const counts=score.rounds.map(r=>practiceRound(r).notes.length);
  assert.equal(score.rounds.length,16);
  assert.ok(counts.every(n=>n>=6&&n<=7));
  assert.ok(counts.includes(6)&&counts.includes(7));
  for(const source of score.rounds)for(const level of [0,1,2]) {
    const round=practiceRound(source,level);
    assert.equal(round.start,source.start);assert.equal(round.end,source.end);
    assert.equal(round.notes.length,practiceRound(source).notes.length);
    for(const note of round.notes)assert.ok(source.notes.some(n=>n.time===note.time&&n.color===note.color));
    const bars=[...new Set(source.notes.map(n=>n.barInRound))];
    for(const bar of bars)assert.ok(round.notes.some(n=>n.barInRound===bar));
    for(let i=1;i<round.notes.length;i++)assert.ok(round.notes[i].time>round.notes[i-1].time);
  }
});
test('regrouping loses no detected beats and introduces no new timestamps',()=>{
 const report=JSON.parse(readFileSync(new URL('../dist/music-analysis.json',import.meta.url)));
 const actual=score.rounds.flatMap(r=>r.notes.map(n=>+(r.start+n.time).toFixed(4)));
 const expected=report.beats.filter(b=>b.time>=score.introDuration&&b.time<score.duration).map(b=>+b.time.toFixed(4));
 assert.deepEqual(actual,expected);
});
test('difficulty grows after two strong rounds and retreats when struggling', () => {
  const good = {accuracy:1,timing:.9}, poor = {accuracy:.25,timing:.2};
  assert.deepEqual(nextDifficulty(0,0,good),{level:0,streak:1});
  assert.deepEqual(nextDifficulty(0,1,good),{level:1,streak:0});
  assert.deepEqual(nextDifficulty(2,1,good),{level:2,streak:0});
  assert.deepEqual(nextDifficulty(1,1,poor),{level:0,streak:0});
});
test('colour and rhythm are independent, including wrong colours on beat', () => {
  const round={start:0,end:5,notes:[{time:0,color:'blue'},{time:2,color:'red'}]};
  const wrong = createResponse(round);
  tapResponse(wrong,'red',1.2); tapResponse(wrong,'blue',3.2);
  assert.equal(gradeResponse(wrong).accuracy,0); assert.equal(gradeResponse(wrong).timing,1);
  const late = createResponse(round,{tolerance:.4,sequenceTolerance:.9});
  tapResponse(late,'blue',1.9); tapResponse(late,'red',3.9);
  assert.equal(gradeResponse(late).accuracy,1); assert.equal(gradeResponse(late).timing,0);
  assert.equal(gradeResponse(late).celebration,false);
  const silent = createResponse(round); expireNotes(silent,20);
  assert.equal(gradeResponse(silent).timing,0);
});
test('first cue gets a full preparation interval and preserves inter-note rhythm', () => {
  const round=practiceRound(score.rounds[0]);
  const response=createResponse(round,{leadIn:2.4,alignFirst:true});
  assert.ok(Math.abs(response.notes[0].due-2.4)<1e-8);
  for(let i=1;i<response.notes.length;i++) assert.ok(Math.abs((response.notes[i].due-response.notes[i-1].due)-(round.notes[i].time-round.notes[i-1].time))<1e-8);
});
test('balloons start high, accelerate down smoothly and kick upward with gravity', () => {
  for(let lane=0;lane<4;lane++) {
    const route=balloonRoute(0,lane);
    assert.ok(route.home.y<20); assert.ok(route.landing.y>=45 && route.landing.y<=82);
    const p=t=>balloonPosition(route,t,3.2);
    for(let i=0;i<=32;i++) assert.ok(containsBalloon(p(i/10)));
    assert.ok(p(2).y-p(1).y > p(1).y-p(0).y);
    const bounce=t=>balloonPosition(route,0,3.2,route.landing,t);
    assert.equal(bounce(0).y,route.landing.y);
    assert.ok(bounce(.5).y<route.landing.y);
    assert.ok(bounce(.3).y-2*bounce(.2).y+bounce(.1).y>0);
  }
});

test('later-round selection varies existing beat colours and preserves early rounds and bar counts',()=>{
 for(const [index,source]of score.rounds.entries()){
  const baseline=practiceRound(source),selected=practiceRound(source,0,index>=score.rounds.length/2);
  if(index<score.rounds.length/2){assert.deepEqual(selected,baseline);continue;}
  assert.equal(selected.notes.length,baseline.notes.length);
  assert.ok(new Set(selected.notes.map(n=>n.color)).size>=2);
  for(const n of selected.notes)assert.ok(source.notes.some(original=>original.time===n.time&&original.color===n.color));
  for(const bar of new Set(source.notes.map(n=>n.barInRound)))assert.equal(selected.notes.filter(n=>n.barInRound===bar).length,baseline.notes.filter(n=>n.barInRound===bar).length);
  for(let i=1;i<selected.notes.length;i++)assert.ok(selected.notes[i].time>selected.notes[i-1].time);
 }
});

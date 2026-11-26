import {test} from 'node:test';
import assert from 'node:assert/strict';
import {FistClickGate} from '../dist/gesture-core.mjs';
const hand=Array.from({length:21},()=>({x:.5,y:.5}));
const pose=(name,score=.95)=>({landmarks:[hand],gestures:[[{categoryName:name,score}]]});
test('one deliberate fist is one click, never repeated while held',()=>{
 const g=new FistClickGate();assert.equal(g.update(pose('Closed_Fist'),0),false);assert.equal(g.update(pose('Closed_Fist'),60),true);assert.equal(g.update(pose('Closed_Fist'),500),false);
});
test('release rearms; uncertain frames and brief palm flicker do not',()=>{
 const g=new FistClickGate();g.update(pose('Closed_Fist'),0);g.update(pose('Closed_Fist'),60);
 g.update(pose('Open_Palm'),100);g.update(pose('Open_Palm'),160);assert.equal(g.update(pose('Closed_Fist'),220),false);
 g.update(pose('Open_Palm'),300);g.update(pose('Open_Palm'),420);g.update(pose('Closed_Fist'),500);assert.equal(g.update(pose('Closed_Fist'),560),true);
});
test('lost tracking and hidden pages cannot click or rearm a fist',()=>{
 const g=new FistClickGate();g.update({landmarks:[]},0);g.update(pose('Closed_Fist'),60);assert.equal(g.update(pose('Closed_Fist'),120),false);
 g.update(pose('Open_Palm'),200);g.update(pose('Open_Palm'),320);g.update(pose('Closed_Fist'),400,false);assert.equal(g.update(pose('Closed_Fist'),470),false);
});
test('a gap or low confidence cannot create a click from separated detections',()=>{
 const g=new FistClickGate();g.update(pose('Closed_Fist'),0);assert.equal(g.update(pose('Closed_Fist'),1000),false);assert.equal(g.update(pose('Closed_Fist',.6),1060),false);
});
test('either hand may click, but a second held fist cannot cause another click',()=>{
 const r={landmarks:[hand,hand],gestures:[[{categoryName:'Open_Palm',score:.95}],[{categoryName:'Closed_Fist',score:.95}]]};
 const g=new FistClickGate();g.update(r,0);assert.equal(g.update(r,60),true);assert.equal(g.update(r,120),false);
});

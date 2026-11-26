import {test} from 'node:test';
import assert from 'node:assert/strict';
import {handPoint,gestureSummary,touchingBalloon,mapPointer} from '../dist/gesture-core.mjs';
const hand=(x,y)=>Array.from({length:21},()=>({x,y,z:0}));
test('track a single palm or the midpoint of two palms, independent of gesture category',()=>{
 assert.deepEqual(handPoint({landmarks:[hand(.2,.4)],gestures:[[{categoryName:'None'}]]}),{x:.2,y:.4});
 assert.deepEqual(handPoint({landmarks:[hand(.2,.4),hand(.6,.8)]}),{x:.4,y:.6000000000000001});
});
test('missing and invalid landmarks cannot move the pointer',()=>{
 for(const result of [null,{}, {landmarks:[]},{landmarks:[[]]},{landmarks:[hand(NaN,.4)]},{landmarks:[hand(1.5,.4)]}])assert.equal(handPoint(result),null);
});
test('no hand and an unrecognized hand pose have different messages',()=>{
 assert.equal(gestureSummary({landmarks:[]}), 'Keep your hands in view');
 assert.equal(gestureSummary({landmarks:[hand(.2,.4)],gestures:[[{categoryName:'None'}]]}), 'Unrecognized pose');
 assert.equal(gestureSummary({landmarks:[hand(.2,.4),hand(.6,.8)],gestures:[[{categoryName:'Open_Palm'}],[{categoryName:'Closed_Fist'}]]}), 'Open palm · Closed fist');
});
test('hover selects the touched balloon by identity',()=>{
 const near={id:7,rect:{left:100,top:100,width:60,height:60}},far={id:1,rect:{left:400,top:100,width:60,height:60}};
 assert.equal(touchingBalloon({x:130,y:125},100,[far,near]),near);assert.equal(touchingBalloon({x:260,y:300},100,[near,far]),null);
});
test('sensitivity expands reach while keeping the pointer inside the screen',()=>{
 assert.deepEqual(mapPointer({x:.5,y:.5}),{x:.5,y:.5});
 const mapped=mapPointer({x:.6,y:.6});assert.ok(mapped.x>.6&&mapped.y>.6);
 assert.deepEqual(mapPointer({x:1,y:0}),{x:.975,y:.025});
});

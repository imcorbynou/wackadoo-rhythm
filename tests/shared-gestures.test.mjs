import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ClickGate,openPalmPoint,TUNING} from '../shared/gestures/input-core.mjs';
const hand=(x=.5,y=.5)=>Array.from({length:21},()=>({x,y}));
const frame=(name,x=.5,y=.5,score=.99)=>({landmarks:[hand(x,y)],gestures:[[{categoryName:name,score}]]});
const open=frame('Open_Palm'),fist=frame('Closed_Fist');
const ready=g=>{g.update(open,0);g.update(open,40);};
test('only open palms move, with the same lowered movement sensitivity',()=>{
 assert.ok(openPalmPoint(open));
 for(const r of [fist,frame('None'),frame('Open_Palm',.5,.5,.4),{landmarks:[]}])assert.equal(openPalmPoint(r),null);
 assert.equal(openPalmPoint(frame('Open_Palm',NaN,.5)),null);
 assert.ok(TUNING.sensitivityX<1.35&&TUNING.sensitivityY<1.25);
});
test('a clear fist clicks immediately after a short open release; a held fist never repeats',()=>{
 const g=new ClickGate();ready(g);assert.equal(g.armed,true);
 assert.equal(g.update(fist,70),true);
 for(let t=100;t<600;t+=33)assert.equal(g.update(fist,t),false);
 g.update(open,620);assert.equal(g.update(fist,640),false); // A single flicker is not a release.
 g.update(open,670);g.update(open,710);assert.equal(g.update(fist,740),true);
});
test('an unclassified second hand no longer blocks the hand being used',()=>{
 const two={landmarks:[hand(.3,.5),hand(.8,.5)],gestures:[[{categoryName:'Open_Palm',score:.98}],[]]};
 const g=new ClickGate();g.update(two,0);g.update(two,40);assert.equal(g.armed,true);
 const closed={...two,gestures:[[{categoryName:'Closed_Fist',score:.98}],[]]};
 assert.equal(g.update(closed,70),true);
});
test('moderate-confidence fist confirms over two frames, tolerating a brief uncertain prediction',()=>{
 const g=new ClickGate();ready(g);
 assert.equal(g.update(frame('Closed_Fist',.5,.5,.70),70),false);
 assert.equal(g.update(frame('None'),100),false);
 assert.equal(g.update(frame('Closed_Fist',.5,.5,.69),133),true);
 for(let t=166;t<400;t+=33)assert.equal(g.update(fist,t),false);
});
test('a second open hand cannot repeatedly rearm a held clicking hand',()=>{
 const two=(left,right)=>({landmarks:[hand(.3),hand(.8)],gestures:[[{categoryName:left,score:.99}],[{categoryName:right,score:.99}]],handedness:[[{categoryName:'Left'}],[{categoryName:'Right'}]]});
 const g=new ClickGate();g.update(two('Open_Palm','Open_Palm'),0);g.update(two('Open_Palm','Open_Palm'),40);
 assert.equal(g.update(two('Closed_Fist','Open_Palm'),70),true);
 g.update(two('None','Open_Palm'),100);g.update(two('None','Open_Palm'),140);
 assert.equal(g.update(two('Closed_Fist','Open_Palm'),170),false);
 g.update(two('Open_Palm','Open_Palm'),200);g.update(two('Open_Palm','Open_Palm'),240);
 assert.equal(g.update(two('Closed_Fist','Open_Palm'),270),true);
});
test('navigation, prolonged tracking loss, hidden pages and stale results cannot click',()=>{
 const g=new ClickGate();
 for(let t=0;t<180;t+=33)assert.equal(g.update(fist,t),false);
 g.reset();ready(g);assert.equal(g.update({landmarks:[]},80),false);
 assert.equal(g.update(frame('Closed_Fist',.5,.5,.7),110),false);
 assert.equal(g.update(frame('Closed_Fist',.5,.5,.7),145),true); // Brief dropout tolerated.
 g.update(open,180);g.update(open,220);g.update({landmarks:[]},450);
 assert.equal(g.update(fist,480),false);
 ready(g);assert.equal(g.update(fist,70,false),false);assert.equal(g.update(fist,100),false);
 ready(g);assert.equal(g.update(fist,600),false);
});

test('one hand can release again after moving from a distant control, without handedness metadata',()=>{
 const g=new ClickGate();ready(g);assert.equal(g.update(fist,70),true);
 g.update(frame('Open_Palm',.1,.1),100);g.update(frame('Open_Palm',.1,.1),140);
 assert.equal(g.update(frame('Closed_Fist',.1,.1),170),true);
});

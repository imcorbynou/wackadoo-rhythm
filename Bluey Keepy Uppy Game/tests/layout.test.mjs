import test from 'node:test';
import assert from 'node:assert/strict';
import {hudLayout} from '../dist/hud-layout.mjs';
import {setPlayArea,balloonRoute,balloonPosition,containsBalloon} from '../dist/play-area.mjs';
test('square insets, aligned cue row and camera-to-round gap survive windowed/fullscreen resizing',()=>{
 for(const [w,h]of [[940,494],[1024,768],[1440,900],[1920,1080],[800,450],[390,844]]){
  const l=hudLayout(w,h);
  assert.ok(l.margin>=16);assert.equal(l.headerTop,l.margin);
  assert.ok(l.roundTop-l.panelBottom>=l.gap);
  assert.equal(l.play.top,l.margin);assert.ok(Math.abs(w-l.play.right-l.margin)<1e-8);
  assert.ok(l.play.left>=l.margin+l.panelWidth+l.gap-.01);
  assert.ok(l.roundTop+l.roundHeight<=h-l.margin+.01);
  assert.ok(l.bodyLeft>=l.margin);
 }
});
test('balloon artwork remains inside the resized activity bounds including its large outer layer',()=>{
 for(const [w,h]of [[940,494],[1024,768],[1440,900],[1920,1080]]){
  const l=hudLayout(w,h),p=l.play;
  setPlayArea({left:p.left/w*100,right:p.right/w*100,top:p.top/h*100,bottom:p.bottom/h*100},w/h);
  for(let i=0;i<7;i++){
   const route=balloonRoute(0,i);
   for(let n=0;n<=32;n++)assert.ok(containsBalloon(balloonPosition(route,n/10,3.2)));
  }
 }
});

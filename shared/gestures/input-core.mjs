export const TUNING = Object.freeze({ sensitivityX: 1.20, sensitivityY: 1.12, smoothingMs: 55, inferenceIntervalMs: 33 });
const clamp = v => Math.max(.01, Math.min(.99, v));
export function openPalmPoint(result) {
  const palms = (result?.landmarks || []).filter((_, i) => {
    const pose = result.gestures?.[i]?.[0];
    return pose?.categoryName === 'Open_Palm' && pose.score >= .65;
  }).map(hand => hand?.[9]).filter(p => p && Number.isFinite(p.x) && Number.isFinite(p.y) && p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1);
  if (!palms.length) return null;
  const x = palms.reduce((s,p) => s+p.x,0)/palms.length, y = palms.reduce((s,p) => s+p.y,0)/palms.length;
  return { x: clamp(.5+(x-.5)*TUNING.sensitivityX), y: clamp(.5+(y-.5)*TUNING.sensitivityY) };
}
const posesOf = result => (result?.landmarks || []).map((_,i)=>result.gestures?.[i]?.[0]);
export const hasFist = result => posesOf(result).some(p => p?.categoryName==='Closed_Fist' && p.score>=.65);
// Confidence hysteresis: a clear fist clicks on its first observation. A weaker
// fist needs two observations, tolerating a brief uncertain frame between them.
// Only two open-palm observations can rearm; held fists and tracking loss cannot.
export class ClickGate {
  constructor() { this.reset(); }
  reset() {
    this.armed=false;this.pressed=false;this.openAt=null;this.openSamples=0;
    this.owner=null;this.fistAt=null;this.fistSamples=0;this.lastOpen=-Infinity;this.lastAt=-Infinity;this.lastSeen=-Infinity;
  }
  clearFist() { this.fistAt=null;this.fistSamples=0; }
  update(result, now, enabled=true) {
    if(!enabled || !Number.isFinite(now)) {this.reset();return false;}
    if(now-this.lastAt>450 || now<this.lastAt)this.reset();
    this.lastAt=now;
    if(!result?.landmarks?.length) {
      if(now-this.lastSeen>180) {this.reset();this.lastAt=now;}
      return false;
    }
    this.lastSeen=now;
    const poses=posesOf(result);
    const side=i=>(result.handedness||result.handednesses)?.[i]?.[0]?.categoryName;
    const fistIndex=poses.reduce((best,p,i)=>p?.categoryName==='Closed_Fist' && p.score>(poses[best]?.score||0)?i:best,-1);
    const fist=fistIndex>=0?poses[fistIndex].score:0;
    if(fist>=.65) {
      this.openAt=null;this.openSamples=0;
      if(!this.armed)return false;
      if(this.fistAt===null || now-this.fistAt>160) {this.fistAt=now;this.fistSamples=0;}
      this.fistSamples++;
      if(fist<.85 && (this.fistSamples<2 || now-this.fistAt<25))return false;
      this.armed=false;this.pressed=true;
      this.owner={side:side(fistIndex),point:result.landmarks[fistIndex]?.[9]};
      this.clearFist();return true;
    }
    const release=poses.some((p,i)=>{
      if(p?.categoryName!=='Open_Palm'||p.score<.65)return false;
      if(!this.owner)return true;
      if(this.owner.side)return side(i)===this.owner.side;
      const point=result.landmarks[i]?.[9];
      return result.landmarks.length===1 || !this.owner.point || (point && Math.hypot(point.x-this.owner.point.x,point.y-this.owner.point.y)<.25);
    });
    if(release) {
      this.clearFist();
      if(this.openAt===null || now-this.lastOpen>160) {this.openAt=now;this.openSamples=0;}
      this.openSamples++;this.lastOpen=now;
      if(this.openSamples>=2 && now-this.openAt>=30) {this.armed=true;this.pressed=false;}
    } else {
      // Uncertain / missing classification is not a release and cannot repeat a
      // held click. Nor should one uncertain frame throw away a pending fist.
      if(this.fistAt!==null && now-this.fistAt>120)this.clearFist();
      if(now-this.lastOpen>160) {this.openAt=null;this.openSamples=0;}
    }
    return false;
  }
}

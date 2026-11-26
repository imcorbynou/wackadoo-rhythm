// Percentages of the stage. The activity boundary is not painted over the art.
export const BALLOON_WIDTH = 5.7;
export const BALLOON_HEIGHT = BALLOON_WIDTH * 269 / 342 * 16 / 9;
// Right-hand activity area. Browser layout supplies exact pixel-safe bounds.
export const PLAY_AREA = [[34,4],[98,4],[98,92],[34,92]];
let bounds={left:34,right:98,top:4,bottom:92},aspect=16/9;
export function setPlayArea(value,ratio=16/9){
  bounds={...value};aspect=ratio;
  PLAY_AREA.splice(0,4,[bounds.left,bounds.top],[bounds.right,bounds.top],[bounds.right,bounds.bottom],[bounds.left,bounds.bottom]);
}
export function containsPoint(x,y){return x>=bounds.left&&x<=bounds.right&&y>=bounds.top&&y<=bounds.bottom;}
function padding(){const x=BALLOON_WIDTH*.66*1.69;return {x,y:x*aspect};}
export function containsBalloon({x,y}){
  const pad=padding();return x>=bounds.left+pad.x&&x<=bounds.right-pad.x&&y>=bounds.top+pad.y&&y<=bounds.bottom-pad.y;
}
export function fitBalloon(point){
  const p=padding();
  return {x:Math.max(bounds.left+p.x,Math.min(bounds.right-p.x,point.x)),y:Math.max(bounds.top+p.y,Math.min(bounds.bottom-p.y,point.y))};
}
// Routes spread across the full right-hand rectangle, without entering the HUD.
export function balloonRoute(round,index){
  const lane=(round+index)%4,p=padding();
  const left=bounds.left+p.x,right=bounds.right-p.x,top=bounds.top+p.y,bottom=bounds.bottom-p.y;
  const point=(x,y)=>({x:left+(right-left)*x,y:top+(bottom-top)*y});
  return {home:point([.04,.34,.64,.96][lane],[0,.025,.005,.04][lane]),
    landing:point([.12,.77,.45,.92][lane],[.6,.83,.69,.95][lane])};
}

export function balloonPosition(route, age, travelTime, hitFrom = null, sinceHit = 0) {
  if (hitFrom) {
    // Ballistic kick: upward velocity, constant gravity, then a gentle return.
    const velocity = Math.min(55, Math.sqrt(96 * Math.max(0, hitFrom.y - route.home.y)));
    return { x: hitFrom.x, y: hitFrom.y - velocity * sinceHit + 24 * sinceHit * sinceHit };
  }
  const t = Math.max(0, age / travelTime);
  return { x: route.home.x + (route.landing.x - route.home.x) * Math.min(t, 1),
    y: route.home.y + (route.landing.y - route.home.y) * t * t };
}

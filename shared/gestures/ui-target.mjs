const SELECTOR='button,a[href],input,select,textarea,[role="button"]';
function usable(control) {
  return control?.isConnected && !control.closest('.balloon,:disabled,[aria-disabled="true"],[inert]') &&
    control.getClientRects().length>0 && getComputedStyle(control).visibility!=='hidden';
}
// Tiny icons and animated hover artwork get 8px of edge tolerance. Never pick a
// covered/disabled control or click through a modal to a button behind it.
export function uiTargetAt(x,y,tolerance=8) {
  const hit=document.elementFromPoint(x,y);
  if(!hit || hit.closest(':disabled,[aria-disabled="true"],[inert],.balloon'))return null;
  const exact=hit.closest(SELECTOR);
  if(exact)return usable(exact)?{control:exact,hit}:null;
  let nearest=null,distance=tolerance*tolerance;
  for(const control of document.querySelectorAll(SELECTOR)) {
    if(!usable(control))continue;
    const r=control.getBoundingClientRect();
    const dx=Math.max(r.left-x,0,x-r.right),dy=Math.max(r.top-y,0,y-r.bottom),d=dx*dx+dy*dy;
    if(d>distance)continue;
    const probe=document.elementFromPoint(Math.max(r.left+1,Math.min(r.right-1,x)),Math.max(r.top+1,Math.min(r.bottom-1,y)));
    if(probe && control.contains(probe)) {nearest={control,hit:control};distance=d;}
  }
  return nearest;
}

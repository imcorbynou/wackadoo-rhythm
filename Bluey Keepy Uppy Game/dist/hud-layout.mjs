const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
// Source-art geometry: white camera body x=253..1835 (2179px PNG),
// title body x=16..2624 (3112px PNG). Decorations also stay inside the inset.
export function hudLayout(width,height) {
  const margin=clamp(Math.min(width,height)*.03,16,32);
  const gap=clamp(Math.min(width,height)*.025,12,24);
  const roundFont=clamp(Math.min(width,height)*.022,12,20),roundHeight=roundFont*1.4;
  const panelWidth=Math.max(90,Math.min(width*.42,(height-2*margin-3*gap-roundHeight)/1.44));
  const bodyWidth=panelWidth*(1583/2179),headerWidth=bodyWidth/(2608/3112);
  const bodyLeft=margin+panelWidth*(253/2179);
  const headerTop=margin,headerHeight=headerWidth*934/3112;
  const cueSize=panelWidth*.088,cueHeight=cueSize*269/342,cueGap=cueSize*.38;
  const cueTop=headerTop+headerHeight+gap;
  const cueBottom=cueTop+cueHeight*2+cueGap;
  const panelTop=cueBottom+gap-panelWidth*102/2179;
  const panelBottom=panelTop+panelWidth*2258/2179;
  const roundTop=height-margin-roundHeight;
  const playLeft=Math.max(margin+panelWidth,bodyLeft-16/3112*headerWidth+headerWidth)+gap;
  return {margin,gap,panelWidth,panelTop,panelBottom,bodyLeft,bodyWidth,headerWidth,headerTop,
    cueTop,cueSize,cueGap,roundTop,roundFont,roundHeight,
    play:{left:playLeft,right:width-margin,top:margin,bottom:roundTop-gap}};
}

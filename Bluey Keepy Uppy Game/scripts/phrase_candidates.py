"""Audio-assisted candidate pauses for the All-In-One structure report."""
import numpy as np


def vocal_envelope(samples, rate):
    if samples.ndim > 1: samples = samples.mean(axis=1)
    hop=max(1,round(rate*.01)); frame=max(1,round(rate*.04))
    samples=np.pad(samples,(0,frame))
    summed=np.r_[0,np.cumsum(samples.astype(np.float64)**2)]
    power=((summed[frame:]-summed[:-frame])/frame)[::hop]
    return np.sqrt(power), hop/rate


def phrase_candidates(raw, vocals, rate, intro, duration):
    envelope,step=vocal_envelope(vocals,rate)
    reference=max(float(np.percentile(envelope,90)),1e-8)
    threshold=reference*.16
    quiet=envelope<threshold
    changes=np.diff(np.r_[False,quiet,False].astype(int))
    gaps=[(a*step,b*step) for a,b in zip(np.flatnonzero(changes==1),np.flatnonzero(changes==-1)) if (b-a)*step>=.12]
    downbeats=np.array(raw['downbeats'],dtype=float)
    section_times=[float(s['start']) for s in raw['segments'][1:] if intro+1 < s['start'] < duration-1]
    candidates=[]
    def rest_quality(t):
        index=min(len(envelope)-1,max(0,round(t/step)))
        window=envelope[max(0,index-5):min(len(envelope),index+6)]
        return float(np.clip(1-window.mean()/reference,0,1))
    # Section changes are always candidates. A nearby rest may refine their position.
    for t in section_times:
        nearby=[(a,b) for a,b in gaps if a-.4 <= t <= b+.4]
        cut=min(nearby,key=lambda g:abs((g[0]+g[1])/2-t)) if nearby else None
        if cut:
            t=float(np.clip(t,cut[0]+.025,cut[1]-.025))
        candidates.append({'time':t,'quality':.85+.15*rest_quality(t),'reason':'section-boundary'})
    # Natural gaps between sung phrases are finer than the model's verse/chorus sections.
    for a,b in gaps:
        if a<intro or b-a>3: continue
        center=(a+b)/2
        nearby=downbeats[(downbeats>=a+.02)&(downbeats<=b-.02)]
        t=float(nearby[np.argmin(abs(nearby-center))]) if len(nearby) else center
        quality=.65+.25*min(1,(b-a)/.45)+.1*rest_quality(t)
        candidates.append({'time':t,'quality':min(1,quality),'reason':'vocal-rest'})
    # Beat-aligned fallbacks keep instrumental passages playable.
    for t in downbeats:
        if intro<t<duration:
            candidates.append({'time':float(t),'quality':.2+.5*rest_quality(t),'reason':'bar-boundary'})
    return candidates, {'stepSeconds':step,'vocalQuietThreshold':threshold,'gaps':gaps}

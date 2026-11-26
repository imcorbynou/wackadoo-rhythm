"""Regroup existing model beats into bar-aligned rounds; never invent beats/colors."""
from copy import deepcopy

def regroup(score, report):
    score, report = deepcopy(score), deepcopy(report)
    intro, end = score.get('introDuration', 8), score['duration']
    notes = sorted((dict(n, absolute=round(r['start']+n['time'],4)) for r in score['rounds'] for n in r['notes']), key=lambda n:n['absolute'])
    edges = sorted(set([intro, end]+[b['time'] for b in report['beats'] if b['position']==1 and intro<b['time']<end]))
    units = [(a,b,[n for n in notes if a-1e-5<=n['absolute']<b-1e-5]) for a,b in zip(edges,edges[1:])]
    # Longer listening spans mean fewer interruptions: four bars per round.
    # Fold a tiny trailing partial bar into the previous round.
    groups=[units[i:i+4] for i in range(0,len(units),4)]
    if len(groups)>1 and len(groups[-1])<2:
        groups[-2].extend(groups.pop())
    rounds=[]
    for group_index,group in enumerate(groups):
        a,b=group[0][0],group[-1][1];out=[]
        for bar,(_,_,ns) in enumerate(group,1):
            for n in ns:
                n=dict(n);absolute=n.pop('absolute');n['time']=round(absolute-a,4);n['barInRound']=bar;out.append(n)
        section=next((s['label'] for s in report['sections'] if s['start']<=a<s['end']),'outro')
        rounds.append(dict(start=a,end=b,barStarts=[u[0] for u in group if any(abs(u[0]-beat['time'])<1e-5 and beat['position']==1 for beat in report['beats'])],barCount=len(group),completeBars=sum(u[0]!=intro and u[1]!=end for u in group),section=section,cuePattern=[2,1,2,1] if group_index%2==0 or len(group)>4 else [2,2,1,2],cutReason='song-end' if b==end else 'downbeat',notes=out))
    assert sum(len(r['notes']) for r in rounds)==len(notes)
    method='All-In-One downbeats; four-bar groups with six/seven selected cues'
    score.update(rounds=rounds,segmentation='musical-bars',arrangement=method)
    score['analysis']['segmentationMethod']=method
    report.update(segmentationMethod=method,roundGrouping={'barsPerRound':4,'usualCueRange':[6,7],'shortTailMerged':True,'source':'existing All-In-One beats/downbeats'},pauseTimes=[r['end'] for r in rounds],phraseDurations=[round(r['end']-r['start'],4) for r in rounds],phraseBoundaries=[{'time':intro,'reason':'intro-end'}]+[{'time':r['end'],'reason':r['cutReason']} for r in rounds])
    return score,report

if __name__=='__main__':
    import json
    from pathlib import Path
    root=Path(__file__).resolve().parent.parent/'dist'
    score,report=regroup(json.loads((root/'score.json').read_text()),json.loads((root/'music-analysis.json').read_text()))
    for name,value in [('score.json',score),('music-analysis.json',report)]:
        tmp=root/(name+'.tmp');tmp.write_text(json.dumps(value,ensure_ascii=False,indent=2,allow_nan=False)+'\n');tmp.replace(root/name)
    print('Rounds:',len(score['rounds']),'Counts:',[len(r['notes']) for r in score['rounds']])

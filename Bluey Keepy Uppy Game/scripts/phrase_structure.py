"""Build short playable phrases from model sections, vocal rests and real beats.

All-In-One provides musical structure. This layer chooses child-sized excerpts;
it does not claim the model itself recognises lyric sentence endings.
"""
import math
from bisect import bisect_right
from statistics import median


def choose_boundaries(candidates, intro, duration, target=6.0, minimum=3.0, maximum=10.0):
    """Shortest-path selection balances natural boundaries and manageable duration."""
    points = [{'time': intro, 'quality': 1, 'reason': 'introduction-end'}]
    for item in sorted(candidates, key=lambda x: x['time']):
        if intro + minimum <= item['time'] <= duration - 1.5:
            if points and item['time'] - points[-1]['time'] < .12:
                if item['quality'] > points[-1]['quality']: points[-1] = item
            else: points.append(item)
    points.append({'time': duration, 'quality': 1, 'reason': 'song-end'})
    costs = [math.inf] * len(points); costs[0] = 0
    previous = [None] * len(points)
    for j in range(1, len(points)):
        for i in range(j - 1, -1, -1):
            length = points[j]['time'] - points[i]['time']
            if length > maximum + .001: break
            floor = 1.5 if j == len(points)-1 else minimum
            if length < floor or not math.isfinite(costs[i]): continue
            cost = costs[i] + ((length-target)/target)**2 + .28 + 1.6*(1-points[j]['quality'])
            # Do not cross a strong structural transition just to get an equal duration.
            cost += sum(1.8 for p in points[i+1:j] if p.get('reason') == 'section-boundary')
            if cost < costs[j]: costs[j], previous[j] = cost, i
    if previous[-1] is None:
        raise ValueError('No usable phrase boundaries within the configured duration range. Existing score preserved.')
    path=[]; j=len(points)-1
    while j is not None: path.append(points[j]); j=previous[j]
    return list(reversed(path))


def build_phrase_score(raw, boundaries, duration, intro, colour_for_time):
    beats = [(float(t), int(p)) for t,p in zip(raw['beats'],raw['beat_positions']) if intro <= t < duration]
    if not beats or any(b[0] <= a[0] for a,b in zip(beats, beats[1:])):
        raise ValueError('All-In-One did not produce a valid increasing beat timeline.')
    downbeats = sorted(float(t) for t in raw['downbeats'] if intro <= t < duration)
    sections = raw['segments']
    rounds=[]
    for first,last in zip(boundaries,boundaries[1:]):
        start,end=first['time'],last['time']
        rows=[(t,p) for t,p in beats if start <= t < end]
        if not rows: raise ValueError('A selected phrase contains no detected musical beat.')
        # Local bar identifiers can include a partial bar at either end.
        bar_ids=[bisect_right(downbeats,t) for t,_ in rows]
        unique=list(dict.fromkeys(bar_ids))
        notes=[]
        for i,((t,p),bar_id) in enumerate(zip(rows,bar_ids)):
            estimate=colour_for_time(t)
            next_time=rows[i+1][0] if i+1<len(rows) else end
            notes.append({'time':round(t-start,4),'color':estimate['color'],
                          'duration':round(max(.13,min(.6,(next_time-t)*.45)),4),
                          'beatInBar':p,'barInRound':unique.index(bar_id)+1,
                          **{key:estimate[key] for key in ['bandEnergy','relativeBandEnergy'] if key in estimate}})
        section=next((s for s in sections if s['start'] <= (start+end)/2 < s['end']),sections[-1])
        rounds.append({'start':round(start,4),'end':round(end,4),
                       'barStarts':[round(t,4) for t in downbeats if start <= t < end],
                       'barCount':len(unique),'completeBars':int(sum(start <= t and next_t <= end for t,next_t in zip(downbeats,downbeats[1:]))),
                       'section':section['label'],'cutReason':last['reason'],
                       'cutQuality':round(last['quality'],4),'notes':notes})
    intervals=[b[0]-a[0] for a,b in zip(beats,beats[1:])]
    return {'rounds':rounds,'bpm':round(60/median(intervals),3),'beats': [{'time':round(t,4),'position':p} for t,p in beats],
            'firstDownbeat':downbeats[0], 'beatsPerBar':max(p for _,p in beats)}

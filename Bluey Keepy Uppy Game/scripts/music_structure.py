"""Convert detected beat/downbeat timestamps into the game's practice rounds.

This module deliberately has no numerical-library dependency. Timing comes
from the model's timestamps, never from a fixed BPM-derived grid.
"""
from collections import Counter
import math

PALETTE = {'blue', 'green', 'yellow', 'red'}

def validate_config(config):
    result = dict(config)
    for key in ['introSeconds', 'minBpm', 'maxBpm', 'framesPerSecond']:
        value = result.get(key)
        if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
            raise ValueError(f'{key} must be a finite number.')
    if result['introSeconds'] < 0 or not 0 < result['minBpm'] < result['maxBpm'] or result['framesPerSecond'] != 100:
        raise ValueError('Invalid introduction, tempo range or frame rate (the model requires 100 FPS).')
    if type(result.get('barsPerRound')) is not int or not 1 <= result['barsPerRound'] <= 16:
        raise ValueError('barsPerRound must be an integer from 1 to 16.')
    meters = result.get('meterCandidates')
    if not isinstance(meters, list) or not meters or any(type(meter) is not int or meter not in [3, 4] for meter in meters):
        raise ValueError('meterCandidates must contain 3 and/or 4.')
    result['meterCandidates'] = sorted(set(meters))
    return result

def build_structure(rows, duration, intro, bars_per_round, colour_for_time):
    if not math.isfinite(duration) or not 0 <= intro < duration:
        raise ValueError('The introduction must be shorter than the audio.')
    if type(bars_per_round) is not int or bars_per_round <= 0:
        raise ValueError('The number of bars per round must be positive.')
    beats = []
    previous = -1.0
    for timestamp, position in rows:
        timestamp, position = float(timestamp), float(position)
        if not math.isfinite(timestamp) or not math.isfinite(position) or position != int(position) or position < 1:
            raise ValueError('The tracker returned an invalid beat.')
        if timestamp <= previous:
            raise ValueError('Detected beat times must be strictly increasing.')
        previous = timestamp
        if intro <= timestamp < duration:
            beats.append({'time': timestamp, 'position': int(position)})
    downbeat_indices = [index for index, beat in enumerate(beats) if beat['position'] == 1]
    if len(downbeat_indices) < 2:
        raise ValueError('Too few downbeats were detected to establish musical bars. The existing score was preserved.')

    bars = []
    for index, first in enumerate(downbeat_indices):
        following = downbeat_indices[index + 1] if index + 1 < len(downbeat_indices) else len(beats)
        bar_beats = beats[first:following]
        complete = index + 1 < len(downbeat_indices)
        end = beats[following]['time'] if complete else duration
        bars.append({
            'number': index + 1,
            'start': bar_beats[0]['time'],
            'end': end,
            'beatsPerBar': max(beat['position'] for beat in bar_beats),
            'complete': complete,
            'beats': bar_beats,
        })

    rounds = []
    for first in range(0, len(bars), bars_per_round):
        group = bars[first:first + bars_per_round]
        # Keep audio continuous from second 8 through any upbeat before the
        # first complete bar; only full bars count toward the first pause.
        start = intro if not rounds else group[0]['start']
        end = group[-1]['end']
        notes = []
        for local_bar, bar in enumerate(group, 1):
            for beat_index, beat in enumerate(bar['beats']):
                estimate = colour_for_time(beat['time'])
                colour = estimate['color'] if isinstance(estimate, dict) else estimate
                band_data = {key: estimate[key] for key in ['bandEnergy', 'relativeBandEnergy'] if key in estimate} if isinstance(estimate, dict) else {}
                if colour not in PALETTE:
                    raise ValueError('An unsupported balloon colour was produced.')
                next_time = bar['beats'][beat_index + 1]['time'] if beat_index + 1 < len(bar['beats']) else bar['end']
                notes.append({
                    'time': round(beat['time'] - start, 4),
                    'color': colour,
                    'duration': round(max(.13, min(.6, (next_time - beat['time']) * .45)), 4),
                    'beatInBar': beat['position'],
                    'barInRound': local_bar,
                    **band_data,
                })
        rounds.append({
            'start': round(start, 4),
            'end': round(end, 4),
            'barStarts': [round(bar['start'], 4) for bar in group],
            'barCount': len(group),
            'completeBars': sum(bar['complete'] for bar in group),
            'notes': notes,
        })

    complete_meters = Counter(bar['beatsPerBar'] for bar in bars if bar['complete'])
    intervals = sorted(beats[index + 1]['time'] - beats[index]['time'] for index in range(len(beats) - 1))
    middle = len(intervals) // 2
    median_interval = intervals[middle] if len(intervals) % 2 else (intervals[middle - 1] + intervals[middle]) / 2
    return {
        'rounds': rounds,
        'bars': [{**{key: value for key, value in bar.items() if key != 'beats'}, 'start': round(bar['start'], 4), 'end': round(bar['end'], 4)} for bar in bars],
        'beats': [{'time': round(beat['time'], 4), 'position': beat['position']} for beat in beats],
        'bpm': round(60 / median_interval, 3),
        'beatsPerBar': complete_meters.most_common(1)[0][0],
        'firstDownbeat': round(bars[0]['start'], 4),
    }

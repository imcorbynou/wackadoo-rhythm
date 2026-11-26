#!/usr/bin/env python3
"""Offline madmom beat/downbeat analysis, cached by audio and configuration."""
import argparse
from datetime import datetime, timezone
import hashlib
import importlib.metadata
import json
import os
from pathlib import Path
import shutil
import sys
import tempfile
import wave

from music_structure import build_structure, validate_config

PIPELINE_VERSION = 2
SOURCE_COMMIT = '27f032e8947204902c675e5e341a3faf5dc86dae'
MODELS_COMMIT = '7e3dc1b0cad499792767074d03c38b194b9b0a79'
ROOT = Path(__file__).resolve().parents[1]

def digest_file(path):
    digest = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest()

def cache_key(audio_hash, config):
    value = {'audioSha256': audio_hash, 'config': config, 'pipelineVersion': PIPELINE_VERSION,
             'sourceCommit': SOURCE_COMMIT, 'modelsCommit': MODELS_COMMIT}
    return hashlib.sha256(json.dumps(value, sort_keys=True).encode()).hexdigest()

def cached_result(score_path, report_path, expected):
    try:
        score = json.loads(score_path.read_text())
        report = json.loads(report_path.read_text())
        return (score.get('analysis', {}).get('cacheKey') == expected
                and report.get('cacheKey') == expected
                and score.get('analysis', {}).get('engine') == 'madmom'
                and bool(score.get('rounds')))
    except (OSError, ValueError, TypeError, AttributeError):
        return False

def atomic_json(path, content):
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary = tempfile.mkstemp(prefix='.' + path.name, suffix='.tmp', dir=path.parent)
    try:
        with os.fdopen(descriptor, 'w') as stream:
            json.dump(content, stream, ensure_ascii=False, indent=2, allow_nan=False)
            stream.write('\n')
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)

BANDS = [('blue', 20, 250), ('green', 250, 1000), ('yellow', 1000, 4000), ('red', 4000, 10000)]

def colour_estimator(samples, sample_rate, numpy):
    """FFT band power, relative to each band's track-wide median power.

    Normalisation prevents a bass-heavy mix from making every cue blue.
    This maps relative band emphasis; it is not pitch transcription.
    """
    mono = samples.astype(numpy.float32) / 32768
    size = 8192
    window = numpy.hanning(size)
    frequencies = numpy.fft.rfftfreq(size, 1 / sample_rate)
    masks = [(frequencies >= low) & (frequencies < high) for _, low, high in BANDS]
    def energy(timestamp):
        start = max(0, int(timestamp * sample_rate) - size // 4)
        segment = mono[start:start + size]
        if len(segment) < size:
            segment = numpy.pad(segment, (0, size - len(segment)))
        power = numpy.abs(numpy.fft.rfft(segment * window)) ** 2
        return numpy.array([float(power[mask].sum()) for mask in masks])
    baseline = numpy.median(numpy.array([energy(t) for t in numpy.arange(8, len(mono) / sample_rate, .5)]), axis=0)
    baseline = numpy.maximum(baseline, 1e-8)
    def estimate(timestamp):
        raw = energy(timestamp)
        relative = raw / baseline
        return {'color': BANDS[int(numpy.argmax(relative))][0],
                'bandEnergy': dict(zip([band[0] for band in BANDS], map(float, raw))),
                'relativeBandEnergy': dict(zip([band[0] for band in BANDS], map(float, relative)))}
    return estimate

def analyze(audio, config):
    try:
        import miniaudio
        import numpy as np
        from madmom.features.downbeats import RNNDownBeatProcessor, DBNDownBeatTrackingProcessor
        from madmom.models import DOWNBEATS_BLSTM
    except ImportError as error:
        raise RuntimeError('Music analysis dependencies are unavailable. Run Setup Music Analysis.command, then retry. ' + str(error)) from error

    if len(DOWNBEATS_BLSTM) != 8:
        raise RuntimeError('The eight downbeat models are missing. Run Setup Music Analysis.command to restore them.')
    print(f'Decoding audio locally; excluding the first {config["introSeconds"]} seconds from music analysis…', flush=True)
    sample_rate = 44100
    decoded = miniaudio.decode_file(str(audio), output_format=miniaudio.SampleFormat.SIGNED16, nchannels=1, sample_rate=sample_rate)
    samples = np.asarray(decoded.samples, dtype=np.int16)
    duration = len(samples) / sample_rate
    intro = config['introSeconds']
    if duration <= intro:
        raise ValueError('The recording is shorter than the excluded introduction.')
    cropped = samples[int(round(intro * sample_rate)):]
    with tempfile.TemporaryDirectory(prefix='bluey-madmom-') as temporary:
        wav_path = Path(temporary) / 'music.wav'
        with wave.open(str(wav_path), 'wb') as wav:
            wav.setnchannels(1)
            wav.setsampwidth(2)
            wav.setframerate(sample_rate)
            wav.writeframes(cropped.astype('<i2', copy=False).tobytes())
        print('madmom: detecting beats and downbeats with the pretrained RNN…', flush=True)
        activations = RNNDownBeatProcessor(num_threads=1)(str(wav_path))
        tracker = DBNDownBeatTrackingProcessor(
            beats_per_bar=config['meterCandidates'],
            min_bpm=config['minBpm'], max_bpm=config['maxBpm'],
            fps=config['framesPerSecond'], num_threads=1,
        )
        tracked = tracker(activations)
    absolute_beats = [(float(time) + intro, int(position)) for time, position in tracked]
    structure = build_structure(absolute_beats, duration, intro, config['barsPerRound'], colour_estimator(samples, sample_rate, np))
    version = importlib.metadata.version('madmom')
    distribution = importlib.metadata.distribution('madmom')
    direct = json.loads(distribution.read_text('direct_url.json') or '{}')
    upstream_path = ROOT / 'vendor/madmom/UPSTREAM.json'
    upstream = json.loads(upstream_path.read_text()) if upstream_path.exists() else {}
    return structure, duration, version, direct.get('vcs_info', {}).get('commit_id') or upstream.get('commit')

def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--audio', type=Path, default=ROOT / 'dist/assets/Keepy Uppy.mp3')
    parser.add_argument('--config', type=Path, default=ROOT / 'analysis-config.json')
    parser.add_argument('--force', action='store_true', help='Re-run the model even if the audio has not changed.')
    parser.add_argument('--if-needed', action='store_true', help='Use the saved analysis when audio and configuration match.')
    args = parser.parse_args(argv)
    audio = args.audio.resolve()
    config = validate_config(json.loads(args.config.read_text()))
    source_hash = digest_file(audio)
    expected = cache_key(source_hash, config)
    score_path = ROOT / 'dist/score.json'
    report_path = ROOT / 'dist/music-analysis.json'
    if not args.force and cached_result(score_path, report_path, expected):
        print('Using cached madmom analysis (audio and settings unchanged).', flush=True)
        return 0

    structure, duration, version, commit = analyze(audio, config)
    metadata = {
        'engine': 'madmom', 'version': version, 'sourceCommit': commit,
        'pipelineVersion': PIPELINE_VERSION,
        'sourceSha256': source_hash, 'cacheKey': expected,
        'generatedAt': datetime.now(timezone.utc).isoformat(),
        'config': config, 'firstDownbeat': structure['firstDownbeat'],
        'beatCount': len(structure['beats']), 'barCount': len(structure['bars']),
        'timingMethod': 'RNNDownBeatProcessor + DBNDownBeatTrackingProcessor',
        'colorMethod': 'FFT band power relative to track-wide band medians',
        'frequencyBandsHz': {color: [low, high] for color, low, high in BANDS},
    }
    report = {**metadata, 'duration': round(duration, 4), 'medianBpm': structure['bpm'],
              'beatsPerBar': structure['beatsPerBar'], 'bars': structure['bars'], 'beats': structure['beats'],
              'pauseTimes': [item['end'] for item in structure['rounds']]}
    score = {
        'title': 'Keepy Uppy', 'audio': 'assets/' + audio.name,
        'duration': round(duration, 4), 'introDuration': config['introSeconds'],
        'bpm': structure['bpm'], 'beatsPerBar': structure['beatsPerBar'],
        'barsPerRound': config['barsPerRound'], 'beatOffset': structure['firstDownbeat'],
        'responseLeadIn': 2.4, 'tolerance': .55,
        'arrangement': 'Detected beat timeline with FFT band emphasis. The browser selects 4, 6 or 8 shared cues per four-bar phrase.',
        'analysis': metadata, 'rounds': structure['rounds'],
    }
    backup = ROOT / '.analysis/score-before-madmom.json'
    if score_path.exists() and not backup.exists():
        backup.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(score_path, backup)
    # Score is only replaced after the complete model run and validation succeed.
    atomic_json(report_path, report)
    atomic_json(score_path, score)
    print(f'Detected {len(structure["beats"])} beats, {len(structure["bars"])} bars; median {structure["bpm"]:.2f} BPM.', flush=True)
    print(f'Saved {len(score["rounds"])} rounds of up to {config["barsPerRound"]} detected bars. First pause: {score["rounds"][0]["end"]:.3f}s.', flush=True)
    return 0

if __name__ == '__main__':
    try:
        raise SystemExit(main())
    except Exception as error:
        print(f'Music analysis failed: {error}', file=sys.stderr)
        raise SystemExit(1)

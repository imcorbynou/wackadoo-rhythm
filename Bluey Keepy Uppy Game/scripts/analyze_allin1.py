#!/usr/bin/env python3
"""Analyze with official All-In-One, then select manageable natural pauses."""
import argparse
from dataclasses import asdict
from datetime import datetime, timezone
import hashlib
import json
import logging
import importlib.metadata
import shutil
import os
from pathlib import Path
import sys
import wave

from analyze_music import atomic_json, digest_file, colour_estimator, BANDS
from phrase_structure import choose_boundaries, build_phrase_score

ROOT=Path(__file__).resolve().parents[1]
PIPELINE_VERSION=1
UPSTREAM_COMMIT='18e78903c0365147a2c5d4e5e57ebf88cb7d800e'

def key_for(audio_hash,config):
    return hashlib.sha256(json.dumps({'audio':audio_hash,'config':config,'pipeline':PIPELINE_VERSION,'upstream':UPSTREAM_COMMIT},sort_keys=True).encode()).hexdigest()

def cached(score_path,report_path,key):
    try:
        score=json.loads(score_path.read_text()); report=json.loads(report_path.read_text())
        return score['analysis']['engine']=='all-in-one' and score['analysis']['cacheKey']==key and report['cacheKey']==key and bool(score['rounds']) and (ROOT/'dist'/score['audio']).is_file()
    except (OSError,KeyError,TypeError,ValueError): return False

def main(argv=None):
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--audio',type=Path,default=ROOT/'dist/assets/Keepy Uppy.mp3')
    parser.add_argument('--config',type=Path,default=ROOT/'analysis-config.json')
    parser.add_argument('--force',action='store_true')
    parser.add_argument('--if-needed',action='store_true')
    args=parser.parse_args(argv)
    config=json.loads(args.config.read_text())
    source=args.audio.resolve(); source_hash=digest_file(source); key=key_for(source_hash,config)
    score_path=ROOT/'dist/score.json';report_path=ROOT/'dist/music-analysis.json'
    if not args.force and cached(score_path,report_path,key):
        print('Using cached All-In-One phrases (audio and settings unchanged).',flush=True);return 0
    # Reuse the game's pinned madmom install for upstream spectrogram extraction.
    import site
    site.addsitedir(str(ROOT/'.venv-madmom/lib/python3.12/site-packages'))
    # Heavy dependencies are only required on an actual re-analysis.
    import numpy as np
    import miniaudio
    import soundfile as sf
    os.environ.setdefault('HF_HOME',str(ROOT/'.analysis/models/huggingface'))
    os.environ.setdefault('TORCH_HOME',str(ROOT/'.analysis/models/torch'))
    os.environ.setdefault('HF_HUB_DISABLE_XET','1')
    from phrase_candidates import phrase_candidates
    cache=ROOT/'.analysis/allin1'/source_hash[:16]
    cache.mkdir(parents=True,exist_ok=True)
    os.environ.setdefault('HF_HOME',str(ROOT/'.analysis/models/huggingface'))
    os.environ.setdefault('TORCH_HOME',str(ROOT/'.analysis/models/torch'))
    os.environ.setdefault('HF_HUB_DISABLE_XET','1')
    rate=44100
    wav=cache/'input/Keepy Uppy.analysis.wav'
    wav.parent.mkdir(parents=True,exist_ok=True)
    playback=ROOT/'dist/assets/Keepy Uppy.analysis.wav'
    decoded=miniaudio.decode_file(str(source),output_format=miniaudio.SampleFormat.SIGNED16,nchannels=2,sample_rate=rate)
    stereo=np.asarray(decoded.samples,dtype=np.int16).reshape(-1,2)
    duration=len(stereo)/rate
    # The model and browser use the exact same decoded waveform/time origin.
    with wave.open(str(wav),'wb') as stream:
        stream.setnchannels(2);stream.setsampwidth(2);stream.setframerate(rate);stream.writeframes(stereo.astype('<i2',copy=False).tobytes())
    raw_path=cache/'model-result.json'
    model=config.get('structureModel','harmonix-all')
    raw_metadata=cache/'model-meta.json'
    identity={'audioSha256':source_hash,'model':model,'upstreamCommit':UPSTREAM_COMMIT}
    if not args.force and raw_path.exists() and raw_metadata.exists() and json.loads(raw_metadata.read_text())==identity:
        print('Reusing official All-In-One model output.',flush=True)
        raw=json.loads(raw_path.read_text())
    else:
        print('All-In-One: analysing song sections, beats and downbeats…',flush=True)
        import torch
        logging.getLogger('natten.functional').setLevel(logging.ERROR)
        import allin1
        torch.set_num_threads(min(8,os.cpu_count() or 1))
        torch.manual_seed(0)
        result=allin1.analyze(wav,out_dir=cache/'raw',model=model,device='cpu',
                             demix_dir=cache/'demix',spec_dir=cache/'spectrograms',
                             keep_byproducts=True,multiprocess=False,include_activations=True,overwrite=args.force)
        raw=asdict(result);raw['path']=str(raw['path']);raw.pop('activations',None);raw.pop('embeddings',None)
        atomic_json(raw_path,raw);atomic_json(raw_metadata,identity)
    vocals_path=cache/'demix/htdemucs'/wav.stem/'vocals.wav'
    vocals,vocal_rate=sf.read(vocals_path,dtype='float32')
    intro=float(config.get('introSeconds',8))
    candidates,rest_report=phrase_candidates(raw,vocals,vocal_rate,intro,duration)
    settings=config.get('phrases',{})
    boundaries=choose_boundaries(candidates,intro,duration,settings.get('targetSeconds',6),settings.get('minSeconds',3),settings.get('maxSeconds',10))
    mono=stereo.astype(np.float32).mean(axis=1)
    structure=build_phrase_score(raw,boundaries,duration,intro,colour_estimator(mono,rate,np))
    metadata={'engine':'all-in-one','version':importlib.metadata.version('allin1'),
              'sourceCommit':UPSTREAM_COMMIT,'model':model,'pipelineVersion':PIPELINE_VERSION,
              'sourceSha256':source_hash,'cacheKey':key,'generatedAt':datetime.now(timezone.utc).isoformat(),
              'config':config,'timingMethod':'All-In-One beat/downbeat predictions',
              'segmentationMethod':'All-In-One section changes + separated-vocal rests + duration-aware selection',
              'colorMethod':'FFT relative band energy; independent of phrase selection',
              'frequencyBandsHz':{color:[low,high] for color,low,high in BANDS},
              'beatCount':len(structure['beats']),'firstDownbeat':structure['firstDownbeat']}
    report={**metadata,'duration':round(duration,4),'medianBpm':structure['bpm'],
            'beatsPerBar':structure['beatsPerBar'],'beats':structure['beats'],'sections':raw['segments'],
            'phraseBoundaries':boundaries,'pauseTimes':[r['end'] for r in structure['rounds']],
            'phraseDurations':[round(r['end']-r['start'],4) for r in structure['rounds']],
            'boundaryCandidates':candidates,'vocalRestAnalysis':rest_report,
            'rawModelResult':str(raw_path.relative_to(ROOT))}
    score={'title':'Keepy Uppy','audio':'assets/'+wav.name,'duration':round(duration,4),'introDuration':intro,
           'bpm':structure['bpm'],'beatsPerBar':structure['beatsPerBar'],'segmentation':'natural-phrases',
           'beatOffset':structure['firstDownbeat'],'responseLeadIn':2.4,'tolerance':.55,
           'arrangement':'Short phrases selected from All-In-One structure and vocal rests. Shared timing for listening and replay.',
           'analysis':metadata,'rounds':structure['rounds']}
    from bar_rounds import regroup
    score, report = regroup(score, report)
    # Validate before replacing any playable output.
    previous=intro
    for r in score['rounds']:
        assert r['notes'] and r['end']>r['start'] and abs(r['start']-previous)<.001
        assert all(0<=n['time']<r['end']-r['start'] for n in r['notes'])
        previous=r['end']
    backup=ROOT/'.analysis/score-before-allin1.json'
    if score_path.exists() and not backup.exists():backup.write_bytes(score_path.read_bytes())
    json.dumps(report,allow_nan=False);json.dumps(score,allow_nan=False)
    temporary=playback.with_suffix('.wav.tmp')
    shutil.copyfile(wav,temporary);os.replace(temporary,playback)
    # Actual WAV excerpts are also available for checking each selected pause.
    preview=ROOT/'.analysis/phrase-previews'/key[:16];preview.mkdir(parents=True,exist_ok=True)
    for index,r in enumerate(score['rounds'],1):
        with wave.open(str(preview/f'{index:02d}.wav'),'wb') as stream:
            stream.setnchannels(2);stream.setsampwidth(2);stream.setframerate(rate)
            stream.writeframes(stereo[round(r['start']*rate):round(r['end']*rate)].astype('<i2',copy=False).tobytes())
    atomic_json(report_path,report);atomic_json(score_path,score)
    print(f"Saved {len(score['rounds'])} bar-aligned practice rounds from {len(raw['segments'])} model sections.",flush=True)
    for i,r in enumerate(score['rounds'],1): print(f"  {i:02d}: {r['start']:.2f}–{r['end']:.2f}s ({r['end']-r['start']:.2f}s), {r['section']}, {r['cutReason']}",flush=True)
    return 0

if __name__=='__main__':
    try: raise SystemExit(main())
    except Exception as error:
        print(f'All-In-One analysis failed: {error}',file=sys.stderr);raise

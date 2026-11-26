import json
from pathlib import Path
import sys,tempfile,unittest
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
import analyze_allin1 as pipeline

class AllInOneCacheTests(unittest.TestCase):
    def test_audio_model_and_phrase_settings_change_cache_identity(self):
        config={'structureModel':'harmonix-all','phrases':{'targetSeconds':6}}
        first=pipeline.key_for('audio1',config)
        self.assertNotEqual(first,pipeline.key_for('audio2',config))
        self.assertNotEqual(first,pipeline.key_for('audio1',{**config,'structureModel':'harmonix-fold0'}))
        self.assertNotEqual(first,pipeline.key_for('audio1',{**config,'phrases':{'targetSeconds':8}}))
    def test_old_engine_or_missing_playback_audio_cannot_count_as_a_valid_cache(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);(root/'dist').mkdir()
            score=root/'dist/score.json';report=root/'dist/music-analysis.json'
            value={'analysis':{'engine':'all-in-one','cacheKey':'key'},'rounds':[{}],'audio':'music.wav'}
            score.write_text(json.dumps(value));report.write_text(json.dumps({'cacheKey':'key'}))
            with patch.object(pipeline,'ROOT',root):
                self.assertFalse(pipeline.cached(score,report,'key'))
                (root/'dist/music.wav').write_bytes(b'wave')
                self.assertTrue(pipeline.cached(score,report,'key'))
                value['analysis']['engine']='madmom';score.write_text(json.dumps(value))
                self.assertFalse(pipeline.cached(score,report,'key'))

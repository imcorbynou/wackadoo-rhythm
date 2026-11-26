import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
import analyze_music

CONFIG = dict(introSeconds=8, barsPerRound=4, meterCandidates=[3,4], minBpm=55, maxBpm=215, framesPerSecond=100)

class CacheTests(unittest.TestCase):
    def test_audio_or_settings_change_invalidates_cache(self):
        first = analyze_music.cache_key('audio-a', CONFIG)
        self.assertNotEqual(first, analyze_music.cache_key('audio-b', CONFIG))
        self.assertNotEqual(first, analyze_music.cache_key('audio-a', {**CONFIG, 'barsPerRound':2}))
        self.assertEqual(first, analyze_music.cache_key('audio-a', dict(reversed(list(CONFIG.items())))))

    def test_both_output_files_must_match_the_analysis(self):
        with tempfile.TemporaryDirectory() as directory:
            score, report = Path(directory)/'score.json', Path(directory)/'report.json'
            analyze_music.atomic_json(score, {'analysis': {'engine':'madmom','cacheKey':'current'}, 'rounds':[{}]})
            analyze_music.atomic_json(report, {'cacheKey':'current'})
            self.assertTrue(analyze_music.cached_result(score,report,'current'))
            analyze_music.atomic_json(report, {'cacheKey':'old'})
            self.assertFalse(analyze_music.cached_result(score,report,'current'))
            score.write_text('[]')
            self.assertFalse(analyze_music.cached_result(score,report,'current'))

    def test_failed_analysis_preserves_the_existing_playable_score(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root/'dist').mkdir()
            score = root/'dist/score.json'
            previous = b'{"previous":"playable score"}\n'
            score.write_bytes(previous)
            audio = root/'song.mp3'; audio.write_bytes(b'test audio')
            config = root/'config.json'; config.write_text(json.dumps(CONFIG))
            with patch.object(analyze_music,'ROOT',root), patch.object(analyze_music,'analyze',side_effect=RuntimeError('model failed')):
                with self.assertRaises(RuntimeError):
                    analyze_music.main(['--audio',str(audio),'--config',str(config)])
            self.assertEqual(score.read_bytes(),previous)
            self.assertFalse((root/'dist/music-analysis.json').exists())

if __name__ == '__main__':
    unittest.main()

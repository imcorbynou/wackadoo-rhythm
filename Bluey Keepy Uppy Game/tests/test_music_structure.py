import sys
from pathlib import Path
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from music_structure import build_structure, validate_config

class StructureTests(unittest.TestCase):
    def test_pause_on_fifth_detected_downbeat_despite_changing_tempo(self):
        starts = [8.4, 11.1, 13.6, 16.5, 19.0, 21.9]
        rows = []
        for start, end in zip(starts, starts[1:] + [24.0]):
            for beat in range(4):
                rows.append((start + (end - start) * beat / 4, beat + 1))
        result = build_structure(rows, 24, 8, 4, lambda _: 'green')
        first = result['rounds'][0]
        self.assertEqual(first['start'], 8)
        self.assertEqual(first['end'], 19)
        self.assertEqual(first['barStarts'], starts[:4])
        self.assertEqual(len(first['notes']), 16)
        self.assertEqual(result['rounds'][1]['start'], 19)
        self.assertEqual(result['rounds'][-1]['end'], 24)
        self.assertNotEqual(first['end'], 8 + 16 * 60 / result['bpm'])

    def test_three_beat_meter_does_not_assume_sixteen_notes(self):
        rows = [(8.2 + bar * 1.8 + beat * .6, beat + 1) for bar in range(5) for beat in range(3)]
        result = build_structure(rows, 17.5, 8, 4, lambda _: 'blue')
        self.assertEqual(result['beatsPerBar'], 3)
        self.assertEqual(len(result['rounds'][0]['notes']), 12)
        self.assertEqual(result['rounds'][0]['end'], 15.4)

    def test_speech_and_upbeat_do_not_count_as_complete_bars(self):
        rows = [(2, 1), (7.9, 1), (8.1, 4), (8.8, 1), (9.4, 2), (10, 3), (10.6, 4), (11.2, 1), (11.8, 2)]
        result = build_structure(rows, 12.5, 8, 4, lambda _: 'yellow')
        self.assertEqual(result['firstDownbeat'], 8.8)
        self.assertEqual(result['rounds'][0]['notes'][0]['time'], .8)
        self.assertTrue(all(note['time'] >= .8 for note in result['rounds'][0]['notes']))
        self.assertEqual(result['rounds'][0]['completeBars'], 1)

    def test_bad_or_insufficient_model_output_does_not_make_a_fake_grid(self):
        for rows in [[], [(8.1, 1)], [(8.1, 1), (8.1, 2)], [(8.1, 1), (9, float('nan'))]]:
            with self.assertRaises(ValueError):
                build_structure(rows, 20, 8, 4, lambda _: 'red')

    def test_configuration_is_explicit_about_supported_meters(self):
        valid = dict(introSeconds=8, barsPerRound=4, meterCandidates=[4, 3, 4], minBpm=55, maxBpm=215, framesPerSecond=100)
        self.assertEqual(validate_config(valid)['meterCandidates'], [3, 4])
        for patch in [dict(barsPerRound=0), dict(introSeconds=-1), dict(meterCandidates=[7]), dict(framesPerSecond=50)]:
            with self.assertRaises(ValueError):
                validate_config({**valid, **patch})

if __name__ == '__main__':
    unittest.main()

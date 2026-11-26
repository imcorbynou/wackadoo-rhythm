import sys
from pathlib import Path
import unittest
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
try:
    import numpy as np
except ImportError:
    np=None
from analyze_music import colour_estimator

@unittest.skipIf(np is None,'Run with the existing madmom environment to test FFT band mapping')
class FrequencyBandTests(unittest.TestCase):
    def test_four_synthetic_frequency_bands_map_in_low_to_high_order(self):
        rate=44100
        times=np.arange(rate*12)/rate
        for frequency, color in [(100,'blue'),(500,'green'),(2000,'yellow'),(6000,'red')]:
            with self.subTest(frequency=frequency):
                audio=np.random.default_rng(2).normal(0,.005,len(times))
                mask=(times>=9)&(times<9.5)
                audio[mask]+=.3*np.sin(2*np.pi*frequency*times[mask])
                estimate=colour_estimator((audio*32767).astype(np.int16),rate,np)(9.2)
                self.assertEqual(estimate['color'],color)
                self.assertEqual(max(estimate['bandEnergy'],key=estimate['bandEnergy'].get),color)
                self.assertTrue(all(np.isfinite(value) for value in estimate['relativeBandEnergy'].values()))

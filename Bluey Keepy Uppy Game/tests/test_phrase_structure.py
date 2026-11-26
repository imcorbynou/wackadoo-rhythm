import sys
from pathlib import Path
import unittest
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from phrase_structure import choose_boundaries,build_phrase_score

class PhraseTests(unittest.TestCase):
    def test_natural_pause_is_preferred_over_equal_length_bar_cut(self):
        candidates=[{'time':6,'quality':.2,'reason':'bar-boundary'},
                    {'time':6.4,'quality':1,'reason':'vocal-rest'},
                    {'time':12,'quality':.2,'reason':'bar-boundary'},
                    {'time':12.7,'quality':1,'reason':'section-boundary'}]
        selected=choose_boundaries(candidates,0,18.5)
        self.assertEqual([p['time'] for p in selected],[0,6.4,12.7,18.5])
    def test_unusable_analysis_fails_instead_of_inventing_a_cut(self):
        with self.assertRaises(ValueError):choose_boundaries([],0,20)
    def test_structure_boundaries_are_preserved_and_long_sections_split(self):
        candidates=[{'time':t,'quality':.9,'reason':'vocal-rest'} for t in [4.1,9.3,14.4,20.2,25.7]]
        candidates.append({'time':18,'quality':1,'reason':'section-boundary'})
        result=choose_boundaries(candidates,0,31)
        self.assertIn(18,[p['time'] for p in result])
        for a,b in zip(result,result[1:]): self.assertLessEqual(b['time']-a['time'],10)
    def test_phrase_score_has_no_gaps_and_uses_only_model_beats(self):
        raw={'beats':[.5+i*.5 for i in range(39)],'beat_positions':[i%4+1 for i in range(39)],
             'downbeats':[.5+i*2 for i in range(10)],'segments':[{'start':0,'end':20,'label':'chorus'}]}
        boundaries=[{'time':t,'quality':1,'reason':'vocal-rest'} for t in [0,6.25,12.2,20]]
        s=build_phrase_score(raw,boundaries,20,0,lambda t:{'color':'green'})
        self.assertEqual(s['rounds'][0]['end'],s['rounds'][1]['start'])
        for r in s['rounds']:
            self.assertTrue(r['notes'])
            for n in r['notes']:
                self.assertTrue(any(abs(r['start']+n['time']-t)<.001 for t in raw['beats']))
                self.assertGreaterEqual(n['time'],0)
                self.assertLess(n['time'],r['end']-r['start'])

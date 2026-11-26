import unittest,json,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
from bar_rounds import regroup
class BarRounds(unittest.TestCase):
 def test_regroup_preserves_all_events_and_is_idempotent(self):
  score=json.loads((ROOT/'dist/score.json').read_text());report=json.loads((ROOT/'dist/music-analysis.json').read_text())
  grouped,new_report=regroup(score,report)
  self.assertEqual(grouped['rounds'],score['rounds'])
  events=lambda s:[(round(r['start']+n['time'],4),n['color']) for r in s['rounds'] for n in r['notes']]
  self.assertEqual(events(grouped),events(score))
  self.assertEqual(new_report['pauseTimes'],[r['end'] for r in grouped['rounds']])
  self.assertEqual(grouped['rounds'][0]['start'],8)
  self.assertEqual(grouped['rounds'][-1]['end'],score['duration'])
if __name__=='__main__':unittest.main()

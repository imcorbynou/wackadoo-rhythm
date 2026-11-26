import test from 'node:test';
import assert from 'node:assert/strict';
import { finalGrade, createResponse, tapResponse, expireNotes, gradeResponse } from '../dist/core.mjs';

test('final grades use actual session hit rate at every tier boundary', () => {
  for (const [hits, expected] of [[0,'Keep going!'],[24,'Keep going!'],[25,'Lovely'],[49,'Lovely'],[50,'Bravo'],[79,'Bravo'],[80,'Wacakadoo!'],[100,'Wacakadoo!']]) {
    assert.equal(finalGrade(hits,100), expected, `${hits}/100`);
  }
  assert.equal(finalGrade(4,5), 'Wacakadoo!');
  assert.equal(finalGrade(2,4), 'Bravo');
  assert.equal(finalGrade(1,4), 'Lovely');
});

test('empty or invalid results receive encouragement without a high grade', () => {
  for (const [hits,total] of [[0,0],[5,0],[0,-1],[NaN,10],[1,NaN],[Infinity,10]]) {
    assert.equal(finalGrade(hits,total), 'Keep going!');
  }
});

test('correct hits, wrong colours and missed notes determine the final session grade', () => {
  const round = {start:0,end:4,notes:[{time:0,color:'blue'},{time:1,color:'red'},{time:2,color:'green'},{time:3,color:'yellow'}]};
  const played = createResponse(round);
  tapResponse(played,'blue',1.2);
  tapResponse(played,'blue',2.2); // Wrong colour does not count as a hit.
  expireNotes(played,99); // The other two notes were missed.
  const first = gradeResponse(played);
  const silent = createResponse(round);
  expireNotes(silent,99);
  const second = gradeResponse(silent);
  assert.equal(finalGrade(first.hits,first.total),'Lovely');
  assert.equal(finalGrade(first.hits+second.hits,first.total+second.total),'Keep going!');
});

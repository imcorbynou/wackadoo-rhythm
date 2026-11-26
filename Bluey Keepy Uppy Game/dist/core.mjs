/** Pure timing and scoring, shared by the game and its regression checks. */
export const COLORS = Object.freeze({
  blue: { name: 'Blue', hex: '#80d8fa', midi: 60, key: '1' },
  green: { name: 'Green', hex: '#72d76c', midi: 64, key: '2' },
  yellow: { name: 'Yellow', hex: '#ffe34e', midi: 67, key: '3' },
  red: { name: 'Red', hex: '#f65c78', midi: 72, key: '4' },
});

export function validateScore(score) {
  if (!score || !Number.isFinite(score.bpm) || score.bpm <= 0 || !Array.isArray(score.rounds) || !score.rounds.length) throw new Error('The song score is missing or invalid.');
  const introDuration = score.introDuration ?? 0;
  if (!Number.isFinite(introDuration) || introDuration < 0) throw new Error('The introduction duration is invalid.');
  let previousEnd = introDuration;
  for (const round of score.rounds) {
    if (!Number.isFinite(round.start) || !Number.isFinite(round.end) || round.end <= round.start || Math.abs(round.start - previousEnd) > .025 || !Array.isArray(round.notes) || !round.notes.length) throw new Error('The song score has an invalid bar.');
    let lastTime = -1;
    for (const note of round.notes) {
      if (!COLORS[note.color] || !Number.isFinite(note.time) || note.time < 0 || note.time >= round.end - round.start + .025 || note.time < lastTime) throw new Error('The colour pattern is invalid.');
      lastTime = note.time;
    }
    previousEnd = round.end;
  }
  return score;
}

export function createResponse(round, { leadIn = 1.2, tolerance = .36, sequenceTolerance = tolerance, alignFirst = false } = {}) {
  const offset = alignFirst ? round.notes[0].time : 0;
  return {
    notes: round.notes.map((note, index) => ({ ...note, index, due: leadIn + note.time - offset, result: null, error: null })),
    duration: leadIn + Math.max(round.end - round.start - offset, round.notes.at(-1).time - offset + sequenceTolerance) + .18,
    tolerance, sequenceTolerance, wrongTaps: 0,
  };
}

function windowFor(response, index) {
  const note = response.notes[index];
  const previous = response.notes[index - 1], next = response.notes[index + 1];
  return {
    start: note.due - Math.min(response.sequenceTolerance, previous ? (note.due - previous.due) / 2 : Infinity),
    end: note.due + Math.min(response.sequenceTolerance, next ? (next.due - note.due) / 2 : Infinity),
  };
}

export function tapResponse(response, color, time, noteIndex = null) {
  expireNotes(response, time);
  const note = response.notes.find(note => note.result === null);
  if (!note) return { kind: 'ignored' };
  const window = windowFor(response, note.index);
  if (time < window.start || time > window.end || (noteIndex !== null && note.index !== noteIndex)) {
    response.wrongTaps++;
    return { kind: 'wrong', color };
  }
  note.error = Math.abs(time - note.due);
  note.tappedColor = color;
  note.result = color === note.color ? 'hit' : 'wrong-color';
  return { kind: note.result === 'hit' ? 'hit' : 'wrong', note, perfect: note.error <= response.tolerance * .42 };
}

export function expireNotes(response, time) {
  const expired = [];
  for (const note of response.notes) {
    if (note.result === null && time > windowFor(response, note.index).end) {
      note.result = 'miss'; expired.push(note);
    }
  }
  return expired;
}

export function gradeResponse(response) {
  const hits = response.notes.filter(note => note.result === 'hit');
  const accuracy = hits.length / (response.notes.length + response.wrongTaps);
  // Rhythm counts timed attempts of either colour; missing beats contribute zero.
  const timing = response.notes.reduce((sum, note) => sum + (note.error === null ? 0 : Math.max(0, 1 - note.error / response.tolerance)), 0) / response.notes.length;
  let message = 'Keep going!';
  if (accuracy >= .95 && timing >= .65) message = 'Excellent!';
  else if (accuracy >= .75 && timing >= .45) message = 'Bravo!';
  else if (accuracy >= .5 || timing >= .5) message = 'Lovely!';
  return { hits: hits.length, total: response.notes.length, accuracy, timing, message, celebration: accuracy >= .75 && timing >= .45 };
}

export function midiFrequency(midi) { return 440 * 2 ** ((midi - 69) / 12); }

/** Final celebration grade uses the whole session's correctly timed colour hits. */
export function finalGrade(hits, total) {
  const ratio = Number.isFinite(hits) && Number.isFinite(total) && total > 0
    ? Math.max(0, Math.min(1, hits / total)) : 0;
  if (ratio >= .8) return 'Wacakadoo!';
  if (ratio >= .5) return 'Bravo';
  if (ratio >= .25) return 'Lovely';
  return 'Keep going!';
}

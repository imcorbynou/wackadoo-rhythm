/** The audio element is the authoritative clock during listening.
 * Vest adapters can subscribe to these events without deriving another score.
 * Adapters must schedule/cancel on their device clock and account for BLE latency.
 */
export function publishTimeline(round, roundIndex, audioTime) {
  window.dispatchEvent(new CustomEvent('keepy:timeline', { detail: {
    roundIndex, start: round.start, end: round.end, audioTime,
    events: round.notes.map((note, index) => ({ ...note, index, audioTime: round.start + note.time })),
  } }));
}
export function publishCue(round, index, observedAudioTime) {
  const note = round.notes[index];
  window.dispatchEvent(new CustomEvent('keepy:cue', { detail: {
    ...note, index, audioTime: round.start + note.time, observedAudioTime,
  } }));
}
export function publishTransport(state, audioTime) {
  window.dispatchEvent(new CustomEvent('keepy:transport', { detail: { state, audioTime } }));
}

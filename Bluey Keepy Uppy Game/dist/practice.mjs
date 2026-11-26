/** Thin a detected natural musical phrase without inventing beat timestamps. */
export function practiceRound(round, level = 0, varied = false) {
  // Keep the longer musical phrase, but play fewer cues inside it. Select only
  // real beats, typically 1–2 per bar: 6/7 cues in a normal four-bar round.
  const bars=[...new Set(round.notes.map(n=>n.barInRound??1))];
  const pattern=round.cuePattern??[2,1,2,1];
  const selected=[],colourCounts=new Map();
  bars.forEach((bar,i)=>{
    const notes=round.notes.filter(n=>(n.barInRound??1)===bar);
    const count=Math.min(notes.length,i<4?pattern[i]:1);
    if(!varied){
      if(count>=1)selected.push(notes[0]);
      if(count>=2)selected.push(notes[Math.floor(notes.length/2)]);
      return;
    }
    // Later rounds use existing offbeat colours too, preserving each bar's cue count.
    const chosen=[];
    const span=Math.max(.01,notes.at(-1).time-notes[0].time);
    for(let slot=0;slot<count;slot++){
      const anchor=notes[slot===0?0:Math.floor(notes.length/2)];
      const cost=n=>(colourCounts.get(n.color)||0)*4+Math.abs(n.time-anchor.time)/span;
      const candidate=notes.filter(n=>!chosen.includes(n)).sort((a,b)=>cost(a)-cost(b)||a.time-b.time)[0];
      chosen.push(candidate);colourCounts.set(candidate.color,(colourCounts.get(candidate.color)||0)+1);
    }
    selected.push(...chosen.sort((a,b)=>a.time-b.time));
  });
  return { ...round, notes:selected.map(note=>({...note,
    eventId:`${(round.start+note.time).toFixed(4)}:${note.color}`})),level };

}

export function nextDifficulty(level, streak, grade) {
  if (grade.accuracy < .5 || grade.timing < .35) return { level: Math.max(0, level - 1), streak: 0 };
  if (grade.accuracy >= .85 && grade.timing >= .65) {
    streak++;
    if (streak >= 2) return { level: Math.min(2, level + 1), streak: 0 };
    return { level, streak };
  }
  return { level, streak: 0 };
}

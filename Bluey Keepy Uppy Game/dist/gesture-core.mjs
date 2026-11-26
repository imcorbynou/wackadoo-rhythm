const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
export const POINTER_TUNING = Object.freeze({ sensitivityX: 1.35, sensitivityY: 1.25, smoothingMs: 18, inferenceIntervalMs: 60 });
export function mapPointer(point) {
  return { x: clamp(.5 + (point.x - .5) * POINTER_TUNING.sensitivityX, .025, .975),
    y: clamp(.5 + (point.y - .5) * POINTER_TUNING.sensitivityY, .025, .975) };
}

// The input image is already mirrored. Average the detected palm centres.
// One or two hands may track; missing hands keep the last pointer position.
export function handPoint(result) {
  const palms = (result?.landmarks ?? []).map(hand => hand?.[9]).filter(p =>
    p && Number.isFinite(p.x) && Number.isFinite(p.y) && p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1);
  if (!palms.length) return null;
  return { x: palms.reduce((sum, p) => sum + p.x, 0) / palms.length,
    y: palms.reduce((sum, p) => sum + p.y, 0) / palms.length };
}

const LABELS = Object.freeze({ None: 'Unrecognized pose', Closed_Fist: 'Closed fist', Open_Palm: 'Open palm',
  Pointing_Up: 'Pointing up', Thumb_Down: 'Thumb down', Thumb_Up: 'Thumb up', Victory: 'Victory', ILoveYou: 'I love you' });
export function gestureSummary(result) {
  if (!result?.landmarks?.length) return 'Keep your hands in view';
  return result.landmarks.map((_, i) => LABELS[result.gestures?.[i]?.[0]?.categoryName] ?? LABELS.None).join(' · ');
}

export function touchingBalloon(point, handWidth, candidates) {
  let nearest = null, distance = Infinity;
  for (const candidate of candidates) {
    const r = candidate.rect;
    const cx = r.left + r.width * .55, cy = r.top + r.height * .48;
    const rx = r.width * .47 + handWidth * .17;
    const ry = r.height * .45 + handWidth * .17;
    const overlap = [-.24, .24].some(offset => ((point.x + offset * handWidth - cx) / rx) ** 2 + ((point.y - cy) / ry) ** 2 <= 1);
    const d = Math.hypot(point.x - cx, point.y - cy);
    if (overlap && d < distance) { nearest = candidate; distance = d; }
  }
  return nearest;
}

// A held fist is one click. Only a confidently observed release rearms it.
export class FistClickGate {
  constructor() { this.reset(); }
  reset() { this.latched = false; this.downAt = null; this.upAt = null; this.lastAt = -Infinity; }
  update(result, now, enabled = true) {
    if (!enabled || !result?.landmarks?.length) {
      this.latched = true; this.downAt = this.upAt = null; this.lastAt = now; return false;
    }
    if (now - this.lastAt > 300) this.downAt = this.upAt = null;
    this.lastAt = now;
    const poses = result.landmarks.map((_, i) => result.gestures?.[i]?.[0]);
    const fist = poses.some(p => p?.categoryName === 'Closed_Fist' && p.score >= .75);
    if (fist) {
      this.upAt = null;
      if (this.latched) return false;
      if (this.downAt === null) this.downAt = now;
      if (now - this.downAt < 60) return false;
      this.latched = true; this.downAt = null; return true;
    }
    this.downAt = null;
    if (poses.every(p => p && p.categoryName !== 'Closed_Fist' && p.score >= .65)) {
      if (this.upAt === null) this.upAt = now;
      if (now - this.upAt >= 120) this.latched = false;
    } else this.upAt = null;
    return false;
  }
}

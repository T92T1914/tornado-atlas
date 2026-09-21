// A wall-clock-driven timeline, independent of display refresh rate.
export class PlaybackClock {
  constructor(duration, rate = 60) {
    if (!Number.isFinite(duration) || duration <= 0) throw new RangeError('Invalid duration');
    this.duration = duration; this.seconds = 0; this.playing = false; this.last = null;
    this.setRate(rate);
  }
  setRate(rate) {
    if (![1,15,60,120].includes(rate)) throw new RangeError('Unsupported playback rate');
    this.rate = rate;
  }
  seek(seconds) {
    if (!Number.isFinite(seconds)) throw new RangeError('Invalid time');
    this.pause(); this.seconds = Math.max(0, Math.min(this.duration, seconds));
  }
  play(now) {
    if (!Number.isFinite(now)) throw new RangeError('Invalid wall clock');
    if (this.seconds === this.duration) this.seconds = 0;
    this.last = now; this.playing = true;
  }
  pause() { this.playing = false; this.last = null; }
  tick(now) {
    if (!Number.isFinite(now) || (this.last !== null && now < this.last)) throw new RangeError('Invalid wall clock');
    if (!this.playing) return this.seconds;
    this.seconds = Math.min(this.duration, this.seconds + (now - this.last) * this.rate / 1000);
    this.last = now;
    if (this.seconds === this.duration) this.pause();
    return this.seconds;
  }
}

export function preparePositions(points) {
  const result = points.map(p => ({...p, stamp:Date.parse(p.properties.utc)}));
  if (result.length < 2 || result.some((p,i) => !Number.isFinite(p.stamp) ||
      (i && p.stamp <= result[i-1].stamp) || p.geometry.coordinates.length !== 2 ||
      !p.geometry.coordinates.every(Number.isFinite))) throw new RangeError('Invalid position series');
  return result;
}

export function positionAt(points, seconds) {
  const stamp = points[0].stamp + seconds * 1000;
  if (!Number.isFinite(stamp) || stamp < points[0].stamp || stamp > points.at(-1).stamp) return null;
  const right = points.findIndex(p => p.stamp >= stamp);
  if (points[right].stamp === stamp) return {coordinates:points[right].geometry.coordinates, utc:new Date(stamp).toISOString(), published:true, before:right, after:right};
  const a = points[right-1], b = points[right], fraction = (stamp-a.stamp)/(b.stamp-a.stamp);
  return {coordinates:a.geometry.coordinates.map((v,i) => v+(b.geometry.coordinates[i]-v)*fraction),
    utc:new Date(stamp).toISOString(), published:false, before:right-1, after:right};
}

// Map north is up. The arrow length is a screen symbol, not geographic distance.
export function bearingOffset(degrees, length = 34) {
  if (!Number.isFinite(degrees) || degrees < 0 || degrees > 360) throw new RangeError('Invalid bearing');
  const angle = degrees * Math.PI / 180;
  return [Math.sin(angle)*length, -Math.cos(angle)*length];
}

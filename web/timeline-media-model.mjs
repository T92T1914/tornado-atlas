// Select only a preceding observation. Never carry an old view indefinitely.
export function frameAt(frames, utc, maxAgeSeconds) {
  const selected = Date.parse(utc);
  if (!Number.isFinite(selected) || !Number.isFinite(maxAgeSeconds) || maxAgeSeconds < 0) throw new RangeError('Invalid media time');
  let candidate = null;
  for (const frame of frames) {
    const stamp = Date.parse(frame.utc);
    if (!Number.isFinite(stamp)) throw new RangeError('Invalid frame time');
    const ageSeconds = (selected-stamp)/1000;
    if (ageSeconds >= 0 && ageSeconds <= maxAgeSeconds && (!candidate || ageSeconds < candidate.ageSeconds)) candidate = {frame,ageSeconds};
  }
  return candidate;
}
const localClock = new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',hour:'numeric',minute:'2-digit',second:'2-digit',timeZoneName:'short'});
export function localStamp(utc) { return localClock.format(new Date(utc)); }

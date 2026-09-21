// Clock observations are points, not inferred continuous coverage.
export function anchorAt(anchors, utc) {
  const stamp = Date.parse(utc);
  if (!Number.isFinite(stamp)) return null;
  // A printed clock has one-second resolution; never reveal a future sample.
  return anchors.find(a => Math.floor(Date.parse(a.utc)/1000) === Math.floor(stamp/1000)) || null;
}
export function sourceLink(source, anchor) {
  return `${source.url}&t=${Math.floor(anchor.video_seconds)}s`;
}
export function sourceTime(seconds) {
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
}
export function matchPassages(entries, query, limit=12) {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  return entries.filter(item => terms.every(term => `${item.title} ${item.text}`.toLocaleLowerCase().includes(term))).slice(0, limit);
}

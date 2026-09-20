// Pure view logic shared by the browser and offline Node tests.
export function filterRecords(records, {query = '', year = '', rating = '', state = '', exhibits = false} = {}) {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return records.filter(record => {
    const text = [record.id, record.title, record.state, record.area, ...record.aliases].join(' ').toLocaleLowerCase();
    return terms.every(term => text.includes(term)) && (!year || record.year === Number(year))
      && (!rating || (rating === 'unrated' ? !/^(EF|F)[0-5]$/.test(record.rating || '') : record.rating === rating))
      && (!state || record.state === state) && (!exhibits || Boolean(record.exhibit));
  }).sort((a, b) => (b.date || '').localeCompare(a.date || '') || a.id.localeCompare(b.id));
}

export function project(point) {
  if (!point || point.length !== 2 || !point.every(Number.isFinite)
      || Math.abs(point[0]) > 180 || Math.abs(point[1]) > 90) return null;
  return [(point[0] + 180) * 3, (90 - point[1]) * 3];
}

export function fitBounds(records) {
  const points = records.map(record => project(record.point)).filter(Boolean);
  if (!points.length) return null;
  const xs = points.map(p => p[0]), ys = points.map(p => p[1]);
  const x = Math.min(...xs), y = Math.min(...ys);
  const width = Math.max(18, Math.max(...xs) - x + 12);
  const height = Math.max(9, Math.max(...ys) - y + 12);
  const w = Math.max(width, height * 2), h = w / 2;
  return clampBounds([x + (Math.max(...xs) - x) / 2 - w / 2, y + (Math.max(...ys) - y) / 2 - h / 2, w, h]);
}

export function clampBounds([x,y,w,h]) {
  const width = Math.max(12, Math.min(1080,w));
  const height = width / 2;
  return [Math.max(0,Math.min(1080-width,x)), Math.max(0,Math.min(540-height,y)), width,height];
}

export function color(rating) {
  const colors = ['#9ac3a7','#add09e','#e0ce8c','#e7aa73','#df8774','#da9fc9'];
  const match = /^(?:EF|F)([0-5])$/.exec(rating || '');
  return match ? colors[Number(match[1])] : '#a9b8c0';
}

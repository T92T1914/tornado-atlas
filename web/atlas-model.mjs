// Pure view logic shared by the browser and offline Node tests.
export function readSearchLink(search = '', hash = '') {
  const params = new URLSearchParams(search);
  return {
    filters: {
      query: params.get('q') || '', year: params.get('year') || '',
      rating: params.get('rating') || '', state: params.get('state') || '',
      exhibits: params.get('exhibits') === '1',
    },
    recordId: new URLSearchParams(hash.replace(/^#/, '')).get('record') || '',
  };
}

export function writeSearchLink(filters = {}, recordId = '') {
  const params = new URLSearchParams();
  for (const [key, field] of [['q','query'],['year','year'],['rating','rating'],['state','state']]) {
    if (filters[field]) params.set(key, filters[field]);
  }
  if (filters.exhibits) params.set('exhibits', '1');
  const query = params.toString();
  // Keep existing #record= bookmarks compatible.
  return `${query ? `?${query}` : ''}${recordId ? `#record=${encodeURIComponent(recordId)}` : ''}`;
}

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
  // A library-sized catalogue must not exceed the engine's argument limit.
  let x=Infinity,y=Infinity,right=-Infinity,bottom=-Infinity;
  for (const [px,py] of points) {x=Math.min(x,px);y=Math.min(y,py);right=Math.max(right,px);bottom=Math.max(bottom,py);}
  const width = Math.max(18, right - x + 12);
  const height = Math.max(9, bottom - y + 12);
  const w = Math.max(width, height * 2), h = w / 2;
  return clampBounds([x + (right - x) / 2 - w / 2, y + (bottom - y) / 2 - h / 2, w, h]);
}

// Screen-sized bins keep rendering bounded as coverage grows. These groups
// count source records, not unique storms or a storm-density estimate.
export function mapGroups(records,bounds,columns=48) {
  if (!Array.isArray(bounds) || bounds.length!==4 || !bounds.every(Number.isFinite)
      || bounds[2]<=0 || bounds[3]<=0 || !Number.isInteger(columns) || columns<1 || columns>200) {
    throw new RangeError('Invalid map grouping extent');
  }
  const [x,y,w,h]=bounds, rows=Math.max(1,Math.ceil(columns*h/w));
  const groups=new Map(); let located=0,visible=0;
  for (const record of records) {
    const point=project(record.point);
    if (!point) continue;
    located++;
    if (point[0]<x || point[0]>x+w || point[1]<y || point[1]>y+h) continue;
    visible++;
    const col=Math.min(columns-1,Math.floor((point[0]-x)/w*columns));
    const row=Math.min(rows-1,Math.floor((point[1]-y)/h*rows));
    const key=`${col}:${row}`;
    if (!groups.has(key)) groups.set(key,{key,point:[0,0],records:[]});
    const group=groups.get(key);
    group.point[0]+=point[0];group.point[1]+=point[1];group.records.push(record);
  }
  for (const group of groups.values()) group.point=group.point.map(v=>v/group.records.length);
  return {groups:[...groups.values()],located,visible,unlocated:records.length-located};
}

export function yearCoverage(years) {
  const sorted=[...new Set(years.map(Number))].sort((a,b)=>a-b);
  if (!sorted.length) return 'No years';
  const ranges=[]; let first=sorted[0],last=first;
  const push=()=>ranges.push(first===last?String(first):`${first}–${last}`);
  for (const year of sorted.slice(1)) {
    if (year===last+1) last=year;
    else {push(); first=last=year;}
  }
  push(); return ranges.join(', ');
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

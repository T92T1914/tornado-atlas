export const ratingColors = {
  EF0:'#73a99b', EF1:'#d5c875', EF2:'#eca65f', EF3:'#f1786f',
  'TSTM/Wind':'#b69fd4', 'N/A':'#87949d', UNKNOWN:'#87949d',
};

export function filterSurvey(points, rating = '', query = '', photos = null) {
  const needle = query.trim().toLocaleLowerCase('en');
  return points.filter(point => (!rating || point.rating === rating) && (!photos || photos[String(point.id)]?.length) &&
    `${point.id} ${point.indicator} ${point.degree}`.toLocaleLowerCase('en').includes(needle));
}

export function surveyState(url) {
  const params = new URL(url, 'https://example.invalid').searchParams;
  const value = params.get('survey');
  return {id: value && /^[1-9]\d*$/.test(value) && Number.isSafeInteger(Number(value)) ? Number(value) : null,
    rating: params.get('surveyRating') || '', query: params.get('surveySearch') || '',
    photosOnly: params.get('surveyPhotos') !== '0'};
}

export function surveyLink(url, state) {
  const result = new URL(url, 'https://example.invalid');
  for (const key of ['survey', 'surveyRating', 'surveySearch', 'surveyPhotos', 'fatality']) result.searchParams.delete(key);
  if (state.id !== null) result.searchParams.set('survey',String(state.id));
  if (state.rating) result.searchParams.set('surveyRating',state.rating);
  if (state.query) result.searchParams.set('surveySearch',state.query);
  result.searchParams.set('surveyPhotos',state.photosOnly ? '1' : '0');
  result.hash = 'survey-explorer'; return result.href;
}

// Carry only survey state between the report and its focused map page.
export function surveyPageLink(url, destination) {
  const current = new URL(url, 'https://example.invalid');
  const result = new URL(destination, current);
  for (const key of ['survey', 'surveyRating', 'surveySearch', 'surveyPhotos', 'fatality']) {
    if (current.searchParams.has(key)) result.searchParams.set(key, current.searchParams.get(key));
  }
  result.hash = 'survey-explorer';
  return result.href;
}

export function surveyViewBox(zoom, center = [480,215]) {
  if (![1,2,4].includes(zoom) || center.length !== 2 || !center.every(Number.isFinite)) throw new RangeError('Invalid map view');
  const width=960/zoom, height=430/zoom;
  return [Math.max(0,Math.min(960-width,center[0]-width/2)), Math.max(0,Math.min(430-height,center[1]-height/2)),width,height];
}

export function surveyProjection(rings) {
  const coords = rings.flat();
  const lat = coords.reduce((sum, p) => sum + p[1], 0) / coords.length;
  const lon = coords.reduce((sum, p) => sum + p[0], 0) / coords.length;
  const km = p => [(p[0] - lon) * 111.195 * Math.cos(lat * Math.PI / 180), (p[1] - lat) * 111.195];
  const xy = coords.map(km);
  const minX=Math.min(...xy.map(p=>p[0])), maxX=Math.max(...xy.map(p=>p[0]));
  const minY=Math.min(...xy.map(p=>p[1])), maxY=Math.max(...xy.map(p=>p[1]));
  const scale=Math.min(810/(maxX-minX),300/(maxY-minY));
  const project=p=>{const [x,y]=km(p);return [480+(x-(minX+maxX)/2)*scale,210-(y-(minY+maxY)/2)*scale];};
  return {project, scale};
}

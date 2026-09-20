export const ratingColors = {
  EF0:'#73a99b', EF1:'#d5c875', EF2:'#eca65f', EF3:'#f1786f',
  'TSTM/Wind':'#b69fd4', 'N/A':'#87949d', UNKNOWN:'#87949d',
};

export function filterSurvey(points, rating = '', query = '') {
  const needle = query.trim().toLocaleLowerCase('en');
  return points.filter(point => (!rating || point.rating === rating) &&
    `${point.id} ${point.indicator} ${point.degree}`.toLocaleLowerCase('en').includes(needle));
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

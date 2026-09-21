// Both exhibit maps use an affine local longitude/latitude projection.
export function inverseProjection(project) {
  const [x,y]=project([0,0]), [east]=project([1,0]), [,north]=project([0,1]);
  return ([px,py])=>[(px-x)/(east-x),(py-y)/(north-y)];
}
export function geographicBounds(view, unproject) {
  const [x,y,w,h]=view, [west,north]=unproject([x,y]),[east,south]=unproject([x+w,y+h]);
  if (![west,south,east,north].every(Number.isFinite) || west>=east || south>=north) throw new Error('Invalid map bounds');
  return [west,south,east,north];
}
export function basemapRequest(mode,bounds,width=1200) {
  if(!['streets','terrain'].includes(mode)) throw new Error('Unknown basemap');
  const service=mode==='streets'?'USGSTopo':'USGSShadedReliefOnly';
  // Match the geographic aspect ratio. ArcGIS otherwise expands the requested bbox.
  const height=Math.max(1,Math.round(width*(bounds[3]-bounds[1])/(bounds[2]-bounds[0])));
  const url=new URL(`https://basemap.nationalmap.gov/arcgis/rest/services/${service}/MapServer/export`);
  url.search=new URLSearchParams({bbox:bounds.join(','),bboxSR:'4326',imageSR:'4326',size:`${width},${height}`,format:'png32',transparent:'false',f:'json'});
  return url.href;
}

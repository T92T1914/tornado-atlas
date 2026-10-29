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
// Raster sizing is separate from geographic registration and renderer quality.
export function basemapRasterSize(bounds,cssWidth,cssHeight,pixelRatio=1) {
  if(!Array.isArray(bounds)||bounds.length!==4||![...bounds,cssWidth,cssHeight,pixelRatio].every(Number.isFinite)
      ||bounds[0]<-180||bounds[2]>180||bounds[1]<-90||bounds[3]>90
      ||bounds[0]>=bounds[2]||bounds[1]>=bounds[3]||cssWidth<=0||cssHeight<=0||pixelRatio<=0)
    throw new RangeError('Invalid basemap raster size');
  const aspect=(bounds[3]-bounds[1])/(bounds[2]-bounds[0]),density=Math.min(2,Math.max(1,pixelRatio));
  const bucket=Math.ceil(Math.max(cssWidth,cssHeight/aspect)*density/64)*64;
  const maximum=Math.min(4096,Math.floor(4096/aspect),Math.floor(Math.sqrt(4194304/aspect)));
  if(!Number.isFinite(bucket)||maximum<1)throw new RangeError('Basemap aspect exceeds the bounded export');
  let width=Math.min(bucket,maximum),height=Math.max(1,Math.round(width*aspect));
  if(width*height>4194304){width--;height=Math.max(1,Math.round(width*aspect));}
  if(width<1||width>4096||height>4096||width*height>4194304)throw new RangeError('Basemap size exceeds the bounded export');
  return {width,height,density,capped:width<bucket||pixelRatio>density};
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

export function basemapImage(data,project) {
  if(data?.error || !data?.href || !data?.extent) throw new Error('Map service unavailable');
  const url=new URL(data.href),e=data.extent,sr=e.spatialReference;
  if(url.origin!=='https://basemap.nationalmap.gov' || url.username || url.password)
    throw new Error('Unexpected map image source');
  // Export Map returns its actual extent, which can differ from the requested
  // bbox. This projection accepts geographic WGS84 degrees only.
  if(sr?.wkid!==4326 || (sr.latestWkid!==undefined && sr.latestWkid!==4326))
    throw new Error('Unexpected map image spatial reference');
  if(![e.xmin,e.ymin,e.xmax,e.ymax].every(Number.isFinite)
      || e.xmin < -180 || e.xmax > 180 || e.ymin < -90 || e.ymax > 90
      || e.xmin>=e.xmax || e.ymin>=e.ymax)
    throw new Error('Invalid map image extent');
  const [x,y]=project([e.xmin,e.ymax]),[right,bottom]=project([e.xmax,e.ymin]);
  if(![x,y,right,bottom].every(Number.isFinite) || right<=x || bottom<=y)
    throw new Error('Invalid projected map image extent');
  return {x,y,width:right-x,height:bottom-y,preserveAspectRatio:'none',href:url.href};
}

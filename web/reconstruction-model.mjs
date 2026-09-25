// Local geographic stage, in kilometers. Flat ground is a display assumption.
export function localPoint(coordinates, origin) {
  if (![...coordinates, ...origin].every(Number.isFinite) || coordinates.length !== 2 || origin.length !== 2) throw new RangeError('Invalid geographic point');
  const radians = Math.PI / 180;
  return [(coordinates[0]-origin[0])*111.195*Math.cos(origin[1]*radians),
    (coordinates[1]-origin[1])*111.195, 0];
}

// Perspective projection. Azimuth 0 looks north from the south of the scene.
export function sceneProject(point, camera, width, height) {
  const {azimuth, elevation, distance, focus} = camera;
  if (![...point, ...focus, azimuth, elevation, distance, width, height].every(Number.isFinite) || distance <= 0 || width <= 0 || height <= 0) throw new RangeError('Invalid scene camera');
  const a=azimuth*Math.PI/180, e=elevation*Math.PI/180;
  const [x,y,z]=point.map((v,i)=>v-focus[i]);
  const depth=distance-(x*Math.sin(a)*Math.cos(e)-y*Math.cos(a)*Math.cos(e)+z*Math.sin(e));
  if (depth <= .05) return null;
  const scale=height*1.1/depth;
  return {x:width/2+(x*Math.cos(a)+y*Math.sin(a))*scale,
    y:height/2-(-x*Math.sin(a)*Math.sin(e)+y*Math.cos(a)*Math.sin(e)+z*Math.cos(e))*scale,
    scale, depth};
}

export function initialSeconds(search, duration) {
  const raw=new URLSearchParams(search).get('t');
  if (raw === null || raw.trim() === '') return 0;
  const seconds=Number(raw);
  return Number.isFinite(seconds) ? Math.min(duration,Math.max(0,seconds)) : 0;
}

// Project only an azimuth direction, then normalize to a fixed screen symbol.
// The arrow length is neither distance to a feature nor a camera field of view.
export function observerGlyph(sample,origin,camera,width,height){
  const point=localPoint(sample.coordinates,origin),angle=sample.azimuth*Math.PI/180;
  const start=sceneProject(point,camera,width,height);
  if(!start||start.x<0||start.x>width||start.y<0||start.y>height)return null;
  // Differentiate the projection at the observer. Projecting an arbitrary
  // distant endpoint could cross the near plane and hide a visible observer.
  const a=camera.azimuth*Math.PI/180,e=camera.elevation*Math.PI/180;
  const east=Math.sin(angle),north=Math.cos(angle);
  const horizontal=east*Math.cos(a)+north*Math.sin(a);
  const vertical=(-east*Math.sin(a)+north*Math.cos(a))*Math.sin(e);
  const depth=(-east*Math.sin(a)+north*Math.cos(a))*Math.cos(e);
  const x=(start.x-width/2)/start.scale,y=-(start.y-height/2)/start.scale;
  const dx=horizontal*start.depth-x*depth,dy=-vertical*start.depth+y*depth;
  const length=Math.hypot(dx,dy);
  return {x:start.x,y:start.y,dx:length>1e-8?dx/length*30:0,dy:length>1e-8?dy/length*30:0};
}

// A drawing glyph, not a measured funnel. Its parameters never come from EF rating.
export function funnelGlyph(seconds, count=480) {
  if (!Number.isFinite(seconds) || !Number.isInteger(count) || count < 1 || count > 2000) throw new RangeError('Invalid glyph');
  return Array.from({length:count},(_,i)=>{
    // Independent integer hashes avoid correlating height with azimuth, which
    // can turn an otherwise dense cloud into a conspicuous single spiral.
    const unit=salt=>{let x=i+salt;x=Math.imul(x^(x>>>16),0x7feb352d);x=Math.imul(x^(x>>>15),0x846ca68b);return ((x^(x>>>16))>>>0)/4294967296;};
    const h=unit(17), angle=unit(191)*Math.PI*2+seconds*.7;
    const radius=(.14+.40*h*h)*Math.sqrt(unit(977));
    return [Math.cos(angle)*radius, Math.sin(angle)*radius, .85*h];
  });
}

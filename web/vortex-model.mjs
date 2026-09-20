// Artistic geometry in normalized scene units. No wind, intensity or damage output.
export const PRESETS = Object.freeze({
  cone: Object.freeze({ base: 0.13, flare: 0.83, bend: 0.12, label: 'Cone' }),
  wedge: Object.freeze({ base: 1.35, flare: 0.24, bend: 0.08, label: 'Wedge' }),
  rope: Object.freeze({ base: 0.065, flare: 0.13, bend: 0.52, label: 'Rope' }),
});
export const HEIGHT = 2.6;
export function radiusAt(shape, height) {
  if (!Object.hasOwn(PRESETS, shape) || !Number.isFinite(height) || height < 0 || height > 1) {
    throw new RangeError('Expected a known shape and normalized height');
  }
  return PRESETS[shape].base + PRESETS[shape].flare * height ** 1.6;
}
export function particles(count = 7200, seed = 20130531) {
  if (!Number.isInteger(count) || count < 100 || count > 12000 || !Number.isInteger(seed)) {
    throw new RangeError('Particle budget or seed is invalid');
  }
  let state = seed >>> 0;
  const random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
  const result = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    // 72% funnel, 13% ground dust, 15% cloud base. These proportions are illustrative.
    result.set([random(), random(), random(), i < count * .72 ? 0 : i < count * .85 ? 1 : 2], i * 4);
  }
  return result;
}
export function advanceTime(time, elapsedSeconds, running) {
  if (![time, elapsedSeconds].every(Number.isFinite) || time < 0 || elapsedSeconds < 0) {
    throw new RangeError('Animation time must be finite and nonnegative');
  }
  // No catch-up jump after a suspended tab or debugger pause.
  return running ? time + Math.min(elapsedSeconds, .05) : time;
}
export function cameraMatrix(azimuth, elevation, distance, aspect) {
  if (![azimuth, elevation, distance, aspect].every(Number.isFinite) || aspect <= 0 || distance <= 0 || elevation <= 0 || elevation >= 89) {
    throw new RangeError('Invalid camera');
  }
  const a = azimuth * Math.PI / 180, e = elevation * Math.PI / 180;
  const eye = [distance * Math.sin(a) * Math.cos(e), 1.15 + distance * Math.sin(e), distance * Math.cos(a) * Math.cos(e)];
  const norm = v => { const d = Math.hypot(...v); return v.map(x => x / d); };
  const cross = (a,b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
  const dot = (a,b) => a.reduce((sum,x,i) => sum + x*b[i],0);
  const z = norm([eye[0],eye[1]-1.15,eye[2]]), x = norm(cross([0,1,0],z)), y = cross(z,x);
  const view = [x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-dot(x,eye),-dot(y,eye),-dot(z,eye),1];
  const f = 1 / Math.tan(45 * Math.PI / 360), near=.1, far=60;
  const proj = [f/aspect,0,0,0,0,f,0,0,0,0,(far+near)/(near-far),-1,0,0,2*far*near/(near-far),0];
  const result = new Float32Array(16);
  for (let col=0;col<4;col++) for (let row=0;row<4;row++) {
    for (let k=0;k<4;k++) result[col*4+row] += proj[k*4+row] * view[col*4+k];
  }
  return result;
}

// Idealized horizontal Rankine vortex plus a uniform eastward background flow.
// SI units throughout. This is not a numerical weather or structural model.
export const MPH = 0.44704;
export const FOOT = 0.3048;
export function windAt(x,y,{peak,radius,background=0}) {
  if (![x,y,peak,radius,background].every(Number.isFinite) || peak<0 || radius<=0 || background<0) throw new RangeError('Invalid wind parameters');
  const r=Math.hypot(x,y);
  const tangent=peak*(r<=radius?r/radius:radius/r);
  const u=background+(r?-y/r*tangent:0),v=r?x/r*tangent:0;
  return {u,v,speed:Math.hypot(u,v),tangent};
}
export function loadAt(speed,{density=1.225,area=1,coefficient=1.2}={}) {
  if (![speed,density,area,coefficient].every(Number.isFinite) || speed<0 || density<=0 || area<=0 || coefficient<0) throw new RangeError('Invalid force parameters');
  const pressure=.5*density*speed**2;
  return {pressure,force:pressure*area*coefficient};
}

// Prescribed eastward translation of an unchanged field. Travel is independent
// of the uniform background wind; neither implies a self-consistent storm.
export function passageAt(time,{travel,offset=0,...field}) {
  if (![time,travel,offset].every(Number.isFinite) || travel<=0) throw new RangeError('Invalid passage parameters');
  const center=travel*time;
  return {time,center,...windAt(-center,offset*field.radius,field)};
}
export function samplePassage(settings,{steps=480,extent=6,threshold=50*MPH}={}) {
  if (!Number.isInteger(steps) || steps<2 || steps>10000 || !Number.isFinite(extent) || extent<=0 || !Number.isFinite(threshold) || threshold<0) throw new RangeError('Invalid passage sampling');
  passageAt(0,settings); // Validate even when an invalid radius would spoil the domain.
  const halfTime=extent*settings.radius/settings.travel;
  const samples=Array.from({length:steps+1},(_,i)=>passageAt((i/steps*2-1)*halfTime,settings));
  let aboveSeconds=0;
  for (let i=1;i<samples.length;i++) {
    const a=samples[i-1],b=samples[i],dt=b.time-a.time;
    if (a.speed>=threshold && b.speed>=threshold) aboveSeconds+=dt;
    else if ((a.speed>=threshold)!==(b.speed>=threshold)) {
      // Linear interpolation only between neighboring samples, not an exact integral.
      const fraction=(threshold-a.speed)/(b.speed-a.speed);
      aboveSeconds+=dt*(a.speed>=threshold?fraction:1-fraction);
    }
  }
  return {samples,halfTime,aboveSeconds,peak:Math.max(...samples.map(s=>s.speed))};
}

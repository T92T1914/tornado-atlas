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

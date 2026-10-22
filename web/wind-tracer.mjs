import {windAt} from './wind-model.mjs';

// Advance a passive marker in core-radius units. Exact rotations cover zero
// background and mixed-flow circles wholly inside the core. Other paths use
// bounded RK4 substeps, including possible core-boundary crossings.
export function advanceWindTracer(point,field,elapsed){
  const background=field?.background===undefined?0:field.background;
  if(!point||!field||!Number.isFinite(point.x)||!Number.isFinite(point.y)||!Number.isFinite(field.peak)||!Number.isFinite(field.radius)||!Number.isFinite(background)||!Number.isFinite(elapsed)||field.peak<0||field.radius<=0||background<0||elapsed<0||elapsed>.04)throw new RangeError('Invalid tracer step');
  if(elapsed===0)return point;
  if(background===0){
    const radial=Math.hypot(point.x,point.y);
    if(radial===0||field.peak===0)return point;
    let angularSpeed=field.peak/field.radius;
    if(radial>1)angularSpeed=angularSpeed/radial/radial;
    const angle=angularSpeed*elapsed;
    if(!Number.isFinite(angle))throw new RangeError('Tracer rotation exceeds representable range');
    const cosine=Math.cos(angle),sine=Math.sin(angle),x=point.x,y=point.y;
    point.x=x*cosine-y*sine;point.y=x*sine+y*cosine;
    return point;
  }
  if(field.peak>0){
    // In the core, x'=-omega*(y-center), y'=omega*x. A complete shifted
    // circle inside r<1 proves the entire step is in this linear field.
    // Endpoint containment alone would not exclude an intervening crossing.
    const center=background/field.peak,x=point.x,y=point.y-center;
    if(center+Math.hypot(x,y)<1){
      const angle=field.peak/field.radius*elapsed;
      if(!Number.isFinite(angle))throw new RangeError('Tracer rotation exceeds representable range');
      // Express the displacement without subtracting and restoring the center
      // at tiny angles. Compute both coordinates before committing the point.
      const halfSine=Math.sin(angle/2),cosineMinusOne=-2*halfSine*halfSine,sine=Math.sin(angle);
      const nextX=point.x+x*cosineMinusOne-y*sine,nextY=point.y+x*sine+y*cosineMinusOne;
      point.x=nextX;point.y=nextY;
      return point;
    }
  }
  // At the supported slider limits a frame spans at most 0.294 nominal
  // radians. Subdivide at 0.04 radians, with eight as a fixed work bound.
  // The wider helper input range remains admitted without an accuracy promise
  // outside those controls. Commit only after every stage has succeeded.
  const steps=Math.min(8,Math.max(1,Math.ceil(field.peak/field.radius*elapsed/.04)));
  const h=elapsed/steps,radius=field.radius;
  let x=point.x,y=point.y;
  for(let i=0;i<steps;i++){
    const a=windAt(x*radius,y*radius,field),ax=a.u/radius,ay=a.v/radius;
    const b=windAt((x+h*ax/2)*radius,(y+h*ay/2)*radius,field),bx=b.u/radius,by=b.v/radius;
    const c=windAt((x+h*bx/2)*radius,(y+h*by/2)*radius,field),cx=c.u/radius,cy=c.v/radius;
    const d=windAt((x+h*cx)*radius,(y+h*cy)*radius,field),dx=d.u/radius,dy=d.v/radius;
    x+=h*(ax+2*bx+2*cx+dx)/6;y+=h*(ay+2*by+2*cy+dy)/6;
    if(!Number.isFinite(x)||!Number.isFinite(y))throw new RangeError('Tracer integration exceeds representable range');
  }
  point.x=x;point.y=y;
  return point;
}

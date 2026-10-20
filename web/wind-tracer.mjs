import {windAt} from './wind-model.mjs';

// Advance a passive marker in core-radius units. Exact rotations cover zero
// background and mixed-flow circles wholly inside the core. Other paths retain
// midpoint integration, including every possible core-boundary crossing.
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
  const wind=windAt(point.x*field.radius,point.y*field.radius,field);
  const mx=point.x+wind.u/field.radius*elapsed/2,my=point.y+wind.v/field.radius*elapsed/2;
  const midpoint=windAt(mx*field.radius,my*field.radius,field);
  point.x+=midpoint.u/field.radius*elapsed;point.y+=midpoint.v/field.radius*elapsed;
  return point;
}

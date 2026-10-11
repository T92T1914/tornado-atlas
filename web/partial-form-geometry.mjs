// Normalized authored display support, never a measured optical silhouette.
export function validateCondensationSupport(points){
  if(!Array.isArray(points)||points.length<3||points.length>64)throw new TypeError('Condensation support requires three through 64 points');
  for(let i=0;i<points.length;i++){
    const p=points[i];
    if(!Array.isArray(p)||p.length!==2||![p[0],p[1]].every(value=>Number.isFinite(value)&&value>=0&&value<=1))throw new TypeError('Condensation support requires finite normalized pairs');
    if(points.slice(0,i).some(q=>q[0]===p[0]&&q[1]===p[1]))throw new TypeError('Condensation support vertices must differ');
  }
  const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
  const on=(a,b,p)=>cross(a,b,p)===0&&p[0]>=Math.min(a[0],b[0])&&p[0]<=Math.max(a[0],b[0])&&p[1]>=Math.min(a[1],b[1])&&p[1]<=Math.max(a[1],b[1]);
  const intersects=(a,b,c,d)=>{const abC=cross(a,b,c),abD=cross(a,b,d),cdA=cross(c,d,a),cdB=cross(c,d,b);return ((abC>0&&abD<0||abC<0&&abD>0)&&(cdA>0&&cdB<0||cdA<0&&cdB>0))||on(a,b,c)||on(a,b,d)||on(c,d,a)||on(c,d,b);};
  let area=0;
  for(let i=0;i<points.length;i++){
    const a=points[i],b=points[(i+1)%points.length],prior=points[(i+points.length-1)%points.length];
    if(Math.hypot(b[0]-a[0],b[1]-a[1])<1e-6)throw new TypeError('Condensation support segment is below display precision');
    if(cross(prior,a,b)===0&&(a[0]-prior[0])*(b[0]-a[0])+(a[1]-prior[1])*(b[1]-a[1])<0)throw new TypeError('Condensation support cannot double back');
    area+=a[0]*b[1]-b[0]*a[1];
    for(let j=i+1;j<points.length;j++){
      if(j===i+1||i===0&&j===points.length-1)continue;
      if(intersects(a,b,points[j],points[(j+1)%points.length]))throw new TypeError('Condensation support cannot self-intersect');
    }
  }
  if(Math.abs(area)<1e-6)throw new TypeError('Condensation support needs nonzero display area');
  return new Float32Array(points.flat());
}

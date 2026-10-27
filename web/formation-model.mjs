// A declared supercell study, not a universal pathway or an atmospheric solve.
// NOAA separates surface circulation from its visible condensation funnel.
export const FORMATION_STUDY=Object.freeze({id:'genesis-v1',duration:30});
const smooth=(a,b,x)=>{const u=Math.max(0,Math.min(1,(x-a)/(b-a)));return u*u*(3-2*u);};

export function formationAt(seconds,{visibility='ordinary',flow=true}={}){
  if(!Number.isFinite(seconds)||seconds<0||seconds>30)throw new RangeError('Formation study time must be between 0 and 30 seconds');
  if(!['ordinary','limited'].includes(visibility)||typeof flow!=='boolean')throw new TypeError('Unknown formation study assumptions');
  const u=seconds/30;
  const circulation=smooth(0,.22,u)*(1-smooth(.72,1,u));
  const condensation=smooth(.16,.42,u)*(1-smooth(.72,.97,u))*(visibility==='limited'?.22:1);
  const dust=smooth(.11,.30,u)*(1-smooth(.65,.94,u));
  const erosion=smooth(.65,.98,u);
  return {model:'genesis-v1',seconds,progress:u,circulation,condensation,dust,erosion,flow,
    shape:{base:.19+.27*smooth(.2,.52,u)-.28*erosion,flare:.48+.12*smooth(.15,.5,u)-.12*erosion,bend:.07+.30*erosion},
    extent:1,
    stage:u<.16?'Circulation before a continuous visible funnel':u<.42?'Patchy condensation and separate surface dust':u<.65?'A developed illustrative tornado':u<.97?'Thinning condensation and weakening circulation':'Condensation gone; this study ends',
  };
}

// Arrow length is constant. Only opacity follows the assumed circulation.
// These display vectors are neither measured velocities nor a fluid solution.
export function formationFlow(seconds,strength){
  if(!Number.isFinite(seconds)||seconds<0||seconds>30||!Number.isFinite(strength)||strength<0||strength>1)throw new RangeError('Invalid modeled circulation cue');
  const lines=[];
  for(let ring=0;ring<2;ring++)for(let i=0;i<12;i++){
    const angle=i*Math.PI/6+seconds*.20,r=.65+ring*.55;
    const x=Math.cos(angle)*r,z=Math.sin(angle)*r;
    const dx=(-Math.sin(angle)-.28*Math.cos(angle))*.15,dz=(Math.cos(angle)-.28*Math.sin(angle))*.15;
    const y=.025;
    lines.push(x,y,z,x+dx,y,z+dz,x+dx,y,z+dz,x+dx*.6+dz*.3,y,z+dz*.6-dx*.3,x+dx,y,z+dz,x+dx*.6-dz*.3,y,z+dz*.6+dx*.3);
  }
  return new Float32Array(lines);
}

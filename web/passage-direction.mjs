import {MPH} from './wind-model.mjs';

// Describe the selected calculation. No wind, sampling or timing rule lives here.
export function passageDirection(sample) {
  if(!sample || ![sample.u,sample.v,sample.speed].every(Number.isFinite) || sample.speed<0)return null;
  const speed=Math.hypot(sample.u,sample.v),east=sample.u/MPH,north=sample.v/MPH;
  if(![speed,east,north].every(Number.isFinite) || Math.abs(speed-sample.speed)>1e-12*Math.max(1,speed,sample.speed))return null;
  const signed=value=>{
    const text=value.toFixed(1);
    return `${Number(text)===0?'0.0':value>0?'+'+text:text} mph`;
  };
  const parts=[];
  if(sample.u!==0)parts.push(sample.u>0?'eastward':'westward');
  if(sample.v!==0)parts.push(sample.v>0?'northward':'southward');
  return {east,north,eastText:signed(east),northText:signed(north),
    explanation:parts.length?`Air moves ${parts.join(' and ')} at this sample.`:'No horizontal wind at this sample, so there is no direction.',
    unit:speed===0?null:{east:sample.u/speed,north:sample.v/speed}};
}

export function showPassageDirection(document,sample,offset) {
  const east=document.getElementById('passage-east-component'),north=document.getElementById('passage-north-component');
  const reading=document.getElementById('passage-direction-reading'),arrow=document.getElementById('passage-direction-arrow');
  const row=Number.isFinite(offset)&&Math.abs(offset)<=3?passageDirection(sample):null;
  document.getElementById('passage-direction-defaults').hidden=true;
  if(!row) {
    for(const node of [east,north]){node.textContent='Unavailable';delete node.dataset.value;}
    reading.textContent='Wind direction is unavailable for this sample.';
    arrow.setAttribute('d','');arrow.setAttribute('visibility','hidden');
    return false;
  }
  east.textContent=row.eastText;north.textContent=row.northText;
  east.dataset.value=String(row.east);north.dataset.value=String(row.north);
  reading.textContent=row.explanation;
  if(!row.unit){arrow.setAttribute('d','');arrow.setAttribute('visibility','hidden');return true;}
  const dx=row.unit.east,dy=-row.unit.north,probeY=210-offset*50;
  const endX=360+50*dx,endY=probeY+50*dy;
  const point=(x,y)=>`${x.toFixed(3)} ${y.toFixed(3)}`;
  arrow.setAttribute('d',`M${point(360+8*dx,probeY+8*dy)} L${point(endX,endY)} M${point(endX-10*dx-6*dy,endY-10*dy+6*dx)} L${point(endX,endY)} L${point(endX-10*dx+6*dy,endY-10*dy-6*dx)}`);
  arrow.setAttribute('visibility','visible');
  return true;
}

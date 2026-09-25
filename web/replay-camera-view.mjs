import {cameraAt,cameraStatus} from './camera-model.mjs';

export function mountReplayCamera(manifest,start,end,seek,formatTime,footageCreator){
  const el=id=>document.getElementById(id),section=el('replay-camera');
  if(!manifest)return ()=>null;
  section.hidden=false;
  el('replay-camera-name').textContent=`${manifest.observer}'s recorded camera`;
  el('replay-camera-method').textContent=`${manifest.method} ${manifest.limits}`;
  el('replay-camera-credit').textContent=manifest.credit;
  el('replay-camera-source').href=manifest.source;
  el('replay-camera-separation').textContent=`${manifest.observer}'s track is separate from ${footageCreator}'s footage below. A matching clock does not connect the two sources.`;
  const menu=el('replay-camera-sample'),enabled=el('replay-camera-enabled');
  const samples=manifest.samples.filter(sample=>Date.parse(sample.utc)>=start&&Date.parse(sample.utc)<=end);
  for(const sample of samples){
    const option=document.createElement('option');option.value=sample.utc;
    option.textContent=`${formatTime(sample.utc)} · ${sample.azimuth}°`;menu.append(option);
  }
  menu.disabled=samples.length===0;
  el('replay-camera-count').textContent=`${samples.length} recorded samples within this timeline. Camera positions are never interpolated.`;
  let lastUtc=null,lastKey=null;
  const update=utc=>{
    lastUtc=utc;
    const state=cameraAt(manifest,utc,enabled.checked);
    const key=`${state.status}:${state.sample?.utc}:${Math.floor(state.ageSeconds)}`;
    if(key!==lastKey){
      lastKey=key;
      section.dataset.state=state.status;
      el('replay-camera-status').textContent=cameraStatus(manifest,state,formatTime);
      menu.value=state.status==='recorded'?state.sample.utc:'';
    }
    return state;
  };
  menu.addEventListener('change',()=>{
    if(!menu.value)return;
    enabled.checked=true;seek((Date.parse(menu.value)-start)/1000);
  });
  enabled.addEventListener('change',()=>{if(lastUtc)update(lastUtc);});
  return update;
}

import {localStamp} from './timeline-media-model.mjs';
import {bearingOffset} from './playback-model.mjs';
import {cameraAt,cameraStatus} from './camera-model.mjs';

export function mountCamera(manifest, svg, project, start, end, seek) {
  const el = id => document.getElementById(id);
  const ns = 'http://www.w3.org/2000/svg';
  const group = document.createElementNS(ns,'g'); group.setAttribute('class','camera-marker');
  group.setAttribute('display','none'); group.setAttribute('aria-hidden','true');
  const dot = document.createElementNS(ns,'circle'); dot.setAttribute('r',5);
  const arrow = document.createElementNS(ns,'path');
  group.append(arrow,dot); svg.append(group);
  const samples = manifest.samples.filter(s => Date.parse(s.utc) >= start && Date.parse(s.utc) <= end);
  const menu = el('camera-sample');
  for (const sample of samples) {
    const option = document.createElement('option'); option.value = sample.utc;
    option.textContent = `${localStamp(sample.utc)} · ${sample.azimuth}°`; menu.append(option);
  }
  el('camera-method').textContent = manifest.method + ' ' + manifest.limits;
  el('camera-count').textContent = `${samples.length} recorded samples within this timeline; ${manifest.samples.length} preserved in the source excerpt.`;
  el('camera-source').href = manifest.source;
  menu.addEventListener('change', () => {if (menu.value) seek((Date.parse(menu.value)-start)/1000);});
  let lastUtc = null, lastKey = null;
  function update(utc) {
    lastUtc = utc;
    const enabled = el('camera-enabled').checked;
    const state = cameraAt(manifest,utc,enabled);
    const key = `${state.status}:${state.sample?.utc || 'none'}:${Math.floor(state.ageSeconds)}`;
    if (key === lastKey) return;
    lastKey = key;
    el('camera-status').textContent = cameraStatus(manifest,state,localStamp);
    group.setAttribute('display', state.visible ? 'inline' : 'none');
    if (!state.visible) {
      menu.value = '';
      return;
    }
    const {sample:frame, ageSeconds} = state, [x,y] = project(frame.coordinates);
    group.setAttribute('transform',`translate(${x} ${y})`);
    const [dx,dy] = bearingOffset(frame.azimuth), [wingX,wingY] = bearingOffset((frame.azimuth+90)%360,5);
    arrow.setAttribute('d',`M0 0 L${dx} ${dy} M${dx*.7+wingX} ${dy*.7+wingY} L${dx} ${dy} L${dx*.7-wingX} ${dy*.7-wingY}`);
    // Only select an exact observation; do not imply that a held sample is current.
    menu.value = ageSeconds === 0 ? frame.utc : '';
  }
  el('camera-enabled').addEventListener('change', () => {if(lastUtc) update(lastUtc);});
  return update;
}

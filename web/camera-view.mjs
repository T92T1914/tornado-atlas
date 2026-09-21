import {frameAt, localStamp} from './timeline-media-model.mjs';
import {bearingOffset} from './playback-model.mjs';

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
    const match = enabled ? frameAt(manifest.samples, utc, manifest.display_max_age_seconds) : null;
    const key = `${enabled}:${match?.frame.utc || 'none'}:${match ? Math.floor(match.ageSeconds) : ''}:${match?.ageSeconds === 0}`;
    if (key === lastKey) return;
    lastKey = key;
    group.setAttribute('display', match ? 'inline' : 'none');
    if (!match) {
      el('camera-status').textContent = enabled ? 'No camera sample within the preceding 90 seconds. The camera marker is hidden.' : 'Camera overlay hidden.';
      menu.value = '';
      return;
    }
    const {frame, ageSeconds} = match, [x,y] = project(frame.coordinates);
    group.setAttribute('transform',`translate(${x} ${y})`);
    const [dx,dy] = bearingOffset(frame.azimuth), [wingX,wingY] = bearingOffset((frame.azimuth+90)%360,5);
    arrow.setAttribute('d',`M0 0 L${dx} ${dy} M${dx*.7+wingX} ${dy*.7+wingY} L${dx} ${dy} L${dx*.7-wingX} ${dy*.7-wingY}`);
    const age = Math.floor(ageSeconds);
    el('camera-status').textContent = `Tim Marshall · camera 1 · ${frame.azimuth}° from north. Recorded at ${localStamp(frame.utc)}; ${ageSeconds === 0 ? 'exact sample time' : `${age < 1 ? 'less than 1' : age} ${age <= 1 ? 'second' : 'seconds'} old`}. Marker stays at that recorded location.`;
    // Only select an exact observation; do not imply that a held sample is current.
    menu.value = ageSeconds === 0 ? frame.utc : '';
  }
  el('camera-enabled').addEventListener('change', () => {if(lastUtc) update(lastUtc);});
  return update;
}

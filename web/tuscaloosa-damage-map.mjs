// Optional map enhancement over the complete native survey accounts.
import {boundedResponseBytes} from './dossier-file-model.mjs';
import {mountExplorerMap} from './explorer-map.mjs';

export async function loadTuscaloosaSurvey(section, {fetcher = fetch} = {}) {
  const file = section.dataset.surveyFile, expectedBytes = Number(section.dataset.surveyBytes);
  const hash = section.dataset.surveySha256;
  if (!/^events\/tuscaloosa-birmingham-2011-survey-[0-9a-f]{20}\.json$/.test(file) ||
      !Number.isSafeInteger(expectedBytes) || expectedBytes <= 0 || expectedBytes > 200000 ||
      !/^[0-9a-f]{64}$/.test(hash) || !file.includes(hash.slice(0, 20))) throw Error('Survey reference is unavailable.');
  const controller = new AbortController(), deadline = setTimeout(() => controller.abort(), 10000);
  let bytes;
  try {
    const response = await fetcher(file, {cache: 'no-store', signal: controller.signal});
    if (!response.ok) throw Error('The preserved survey package could not load.');
    bytes = await boundedResponseBytes(response, 200000);
  } finally {clearTimeout(deadline);}
  const actual = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
    .map(value => value.toString(16).padStart(2, '0')).join('');
  if (bytes.length !== expectedBytes || actual !== hash) throw Error('Survey file differs from the reviewed edition.');
  const data = JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(bytes));
  if (data.kind !== 'atlas-static-damage-survey' || data.event_id !== 'tuscaloosa-birmingham-2011' ||
      data.points?.length !== 198 || data.polygons?.length !== 8) throw Error('Unexpected survey package.');
  return data;
}

let leafletLoading;
function loadLeaflet() {
  if (window.L) return Promise.resolve();
  if (!leafletLoading) leafletLoading = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'vendor/leaflet/leaflet.js';
    const fail = () => {clearTimeout(deadline);script.remove();leafletLoading = null;reject(Error('Local map controls could not load.'));};
    const deadline = setTimeout(fail, 10000);
    script.onload = () => {clearTimeout(deadline);if(window.L)resolve();else fail();};
    script.onerror = fail;
    document.head.append(script);
  });
  return leafletLoading;
}

export async function mountTuscaloosaDamageMap(section, {onSelect, onGroup, onStatus}) {
  const data = await loadTuscaloosaSurvey(section);
  await loadLeaflet();
  const host = document.getElementById('damage-interactive-map');
  host.hidden = false;
  const map = mountExplorerMap(host, {onSelect, onGroup, onStatus, onView() {}, onCount() {}});
  map.interactive(false);
  const records = data.points.map(point => ({id: point.id, point: point.coordinates,
    title: `Account ${point.fid + 1}: ${point.source_feature.attributes.dod_txt}`,
    mapLabel: `Survey account ${point.fid + 1}, ${point.source_feature.attributes.efscale}. No impact time assigned.`,
    rating: point.source_feature.attributes.efscale, date: ''}));
  map.setFootprint({type: 'FeatureCollection', features: data.polygons.map(area => ({
    type: 'Feature', properties: {id: area.id, role: area.role},
    geometry: {type: 'Polygon', coordinates: area.coordinates}}))});
  map.fitFootprint();map.setRecords(records);
  const controls = document.getElementById('damage-map-controls');controls.hidden = false;
  document.getElementById('damage-fit').addEventListener('click', () => map.fitFootprint());
  document.getElementById('damage-zoom-out').addEventListener('click', () => map.zoom(-1));
  document.getElementById('damage-zoom-in').addEventListener('click', () => map.zoom(1));
  const drag = document.getElementById('damage-drag');let dragging = false;
  drag.addEventListener('click', () => {
    dragging = !dragging;map.interactive(dragging);
    drag.textContent = dragging ? 'Disable map dragging' : 'Enable map dragging';
    drag.setAttribute('aria-pressed', String(dragging));
  });
  onStatus('NWS estimated footprint and individual survey accounts. Local geography is reference context; no impact clock or wind field.');
  return {data, records, map};
}

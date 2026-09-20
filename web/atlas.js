import {filterRecords, project, fitBounds, clampBounds, color} from './atlas-model.mjs';

const el = id => document.getElementById(id);
const make = (tag, text, className) => {
  const item = document.createElement(tag);
  if (text !== undefined) item.textContent = text;
  if (className) item.className = className;
  return item;
};
function anchor(text, href, className) {
  const item = make('a', text, className);
  const target = new URL(href, location.href);
  if (!['https:', 'http:'].includes(target.protocol)) throw new Error('Unsupported source link');
  item.href = target.href;
  if (target.origin !== location.origin) {item.target = '_blank'; item.rel = 'noopener noreferrer';}
  return item;
}
function svg(tag, attributes, text) {
  const item = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [key,value] of Object.entries(attributes)) item.setAttribute(key,value);
  if (text) item.textContent = text;
  return item;
}
function option(select, value, text = value) {
  const item = make('option', text);
  item.value = value;
  select.append(item);
}
async function getJSON(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Could not load ${path}. Refresh or rebuild the catalogue.`);
  return response.json();
}

async function main() {
  const [catalogue, land] = await Promise.all([getJSON('catalogue/index.json'),getJSON('land.json')]);
  const records = catalogue.records;
  const byId = new Map(records.map(record => [record.id,record]));
  const detailCache = new Map();
  const pageSize = 20;
  let matches = [], page = 0, selected = null, request = 0;
  let bounds = [0,0,1080,540];
  const map = el('world-map');
  const years = Object.keys(catalogue.coverage.by_year).sort();
  el('coverage').textContent = `${records.length.toLocaleString()} source records · US pilot years ${years.join(', ')} · Partial coverage, including tornado segments. Other places and years have not been imported.`;
  years.forEach(year => option(el('year'),year));
  [...new Set(records.map(record => record.state).filter(Boolean))].sort().forEach(state => option(el('state'),state));
  [...new Set(records.map(record => record.rating).filter(rating => /^(EF|F)[0-5]$/.test(rating || '')))]
    .sort((a,b) => a.startsWith('EF') - b.startsWith('EF') || a.localeCompare(b))
    .forEach(rating => option(el('rating'),rating));
  option(el('rating'),'unrated','Unrated / other');

  for (const feature of land.features) {
    const polygons = feature.geometry.type === 'Polygon' ? [feature.geometry.coordinates] : feature.geometry.coordinates;
    const d = polygons.map(polygon => polygon.map(ring => ring.map((coordinate,index) =>
      `${index ? 'L':'M'}${project(coordinate).join(',')}`).join(' ')+'Z').join(' ')).join(' ');
    const shape = svg('path',{d,class:'land','fill-rule':'evenodd'});
    shape.append(svg('title',{},feature.properties.name));
    el('land').append(shape);
  }

  function setBounds(next) {
    if (!next) return;
    bounds = clampBounds(next);
    map.setAttribute('viewBox',bounds.join(' '));
    const radius = bounds[2] / 360;
    for (const marker of el('markers').children) marker.setAttribute('r',radius);
    renderSelection();
  }
  function renderSelection() {
    el('selection').replaceChildren();
    const point = selected ? project(selected.point) : null;
    if (point) el('selection').append(svg('circle',{cx:point[0],cy:point[1],r:bounds[2]/110,class:'selected-marker'}));
  }
  function renderMap() {
    const fragment = document.createDocumentFragment();
    let located = 0;
    for (const record of matches) {
      const point = project(record.point);
      if (!point) continue;
      located++;
      const marker = svg('circle',{cx:point[0],cy:point[1],r:bounds[2]/360,fill:color(record.rating),class:'record-marker','data-record':record.id});
      marker.append(svg('title',{},`${record.title} · ${record.date || 'Date unknown'} · ${record.rating || 'Unrated'} · ${record.point_basis}`));
      fragment.append(marker);
    }
    el('markers').replaceChildren(fragment);
    el('map-count').textContent = `${located.toLocaleString()} mapped · ${(matches.length-located).toLocaleString()} unlocated`;
    renderSelection();
  }
  function renderResults() {
    const fragment = document.createDocumentFragment();
    for (const record of matches.slice(page*pageSize,(page+1)*pageSize)) {
      const button = make('button',undefined,'result-button');
      button.type = 'button';
      button.dataset.record = record.id;
      button.setAttribute('aria-pressed',String(selected?.id === record.id));
      const rating = make('span',record.rating || 'Unrated','result-rating');
      rating.style.color = color(record.rating);
      button.append(rating, make('strong',record.title));
      if (record.aliases.length) button.append(make('small',record.aliases[0]));
      button.append(make('small',`${record.date || 'Date unknown'} · ${record.id}`));
      if (record.exhibit) button.append(make('small','Exhibit available','exhibit-mark'));
      fragment.append(button);
    }
    if (!matches.length) fragment.append(make('p','No records match these filters. Try another place or an imported year.','empty-state'));
    el('results').replaceChildren(fragment);
    const pages = Math.max(1,Math.ceil(matches.length/pageSize));
    el('results-count').textContent = `${matches.length.toLocaleString()} ${matches.length === 1 ? 'match' : 'matches'}`;
    el('page-count').textContent = matches.length ? `Page ${page+1} of ${pages}` : 'No results';
    el('prev-page').disabled = page === 0;
    el('next-page').disabled = page >= pages-1;
  }
  function clearDetail() {
    selected = null;
    request++;
    el('detail').replaceChildren(make('h2','Select a record'),make('p','Choose a marker or a result to inspect its source.'));
    history.replaceState(null,'',location.pathname+location.search);
  }
  function applyFilters() {
    matches = filterRecords(records,{
      query:el('query').value,year:el('year').value,rating:el('rating').value,
      state:el('state').value,exhibits:el('exhibits').checked,
    });
    page = 0;
    if (selected && !matches.some(record => record.id === selected.id)) clearDetail();
    renderMap();
    renderResults();
    el('fit').disabled = !matches.some(record => project(record.point));
  }
  function datum(list, label, value) {
    list.append(make('dt',label),make('dd',value === null || value === undefined ? 'Not reported' : String(value)));
  }
  async function selectRecord(record, {writeHash = true} = {}) {
    selected = record;
    const token = ++request;
    if (writeHash) history.replaceState(null,'',`#record=${encodeURIComponent(record.id)}`);
    renderSelection();
    renderResults();
    el('detail').replaceChildren(make('span',record.id,'eyebrow'),make('h2',record.title),make('p','Loading source account…'));
    try {
      if (!detailCache.has(record.detail_file)) {
        const pending = getJSON(`catalogue/${record.detail_file}`).catch(error => {detailCache.delete(record.detail_file);throw error;});
        detailCache.set(record.detail_file,pending);
      }
      const file = await detailCache.get(record.detail_file);
      if (token !== request) return;
      const detail = file[record.id];
      if (!detail || detail.id !== record.id) throw new Error('The source record is missing from its detail file. Rebuild the catalogue.');
      const panel = el('detail');
      panel.replaceChildren(make('span',record.id,'eyebrow'),make('h2',record.title));
      if (record.aliases.length) panel.append(make('p',record.aliases.join(' · '),'alias'));
      panel.append(make('p','NOAA source record. It may describe one segment of a longer tornado.'));
      if (record.exhibit) panel.append(anchor('Enter the El Reno exhibit ↗',record.exhibit,'exhibit-link'));
      const actions = make('div',undefined,'detail-actions');
      const focus = make('button','Center on map');
      focus.type = 'button';
      focus.disabled = !project(record.point);
      focus.addEventListener('click',() => setBounds(fitBounds([record])));
      actions.append(focus);
      panel.append(actions);
      const fields = make('dl');
      datum(fields,'Reported rating',record.rating || 'Unrated');
      datum(fields,'Reported local time',`${record.local_time || 'Unknown'} ${record.zone || ''}`.trim());
      datum(fields,'Time convention','Source standard-time label retained; daylight saving is not silently applied.');
      datum(fields,'County / area',record.area);
      datum(fields,'Map position',record.point ? `${record.point[1]}, ${record.point[0]} (${record.point_basis.replaceAll('_',' ')})` : null);
      datum(fields,'Reported length, miles (tornado or segment)',detail.dimensions.reported_length_miles);
      datum(fields,'Reported width, yards (not funnel width)',detail.dimensions.reported_width_yards);
      datum(fields,'Source revision',detail.provenance.snapshot_id);
      panel.append(fields,anchor('Open the published NOAA source file ↗',detail.provenance.source_url,'source-link'));
      const narrative = make('details');
      narrative.append(make('summary','Read the source narrative'));
      narrative.append(make('p',detail.narrative || 'No event narrative was supplied.','source-narrative'));
      panel.append(narrative);
      if (detail.curation) {
        const notes = make('details');
        notes.append(make('summary','Why this storm name is searchable'),make('p',detail.curation.basis));
        panel.append(notes);
      }
      const quality = make('details');
      quality.append(make('summary','Provenance and data notes'));
      quality.append(make('p',`Logical CSV record ${detail.provenance.csv_record}. Retrieved ${detail.provenance.retrieved_at}.`));
      const list = make('ul',undefined,'quality-list');
      for (const note of detail.quality_notes) list.append(make('li',note.replaceAll('_',' ')));
      if (!detail.quality_notes.length) list.append(make('li','No parser quality flags. This does not establish complete historical accuracy.'));
      quality.append(list);
      panel.append(quality);
    } catch (error) {
      if (token !== request) return;
      const retry = make('button','Retry this record');
      retry.addEventListener('click',() => selectRecord(record));
      el('detail').append(make('p',error.message),retry);
    }
  }

  for (const id of ['query','year','rating','state','exhibits']) el(id).addEventListener(id === 'query' ? 'input':'change',applyFilters);
  el('filters').addEventListener('submit',event => event.preventDefault());
  function resetFilters() {
    for (const id of ['query','year','rating','state']) el(id).value = '';
    el('exhibits').checked = false;
    clearDetail();
    applyFilters();
    setBounds(fitBounds(matches));
  }
  // The native reset event fires before controls reset. Set values explicitly so
  // results never depend on a microtask racing the browser's default action.
  el('filters').addEventListener('reset',event => {event.preventDefault();resetFilters();});
  el('prev-page').addEventListener('click',() => {page--;renderResults();});
  el('next-page').addEventListener('click',() => {page++;renderResults();});
  for (const id of ['results','markers']) el(id).addEventListener('click',event => {
    const target = event.target.closest('[data-record]');
    if (target) selectRecord(byId.get(target.dataset.record));
  });
  el('fit').addEventListener('click',() => setBounds(fitBounds(matches)));
  el('world').addEventListener('click',() => setBounds([0,0,1080,540]));
  for (const [id,factor] of [['zoom-in',.7],['zoom-out',1/.7]]) el(id).addEventListener('click',() => {
    const [x,y,w,h] = bounds;
    setBounds([x+w*(1-factor)/2,y+h*(1-factor)/2,w*factor,h*factor]);
  });
  map.addEventListener('keydown',event => {
    const directions = {ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};
    const direction = directions[event.key];
    if (!direction) return;
    event.preventDefault();
    setBounds([bounds[0]+direction[0]*bounds[2]*.15,bounds[1]+direction[1]*bounds[3]*.15,bounds[2],bounds[3]]);
  });
  let drag = null;
  map.addEventListener('pointerdown',event => {
    if (event.target.closest('[data-record]')) return;
    drag = {x:event.clientX,y:event.clientY,bounds:[...bounds]};
    map.setPointerCapture(event.pointerId);
  });
  map.addEventListener('pointermove',event => {
    if (!drag) return;
    const scale = drag.bounds[2]/map.getBoundingClientRect().width;
    setBounds([drag.bounds[0]-(event.clientX-drag.x)*scale,drag.bounds[1]-(event.clientY-drag.y)*scale,drag.bounds[2],drag.bounds[3]]);
  });
  for (const type of ['pointerup','pointercancel','lostpointercapture']) map.addEventListener(type,() => {drag=null;});
  const initialId = new URLSearchParams(location.hash.slice(1)).get('record');
  applyFilters();
  setBounds(fitBounds(matches));
  if (initialId && byId.has(initialId)) selectRecord(byId.get(initialId),{writeHash:false});
  window.addEventListener('hashchange',() => {
    const id = new URLSearchParams(location.hash.slice(1)).get('record');
    if (id && byId.has(id)) {
      resetFilters();
      selectRecord(byId.get(id));
    }
  });
}
main().catch(error => {el('error').hidden=false;el('error').textContent=error.message;el('coverage').textContent='Catalogue unavailable. The El Reno exhibit remains accessible from the navigation.';});

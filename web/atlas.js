import {filterRecords, project, fitBounds, clampBounds, color, mapGroups, yearCoverage, readSearchLink, writeSearchLink} from './atlas-model.mjs';

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
  async function getCatalogue() {
    if (typeof DecompressionStream!=='undefined') {
      try {
        const response=await fetch('catalogue/index.json.gz');
        if (response.ok) return await new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).json();
      } catch { /* Older hosts and damaged compressed copies fall back to the readable index. */ }
    }
    return getJSON('catalogue/index.json');
  }
  const [catalogue, land] = await Promise.all([getCatalogue(),getJSON('land.json')]);
  const records = catalogue.records;
  const byId = new Map(records.map(record => [record.id,record]));
  const detailCache = new Map();
  const pageSize = 20;
  let matches = [], page = 0, selected = null, request = 0;
  let groups = new Map(), groupSelection = null, filterTimer;
  let bounds = [0,0,1080,540];
  const map = el('world-map');
  const years = Object.keys(catalogue.coverage.by_year).sort();
  el('coverage').textContent = `${records.length.toLocaleString()} NOAA source records · United States ${yearCoverage(years)} · Includes tornado segments, not deduplicated storms. International records have not been imported.`;
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
    renderMap();
  }
  function renderSelection() {
    el('selection').replaceChildren();
    const point = selected ? project(selected.point) : null;
    if (point) el('selection').append(svg('circle',{cx:point[0],cy:point[1],r:bounds[2]/110,class:'selected-marker'}));
  }
  function renderMap() {
    const fragment = document.createDocumentFragment();
    const summary=mapGroups(matches,bounds);
    groups=new Map(summary.groups.map(group=>[group.key,group]));
    for (const group of summary.groups) {
      const count=group.records.length,point=group.point;
      if (count===1) {
        const record=group.records[0];
        const marker=svg('circle',{cx:point[0],cy:point[1],r:bounds[2]/320,fill:color(record.rating),class:'record-marker','data-record':record.id});
        marker.append(svg('title',{},`${record.title} · ${record.date || 'Date unknown'} · ${record.rating || 'Unrated'} · ${record.point_basis}`));
        fragment.append(marker);
      } else {
        const cluster=svg('g',{'data-group':group.key,class:'record-cluster'});
        cluster.append(svg('circle',{cx:point[0],cy:point[1],r:bounds[2]/145}));
        cluster.append(svg('text',{x:point[0],y:point[1],'font-size':bounds[2]/135},count>999?'1k+':String(count)));
        cluster.append(svg('title',{},`${count.toLocaleString()} source records. Select to inspect this group.`));
        fragment.append(cluster);
      }
    }
    el('markers').replaceChildren(fragment);
    el('map-count').textContent = `${summary.visible.toLocaleString()} in view · ${summary.unlocated.toLocaleString()} unlocated`;
    el('clear-group').hidden=!groupSelection;
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
    el('results-count').textContent = `${matches.length.toLocaleString()} ${matches.length === 1 ? 'match' : 'matches'}${groupSelection ? ' in selected group' : ''}`;
    el('page-count').textContent = matches.length ? `Page ${page+1} of ${pages}` : 'No results';
    el('prev-page').disabled = page === 0;
    el('next-page').disabled = page >= pages-1;
  }
  function clearDetail() {
    selected = null;
    request++;
    el('detail').replaceChildren(make('h2','Select a record'),make('p','Choose a marker or a result to inspect its source.'));
  }
  function currentFilters() {
    return {
      query:el('query').value,year:el('year').value,rating:el('rating').value,
      state:el('state').value,exhibits:el('exhibits').checked,
    };
  }
  function syncSearchLink({writeHistory=true,push=false}={}) {
    const href = location.pathname + writeSearchLink(currentFilters(), selected?.id);
    el('search-link').href = href;
    el('search-link').textContent = groupSelection ? 'Link to full filtered search' : 'Link to this search';
    el('search-link-note').textContent = groupSelection
      ? 'Includes filters and the selected record. This temporary map group is not included.'
      : 'Includes filters and the selected record.';
    if (writeHistory && href !== location.pathname+location.search+location.hash) {
      history[push ? 'pushState' : 'replaceState'](null,'',href);
    }
  }
  function applyFilters({keepGroup=false,writeHistory=true}={}) {
    if (!keepGroup) groupSelection=null;
    matches = filterRecords(records,currentFilters());
    if (groupSelection) matches=matches.filter(record=>groupSelection.has(record.id));
    page = 0;
    if (selected && !matches.some(record => record.id === selected.id)) clearDetail();
    renderMap();
    renderResults();
    el('fit').disabled = !matches.some(record => project(record.point));
    syncSearchLink({writeHistory});
  }
  function datum(list, label, value) {
    list.append(make('dt',label),make('dd',value === null || value === undefined ? 'Not reported' : String(value)));
  }
  async function selectRecord(record, {writeHistory = true} = {}) {
    selected = record;
    const token = ++request;
    syncSearchLink({writeHistory,push:true});
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
      if (!matches.some(match => match.id === record.id)) {
        panel.append(make('p','This linked record is outside the current filters. Reset filters to include it.'));
      }
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
      datum(fields,'Direct deaths reported in this record',detail.impacts.deaths_direct);
      datum(fields,'Direct injuries reported in this record',detail.impacts.injuries_direct);
      datum(fields,'Property damage (source amount; not inflation adjusted)',detail.impacts.property_damage.reported);
      datum(fields,'Source revision',detail.provenance.snapshot_id);
      panel.append(fields,anchor('Open the published NOAA source file ↗',detail.provenance.source_url,'source-link'));
      const narrative = make('details');
      narrative.append(make('summary','Read the source narrative'));
      narrative.append(make('p',detail.narrative || 'No event narrative was supplied.','source-narrative'));
      panel.append(narrative);
      if (detail.curation) {
        const notes = make('details');
        notes.append(make('summary','Why this storm name is searchable'),make('p',detail.curation.basis));
        for (const source of detail.curation.sources || []) notes.append(anchor('Read the supporting account ↗',source,'source-link'));
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

  for (const id of ['query','year','rating','state','exhibits']) el(id).addEventListener(id === 'query' ? 'input':'change',() => {
    clearTimeout(filterTimer);
    if (id==='query') filterTimer=setTimeout(applyFilters,150);
    else applyFilters();
  });
  el('filters').addEventListener('submit',event => event.preventDefault());
  function resetFilters() {
    clearTimeout(filterTimer);
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
    const cluster=event.target.closest('[data-group]');
    if (cluster && groups.has(cluster.dataset.group)) {
      const group=groups.get(cluster.dataset.group);
      groupSelection=new Set(group.records.map(record=>record.id));
      applyFilters({keepGroup:true});
      setBounds(fitBounds(matches));
    }
  });
  el('clear-group').addEventListener('click',() => {applyFilters();setBounds(fitBounds(matches));});
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
    if (event.target.closest('[data-record], [data-group]')) return;
    drag = {x:event.clientX,y:event.clientY,bounds:[...bounds]};
    map.setPointerCapture(event.pointerId);
  });
  map.addEventListener('pointermove',event => {
    if (!drag) return;
    const scale = drag.bounds[2]/map.getBoundingClientRect().width;
    setBounds([drag.bounds[0]-(event.clientX-drag.x)*scale,drag.bounds[1]-(event.clientY-drag.y)*scale,drag.bounds[2],drag.bounds[3]]);
  });
  for (const type of ['pointerup','pointercancel','lostpointercapture']) map.addEventListener(type,() => {drag=null;});
  function restoreLocation() {
    clearTimeout(filterTimer);
    const {filters,recordId} = readSearchLink(location.search,location.hash);
    el('query').value = filters.query;
    for (const id of ['year','rating','state']) {
      const select = el(id);
      select.querySelectorAll('[data-unavailable]').forEach(item => item.remove());
      // A stale or mistyped link must not broaden silently to all records.
      if (filters[id] && ![...select.options].some(item => item.value === filters[id])) {
        option(select,filters[id],`Unavailable: ${filters[id]}`);
        select.lastElementChild.dataset.unavailable = 'true';
      }
      select.value = filters[id];
    }
    el('exhibits').checked = filters.exhibits;
    clearDetail();
    applyFilters({writeHistory:false});
    setBounds(fitBounds(matches) || [0,0,1080,540]);
    if (recordId && byId.has(recordId)) {
      const index = matches.findIndex(record => record.id === recordId);
      if (index >= 0) page = Math.floor(index/pageSize);
      selectRecord(byId.get(recordId),{writeHistory:false});
    } else if (recordId) {
      el('detail').replaceChildren(make('h2','Record unavailable'),make('p','That source ID is not in the current catalogue. The search filters still apply.'));
    }
  }
  restoreLocation();
  window.addEventListener('popstate',restoreLocation);
  window.addEventListener('hashchange',() => {
    if (!location.hash || location.hash.startsWith('#record=')) restoreLocation();
  });
}
main().catch(error => {el('error').hidden=false;el('error').textContent=error.message;el('coverage').textContent='Catalogue unavailable. The El Reno exhibit remains accessible from the navigation.';});

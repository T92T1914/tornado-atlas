'use strict';
const byId = (id) => document.getElementById(id);
const node = (tag, text, className) => {
  const element = document.createElement(tag);
  if (text) element.textContent = text;
  if (className) element.className = className;
  return element;
};
function link(text, href) {
  const element = node('a', text);
  element.href = href;
  element.target = '_blank';
  element.rel = 'noopener noreferrer';
  return element;
}
function svgNode(tag, attributes, text) {
  const element = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
  if (text) element.textContent = text;
  return element;
}
async function main() {
  const response = await fetch('data.json');
  if (!response.ok) throw new Error('Exhibit data could not be loaded. Run the exhibit build first.');
  const data = await response.json();
  const exhibit = data.exhibit;
  byId('place').textContent = exhibit.location;
  byId('introduction').textContent = exhibit.introduction;
  byId('map-note').textContent = exhibit.map_note;
  byId('time-note').textContent = exhibit.time_note;
  byId('coverage').textContent = exhibit.coverage.video_review;
  byId('remaining').textContent = exhibit.coverage.remaining;
  for (const fact of exhibit.facts) {
    const card = node('div', null, 'fact');
    card.append(node('strong', fact.value), link(fact.label + ' ↗', fact.source));
    byId('facts').append(card);
  }
  for (const entry of exhibit.discrepancies) {
    const card = node('article', null, 'note');
    card.append(node('h3', entry.title), node('p', entry.text));
    entry.sources.forEach((url, index) => card.append(link(`Source ${index + 1} ↗`, url)));
    byId('notes').append(card);
  }
  const creators = new Map(data.creators.map(c => [c.id, c]));
  const notebook = data.notebook;
  byId('footage-title').textContent = notebook.title;
  byId('footage-introduction').textContent = notebook.introduction;
  byId('footage-timing').textContent = notebook.timing_note;
  byId('method-source').append(node('span', notebook.method_source.note + ' '),
    link('Research precedent ↗', notebook.method_source.url));
  for (const observation of notebook.observations) {
    const card = node('article', null, 'observation');
    const minute = Math.floor(observation.start_seconds / 60);
    const second = Math.floor(observation.start_seconds % 60).toString().padStart(2,'0');
    const sourceVideo = data.review_queue.find(video => video.id === observation.video);
    card.append(node('span', observation.kind === 'visual_sample' ? 'Inspected still sample' : 'Creator annotation', 'eyebrow'));
    card.append(node('h4', observation.title), node('p', observation.note));
    card.append(link(`${creators.get(sourceVideo.creator).name} · ${minute}:${second} ↗`,
      `https://www.youtube.com/watch?v=${observation.video}&t=${Math.floor(observation.start_seconds)}s`));
    const details = node('details');
    details.append(node('summary', 'What is still unresolved'),
      node('p', 'Historical time and camera location are not registered. ' + observation.next));
    card.append(details);
    byId('observations').append(card);
  }
  for (const creator of data.creators) {
    const anchor = link(creator.name + ' ↗', creator.url);
    anchor.className = 'creator';
    byId('creators').append(anchor);
  }
  function showVideos() {
    const query = byId('search').value.trim().toLowerCase();
    const filtered = data.review_queue.filter(v =>
      [v.event, v.title, creators.get(v.creator).name].join(' ').toLowerCase().includes(query));
    byId('videos').replaceChildren();
    for (const video of filtered) {
      const card = node('article', null, 'video');
      card.append(node('div', `${video.event} / ${creators.get(video.creator).name}`, 'eyebrow'));
      const title = node('h3');
      title.append(link(video.title + ' ↗', 'https://www.youtube.com/watch?v=' + video.id));
      card.append(title, node('p', video.coverage), node('span', video.status.replaceAll('_', ' '), 'review'));
      byId('videos').append(card);
    }
    byId('count').textContent = `${filtered.length} of ${data.review_queue.length} research leads`;
    if (!filtered.length) byId('videos').append(node('p', 'No research leads match this search.'));
  }
  byId('search').addEventListener('input', showVideos);
  showVideos();
  drawMap(data.geometry);
}
function drawMap(geojson) {
  const svg = byId('map');
  const features = geojson.features;
  const positions = features.filter(f => f.geometry.type === 'Point');
  const all = features.flatMap(f => f.geometry.type === 'Polygon' ? f.geometry.coordinates.flat()
    : f.geometry.type === 'LineString' ? f.geometry.coordinates : [f.geometry.coordinates]);
  const lonCenter = all.reduce((a, p) => a + p[0], 0) / all.length;
  const latCenter = all.reduce((a, p) => a + p[1], 0) / all.length;
  // Local equirectangular approximation in km. This is a map, not a wind model.
  const km = p => [(p[0] - lonCenter) * 111.195 * Math.cos(latCenter * Math.PI / 180), (p[1] - latCenter) * 111.195];
  const xy = all.map(km);
  const minX = Math.min(...xy.map(p => p[0])), maxX = Math.max(...xy.map(p => p[0]));
  const minY = Math.min(...xy.map(p => p[1])), maxY = Math.max(...xy.map(p => p[1]));
  const scale = Math.min(820 / (maxX - minX), 310 / (maxY - minY));
  const project = p => { const [x,y] = km(p); return [480 + (x - (minX + maxX) / 2) * scale, 215 - (y - (minY + maxY) / 2) * scale]; };
  const path = points => points.map((p,i) => (i ? 'L' : 'M') + project(p).join(',')).join(' ');
  for (let lon = Math.ceil(Math.min(...all.map(p => p[0])) * 20) / 20; lon < Math.max(...all.map(p => p[0])); lon += .05) {
    const x = project([lon, latCenter])[0];
    svg.append(svgNode('line', {x1:x,y1:35,x2:x,y2:395,class:'grid-line'}));
    svg.append(svgNode('text', {x:x+5,y:405,class:'axis-label'}, `${Math.abs(lon).toFixed(2)}°W`));
  }
  for (let lat = Math.ceil(Math.min(...all.map(p => p[1])) * 50) / 50; lat < Math.max(...all.map(p => p[1])); lat += .02) {
    const y = project([lonCenter,lat])[1];
    svg.append(svgNode('line', {x1:35,y1:y,x2:925,y2:y,class:'grid-line'}));
    svg.append(svgNode('text', {x:38,y:y-6,class:'axis-label'}, `${lat.toFixed(2)}°N`));
  }
  for (const feature of features) {
    const geometry = feature.geometry;
    if (geometry.type === 'Polygon') svg.append(svgNode('path', {d:geometry.coordinates.map(r => path(r)+' Z').join(' '),class:'map-outline','fill-rule':'evenodd'}));
    if (geometry.type === 'LineString') svg.append(svgNode('path', {d:path(geometry.coordinates),class:'map-path'}));
  }
  for (const position of positions) {
    const [x,y] = project(position.geometry.coordinates);
    const dot = svgNode('circle', {cx:x,cy:y,r:2.6,class:'map-position'});
    dot.append(svgNode('title', {}, position.properties.display_time));
    svg.append(dot);
  }
  const halo = svgNode('circle', {r:13,class:'selected-halo'});
  const core = svgNode('circle', {r:5,class:'selected-core'});
  svg.append(halo,core);
  svg.append(svgNode('text', {x:909,y:45,class:'axis-label'}, 'N ↑'));
  const bar = 2 * scale;
  svg.append(svgNode('path', {d:`M 50 355 v 5 h ${bar} v -5`,fill:'none',stroke:'#b3bbae','stroke-width':1.5}));
  svg.append(svgNode('text', {x:50,y:380,class:'axis-label'}, '≈ 2 km'));
  let index = 0, timer = null;
  const slider = byId('timeline');
  slider.max = positions.length - 1;
  slider.disabled = false;
  byId('play').disabled = false;
  function stop() { if (timer !== null) clearInterval(timer); timer = null; byId('play').textContent = 'Play timeline'; }
  function update() {
    const selected = positions[index], [x,y] = project(selected.geometry.coordinates);
    for (const element of [halo,core]) {element.setAttribute('cx',x);element.setAttribute('cy',y);}
    byId('clock').textContent = selected.properties.display_time;
    slider.value = index;
    slider.setAttribute('aria-valuetext', selected.properties.display_time);
    byId('previous').disabled = index === 0;
    byId('next').disabled = index === positions.length - 1;
    byId('map-description').textContent = `NWS whole-event outline and center path. Selected center position: ${selected.properties.display_time}. The marker has no physical size.`;
  }
  slider.addEventListener('input', () => {stop();index = Number(slider.value);update();});
  byId('previous').addEventListener('click', () => {stop();index = Math.max(0,index-1);update();});
  byId('next').addEventListener('click', () => {stop();index = Math.min(positions.length-1,index+1);update();});
  byId('play').addEventListener('click', () => {
    if (timer !== null) {stop();return;}
    if (index === positions.length-1) {index=0;update();}
    byId('play').textContent = 'Pause timeline';
    timer = setInterval(() => {index++;update();if(index === positions.length-1) stop();}, 650);
  });
  document.addEventListener('visibilitychange', () => {if(document.hidden) stop();});
  update();
}
main().catch(error => {byId('error').hidden=false;byId('error').textContent=error.message;});

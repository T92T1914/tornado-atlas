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
  if (!response.ok) throw new Error('Interactive exploration is unavailable. The historical account, photographs and sources remain readable below. Reload to try the interactive tools again.');
  const data = await response.json();
  const { mountPhotoViewer } = await import('./photo-view.mjs');
  const openPhoto = mountPhotoViewer();
  const exhibit = data.exhibit;
  const history = data.history;
  const { mountCommunity } = await import('./community-view.mjs');
  mountCommunity(data.community);
  const memorial = history.remembrance;
  // Reading is published from these same records. Enhance its original links
  // only after the viewer is available; otherwise ordinary navigation works.
  for (const anchor of document.querySelectorAll('[data-storm-photo]')) {
    const index = Number(anchor.dataset.stormPhoto);
    const photo = data.storm_photos[index];
    anchor.addEventListener('click', event => {
      event.preventDefault();
      openPhoto({title:`El Reno / storm photograph ${index + 1}`, asset:photo.file,
        alt:photo.alt, caption:photo.caption, location:photo.timing_note,
        credit:photo.credit + '. ' + photo.changes, source:photo.source,
        license:photo.license, licenseUrl:photo.license_url});
    });
    const image = anchor.querySelector('img');
    const failed = () => {
      anchor.replaceChildren(node('span', 'Photograph unavailable. Open the preserved original or use the credited source below.'));
    };
    image.addEventListener('error', failed, {once:true});
    if (image.complete && !image.naturalWidth) failed();
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
  const { mountNotebookPhotographs } = await import('./notebook-view.mjs');
  mountNotebookPhotographs(notebook, byId('observations'));
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
  const { mountTimelineMedia } = await import('./timeline-media.mjs');
  const updateMedia = mountTimelineMedia(data.timeline_media, data.storm_photos, openPhoto);
  const {mountComparison,mountResearchLog} = await import('./documentary-view.mjs');
  mountComparison(data.documentary.comparison);
  const { mountReader, mountReaderLayout } = await import('./reader-view.mjs');
  // Resolve the upstream responsive layout before playback becomes interactive.
  mountReaderLayout();
  const replay = await drawMap(data.geometry, history.chapters, updateMedia, data.cameras, memorial.places, data.documentary, data.timeline_media, data.footage, {points:data.survey.points,media:data.survey_media,openPhoto,lazy:true});
  const selectMinute = replay.selectMinute;
  const mapTimes = new Map(data.geometry.features.filter(f => f.geometry.type === 'Point')
    .map(f => [Number(f.properties.source_name.split(':')[1]), f.properties.display_time]));
  mountReader(data.reading, history.chapters.map(chapter => ({...chapter, map_time:mapTimes.get(chapter.minute)})), selectMinute);
  const { mountDamage } = await import('./damage-view.mjs');
  mountDamage(data.damage, openPhoto);
  const { mountSurvey } = await import('./survey-view.mjs');
  mountSurvey(data.survey, data.geometry, data.survey_media, openPhoto, memorial.places,
    {beforeHistoryChange:replay.prepareSurveyHistory});
  mountResearchLog(data.documentary);
  const {mountReadingTools}=await import('./footage-view.mjs');
  mountReadingTools(data.footage);
  // A shared section link can arrive before the asynchronous exhibit is laid out.
  requestAnimationFrame(() => {
    let id;
    try { id = decodeURIComponent(location.hash.slice(1)); }
    catch { id = null; }
    if (id) document.getElementById(id)?.scrollIntoView({behavior:'instant',block:'start'});
    document.body.dataset.exhibitReady = 'true';
    byId('enhancement-status').hidden = true;
  });
}
async function drawMap(geojson, chapters, updateMedia, cameras, places, documentary, media, footage, photoContext) {
  // Resolve dependencies before exposing controls or focusable map positions.
  // The remaining setup is synchronous, so a slow module cannot leave a
  // usable-looking control whose handler still depends on uninitialized state.
  const [{PlaybackClock, preparePositions, positionAt}, {localStamp}, {mountCamera},
    {mountPlaces}, {mountMapNavigation}, {mountGeography}, {mountDocumentary},
    {mountFootage}, {replaySeconds,replayURL}] = await Promise.all([
    import('./playback-model.mjs'), import('./timeline-media-model.mjs'),
    import('./camera-view.mjs'), import('./places-view.mjs'),
    import('./map-navigation.mjs'), import('./geography-view.mjs'),
    import('./documentary-view.mjs'), import('./footage-view.mjs'),
    import('./reconstruction-model.mjs'),
  ]);
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
    const dot = svgNode('circle', {cx:x,cy:y,r:2.5,class:'map-position',tabindex:0,role:'button','aria-label':'Go to '+position.properties.display_time});
    dot.append(svgNode('title', {}, position.properties.display_time));
    const jump=()=>seek((Date.parse(position.properties.utc)-start)/1000);
    dot.addEventListener('click',jump);
    dot.addEventListener('keydown',event=>{if(['Enter',' '].includes(event.key)){event.preventDefault();jump();}});
    svg.append(dot);
    const option=node('option',position.properties.display_time);option.value=(Date.parse(position.properties.utc)-Date.parse(positions[0].properties.utc))/1000;byId('published-position').append(option);
  }
  const halo = svgNode('circle', {r:8,class:'selected-halo'});
  const core = svgNode('circle', {r:3.5,class:'selected-core'});
  svg.append(halo,core);
  svg.append(svgNode('text', {x:909,y:45,class:'axis-label'}, 'N ↑'));
  const bar = 2 * scale;
  svg.append(svgNode('path', {d:`M 50 355 v 5 h ${bar} v -5`,fill:'none',stroke:'#b3bbae','stroke-width':1.5}));
  svg.append(svgNode('text', {x:50,y:380,class:'axis-label'}, '≈ 2 km'));
  mountPlaces(places, svg, project, photoContext);
  const navigation=mountMapNavigation(svg,{extent:[0,0,960,430]});
  mountGeography(svg,project,byId('path-geography'));
  byId('path-zoom-in').addEventListener('click',()=>navigation.zoom(1/1.6));
  byId('path-zoom-out').addEventListener('click',()=>navigation.zoom(1.6));
  byId('path-fit').addEventListener('click',navigation.reset);
  const timed = preparePositions(positions), start = timed[0].stamp, end = timed.at(-1).stamp;
  const clock = new PlaybackClock((end-start)/1000);
  clock.seek(replaySeconds(location.search,clock.duration,footage.anchors,start));
  let animation = null, lastChapter = null, lastText = null;
  const slider = byId('timeline');
  slider.max = clock.duration;
  byId('media-time').max = clock.duration;
  function syncLocation(mode='replace',fragment=null) {
    const original=new URL(location.href),url=replayURL(original.href,footage.event,clock.seconds,footage.anchors,start);
    if(!original.searchParams.has('event'))url.searchParams.delete('event');
    if(fragment)url.hash=fragment;
    if(url.href!==location.href) {
      history[mode==='push'?'pushState':'replaceState'](null,'',url);
      window.dispatchEvent(new Event('atlas:replay-url-change'));
    }
  }
  function stop(save=true) {
    clock.pause(performance.now());
    if (animation !== null) cancelAnimationFrame(animation);
    animation = null; byId('play').textContent = 'Play timeline';
    if(save)syncLocation();
  }
  function seek(seconds,{mode='push',fragment=null}={}) {stop(mode!==null); clock.seek(seconds); update(); if(mode)syncLocation(mode,fragment);}
  byId('published-position').addEventListener('change',event=>{if(event.target.value!=='')seek(Number(event.target.value));});
  const updateCamera = mountCamera(cameras, svg, project, start, end, seek);
  const updateDocumentary=mountDocumentary(documentary,media,cameras,svg,project,start,end,seek,footage);
  const updateFootage=mountFootage(footage,start,seconds=>seek(seconds,{mode:'replace'}),stop,{restoreInitialMoment:false,onMomentSelect:anchor=>seek((Date.parse(anchor.utc)-start)/1000,{fragment:'registered-footage'})});
  byId('footage-source').addEventListener('change',()=>{update();syncLocation();});
  window.addEventListener('popstate',()=>{seek(replaySeconds(location.search,clock.duration,footage.anchors,start),{mode:null});syncLocation();});
  function update() {
    const selected = positionAt(timed, clock.seconds), [x,y] = project(selected.coordinates);
    for (const element of [halo,core]) {element.setAttribute('cx',x);element.setAttribute('cy',y);}
    // Expiry checks run on every frame, including between displayed whole seconds.
    updateCamera(selected.utc);
    updateFootage(selected.utc);
    updateDocumentary(selected.utc,byId('footage-source').value);
    updateMedia({properties:{utc:selected.utc,display_time:localStamp(selected.utc)}},Math.floor(clock.seconds));
    // Keep the marker smooth, but do not rebuild captions or image nodes each frame.
    const textKey = `${Math.floor(clock.seconds)}:${selected.published}`;
    if (textKey === lastText) return;
    lastText = textKey;
    const time = localStamp(selected.utc);
    byId('clock').textContent = time;
    slider.value = Math.floor(clock.seconds);
    byId('published-position').value=selected.published?String((timed[selected.before].stamp-start)/1000):'';
    slider.setAttribute('aria-valuetext', time);
    byId('previous').disabled = clock.seconds === 0;
    byId('next').disabled = clock.seconds === clock.duration;
    const basis = selected.published ? 'Published NWS minute position' : `Interpolated between ${positions[selected.before].properties.source_name} and ${positions[selected.after].properties.source_name} PM CDT`;
    byId('position-basis').textContent = basis;
    byId('map-description').textContent = `NWS whole-event outline and center path. Selected time: ${time}. ${basis}. The marker has no physical size. Camera samples are separate recorded observations.`;
    const minute=Number(positions[selected.before].properties.source_name.split(':')[1]);
    const chapter=chapters.filter(c=>c.minute<=minute).at(-1) || chapters[0];
    if (lastChapter === chapter) return;
    lastChapter = chapter;
    byId('chapter-title').textContent=chapter.time+' · '+chapter.title;
    byId('chapter-account').replaceChildren(document.createTextNode(chapter.text+' '),link('NWS account ↗',chapter.source));
    for (const button of byId('path-chapters').querySelectorAll('button')) button.setAttribute('aria-pressed',String(Number(button.dataset.minute)===chapter.minute));
  }
  for (const chapter of chapters) {
    const button=node('button');button.type='button';button.dataset.minute=chapter.minute;
    button.append(node('span',chapter.time),node('strong',chapter.title));
    button.addEventListener('click',()=>selectMinute(chapter.minute));
    byId('path-chapters').append(button);
  }
  slider.addEventListener('input', () => seek(Number(slider.value),{mode:'replace'}));
  byId('media-time').addEventListener('input', () => seek(Number(byId('media-time').value),{mode:'replace'}));
  byId('previous').addEventListener('click', () => {
    const previous = timed.filter(p => (p.stamp-start)/1000 < clock.seconds).at(-1);
    seek(previous ? (previous.stamp-start)/1000 : 0);
  });
  byId('next').addEventListener('click', () => {
    const next = timed.find(p => (p.stamp-start)/1000 > clock.seconds);
    seek(next ? (next.stamp-start)/1000 : clock.duration);
  });
  function frame() {
    // Use the same monotonic clock as UI events, not the older frame timestamp.
    animation = null; clock.tick(performance.now()); update();
    if (clock.playing) animation = requestAnimationFrame(frame);
    else stop();
  }
  byId('play').addEventListener('click', () => {
    if (clock.playing) {stop(); update(); return;}
    clock.play(performance.now()); update();
    byId('play').textContent = 'Pause timeline';
    animation = requestAnimationFrame(frame);
  });
  byId('playback-rate').addEventListener('change', () => {
    clock.setRate(Number(byId('playback-rate').value),performance.now()); update();
  });
  document.addEventListener('visibilitychange', () => {if(document.hidden) {stop();update();}});
  byId('timeline-media-image').addEventListener('click',()=>{stop();update();});
  update();syncLocation();
  for (const id of ['play','timeline','published-position','playback-rate',
    'camera-sample','media-time','path-zoom-in','path-zoom-out','path-fit']) byId(id).disabled=false;
  function selectMinute(minute) {
    const selected = positions.findIndex(p => Number(p.properties.source_name.split(':')[1]) === minute);
    if (selected < 0) return;
    seek((timed[selected].stamp-start)/1000);
  }
  function prepareSurveyHistory() {
    stop(false);update();syncLocation();
  }
  return {selectMinute,prepareSurveyHistory};
}
main().catch(error => {document.body.dataset.exhibitReady='error';byId('error').hidden=false;byId('error').textContent=error.message;byId('enhancement-status').textContent='Interactive exploration could not finish loading. The historical account, photographs and source links remain available. Reload to try again.';});

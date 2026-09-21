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
  const { mountPhotoViewer } = await import('./photo-view.mjs');
  const openPhoto = mountPhotoViewer();
  const exhibit = data.exhibit;
  const history = data.history;
  const { mountCommunity } = await import('./community-view.mjs');
  mountCommunity(data.community);
  const sourceNames = new Map(data.reading.sources.map(source => [source.url, source.publisher]));
  byId('history-introduction').textContent = history.introduction;
  for (const entry of history.context) {
    const card = node('article', null, 'note');
    card.append(node('h3', entry.title),node('p',entry.text),link('Read the account ↗',entry.source));
    byId('historical-context').append(card);
  }
  const contents=node('nav',null,'report-contents');contents.setAttribute('aria-label','In this history');contents.append(node('strong','In this history'));
  for(const section of history.report){const entry=node('a',section.title);entry.href='#'+section.id;contents.append(entry);}
  byId('documentary-report').append(contents);
  for (const section of history.report) {
    const article = node('article'); article.id = section.id;
    const heading = node('h3'); const anchor = node('a', section.title); anchor.href = '#'+section.id;
    heading.append(anchor); article.append(heading);
    section.paragraphs.forEach(text => article.append(node('p', text)));
    const sources = node('div', null, 'report-links');
    section.sources.forEach(source => sources.append(link(source.label, source.url)));
    article.append(sources); byId('documentary-report').append(article);
  }
  function stormFigure(photo, index, hero = false) {
    const figure = node('figure');
    const image = node('img');
    image.src = photo.file; image.alt = photo.alt; image.loading = hero ? 'eager' : 'lazy';
    image.decoding = 'async';
    if (hero) image.fetchPriority = 'high';
    image.width=photo.width; image.height=photo.height;
    const full = node('button', null, 'storm-photo-button');
    full.append(image); full.setAttribute('aria-label',`Enlarge storm photograph ${index + 1}`);
    full.addEventListener('click', () => openPhoto({
      title:`El Reno / storm photograph ${index + 1}`, asset:photo.file, alt:photo.alt,
      caption:photo.caption, location:photo.timing_note, credit:photo.credit + '. ' + photo.changes,
      source:photo.source, license:photo.license, licenseUrl:photo.license_url
    }));
    image.addEventListener('error', () => {
      full.replaceChildren(node('span', 'Photograph unavailable. Use the source link below.'));
      full.disabled = true;
    }, {once:true});
    const caption=node('figcaption');
    caption.append(node('p', hero ? 'El Reno, photographed on May 31, 2013. Select to enlarge.' : photo.caption),
      link(photo.credit + ' ↗',photo.source), document.createTextNode(' · '),link(photo.license,photo.license_url));
    if (!hero) caption.append(node('p',photo.changes+' '+photo.timing_note,'fineprint'));
    figure.append(full,caption);
    return figure;
  }
  data.storm_photos.forEach((photo,index) => {
    byId('storm-photographs').append(stormFigure(photo,index));
  });
  if (data.storm_photos.length) byId('hero-photograph').append(stormFigure(data.storm_photos[0],0,true));
  for (const entry of data.visitor_guide) {
    const details = node('details');
    details.id = entry.id;
    details.append(node('summary',entry.question),node('p',entry.answer));
    const sources = node('p',null,'guide-sources');
    entry.sources.forEach(source => sources.append(link(source.label+' ↗',source.url)));
    details.append(sources);
    byId('visitor-questions').append(details);
  }
  const impacts=history.impacts, memorial=history.remembrance;
  for (const [label,value] of [['Direct fatalities',impacts.deaths_direct],['Direct injuries reported',impacts.injuries_direct]]) {
    const card=node('div',null,'fact');
    card.append(node('strong',String(value)),link(label+' ↗',impacts.source));byId('impact-counts').append(card);
  }
  byId('impact-scope').textContent=impacts.scope+' Source revision '+impacts.snapshot+'.';
  byId('impact-definitions').textContent=impacts.note;
  byId('impact-discrepancy').append(document.createTextNode(impacts.discrepancy+' '),link('Contemporary reporting ↗',impacts.discrepancy_source));
  byId('remembrance-title').textContent=memorial.title;
  byId('remembrance-introduction').textContent=memorial.introduction;
  byId('remembrance-scope').textContent=memorial.scope;
  byId('remembrance-source-note').textContent=memorial.source_note;
  for (const person of memorial.people) {
    const item=node('li');item.append(node('strong',person.name));
    if(person.note)item.append(node('p',person.note));
    const sources=node('div',null,'memorial-sources');
    person.sources.forEach(url=>sources.append(link(`${sourceNames.get(url) || 'Public source'} ↗`,url)));
    item.append(sources);byId('memorial-names').append(item);
  }
  byId('place').textContent = exhibit.location;
  byId('introduction').textContent = exhibit.introduction;
  byId('introduction').append(' ', link('NWS account ↗', exhibit.introduction_source));
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
    entry.sources.forEach(url => card.append(link(`${sourceNames.get(url) || 'Source'} ↗`, url)));
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
  const { mountTimelineMedia } = await import('./timeline-media.mjs');
  const updateMedia = mountTimelineMedia(data.timeline_media, data.storm_photos, openPhoto);
  const {mountComparison,mountResearchLog} = await import('./documentary-view.mjs');
  mountComparison(data.documentary.comparison);
  const selectMinute = await drawMap(data.geometry, history.chapters, updateMedia, data.cameras, memorial.places, data.documentary, data.timeline_media, data.footage, {points:data.survey.points,media:data.survey_media,openPhoto,lazy:true});
  const { mountReader } = await import('./reader-view.mjs');
  const mapTimes = new Map(data.geometry.features.filter(f => f.geometry.type === 'Point')
    .map(f => [Number(f.properties.source_name.split(':')[1]), f.properties.display_time]));
  mountReader(data.reading, history.chapters.map(chapter => ({...chapter, map_time:mapTimes.get(chapter.minute)})), selectMinute);
  const { mountDamage } = await import('./damage-view.mjs');
  mountDamage(data.damage, openPhoto);
  const { mountSurvey } = await import('./survey-view.mjs');
  mountSurvey(data.survey, data.geometry, data.survey_media, openPhoto, memorial.places);
  mountResearchLog(data.documentary);
  const {mountReadingTools}=await import('./footage-view.mjs');
  mountReadingTools(data.footage);
  // A shared section link can arrive before the asynchronous exhibit is laid out.
  requestAnimationFrame(() => {
    let id;
    try { id = decodeURIComponent(location.hash.slice(1)); }
    catch { return; }
    if (id) document.getElementById(id)?.scrollIntoView({behavior:'instant',block:'start'});
  });
}
async function drawMap(geojson, chapters, updateMedia, cameras, places, documentary, media, footage, photoContext) {
  const {PlaybackClock, preparePositions, positionAt} = await import('./playback-model.mjs');
  const {localStamp} = await import('./timeline-media-model.mjs');
  const {mountCamera} = await import('./camera-view.mjs');
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
    const dot = svgNode('circle', {cx:x,cy:y,r:4.5,class:'map-position',tabindex:0,role:'button','aria-label':'Go to '+position.properties.display_time});
    dot.append(svgNode('title', {}, position.properties.display_time));
    const jump=()=>seek((Date.parse(position.properties.utc)-start)/1000);
    dot.addEventListener('click',jump);
    dot.addEventListener('keydown',event=>{if(['Enter',' '].includes(event.key)){event.preventDefault();jump();}});
    svg.append(dot);
  }
  const halo = svgNode('circle', {r:13,class:'selected-halo'});
  const core = svgNode('circle', {r:5,class:'selected-core'});
  svg.append(halo,core);
  svg.append(svgNode('text', {x:909,y:45,class:'axis-label'}, 'N ↑'));
  const bar = 2 * scale;
  svg.append(svgNode('path', {d:`M 50 355 v 5 h ${bar} v -5`,fill:'none',stroke:'#b3bbae','stroke-width':1.5}));
  svg.append(svgNode('text', {x:50,y:380,class:'axis-label'}, '≈ 2 km'));
  const { mountPlaces } = await import('./places-view.mjs');
  mountPlaces(places, svg, project, photoContext);
  const {mountMapNavigation}=await import('./map-navigation.mjs');
  const navigation=mountMapNavigation(svg,{extent:[0,0,960,430]});
  const {mountGeography}=await import('./geography-view.mjs');
  mountGeography(svg,project,byId('path-geography'));
  byId('path-zoom-in').addEventListener('click',()=>navigation.zoom(1/1.6));
  byId('path-zoom-out').addEventListener('click',()=>navigation.zoom(1.6));
  byId('path-fit').addEventListener('click',navigation.reset);
  const timed = preparePositions(positions), start = timed[0].stamp, end = timed.at(-1).stamp;
  const clock = new PlaybackClock((end-start)/1000);
  let animation = null, lastChapter = null, lastText = null;
  const slider = byId('timeline');
  slider.max = clock.duration;
  byId('media-time').max = clock.duration;
  slider.disabled = false;
  byId('play').disabled = false;
  function stop() {
    clock.pause();
    if (animation !== null) cancelAnimationFrame(animation);
    animation = null; byId('play').textContent = 'Play timeline';
  }
  function seek(seconds) {stop(); clock.seek(seconds); update();}
  const updateCamera = mountCamera(cameras, svg, project, start, end, seek);
  const {mountDocumentary}=await import('./documentary-view.mjs');
  const updateDocumentary=mountDocumentary(documentary,media,cameras,svg,project,start,end,seek,footage);
  const {mountFootage}=await import('./footage-view.mjs');
  const updateFootage=mountFootage(footage,start,seek,stop);
  function update() {
    const selected = positionAt(timed, clock.seconds), [x,y] = project(selected.coordinates);
    for (const element of [halo,core]) {element.setAttribute('cx',x);element.setAttribute('cy',y);}
    // Expiry checks run on every frame, including between displayed whole seconds.
    updateCamera(selected.utc);
    updateDocumentary(selected.utc);
    updateFootage(selected.utc);
    updateMedia({properties:{utc:selected.utc,display_time:localStamp(selected.utc)}},Math.floor(clock.seconds));
    // Keep the marker smooth, but do not rebuild captions or image nodes each frame.
    const textKey = `${Math.floor(clock.seconds)}:${selected.published}`;
    if (textKey === lastText) return;
    lastText = textKey;
    const time = localStamp(selected.utc);
    byId('clock').textContent = time;
    slider.value = Math.floor(clock.seconds);
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
  slider.addEventListener('input', () => seek(Number(slider.value)));
  byId('media-time').addEventListener('input', () => seek(Number(byId('media-time').value)));
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
    if (clock.playing) {clock.tick(performance.now()); stop(); update(); return;}
    clock.play(performance.now()); update();
    byId('play').textContent = 'Pause timeline';
    animation = requestAnimationFrame(frame);
  });
  byId('playback-rate').addEventListener('change', () => {
    clock.tick(performance.now());
    clock.setRate(Number(byId('playback-rate').value)); update();
  });
  document.addEventListener('visibilitychange', () => {if(document.hidden) stop();});
  byId('timeline-media-image').addEventListener('click',stop);
  update();
  function selectMinute(minute) {
    const selected = positions.findIndex(p => Number(p.properties.source_name.split(':')[1]) === minute);
    if (selected < 0) return;
    seek((timed[selected].stamp-start)/1000);
  }
  return selectMinute;
}
main().catch(error => {byId('error').hidden=false;byId('error').textContent=error.message;});

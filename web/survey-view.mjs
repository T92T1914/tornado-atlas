import {filterSurvey, ratingColors, surveyProjection, surveyState, surveyLink, surveyViewBox} from './survey-model.mjs';

const byId = id => document.getElementById(id);
const el = (tag, text, className) => {
  const element = document.createElement(tag);
  if (text) element.textContent = text;
  if (className) element.className = className;
  return element;
};
const svgNode = (tag, attrs, text) => {
  const element = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [key, value] of Object.entries(attrs)) element.setAttribute(key, value);
  if (text) element.textContent = text;
  return element;
};

export function mountSurvey(survey, geometry, media, openPhoto) {
  const host = byId('survey-explorer');
  const initial = surveyState(location.href);
  host.append(el('p', 'PLACES AND PHOTOGRAPHS', 'eyebrow'), el('h3', 'Explore the damage, one place at a time'),
    el('p',`${media.photo_count} photographs are linked to ${media.records_with_photos} survey locations. Choose a photograph or a map point to see its recorded assessment and original image.`));
  const filters = el('div', null, 'damage-filters');
  const rating = el('select'); rating.id = 'survey-rating';
  rating.setAttribute('aria-label', 'Recorded rating');
  const ratingLabel = el('label', 'Recorded rating '); ratingLabel.htmlFor = rating.id;
  ratingLabel.append(rating);
  const all = el('option', 'All recorded ratings'); all.value = ''; rating.append(all);
  for (const value of [...new Set(survey.points.map(p => p.rating))].sort()) {
    const option = el('option', value); option.value = value; rating.append(option);
  }
  if (initial.rating && ![...rating.options].some(option=>option.value===initial.rating)) {
    const option=el('option',initial.rating);option.value=initial.rating;rating.append(option);
  }
  rating.value=initial.rating;
  const search = el('input'); search.id = 'survey-search'; search.type = 'search';
  search.placeholder = 'House, tree, rigid frames, record ID…';
  search.value=initial.query;
  const searchLabel = el('label', 'Search observations '); searchLabel.htmlFor = search.id;
  searchLabel.append(search);
  const count = el('output'); count.id='survey-count'; count.setAttribute('aria-live','polite');
  filters.append(ratingLabel, searchLabel, count); host.append(filters);
  const photoLabel=el('label',null,'survey-photo-filter'), photosOnly=el('input');
  photosOnly.type='checkbox';photosOnly.id='survey-photos-only';photosOnly.checked=initial.photosOnly;
  photoLabel.append(photosOnly,document.createTextNode('Only locations with linked photographs'));
  const reset=el('button','Reset filters');reset.type='button';reset.id='survey-reset';
  const options=el('div',null,'survey-options');options.append(photoLabel,reset);host.append(options);
  const workspace=el('div',null,'survey-workspace'), mapPanel=el('div',null,'survey-map-panel'), inspector=el('div',null,'survey-inspector');
  workspace.append(mapPanel,inspector);host.append(workspace);

  const svg = svgNode('svg', {viewBox:'0 0 960 430',id:'survey-map',role:'img','aria-labelledby':'survey-map-title survey-map-desc'});
  svg.append(svgNode('title',{id:'survey-map-title'},'Damage survey locations within the published El Reno outline'),
    svgNode('desc',{id:'survey-map-desc'},'Static surveyed outcomes, north up. Select a dot or use the observation list below. Color represents the source rating, not an inferred wind field.'));
  const outline = geometry.features.find(f => f.geometry.type === 'Polygon').geometry.coordinates;
  const {project, scale} = surveyProjection(outline);
  const path = points => points.map((p,i)=>(i?'L':'M')+project(p).join(',')).join(' ');
  const flat = outline.flat();
  for (let lon=Math.ceil(Math.min(...flat.map(p=>p[0]))*20)/20;lon<Math.max(...flat.map(p=>p[0]));lon+=.05) {
    const x=project([lon,flat[0][1]])[0];
    svg.append(svgNode('line',{x1:x,y1:30,x2:x,y2:375,class:'grid-line'}),
      svgNode('text',{x:x+4,y:410,class:'axis-label'},`${Math.abs(lon).toFixed(2)}°W`));
  }
  svg.append(svgNode('path',{d:outline.map(r=>path(r)+' Z').join(' '),class:'map-outline','fill-rule':'evenodd'}));
  for (const f of geometry.features.filter(f=>f.geometry.type==='LineString'))
    svg.append(svgNode('path',{d:path(f.geometry.coordinates),class:'map-path'}));
  const dots=svgNode('g',{}), halo=svgNode('circle',{r:10,class:'survey-selected',visibility:'hidden'});
  svg.append(dots,halo,svgNode('text',{x:900,y:35,class:'axis-label'},'N ↑'),
    svgNode('path',{d:`M 50 355 v 5 h ${2*scale} v -5`,fill:'none',stroke:'#b3bbae','stroke-width':1.5}),
    svgNode('text',{x:50,y:383,class:'axis-label'},'≈ 2 km'));
  mapPanel.append(svg);
  const zoomControls=el('div',null,'survey-zoom'), zoomOut=el('button','Zoom out'), zoomIn=el('button','Zoom in'), fit=el('button','Whole path');
  for (const button of [zoomOut,zoomIn,fit]) button.type='button';
  zoomOut.id='survey-zoom-out';zoomIn.id='survey-zoom-in';fit.id='survey-fit';
  zoomControls.append(zoomOut,zoomIn,fit);mapPanel.append(zoomControls);
  const legend=el('div',null,'survey-legend');
  for (const [label,color] of Object.entries(ratingColors).filter(([label])=>label!=='UNKNOWN')) {
    const item=el('span',label==='N/A'?'N/A or unknown':label);
    item.style.setProperty('--swatch',color); legend.append(item);
  }
  mapPanel.append(legend,el('p','Choose a dot or photograph. Zoom follows the selected location. The map shows surveyed features, not camera positions.','fineprint'));
  const controls=el('div',null,'survey-controls'), label=el('label','Observation ');
  const select=el('select');select.id='survey-observation';label.htmlFor=select.id;label.append(select);
  select.setAttribute('aria-label','Observation');
  const previous=el('button','Previous'), next=el('button','Next');
  previous.type=next.type='button';previous.id='survey-previous';next.id='survey-next';
  controls.append(label,previous,next);inspector.append(controls);
  const detail=el('article',null,'survey-detail');detail.id='survey-detail';detail.setAttribute('aria-live','polite');inspector.append(detail);
  const strip=el('div',null,'survey-photo-strip');strip.id='survey-photo-strip';strip.setAttribute('aria-label','Photographs at matching survey locations');host.append(strip);
  let visible=[], selectedId=initial.id, zoom=1, selectedXY=[480,215];
  function zoomMap(){svg.setAttribute('viewBox',surveyViewBox(zoom,selectedXY).join(' '));zoomOut.disabled=zoom===1;zoomIn.disabled=zoom===4;}
  zoomOut.addEventListener('click',()=>{zoom=Math.max(1,zoom/2);zoomMap();});
  zoomIn.addEventListener('click',()=>{zoom=Math.min(4,zoom*2);zoomMap();});
  fit.addEventListener('click',()=>{zoom=1;zoomMap();});
  const targetMissing=el('p',null,'fineprint');targetMissing.id='survey-link-status';host.append(targetMissing);
  function show(id) {
    const index=visible.findIndex(p=>p.id===id), point=visible[index];
    selectedId=point?.id ?? null;select.value=point?String(point.id):'';
    previous.disabled=index<=0;next.disabled=index<0 || index===visible.length-1;
    detail.replaceChildren();halo.setAttribute('visibility',point?'visible':'hidden');
    if (!point) {detail.append(el('p','No survey observations match these filters.'));return;}
    const [x,y]=project(point.coordinates);halo.setAttribute('cx',x);halo.setAttribute('cy',y);
    selectedXY=[x,y];zoomMap();
    for (const button of strip.querySelectorAll('button')) button.setAttribute('aria-pressed',String(Number(button.dataset.id)===id));
    const source=el('a','Open this NWS record ↗');source.href=point.source_url;source.target='_blank';source.rel='noopener';
    detail.append(el('p',`NWS DAT RECORD ${point.id} · ${point.rating}`,'eyebrow'),el('h4',point.indicator));
    const photos=media.photos[String(point.id)] || [];
    if (photos.length) {
      const gallery=el('div',null,'survey-record-photos');
      for (const [i,photo] of photos.entries()) {
        const button=el('button',null,'survey-photo-open');button.type='button';
        button.setAttribute('aria-label',`Enlarge photograph ${i+1} for survey record ${point.id}`);
        const img=el('img');img.src=photo.url;img.alt=`Photograph attached to NWS survey record ${point.id}, rated ${point.rating}.`;
        img.referrerPolicy='no-referrer';img.decoding='async';
        img.addEventListener('error',()=>{button.disabled=true;button.replaceChildren(el('span','Photograph unavailable from the source. The original record link remains below.'));},{once:true});
        button.append(img);button.addEventListener('click',()=>openPhoto({title:`${point.rating} · NWS survey ${point.id}`,asset:photo.url,alt:img.alt,
          caption:`Recorded assessment: ${point.degree}. This assessment belongs to the survey record, not a new rating from the photograph.`,
          location:`Surveyed feature: ${point.coordinates[1].toFixed(5)}°N, ${Math.abs(point.coordinates[0]).toFixed(5)}°W. The camera's position and capture time are not supplied.`,
          credit:media.source.credit,source:point.source_url}));gallery.append(button);
      }
      detail.append(gallery);
    } else detail.append(el('p','No original photograph is linked in the preserved attachment response for this record.','survey-photo-empty'));
    detail.append(el('p','Recorded assessment','eyebrow'),el('p',point.degree),
      el('p',`${point.coordinates[1].toFixed(5)}°N, ${Math.abs(point.coordinates[0]).toFixed(5)}°W. Surveyed feature location; camera position and positional accuracy are not established here.`,'fineprint'));
    if(photos.length) detail.append(el('p','Source: NOAA/NWS Damage Assessment Toolkit. Photographer: not identified in the attachment metadata. Capture time: not provided.','fineprint'));
    const share=el('a','Link to this observation');share.id='survey-share';
    share.href=surveyLink(location.href,{id:point.id,rating:rating.value,query:search.value,photosOnly:photosOnly.checked});
    const links=el('div',null,'survey-record-links');links.append(source,share);detail.append(links);
  }
  function filter() {
    visible=filterSurvey(survey.points,rating.value,search.value,photosOnly.checked?media.photos:null);
    count.textContent=`${visible.length} of ${survey.included_count} survey locations`;
    select.replaceChildren();dots.replaceChildren();strip.replaceChildren();select.disabled=!visible.length;
    for (const point of visible) {
      const option=el('option',`${point.id} · ${point.rating} · ${point.indicator}`);option.value=point.id;select.append(option);
      const [x,y]=project(point.coordinates);
      const dot=svgNode('circle',{cx:x,cy:y,r:4.2,fill:ratingColors[point.rating]||'#87949d',class:'survey-dot'});
      dot.append(svgNode('title',{},`${point.id} · ${point.rating} · ${point.indicator}`));
      dot.addEventListener('click',()=>show(point.id));dots.append(dot);
      const photo=media.photos[String(point.id)]?.[0];
      if (photo) {
        const button=el('button');button.type='button';button.dataset.id=point.id;
        button.setAttribute('aria-label',`View ${point.rating} photograph at survey record ${point.id}`);
        const img=el('img');img.loading='lazy';img.decoding='async';img.referrerPolicy='no-referrer';img.src=photo.thumbnail_url;img.alt='';
        img.addEventListener('error',()=>img.remove(),{once:true});
        button.append(img,el('span',`${point.rating} · ${point.id}`));button.addEventListener('click',()=>show(point.id));strip.append(button);
      }
    }
    show(visible.some(p=>p.id===selectedId)?selectedId:visible[0]?.id);
  }
  rating.addEventListener('change',filter);search.addEventListener('input',filter);photosOnly.addEventListener('change',filter);
  reset.addEventListener('click',()=>{rating.value='';search.value='';photosOnly.checked=true;targetMissing.textContent='';filter();});
  select.addEventListener('change',()=>show(Number(select.value)));
  previous.addEventListener('click',()=>show(visible[visible.findIndex(p=>p.id===selectedId)-1]?.id));
  next.addEventListener('click',()=>show(visible[visible.findIndex(p=>p.id===selectedId)+1]?.id));
  const methodology=el('details'), summary=el('summary','Source, coverage and interpretation');
  const queryLink=el('a','Inspect the bounded NWS query ↗');queryLink.href=survey.source.query_url;queryLink.target='_blank';queryLink.rel='noopener';
  methodology.append(summary,el('p',survey.time_note),el('p',survey.note),el('p',survey.status_note),
    el('p',`${survey.queried_count} regional records retrieved; ${survey.included_count} fall inside or on the outline and ${survey.outside_count} are outside. Counts are survey records, not unique buildings or casualties.`),
    el('p','EF labels are individual assessments. TSTM/Wind is the source’s thunderstorm-wind classification. N/A and UNKNOWN have no EF rating. None is converted into a tornado wind speed.'),
    el('p',`Snapshot: ${survey.source.retrieved_at.slice(0,10)}. Coordinates preserved; local map projection is approximate. The recorded storm-date field is used to retrieve the regional survey, not to animate failures.`),queryLink,
    el('p',media.source.association),el('p',media.source.rights));
  host.append(methodology);
  const context=el('nav',null,'survey-context');context.setAttribute('aria-label','Read around these observations');
  for (const [text,href] of [['Read the storm history','#history'],['Explore the EF3 / EF5 discussion','#el-reno-ef5-debate'],['Remember those who died','#remembrance']]) {
    const anchor=el('a',text);anchor.href=href;context.append(anchor);
  }
  host.append(context);filter();
  if (initial.id !== null && selectedId !== initial.id) targetMissing.textContent=`The shared record ${initial.id} is unavailable under these filters. The first matching observation is shown instead.`;
}

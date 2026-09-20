import {filterSurvey, ratingColors, surveyProjection} from './survey-model.mjs';

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

export function mountSurvey(survey, geometry) {
  const host = byId('survey-explorer');
  host.append(el('p', 'RECORDED LOCATIONS', 'eyebrow'), el('h3', 'Inspect the damage on the map'),
    el('p', survey.note), el('p', survey.time_note, 'fineprint'));
  const filters = el('div', null, 'damage-filters');
  const rating = el('select'); rating.id = 'survey-rating';
  rating.setAttribute('aria-label', 'Recorded rating');
  const ratingLabel = el('label', 'Recorded rating '); ratingLabel.htmlFor = rating.id;
  ratingLabel.append(rating);
  const all = el('option', 'All recorded ratings'); all.value = ''; rating.append(all);
  for (const value of [...new Set(survey.points.map(p => p.rating))].sort()) {
    const option = el('option', value); option.value = value; rating.append(option);
  }
  const search = el('input'); search.id = 'survey-search'; search.type = 'search';
  search.placeholder = 'House, tree, rigid frames, record ID…';
  const searchLabel = el('label', 'Search observations '); searchLabel.htmlFor = search.id;
  searchLabel.append(search);
  const count = el('output'); count.id='survey-count'; count.setAttribute('aria-live','polite');
  filters.append(ratingLabel, searchLabel, count); host.append(filters);

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
  host.append(svg);
  const legend=el('div',null,'survey-legend');
  for (const [label,color] of Object.entries(ratingColors).filter(([label])=>label!=='UNKNOWN')) {
    const item=el('span',label==='N/A'?'N/A or unknown':label);
    item.style.setProperty('--swatch',color); legend.append(item);
  }
  host.append(legend,el('p','Choose a dot, or use the list and Previous / Next buttons. Multiple records can occupy one location; the list keeps each record accessible.','fineprint'));
  const controls=el('div',null,'survey-controls'), label=el('label','Observation ');
  const select=el('select');select.id='survey-observation';label.htmlFor=select.id;label.append(select);
  select.setAttribute('aria-label','Observation');
  const previous=el('button','Previous'), next=el('button','Next');
  previous.type=next.type='button';previous.id='survey-previous';next.id='survey-next';
  controls.append(label,previous,next);host.append(controls);
  const detail=el('article',null,'survey-detail');detail.id='survey-detail';detail.setAttribute('aria-live','polite');host.append(detail);
  let visible=[], selectedId=null;
  function show(id) {
    const index=visible.findIndex(p=>p.id===id), point=visible[index];
    selectedId=point?.id ?? null;select.value=point?String(point.id):'';
    previous.disabled=index<=0;next.disabled=index<0 || index===visible.length-1;
    detail.replaceChildren();halo.setAttribute('visibility',point?'visible':'hidden');
    if (!point) {detail.append(el('p','No survey observations match these filters.'));return;}
    const [x,y]=project(point.coordinates);halo.setAttribute('cx',x);halo.setAttribute('cy',y);
    const source=el('a','Open this NWS record ↗');source.href=point.source_url;source.target='_blank';source.rel='noopener';
    detail.append(el('p',`NWS DAT RECORD ${point.id} · ${point.rating}`,'eyebrow'),
      el('h4',point.indicator),el('p',point.degree),
      el('p',`${point.coordinates[1].toFixed(5)}°N, ${Math.abs(point.coordinates[0]).toFixed(5)}°W. Survey coordinates; positional accuracy is not established here.`,'fineprint'),source);
  }
  function filter() {
    visible=filterSurvey(survey.points,rating.value,search.value);
    count.textContent=`${visible.length} of ${survey.included_count} mapped records`;
    select.replaceChildren();dots.replaceChildren();select.disabled=!visible.length;
    for (const point of visible) {
      const option=el('option',`${point.id} · ${point.rating} · ${point.indicator}`);option.value=point.id;select.append(option);
      const [x,y]=project(point.coordinates);
      const dot=svgNode('circle',{cx:x,cy:y,r:4.2,fill:ratingColors[point.rating]||'#87949d',class:'survey-dot'});
      dot.append(svgNode('title',{},`${point.id} · ${point.rating} · ${point.indicator}`));
      dot.addEventListener('click',()=>show(point.id));dots.append(dot);
    }
    show(visible.some(p=>p.id===selectedId)?selectedId:visible[0]?.id);
  }
  rating.addEventListener('change',filter);search.addEventListener('input',filter);
  select.addEventListener('change',()=>show(Number(select.value)));
  previous.addEventListener('click',()=>show(visible[visible.findIndex(p=>p.id===selectedId)-1]?.id));
  next.addEventListener('click',()=>show(visible[visible.findIndex(p=>p.id===selectedId)+1]?.id));
  const methodology=el('details'), summary=el('summary','Source, coverage and interpretation');
  const queryLink=el('a','Inspect the bounded NWS query ↗');queryLink.href=survey.source.query_url;queryLink.target='_blank';queryLink.rel='noopener';
  methodology.append(summary,el('p',survey.status_note),
    el('p',`${survey.queried_count} regional records retrieved; ${survey.included_count} fall inside or on the outline and ${survey.outside_count} are outside. Counts are survey records, not unique buildings or casualties.`),
    el('p','EF labels are individual assessments. TSTM/Wind is the source’s thunderstorm-wind classification. N/A and UNKNOWN have no EF rating. None is converted into a tornado wind speed.'),
    el('p',`Snapshot: ${survey.source.retrieved_at.slice(0,10)}. Coordinates preserved; local map projection is approximate. The recorded storm-date field is used to retrieve the regional survey, not to animate failures.`),queryLink);
  host.append(methodology);filter();
}

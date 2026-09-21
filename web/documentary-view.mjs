import {issuedAt,activeWarnings,splitPercent} from './documentary-model.mjs';
import {localStamp,frameAt} from './timeline-media-model.mjs';
import {anchorAt} from './footage-model.mjs';
const el=(tag,text,cls)=>{const e=document.createElement(tag);if(text)e.textContent=text;if(cls)e.className=cls;return e;};
const link=(text,url)=>{const a=el('a',text);a.href=url;a.target='_blank';a.rel='noopener';return a;};
export function mountDocumentary(data,media,cameras,svg,project,start,end,seek,footage) {
  const host=document.getElementById('evidence-desk');
  host.append(el('p','ONE CLOCK, SEPARATE RECORDS','eyebrow'),el('h3','What was known at this moment'),el('p','Move either timeline slider to follow the latest reviewed warning, radar frame and camera sample. Issue time is separate from the earlier observation described inside a bulletin. This is a historical archive, not a live warning service.'));
  const cards=el('div',null,'evidence-cards');host.append(cards);
  const warning=el('article'),radar=el('article'),camera=el('article');cards.append(warning,radar,camera);
  const toggle=el('input');toggle.type='checkbox';toggle.id='warning-polygons';
  const label=el('label',null,'warning-toggle');label.append(toggle,document.createTextNode(' Show archived warning polygons on the path'));host.append(label,el('p','Dashed boundaries are areas warned by NWS, not the tornado footprint. Only the selected, preserved bulletins are represented.','fineprint'));
  const layer=document.createElementNS('http://www.w3.org/2000/svg','g');layer.setAttribute('class','warning-layer');layer.setAttribute('aria-hidden','true');svg.append(layer);
  let last=null,lastKey=null;
  function update(utc) {
    last=utc;const available=issuedAt(data.warnings,utc),latest=available.at(-1),r=frameAt(media.frames,utc,media.max_age_seconds),c=frameAt(cameras.samples,utc,cameras.display_max_age_seconds);
    const active=activeWarnings(data.warnings,utc);
    const recorded=anchorAt(footage.anchors,utc);
    const key=JSON.stringify([latest?.id,r?.frame.utc,c?.frame.utc,recorded?.id,toggle.checked,active.map(item=>item.id)]);if(key===lastKey)return;lastKey=key;
    warning.replaceChildren(el('h4','Latest reviewed bulletin'));
    if(latest) warning.append(el('p',localStamp(latest.issued)),el('strong',latest.title),el('p',latest.summary),link('Read the original bulletin',latest.source));
    else warning.append(el('p','No reviewed bulletin issued by this time.'));
    radar.replaceChildren(el('h4','Radar available'));
    radar.append(el('p',r?localStamp(r.frame.utc):'No frame within the preceding four minutes.'),el('p','Regional reflectivity. Available frames remain discrete; intermediate images are not generated.','fineprint'));
    camera.replaceChildren(el('h4','Camera evidence'));
    if(recorded){
      camera.append(el('p',`Dan Robinson · ${localStamp(recorded.utc)}`),el('p','Checked video clock. Camera position and bearing are not registered.','fineprint'));
      const jump=el('a','View the original footage below');jump.href='#registered-footage';camera.append(jump);
    }else camera.append(el('p','No checked video frame assigned to this second.','fineprint'));
    camera.append(el('p',c?`Separate camera: Tim Marshall · ${localStamp(c.frame.utc)} · ${c.frame.azimuth}°`:'No Marshall position sample within the preceding 90 seconds.'),el('p','Marshall entries contain published position and bearing only.','fineprint'));
    layer.replaceChildren();
    if(toggle.checked) for(const item of active) {
      const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d',item.polygon.map((p,i)=>(i?'L':'M')+project(p).join(',')).join(' ')+' Z');
      const title=document.createElementNS(svg.namespaceURI,'title');title.textContent=`${item.event_id} · issued ${localStamp(item.issued)}`;path.append(title);layer.append(path);
    }
  }
  toggle.addEventListener('change',()=>{if(last)update(last);});
  const sequence=document.getElementById('forecast-sequence');
  for(const record of data.warnings) {
    const item=el('li');item.id=record.id;item.append(el('p',localStamp(record.issued),'eyebrow'),el('h3',record.title),el('p',record.summary),link('Original NWS text, preserved by IEM',record.source));
    const stamp=Date.parse(record.issued);
    if(stamp>=start&&stamp<=end){const jump=el('button','Follow this moment on the path');jump.type='button';jump.addEventListener('click',()=>{seek((stamp-start)/1000);document.getElementById('evidence-desk').scrollIntoView({block:'start'});});item.append(jump);}
    else item.append(el('p','Before the first published path position.','fineprint'));
    sequence.append(item);
  }
  return update;
}
export function mountComparison(pair) {
  const host=document.getElementById('before-after');host.append(el('p','BEFORE AND AFTER','eyebrow'),el('h2',pair.title),el('p',pair.description));
  const frame=el('div',null,'comparison-frame');const before=el('img'),after=el('img');
  for(const [image,record] of [[before,pair.before],[after,pair.after]]) {image.src=record.asset;image.alt=record.alt;image.width=pair.width;image.height=pair.height;image.loading='lazy';image.decoding='async';}
  after.className='comparison-after';frame.append(before,after);host.append(frame);
  const label=el('label','Reveal the later view '),slider=el('input');slider.type='range';slider.min=0;slider.max=100;slider.value=50;slider.id='comparison-split';label.htmlFor=slider.id;
  const output=el('output');output.htmlFor=slider.id;
  function change(){const value=splitPercent(slider.value);after.style.clipPath=`inset(0 ${100-value}% 0 0)`;output.textContent=`${value}% of the later view revealed`;slider.setAttribute('aria-valuetext',output.textContent);}
  slider.addEventListener('input',change);change();
  const dates=el('div',null,'comparison-dates');dates.append(el('span','Earlier: '+pair.before.date),el('span','Later: '+pair.after.date));
  host.append(label,slider,output,dates,el('p',pair.limits,'fineprint'),el('p',pair.credit,'fineprint'),link('Space Science and Engineering Center','https://www.ssec.wisc.edu/'),document.createTextNode(' · '),link('Original comparison and explanation',pair.source),document.createTextNode(' · '),link('Image use terms',pair.rights));
  for(const image of [before,after])image.addEventListener('error',()=>{frame.hidden=true;slider.disabled=true;output.textContent='Image unavailable. Open the original comparison below.';},{once:true});
}
export function mountResearchLog(data) {
  const host=document.getElementById('research-log');
  for(const record of data.log) {const article=el('article');article.append(el('p',record.date+' · '+record.status,'eyebrow'),el('h3',record.title),el('p',record.finding));record.sources.forEach(s=>article.append(link(s.label,s.url)));host.append(article);}
  const missing=document.getElementById('unmapped-fatalities');
  for(const item of data.unmapped_fatalities){const card=el('article');card.id=item.id;card.append(el('h3',item.people.join(' and ')),el('p',item.account),el('p',item.reason,'fineprint'));item.sources.forEach(s=>card.append(link(s.label,s.url)));missing.append(card);}
  for(const host of document.querySelectorAll('[data-remembrance-coverage]')){
    const details=el('details');details.append(el('summary','Other victims: location research'));
    details.append(el('p','All eight people are named in the remembrance. The mapped recovery record accounts for the three TWISTEX members. The five people below have confirmed names but no verified precise location in this exhibit.','fineprint'));
    const list=el('ul');for(const item of data.unmapped_fatalities){const row=el('li'),a=el('a',item.people.join(' and '));a.href='#'+item.id;row.append(a);list.append(row);}details.append(list);host.append(details);
  }
  const audit=document.getElementById('link-audit-summary');
  fetch('source-audit.json').then(response=>{if(!response.ok)throw new Error('Audit unavailable');return response.json();}).then(report=>{
    audit.append(el('p',`Link access checked ${report.checked_at.slice(0,10)} UTC: ${report.results.length} distinct URLs, ${report.counts.reachable||0} reachable, ${report.counts.access_unresolved||0} with unresolved access, ${report.counts.missing||0} returned missing pages. These results cover the curated exhibit and museum pages, not every catalogue record.`));
    const unresolved=report.results.filter(row=>row.access!=='reachable');
    if(unresolved.length){const details=el('details'),list=el('ul');details.append(el('summary','Sources whose access could not be confirmed'));
      for(const row of unresolved){const item=el('li');item.append(link(new URL(row.url).hostname,row.url),document.createTextNode(` · ${row.http_status?'HTTP '+row.http_status:row.error} · ${row.url}`));list.append(item);}details.append(list);audit.append(details);}
  }).catch(()=>audit.append(el('p','The link audit could not be loaded. Its preserved file is linked below.')));
}

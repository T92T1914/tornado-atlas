import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fixture,base} from './harness.mjs';

// Literal item identities retained in accepted archive/source records. Routes
// use the current dossier revision, including the source-linked Udall update.
// These expectations do not import the reference adapter or its generated map.
const references=[
 {event:'el-reno-2013',media:'nolte-231037-full-documentary',source:'nolte-three-permitted-full-exports',
  revision:'854b56dffaf8720e27beab95bf091450f3de80ba8d0f8f678ee21986b6fa410c',
  asset:'assets/el-reno-2013/nolte-231037-full.jpg',sha:'e9ad30c4fdcb6a28340bbb0e422b80cbc937ef248b497092246c7bff51fd4847',width:1920,height:1080,
  original:'https://nnwx.us/blog/2013/07/15/may-31-2013-the-el-reno-ef-5/',item:'https://nnwx.us/wp-content/uploads/2018/02/231037.jpg',
  story:'index.html#documentary-nolte-231037',role:/creator-reported instant/,credit:'creator: Nick Nolte',
  rights:['item-specific permission','231037.jpg, 231059.jpg and 231202.jpg','fourth still and movie remain outside this grant'],
  limits:['23:10Z','not independently calibrated','Appearance between samples remains unknown'],version:'Unchanged full published JPEG'},
 {event:'joplin-2011',media:'friskey-joplin-storm',source:'commons-friskey-joplin',
  revision:'68dca24097277ba2afb70a2430ed89cda500cd4e833c804347b2dee2e4ebe326',
  asset:'assets/joplin-2011/storm.jpg',sha:'5002f48485c7b139bc6ce3b0d2bd2e3359da812ef220b0d761210cab2bf034f1',width:1557,height:932,
  original:'https://commons.wikimedia.org/wiki/File:Joplin,_Missouri_tornado_of_2011.jpg',
  story:'joplin.html?photo=friskey-joplin-storm#visibility',role:/unregistered camera and clock/,credit:'creator: Daniel Friskey',
  rights:['CC BY-SA 4.0','Daniel Friskey','does not qualify the linked video'],
  limits:['continuous outline','capture clock','private VRT correspondence were not inspected'],version:'without cropping, recoloring'},
 {event:'blackwell-1955',media:'nara-blackwell-aerial-aftermath',source:'nara-blackwell-283884',
  revision:'9e74182ea8d0076dae452b9a29e44158793d5b2bafe7a237d7969ec336ea5b8b',
  asset:'assets/blackwell-1955/nara-283884.jpg',sha:'66ea06de076b831c60710ee56168484ce90c7ef510cb1d6f87e3b28c67d58e34',width:3000,height:2371,
  original:'https://commons.wikimedia.org/wiki/File:Tornado_damage._Blackwell,_Oklahoma_-_NARA_-_283884.jpg',
  story:'blackwell.html#photographs-and-film',role:/aftermath photograph, not a storm-time view/,credit:'creator: not established',
  rights:['PD-USGov','NARA/NAID283884','Individual photographer and exact capture time are unestablished'],
  limits:['daylight','aftermath photograph','exposure time'],version:'full frame and annotation preserved'},
 {event:'tuscaloosa-birmingham-2011',media:'oliveira-2019-tornado-video-frames',source:'oliveira-2019-tuscaloosa-figure6',
  revision:'63b08e0460f38874aeb9f56825860abb768886cb6eea408e5415e9215bcc4a64',
  asset:'assets/tuscaloosa-birmingham-2011/tornado-video-frames-oliveira2019.png',sha:'d8e89044ea98c4beab8d568598ea3a1711b73bfe3a425e5afd304af491e48d4f',width:1351,height:767,
  original:'https://repository.library.noaa.gov/view/noaa/26149/noaa_26149_DS1.pdf',item:'https://repository.library.noaa.gov/view/noaa/26149/noaa_26149_DS1.pdf#page=10',
  story:'tuscaloosa.html#photographs-and-film',role:/estimated time labels/,credit:'creator: Maurício I. Oliveira',
  rights:['CC BY4.0','Mike Wilhelm','John Brown','does not license the complete original recordings'],
  limits:['estimated','two credited films','not verified capture UTC'],version:'All panels, printed letters, arrows and time labels preserved'},
 {event:'moore-2013',media:'moore-medical-center-survey',source:'nws-event-hub',
  revision:'5ed36647a0e6141f8ddeeee30ef7be9e7bb6332613ed86428b3b9b5536b25e85',
  asset:'assets/moore-2013/IMG_9287-800.jpg',sha:'f10b6b33fbcecd2c228632d2d681bbef47e58876246b753a04721dda3a58c6bb',width:800,height:533,
  original:'https://www.weather.gov/oun/events-20130520',item:'https://www.weather.gov/images/oun/wxevents/20130520/photos/damage/IMG_9287-800.jpg',
  story:'moore.html#survey-photographs',role:/Following-day survey photograph, not a storm-time view/,credit:'creator: Doug Speheger',
  rights:['NWS employee Doug Speheger','exact item review','third-party contributions do not inherit that basis'],
  limits:['ENE remains a qualitative caption direction','No surveyed camera location','following-day aftermath'],
  version:'Removed EXIF and XMP APP1 plus Photoshop IPTC APP13 metadata only'},
 {event:'udall-1955',media:'nws-blackwell-warning2',source:'nws-blackwell-warning2',
  revision:'ea29259561776155de0dce541ee11642c175258d8b6af476c5b143f1fed47bcf',
  asset:'assets/blackwell-1955/nws-warning2.jpg',sha:'8de7b776fc25c87834a9277c77c2a6b10939b4618984dbefe450e621584304a5',width:608,height:436,
  original:'https://www.weather.gov/images/ict/wxstory/udall/warning2.jpg',
  story:'udall.html#udall-regional-forecast',role:/forecast document, not a photograph of the tornado/,credit:'creator: not established',
  rights:['NWS default public-domain use policy','issuing office, typist and scan creator are unknown','does not clear unrelated newspaper scans'],
  limits:['later archive caption','No independent station record','No tornado lead time or absolute event clock'],
  version:'without crop, recoloring, resampling or caption removal'}
];
const ref=event=>references.find(row=>row.event===event);
const controls={peak:'145',radius:'650',background:'15','probe-x':'-0.8','probe-y':'1.3',area:'2.4',coefficient:'1.1',travel:'35',offset:'-0.7',threshold:'95',capacity:'1.6'};
async function input(page,id,value){
 await page.locator('#'+id).evaluate((node,value)=>{node.value=String(value);node.dispatchEvent(new Event('input',{bubbles:true}));},value);
}
async function ready(page){await page.locator('#lab-context[data-experiment-ready="true"]').waitFor();}
async function appearance(page,value){
 await page.locator('#reading-appearance:not([disabled])').waitFor();
 await page.locator('#reading-appearance').selectOption(value);
 assert.equal(await page.locator('html').getAttribute('data-appearance'),value);
}
async function paused(page,kind){
 for(const id of kind==='wind'?['wind-motion','passage-play','component-play']:['motion'])
  assert.match(await page.locator('#'+id).textContent(),/^Play/);
}
async function windState(page){
 return page.evaluate(()=>({
  controls:Object.fromEntries(['peak','radius','background','probe-x','probe-y','area','coefficient','travel','offset','threshold','capacity'].map(id=>[id,document.getElementById(id).value])),
  sample:document.getElementById('passage-time').value,paired:document.getElementById('component-time').value,
  selected:[...document.querySelectorAll('#sampled-values-body tr[aria-current="true"]')].map(row=>row.id),
  graph:document.getElementById('passage-line').getAttribute('d'),
  readings:['passage-now','passage-force','component-now','component-first','passage-axis-range'].map(id=>document.getElementById(id).textContent),
  rows:[205,206].map(i=>[...document.getElementById('passage-sample-'+i).cells].map(c=>[c.textContent,c.dataset.value??null]))
 }));
}
async function formState(page){
 return page.evaluate(()=>({
  controls:Object.fromEntries(['shape','condensation','azimuth','elevation','distance','quality','sequence-coverage','sequence-rate','sequence-time'].map(id=>[id,document.getElementById(id).value])),
  dust:document.getElementById('dust').checked,enabled:document.getElementById('sequence-enabled').checked,
  stage:document.getElementById('sequence-stage').textContent
 }));
}
async function choose(page,row){
 await page.locator('#lab-event').selectOption(row.event);
 await page.waitForFunction(({event,media})=>{
  const host=document.getElementById('lab-reference-evidence');
  return host?.dataset.state==='ready'&&host.dataset.event===event&&host.dataset.mediaId===media;
 },{event:row.event,media:row.media});
}
function routeIdentity(href,row,kind,id){
 const url=new URL(href,base);assert.equal(url.pathname,'/dossier.html');
 assert.deepEqual(Object.fromEntries(url.searchParams),{event:row.event,[kind]:id,revision:row.revision});
 assert.equal(url.hash,'#'+kind+'-'+id);
}
async function referenceIdentity(page,row,{bytes=true}={}){
 const host=page.locator('#lab-reference-evidence');
 assert.equal(await host.getAttribute('data-state'),'ready');
 assert.equal(await host.getAttribute('data-event'),row.event);
 assert.equal(await host.getAttribute('data-media-id'),row.media);
 assert.equal(await host.getAttribute('aria-busy'),'false');
 assert.match(await host.locator('.lab-reference-role').innerText(),row.role);
 assert.ok((await host.locator('.lab-reference-credit').innerText()).includes(row.credit));
 for(const term of row.rights)assert.ok((await host.locator('.lab-reference-rights').innerText()).includes(term),row.event+' rights: '+term);
 const words=await host.locator('figure').innerText();
 for(const term of row.limits)assert.ok(words.includes(term),row.event+' limits: '+term);
 assert.ok((await host.locator('.lab-reference-version').innerText()).includes(row.version));
 const actions=host.locator('.lab-reference-actions');
 routeIdentity(await actions.getByRole('link',{name:'Inspect the media record and its limits',exact:true}).getAttribute('href'),row,'media',row.media);
 routeIdentity(await actions.getByRole('link',{name:'Read the item source and permission',exact:true}).getAttribute('href'),row,'source',row.source);
 assert.equal(await actions.getByRole('link',{name:'Read this item in its article',exact:true}).getAttribute('href'),new URL(row.story,base).href);
 assert.equal(await actions.getByRole('link',{name:'Open the original source',exact:true}).getAttribute('href'),row.original);
 if(row.item&&row.item!==row.original)assert.equal(await actions.getByRole('link',{name:'Open the original item',exact:true}).getAttribute('href'),row.item);
 assert.equal(await host.locator('.lab-reference-image-link').getAttribute('href'),new URL(row.asset,base).href);
 const image=host.locator('#lab-reference-image');
 assert.equal(await image.isVisible(),true);
 const actual=await image.evaluate(async node=>{
  const r=node.getBoundingClientRect(),s=getComputedStyle(node);
  const clipped=[];
  for(let a=node.parentElement;a&&a.id!=='lab-context';a=a.parentElement){
   const cs=getComputedStyle(a),box=a.getBoundingClientRect();
   if(['hidden','clip'].includes(cs.overflowY)&&(r.top<box.top-1||r.bottom>box.bottom+1))clipped.push(a.tagName+'.'+a.className);
  }
  const b=await (await fetch(node.currentSrc)).arrayBuffer();
  const digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',b))].map(v=>v.toString(16).padStart(2,'0')).join('');
  return {width:node.naturalWidth,height:node.naturalHeight,hidden:node.hidden,fit:s.objectFit,box:{width:r.width,height:r.height},digest,clipped};
 });
 assert.equal(actual.width,row.width);assert.equal(actual.height,row.height);assert.equal(actual.hidden,false);
 assert.equal(actual.fit,'contain');assert.ok(actual.box.width>0&&actual.box.height>0);
 assert.ok(Math.abs(actual.box.width/actual.box.height-row.width/row.height)<.02,'Full image ratio '+JSON.stringify(actual));
 assert.deepEqual(actual.clipped,[],'No ancestor clips the complete image bottom');
 if(bytes)assert.equal(actual.digest,row.sha,'Actual displayed object bytes '+row.event);
 return host;
}
async function readable(page,selectors){
 for(const selector of selectors){
  const metrics=await page.locator(selector).first().evaluate(node=>{
   const s=getComputedStyle(node),r=node.getBoundingClientRect();
   return {tag:node.tagName,font:parseFloat(s.fontSize),width:r.width,height:r.height,text:node.textContent.slice(0,160)};
  });
  assert.ok(!['SVG','TEXT'].includes(metrics.tag)&&metrics.font>=14&&metrics.width>0&&metrics.height>0,selector+' '+JSON.stringify(metrics));
 }
}
async function reflow(page){
 const result=await page.evaluate(()=>({
  viewport:innerWidth,document:document.documentElement.scrollWidth,
  outside:[...document.querySelectorAll('.figure-reading,.wind-key,.wind-key small,.scene-overlay span,.lab-reference-role,.lab-reference-boundary,.lab-reference-figure figcaption p,.lab-reference-actions a')].flatMap(node=>{
   const range=document.createRange();range.selectNodeContents(node);
   return [...range.getClientRects()].filter(r=>r.width>0&&(r.left< -1||r.right>innerWidth+1)).map(r=>({text:node.textContent.slice(0,100),left:r.left,right:r.right}));
  })
 }));
 assert.ok(result.document<=result.viewport+1,JSON.stringify(result));assert.deepEqual(result.outside,[],JSON.stringify(result));
}
async function capture(page,name){
 if(!process.env.ATLAS_LAB_CAPTURE)return;
 await mkdir(process.env.ATLAS_LAB_CAPTURE,{recursive:true});
 await page.screenshot({path:path.join(process.env.ATLAS_LAB_CAPTURE,name+'.png')});
}
async function figureKeys(page){
 const gradient=await page.locator('.wind-key i').evaluate(node=>getComputedStyle(node).backgroundImage);
 const stops=gradient.match(/rgb\(\d+,\s*\d+,\s*\d+\)/g)?.map(s=>s.replace(/\s/g,''))??[];
 const scheme=await page.locator('html').evaluate(node=>getComputedStyle(node).colorScheme);
 assert.ok(['dark','light'].includes(scheme));
 const expected=scheme==='dark'?['rgb(164,164,164)','rgb(244,244,244)']:['rgb(100,98,92)','rgb(36,36,36)'];
 assert.deepEqual(stops,expected,'The relative field key has the reviewed appearance endpoints and no unrelated midpoint');
 assert.match(await page.locator('.wind-key small').innerText(),/relative.*not EF ratings/);
 for(const [figure,explanation,terms] of [
  ['passage-plan','passage-plan-reading',['center travels east','12 core radii','fixed probe']],
  ['passage-chart','passage-chart-reading',['481 wind samples','comparison speed','selected sample']],
  ['component-diagram','component-diagram-reading',['four connections','no physical dimensions','does not predict a debris trajectory']]
 ]){
  assert.equal(await page.locator('#'+figure).getAttribute('aria-describedby'),explanation);
  const text=await page.locator('#'+explanation).innerText();for(const term of terms)assert.ok(text.includes(term),term);
 }
 await readable(page,['#passage-plan-reading','#passage-chart-reading','#component-diagram-reading','.wind-key small']);
 assert.match(await page.locator('#passage-axis-range').innerText(),/mph/);
 assert.match(await page.locator('#passage-axis-range').innerText(),/model seconds/);
}
async function savePaused(page){
 await page.locator('#lab-share').click();await paused(page,'wind');
}

for(const [width,scheme] of [[320,'dark'],[320,'light'],[1280,'dark'],[1280,'light']]){
 test('Laboratory figures and all six documentary identities '+width+' '+scheme,{timeout:45000},async t=>{
  const page=await fixture(t,{viewport:{width,height:900},isMobile:width<600,colorScheme:scheme,reducedMotion:'reduce',serviceWorkers:'block'});
  const requested=[];page.on('request',request=>requested.push(request.url()));
  await page.goto(base+'/wind.html');await ready(page);await appearance(page,scheme);
  assert.equal(await page.locator('#lab-reference-evidence').isHidden(),true);
  for(const[id,value]of Object.entries(controls))await input(page,id,value);
  for(const sample of [205,206]){
   await input(page,'component-time',sample);await savePaused(page);const expected=await windState(page),url=page.url();
   assert.deepEqual(expected.controls,controls);assert.equal(expected.sample,String(sample));assert.equal(expected.paired,String(sample));
   assert.deepEqual(expected.selected,['passage-sample-'+sample]);
   await appearance(page,scheme==='dark'?'light':'dark');
   assert.deepEqual(await windState(page),expected);assert.equal(page.url(),url);await paused(page,'wind');
   await appearance(page,scheme);assert.deepEqual(await windState(page),expected);await paused(page,'wind');
  }
  const retained=await windState(page);
  for(const row of references){await choose(page,row);await referenceIdentity(page,row);assert.deepEqual(await windState(page),retained);await paused(page,'wind');}
  assert.equal(await page.locator('#sampled-values-body tr').count(),481);
  assert.equal(await page.locator('#wind-reference-values').isVisible(),true,'Positive background has a continuous reference within the stated model');
  assert.ok(parseFloat(await page.locator('#reference-maximum-drag').textContent())>1.6);
  assert.ok(parseFloat(await page.locator('#reference-capacity-duration').textContent())>0);
  assert.equal(requested.some(url=>/231255|youtube\.com|\.mp4(?:\?|$)|\.webm(?:\?|$)/.test(url)),false,'No fourth Nolte still or movie permission is inherited');
  await figureKeys(page);await reflow(page);
  await page.locator('#lab-reference-title').scrollIntoViewIfNeeded();await capture(page,'wind-evidence-'+width+'-'+scheme);
 });
}

for(const width of [320,1280]){
 test('Laboratory native figure and source text doubles and reflows '+width,{timeout:45000},async t=>{
  const page=await fixture(t,{viewport:{width,height:900},colorScheme:width===320?'dark':'light',reducedMotion:'reduce',serviceWorkers:'block'});
  await page.goto(base+'/wind.html?event=udall-1955');await ready(page);await choose(page,ref('udall-1955'));await referenceIdentity(page,ref('udall-1955'));
  await figureKeys(page);
  const selectors=['#passage-plan-reading','#passage-chart-reading','#component-diagram-reading','.wind-key small','.lab-reference-caption','.lab-reference-rights'];
  const baseline=await Promise.all(selectors.map(selector=>page.locator(selector).first().evaluate(node=>{const r=node.getBoundingClientRect();return {font:parseFloat(getComputedStyle(node).fontSize),width:r.width,height:r.height};})));
  for(const m of baseline)assert.ok(m.font>=14&&m.width>0&&m.height>0);
  await page.evaluate(()=>{
   const nodes=[document.body,...document.body.querySelectorAll('*')].filter(node=>node instanceof HTMLElement);
   const fonts=nodes.map(node=>parseFloat(getComputedStyle(node).fontSize));
   nodes.forEach((node,i)=>{node.style.fontSize=fonts[i]*2+'px';});
  });
  await page.addStyleTag({content:'.figure-reading,.wind-key,.wind-key small,.lab-reference-figure figcaption p,.lab-reference-role,.lab-reference-boundary,.lab-reference-actions a{line-height:1.6!important;letter-spacing:.12em!important;word-spacing:.16em!important}.figure-reading,.lab-reference-figure figcaption p{margin-bottom:2em!important}'});
  const after=await Promise.all(selectors.map(selector=>page.locator(selector).first().evaluate(node=>{const s=getComputedStyle(node);return {font:parseFloat(s.fontSize),line:parseFloat(s.lineHeight),letter:parseFloat(s.letterSpacing),word:parseFloat(s.wordSpacing)};})));
  after.forEach((m,i)=>{assert.equal(m.font,baseline[i].font*2);assert.ok(Math.abs(m.line/m.font-1.6)<.01);assert.ok(Math.abs(m.letter/m.font-.12)<.01);assert.ok(Math.abs(m.word/m.font-.16)<.01);});
  await reflow(page);await referenceIdentity(page,ref('udall-1955'));await paused(page,'wind');
  await page.locator('#passage-plan-reading').scrollIntoViewIfNeeded();await capture(page,'wind-enlarged-'+width);
 });
}

for(const [width,scheme]of [[320,'light'],[1280,'dark']]){
 test('Form appearance and documentary selection preserve the bounded gap '+width+' '+scheme,{timeout:45000},async t=>{
  const page=await fixture(t,{viewport:{width,height:900},isMobile:width<600,colorScheme:scheme,reducedMotion:'reduce',serviceWorkers:'block'});
  // Observe the renderer's own request, without allocating a second context or changing its result.
  await page.addInitScript(()=>{
   const original=HTMLCanvasElement.prototype.getContext;
   window.__atlasFormContextObservation={attempted:false,available:null};
   HTMLCanvasElement.prototype.getContext=function(type,...args){
    const value=Reflect.apply(original,this,[type,...args]);
    if(type==='webgl2'&&this.id==='scene'&&!window.__atlasFormContextObservation.attempted)
     window.__atlasFormContextObservation={attempted:true,available:value!==null};
    return value;
   };
  });
  await page.goto(base+'/study.html?event=el-reno-2013');await ready(page);await choose(page,ref('el-reno-2013'));
  const capability=await page.evaluate(()=>window.__atlasFormContextObservation);
  assert.equal(capability.attempted,true);assert.equal(typeof capability.available,'boolean');
  t.diagnostic('FORM_CONTEXT_CAPABILITY '+JSON.stringify({width,scheme,webgl2_context_available:capability.available,scope:capability.available?'Actual gap drawing remains required; any optional image needs separate pixel review':'Unavailable-view controls/reference acceptance only; no drawn-form or theme-pixel acceptance'}));
  const formView=async()=>{
   if(capability.available){
    // A non-null context with a shader/link/initialization failure is still a failure.
    assert.equal(await page.locator('#scene-failure').isHidden(),true);
    await page.waitForFunction(()=>document.getElementById('scene').dataset.appearanceCoverage==='gap');
   }else{
    assert.equal(await page.locator('#scene-failure').isVisible(),true);
    assert.match(await page.locator('#scene-failure').innerText(),/This view needs WebGL 2/);
    assert.equal(await page.locator('#motion-status').textContent(),'WebGL 2 is unavailable');
    assert.equal(await page.locator('#motion').isDisabled(),true);
    assert.equal(await page.locator('#scene').getAttribute('data-appearance-coverage'),null);
   }
  };
  await page.locator('#shape').selectOption('rope');await input(page,'condensation',65);await input(page,'azimuth',-35);
  await page.locator('#quality').selectOption('3600');await page.locator('#sequence-coverage').selectOption('bounded');await page.locator('#sequence-enabled').check();await input(page,'sequence-time',.5);
  const expected=await formState(page);
  assert.equal(expected.controls['sequence-time'],'0.5');assert.equal(expected.controls.condensation,'65');
  assert.equal(expected.controls.azimuth,'-35');assert.match(expected.stage,/No assigned form between 10 and 22 seconds/);
  await page.locator('#scene').scrollIntoViewIfNeeded();await formView();
  await appearance(page,scheme);assert.deepEqual(await formState(page),expected);await paused(page,'form');await formView();
  await appearance(page,scheme==='dark'?'light':'dark');assert.deepEqual(await formState(page),expected);await paused(page,'form');await formView();
  await choose(page,ref('moore-2013'));await referenceIdentity(page,ref('moore-2013'));assert.deepEqual(await formState(page),expected);await formView();
  await choose(page,ref('blackwell-1955'));await referenceIdentity(page,ref('blackwell-1955'));assert.deepEqual(await formState(page),expected);await paused(page,'form');await formView();
  await readable(page,['.scene-overlay span','.lab-reference-caption','.lab-reference-rights']);
  const overlay=await page.locator('.scene-overlay').evaluate(node=>({position:getComputedStyle(node).position,inside:!!node.closest('.scene-wrap'),hidden:node.getAttribute('aria-hidden'),text:node.textContent}));
  assert.equal(overlay.position,'static');assert.equal(overlay.inside,false);assert.notEqual(overlay.hidden,'true');assert.match(overlay.text,/No historical time or physical scale/);
  await reflow(page);await page.locator('#scene').scrollIntoViewIfNeeded();await formView();
  await capture(page,(capability.available?'form-gap-':'form-unavailable-')+width+'-'+scheme);
 });
}

test('A delayed old reference response cannot replace the new selected image',{timeout:45000},async t=>{
 const page=await fixture(t,{viewport:{width:320,height:900},reducedMotion:'reduce',serviceWorkers:'block'});
 const old=ref('joplin-2011'),next=ref('el-reno-2013');
 let release,arrive,done,deliveryError=null;
 const held=new Promise(resolve=>{arrive=resolve;}),barrier=new Promise(resolve=>{release=resolve;}),finished=new Promise(resolve=>{done=resolve;});
 t.after(()=>release());
 await page.route('**/'+old.asset,async route=>{
  const response=await route.fetch();arrive();await barrier;
  try{await route.fulfill({response});}catch(error){deliveryError=String(error.message).slice(0,160);}finally{done();}
 });
 await page.goto(base+'/wind.html?event='+old.event);await ready(page);await held;
 assert.equal(await page.locator('#lab-reference-evidence').getAttribute('data-state'),'loading');
 const baseline=await windState(page);
 await choose(page,next);await referenceIdentity(page,next);
 release();await finished;await referenceIdentity(page,next);
 assert.deepEqual(await windState(page),baseline);await paused(page,'wind');
 console.log('# LAB_REFERENCE_RETIRED_RESPONSE '+JSON.stringify({old:old.event,current:next.event,lateFulfilRejected:deliveryError!==null}));
});

test('Failure followed by a different reference retries only the current source',{timeout:45000},async t=>{
 const page=await fixture(t,{viewport:{width:1280,height:900},colorScheme:'light',reducedMotion:'reduce',serviceWorkers:'block'});
 const old=ref('joplin-2011'),next=ref('moore-2013');let oldRequests=0,nextRequests=0,failNext=true;
 await page.route('**/'+old.asset,route=>{oldRequests++;return route.fulfill({status:503,contentType:'text/plain',body:'Controlled selected-image failure'});});
 await page.route('**/'+next.asset,route=>{nextRequests++;return failNext?route.fulfill({status:503,contentType:'text/plain',body:'Controlled new selected-image failure'}):route.continue();});
 await page.goto(base+'/wind.html?event='+old.event);await ready(page);
 await page.locator('#lab-reference-evidence[data-state="unavailable"]').waitFor();
 const previousRetry=await page.locator('#lab-reference-retry').elementHandle(),baseline=await windState(page);
 assert.equal(await page.locator('#lab-reference-image:visible').count(),0);
 routeIdentity(await page.locator('.lab-reference-actions').getByRole('link',{name:'Read the item source and permission',exact:true}).getAttribute('href'),old,'source',old.source);
 await page.locator('#lab-event').selectOption(next.event);
 await page.locator('#lab-reference-evidence[data-state="unavailable"][data-event="moore-2013"]').waitFor();
 assert.equal(await previousRetry.evaluate(node=>node.isConnected),false);
 assert.equal(await page.locator('#lab-reference-image:visible').count(),0);
 routeIdentity(await page.locator('.lab-reference-actions').getByRole('link',{name:'Read the item source and permission',exact:true}).getAttribute('href'),next,'source',next.source);
 const oldCount=oldRequests;failNext=false;
 await page.locator('#lab-reference-retry').focus();await page.locator('#lab-reference-retry').press('Enter');
 await page.locator('#lab-reference-evidence[data-state="ready"][data-event="moore-2013"]').waitFor();
 await referenceIdentity(page,next);assert.equal(oldRequests,oldCount);assert.equal(nextRequests,2);
 assert.deepEqual(await windState(page),baseline);await paused(page,'wind');await reflow(page);
});

for(const missing of ['createObjectURL','revokeObjectURL'])test('Missing '+missing+' refuses allocation while source navigation survives',{timeout:30000},async t=>{
 const page=await fixture(t,{viewport:{width:320,height:900},reducedMotion:'reduce',serviceWorkers:'block'});
 await page.addInitScript(missing=>{
  const create=URL.createObjectURL;window.labObjectURLsCreated=0;
  URL.createObjectURL=(...args)=>{window.labObjectURLsCreated++;return create.apply(URL,args);};
  URL[missing]=undefined;
 },missing);
 await page.goto(base+'/study.html?event=el-reno-2013');await ready(page);
 await page.locator('#lab-reference-evidence[data-state="unavailable"]').waitFor();
 assert.match(await page.locator('#lab-reference-status').innerText(),/Checked image display is unavailable/);
 assert.equal(await page.evaluate(()=>window.labObjectURLsCreated),0);
 assert.equal(await page.locator('#lab-reference-image:visible').count(),0);
 await page.locator('#lab-event').selectOption('moore-2013');
 await page.locator('#lab-reference-evidence[data-state="unavailable"][data-event="moore-2013"]').waitFor();
 routeIdentity(await page.locator('.lab-reference-actions').getByRole('link',{name:'Read the item source and permission',exact:true}).getAttribute('href'),ref('moore-2013'),'source','nws-event-hub');
 assert.equal(await page.evaluate(()=>window.labObjectURLsCreated),0);await paused(page,'form');
});

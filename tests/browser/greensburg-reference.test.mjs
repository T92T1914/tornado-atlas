import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fixture,base} from './harness.mjs';

// Independently declared from the reviewed documentary account and retained
// NCEI records. Do not derive expected words or identity from the lab adapter.
// This proposed revision must be reconciled with the final reviewed publisher
// output before admission. A later metadata change is not an automatic repin.
const GREEN={event:'greensburg-2007',observation:'kiowa-town-impact',source:'ncei-2007-retained',
 revision:'c4d47704a89025e2fc66e70ffe25eeaa30b9d77d863fc8abc55a6735f8bad937',
 title:'From homes south of town into Greensburg',
 sourceTitle:'NOAA NCEI Storm Events: two Greensburg county records',
 sourceURL:'https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/StormEvents_details-ftp_v1.0_d2007_c20260323.csv.gz',
 account:'The Kiowa record describes destroyed homes and a church south of Greensburg, then destruction across nearly 95 percent of the town. It reports 961 homes and businesses destroyed, 216 with major damage and 307 with minor damage. Its reported damage estimate is about $250 million including uninsured losses.',
 limits:'These are source reported damage categories and a nominal historical estimate. No independently assessed building inventory, present day value, complete local EF5 swath or uniform wind field is inferred.',
 rights:'Attributed paraphrase and original source links. No source photograph, figure, audio or film is copied or licensed by this record.'};
const MOORE={asset:'assets/moore-2013/IMG_9287-800.jpg',bytes:339582,
 sha256:'f10b6b33fbcecd2c228632d2d681bbef47e58876246b753a04721dda3a58c6bb',
 revision:'d7a6ec9d4ca0081f368bd2703c2b65ac3ba6e05dcabfc333029f42af87c1f654'};
const host='#lab-reference-evidence';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const read=path=>readFile(new URL('../../web/'+path,import.meta.url));
async function published(){
 const index=JSON.parse(await read('archive/index.json'));
 const entry=index.events.find(row=>row.id===GREEN.event);
 assert.ok(entry,'The independently reviewed Greensburg publication must exist');
 assert.equal(entry.dossier_sha256,GREEN.revision);
 assert.equal(entry.file,'archive/greensburg-2007-'+GREEN.revision.slice(0,20)+'.json');
 const bytes=await read(entry.file);assert.equal(hash(bytes),entry.file_sha256);
 const dossier=JSON.parse(bytes);
 assert.equal(dossier.observations.find(row=>row.id===GREEN.observation)?.account,GREEN.account);
 assert.equal(dossier.sources.find(row=>row.id===GREEN.source)?.url,GREEN.sourceURL);
 return {index,entry,bytes,dossier};
}
async function ready(page){await page.locator('#lab-context[data-experiment-ready="true"]').waitFor();}
async function greenReady(page){await page.locator(host+'[data-event="greensburg-2007"][data-state="ready"]').waitFor();}
async function input(page,id,value){
 await page.locator('#'+id).evaluate((node,value)=>{node.value=String(value);node.dispatchEvent(new Event('input',{bubbles:true}));},value);
}
async function paused(page,kind){
 for(const id of kind==='form'?['motion']:['wind-motion','passage-play','component-play'])
  assert.match(await page.locator('#'+id).textContent(),/^Play/);
}
async function state(page,kind){
 return page.evaluate(kind=>kind==='form'?{
  controls:Object.fromEntries(['shape','condensation','azimuth','elevation','distance','quality','sequence-coverage','sequence-rate','sequence-time'].map(id=>[id,document.getElementById(id).value])),
  switches:Object.fromEntries(['dust','sequence-enabled'].map(id=>[id,document.getElementById(id).checked])),
  stage:document.getElementById('sequence-stage').textContent
 }:{
  controls:Object.fromEntries(['peak','radius','background','probe-x','probe-y','area','coefficient','travel','offset','threshold','capacity','passage-time','component-time'].map(id=>[id,document.getElementById(id).value])),
  labels:Object.fromEntries(['probe-speed','probe-pressure','probe-force','passage-now','passage-force','passage-peak','passage-duration','component-now','component-peak','component-first','component-state'].map(id=>[id,document.getElementById(id).textContent])),
  graph:document.getElementById('passage-line').getAttribute('d'),
  rows:[205,206].map(i=>[...document.getElementById('passage-sample-'+i).cells].map(c=>[c.textContent,c.dataset.value??null])),
  selected:[...document.querySelectorAll('#sampled-values-body tr[aria-current="true"]')].map(row=>row.id),
  count:document.querySelectorAll('#sampled-values-body tr').length
 },kind);
}
async function configure(page,kind){
 if(kind==='form'){
  await page.locator('#sequence-enabled').uncheck();await page.locator('#shape').selectOption('rope');
  for(const [id,value]of Object.entries({condensation:65,azimuth:-35,elevation:24,distance:8.2}))await input(page,id,value);
  await page.locator('#dust').uncheck();await page.locator('#quality').selectOption('3600');
  await page.locator('#sequence-coverage').selectOption('bounded');await page.locator('#sequence-rate').selectOption('15');
  await page.locator('#sequence-enabled').check();await input(page,'sequence-time',.5);
  const result=await state(page,kind);assert.equal(result.controls.condensation,'65');
  assert.equal(result.controls['sequence-time'],'0.5');assert.match(result.stage,/No assigned form between 10 and 22 seconds/);
 }else{
  const values={peak:145,radius:650,background:15,'probe-x':-.8,'probe-y':1.3,area:2.4,coefficient:1.1,travel:35,offset:-.7,threshold:95,capacity:1.6};
  for(const [id,value]of Object.entries(values))await input(page,id,value);
  await input(page,'component-time',205);const result=await state(page,kind);
  for(const [id,value]of Object.entries(values))assert.equal(result.controls[id],String(value));
  assert.equal(result.controls['passage-time'],'205');assert.equal(result.controls['component-time'],'205');
  assert.equal(result.count,481);assert.deepEqual(result.selected,['passage-sample-205']);
 }
}
function route(href,field,id,revision=GREEN.revision){
 const url=new URL(href,base);assert.equal(url.origin,new URL(base).origin);assert.equal(url.pathname,'/dossier.html');
 assert.deepEqual([...url.searchParams],Object.entries({event:GREEN.event,[field]:id,...(revision?{revision}:{})}));
 assert.equal(url.hash,'#'+field+'-'+id);
}
async function identity(page){
 const h=page.locator(host);assert.equal(await h.getAttribute('data-state'),'ready');
 assert.equal(await h.getAttribute('data-event'),GREEN.event);assert.equal(await h.getAttribute('data-observation-id'),GREEN.observation);
 assert.equal(await h.getAttribute('data-media-id'),null);assert.equal(await h.getAttribute('aria-busy'),'false');
 assert.equal(await h.locator('#lab-reference-title').textContent(),GREEN.title);
 assert.equal(await h.locator('.lab-reference-caption').textContent(),GREEN.account);
 assert.equal(await h.locator('.lab-reference-limits').textContent(),GREEN.limits);
 assert.equal(await h.locator('.lab-reference-credit').textContent(),'Source: '+GREEN.sourceTitle);
 assert.equal(await h.locator('.lab-reference-rights').textContent(),GREEN.rights);
 assert.equal(await h.locator('.lab-reference-boundary').textContent(),'This account records reported destruction. It supplies no historical funnel geometry, camera or measured wind field.');
 assert.equal(await h.locator('img,figure,video,audio,iframe').count(),0);
 route(await h.getByRole('link',{name:'Inspect the observation and its limits',exact:true}).getAttribute('href'),'observation',GREEN.observation);
 route(await h.getByRole('link',{name:'Read the source record',exact:true}).getAttribute('href'),'source',GREEN.source);
 assert.equal(await h.getByRole('link',{name:'Read this item in its article',exact:true}).getAttribute('href'),base+'/greensburg.html#path-and-impact');
 const original=h.getByRole('link',{name:'Open the original source',exact:true});
 assert.equal(await original.getAttribute('href'),GREEN.sourceURL);assert.equal(await original.getAttribute('target'),'_blank');
 assert.deepEqual((await original.getAttribute('rel')).split(/\s+/).sort(),['noopener','noreferrer']);
 assert.equal(await h.locator('#lab-reference-retry').isHidden(),true);
}
async function observeAllocations(page){
 const requests=[];page.on('request',request=>requests.push({url:request.url(),kind:request.resourceType()}));
 await page.addInitScript(()=>{
  window.__greensburgAllocation={objectURLs:0,images:0};
  const create=URL.createObjectURL,element=document.createElement;
  if(typeof create==='function')URL.createObjectURL=function(...args){window.__greensburgAllocation.objectURLs++;return Reflect.apply(create,this,args);};
  document.createElement=function(name,...args){if(String(name).toLowerCase()==='img')window.__greensburgAllocation.images++;return Reflect.apply(element,this,[name,...args]);};
 });
 return async()=>{
  assert.deepEqual(await page.evaluate(()=>window.__greensburgAllocation),{objectURLs:0,images:0});
  assert.deepEqual(requests.filter(r=>['image','media'].includes(r.kind)||r.url.startsWith('blob:')||new URL(r.url).origin!==new URL(base).origin),[],'No image, media, Blob or original-provider request for source-only evidence');
  assert.equal(requests.filter(r=>r.url===base+'/archive/index.json').length,1);
  assert.equal(requests.filter(r=>r.url===base+'/archive/greensburg-2007-'+GREEN.revision.slice(0,20)+'.json').length,1);
 };
}
async function reflow(page){
 const actual=await page.locator(host).evaluate(root=>({viewport:innerWidth,document:document.documentElement.scrollWidth,
  outside:[...root.querySelectorAll('h2,#lab-reference-title,p,a,button')].flatMap(node=>{
   const range=document.createRange();range.selectNodeContents(node);
   return [...range.getClientRects()].filter(r=>r.width>0&&(r.left< -1||r.right>innerWidth+1)).map(r=>({text:node.textContent.slice(0,80),left:r.left,right:r.right}));
  }),
  paragraphs:[...root.querySelectorAll('.lab-reference-observation p')].map(node=>{
   const r=node.getBoundingClientRect(),s=getComputedStyle(node);return{top:r.top,bottom:r.bottom,height:r.height,font:parseFloat(s.fontSize),client:node.clientHeight,scroll:node.scrollHeight,overflow:s.overflowY};
  })
 }));
 assert.ok(actual.document<=actual.viewport+1,JSON.stringify(actual));assert.deepEqual(actual.outside,[]);
 assert.equal(actual.paragraphs.length,4);
 actual.paragraphs.forEach((row,i)=>{assert.ok(row.height>0&&row.font>=14);if(i)assert.ok(row.top>=actual.paragraphs[i-1].bottom-1,'Account paragraphs do not overlap');if(['hidden','clip'].includes(row.overflow))assert.ok(row.scroll<=row.client+1);});
}
async function keyboardReturn(page,kind,label,expected){
 const link=page.locator(host).getByRole('link',{name:label,exact:true}),destination=await link.getAttribute('href');
 await page.locator('#lab-share').click();await paused(page,kind);
 const saved=page.url();assert.equal(await page.locator('#lab-share').getAttribute('href'),saved);
 await link.evaluate(node=>{
  const records=[];sessionStorage.removeItem('__greensburgKeyboard');
  // Capture the document's whole activation sequence, including an unexpected
  // event sent elsewhere. A hidden extra event must not disappear from the oracle.
  for(const type of ['keydown','click','keyup'])document.addEventListener(type,event=>{
   records.push({type:event.type,trusted:event.isTrusted,key:event.key??null,detail:event.detail??null,
    href:node.href,targetIsLink:event.target===node,focused:document.activeElement===node,
    repeat:event.repeat??null,alt:event.altKey,ctrl:event.ctrlKey,meta:event.metaKey,shift:event.shiftKey});
   sessionStorage.setItem('__greensburgKeyboard',JSON.stringify(records));
  },true);
 });
 await link.focus();assert.equal(await link.evaluate(node=>document.activeElement===node),true);
 const commits=[],onCommit=frame=>{if(frame===page.mainFrame())commits.push(frame.url());};
 page.on('framenavigated',onCommit);
 let gesture;
 try{
  await page.keyboard.press('Enter');await page.waitForURL(destination);assert.equal(page.url(),destination);
  const target=new URL(destination);await page.locator(target.hash).waitFor();
  gesture=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('__greensburgKeyboard')));
  assert.ok(Array.isArray(gesture)&&[2,3].includes(gesture.length),JSON.stringify(gesture));
  assert.deepEqual(gesture.map(row=>row.type),gesture.length===2?['keydown','click']:['keydown','click','keyup']);
  assert.equal(gesture[0].key,'Enter');assert.equal(gesture[0].repeat,false);assert.equal(gesture[1].key,null);
  if(gesture.length===3){assert.equal(gesture[2].key,'Enter');assert.equal(gesture[2].repeat,false);}
  assert.ok(gesture.every(row=>row.trusted&&row.href===destination&&row.targetIsLink&&row.focused&&
   !row.alt&&!row.ctrl&&!row.meta&&!row.shift),JSON.stringify(gesture));
  assert.deepEqual(commits,[destination],'One trusted Enter activation commits exactly one destination');
 }finally{page.off('framenavigated',onCommit);}
 // Native click.detail differs between engines. It is retained as a diagnostic,
 // not substituted for the ordered trusted events and exact single commit.
 await page.goBack();await ready(page);await greenReady(page);
 assert.equal(page.url(),saved);assert.equal(await page.locator('#lab-share').getAttribute('href'),saved);
 assert.deepEqual(await state(page,kind),expected);await paused(page,kind);await identity(page);
 // Explicit focus below checks return-link focusability. It does not establish
 // automatic browser focus restoration after Back.
 await page.locator(host).getByRole('link',{name:label,exact:true}).focus();
 assert.equal(await page.locator(host).getByRole('link',{name:label,exact:true}).evaluate(node=>document.activeElement===node),true);
 return {events:gesture,commits,returnFocus:'explicit focusability only'};
}

for(const kind of ['form','wind'])for(const [width,scheme]of [[320,'light'],[1280,'dark']])
test('Greensburg source-only '+kind+' preserves assumptions and keyboard return '+width+' '+scheme,{timeout:60000},async t=>{
 await published();const page=await fixture(t,{viewport:{width,height:900},isMobile:width<600,colorScheme:scheme,reducedMotion:'reduce',serviceWorkers:'block'});
 const sourceOnly=await observeAllocations(page),file=kind==='form'?'study.html':'wind.html';
 await page.goto(base+'/'+file);await ready(page);assert.equal(await page.locator(host).isHidden(),true);
 await configure(page,kind);const expected=await state(page,kind);
 const before=new URL(await page.locator('#lab-share').getAttribute('href'));
 await page.locator('#lab-event').selectOption(GREEN.event);await greenReady(page);await identity(page);
 const after=new URL(await page.locator('#lab-share').getAttribute('href'));
 after.searchParams.delete('event');before.searchParams.delete('event');assert.equal(after.href,before.href);
 assert.deepEqual(await state(page,kind),expected);await paused(page,kind);await sourceOnly();
 await page.locator('#reading-appearance:not([disabled])').waitFor();await page.locator('#reading-appearance').selectOption(scheme);
 assert.equal(await page.locator('html').getAttribute('data-appearance'),scheme);await reflow(page);
 if(width===320){
  await page.locator(host).evaluate(root=>{
   const rows=[...root.querySelectorAll('h2,#lab-reference-title,p,a,button')].map(node=>[node,parseFloat(getComputedStyle(node).fontSize)]);
   rows.forEach(([node,size])=>{node.style.fontSize=size*2+'px';node.style.lineHeight='1.6';node.style.letterSpacing='.12em';node.style.wordSpacing='.16em';});
  });
  await reflow(page);await identity(page);assert.deepEqual(await state(page,kind),expected);
 }
 const label=kind==='form'?(width===320?'Inspect the observation and its limits':'Read this item in its article'):'Read the source record';
 const gesture=await keyboardReturn(page,kind,label,expected);
 t.diagnostic('Greensburg source-only keyboard control '+JSON.stringify({kind,width,scheme,gesture,scope:'Documentary account and navigation only; no rendered tornado or physical-device acceptance'}));
});

test('Both laboratories keep ordinary Greensburg reading without scripts',{timeout:45000},async t=>{
 const page=await fixture(t,{javaScriptEnabled:false,viewport:{width:320,height:900},serviceWorkers:'block'});
 for(const file of ['study.html','wind.html']){
  await page.goto(base+'/'+file+'?event=greensburg-2007&experiment=wind-1&peak=200');
  assert.equal(await page.locator('#lab-enhancement').isVisible(),false);assert.equal(await page.locator(host).count(),0);
  assert.match(await page.locator('#lab-context noscript').textContent(),/need JavaScript to restore settings/);
  const link=page.locator('#lab-documentary-fallback a[href="greensburg.html"]');
  assert.equal(await link.count(),1);assert.equal(await link.isVisible(),true);assert.match(await link.textContent(),/Greensburg/);
  if(file==='wind.html'){assert.equal(await page.locator('#sampled-values-body tr').count(),481);assert.match(await page.locator('#sampled-values-static').textContent(),/default experiment/);}
  await link.focus();await page.keyboard.press('Enter');await page.waitForURL(base+'/greensburg.html');
  assert.equal(await page.locator('#path-and-impact').isVisible(),true);
  await page.goBack();assert.equal(await page.locator('#lab-documentary-fallback a[href="greensburg.html"]').isVisible(),true);
 }
});

for(const mutation of ['different-source-url','expanded-rights'])
test('Hash-matching Greensburg '+mutation+' is refused before account display and retries explicitly',{timeout:45000},async t=>{
 const current=await published(),changed=structuredClone(current.dossier),index=structuredClone(current.index);
 if(mutation==='different-source-url')changed.sources.find(row=>row.id===GREEN.source).url='https://www.weather.gov/ict/';
 else changed.observations.find(row=>row.id===GREEN.observation).status.rights='permitted_hosting';
 const body=Buffer.from(JSON.stringify(changed));index.events.find(row=>row.id===GREEN.event).file_sha256=hash(body);
 // Deliberately change this controlled index's byte association. Complete
 // schema and valid bytes reach the narrower source/rights contract. This is
 // not a claim that a modified fixture is an authentic historical publication.
 const page=await fixture(t,{viewport:{width:320,height:900},reducedMotion:'reduce',serviceWorkers:'block'});
 let refuse=true,dossierRequests=0;
 await page.route('**/archive/index.json',r=>refuse?r.fulfill({contentType:'application/json',body:JSON.stringify(index)}):r.continue());
 await page.route('**/'+current.entry.file,r=>{dossierRequests++;return refuse?r.fulfill({contentType:'application/json',body}):r.continue();});
 await page.goto(base+'/wind.html?event=greensburg-2007');await ready(page);
 await page.locator(host+'[data-state="unavailable"]').waitFor();const retained=await state(page,'wind');
 assert.equal(await page.locator('#lab-reference-status').textContent(),'The documentary account could not be checked. The selected observation no longer has its expected documentary source, status and links only basis. The article and source records remain available.');
 assert.equal(await page.locator(host+' .lab-reference-observation,'+host+' img').count(),0);
 route(await page.locator(host).getByRole('link',{name:'Read the source record',exact:true}).getAttribute('href'),'source',GREEN.source,null);
 assert.equal(await page.locator(host).getByRole('link',{name:'Read this item in its article',exact:true}).getAttribute('href'),base+'/greensburg.html#path-and-impact');
 assert.equal(dossierRequests,1);refuse=false;
 await page.locator('#lab-reference-retry').focus();await page.keyboard.press('Enter');await greenReady(page);await identity(page);
 assert.equal(dossierRequests,2);assert.equal(await page.locator('#lab-reference-title').evaluate(node=>document.activeElement===node),true);
 assert.deepEqual(await state(page,'wind'),retained);await paused(page,'wind');
});

test('A retired Greensburg account cannot replace the selected checked photograph',{timeout:45000},async t=>{
 const current=await published();let page;
 // Release the one controlled delay before fixture closes its owned context.
 t.after(async()=>{if(page&&!page.isClosed())await page.evaluate(()=>window.__greensburgHold?.release?.());});
 page=await fixture(t,{viewport:{width:320,height:900},reducedMotion:'reduce',serviceWorkers:'block'});
 await page.addInitScript(({file,bytes})=>{
  const nativeFetch=window.fetch,digest=crypto.subtle.digest;
  const held=window.__greensburgHold={state:'waiting',release:null,digestSettled:false,signalAborted:false};
  crypto.subtle.digest=async function(algorithm,data){
   const result=await Reflect.apply(digest,this,[algorithm,data]);
   if(held.state==='released'&&data.byteLength===bytes)held.digestSettled=true;
   return result;
  };
  window.fetch=async function(input,options){
   const response=await Reflect.apply(nativeFetch,this,[input,options]);
   const url=new URL(typeof input==='string'?input:input.url,location.href);
   if(url.pathname!=='/'+file||held.state!=='waiting')return response;
   const retained=await response.arrayBuffer(),headers=[...response.headers],status=response.status;
   held.state='held';held.bytes=retained.byteLength;held.status=status;
   await new Promise(resolve=>{held.release=resolve;});held.state='released';held.signalAborted=options?.signal?.aborted??false;
   return new Response(retained,{status,headers});
  };
 },{file:current.entry.file,bytes:current.bytes.length});
 await page.goto(base+'/wind.html?event=greensburg-2007');await ready(page);
 await page.waitForFunction(()=>window.__greensburgHold.state==='held');
 assert.deepEqual(await page.evaluate(()=>({bytes:window.__greensburgHold.bytes,status:window.__greensburgHold.status})),{bytes:current.bytes.length,status:200});
 assert.equal(await page.locator(host).getAttribute('data-state'),'loading');const retained=await state(page,'wind');
 await page.locator('#lab-event').selectOption('moore-2013');await page.locator(host+'[data-event="moore-2013"][data-state="ready"]').waitFor();
 const photograph=async()=>{
  const result=await page.locator('#lab-reference-image').evaluate(async node=>{
   await node.decode();const bytes=await(await fetch(node.currentSrc)).arrayBuffer();
   return{bytes:bytes.byteLength,sha256:[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join(''),width:node.naturalWidth,height:node.naturalHeight};
  });
  assert.deepEqual(result,{bytes:MOORE.bytes,sha256:MOORE.sha256,width:800,height:533});
  assert.equal(await page.locator(host).getAttribute('data-event'),'moore-2013');
  assert.equal(await page.locator(host).getAttribute('data-observation-id'),null);
  assert.equal(await page.locator(host).getAttribute('data-media-id'),'moore-medical-center-survey');
  const source=new URL(await page.locator(host).getByRole('link',{name:'Read the item source and permission',exact:true}).getAttribute('href'));
  assert.equal(source.origin,new URL(base).origin);assert.equal(source.pathname,'/dossier.html');
  assert.deepEqual([...source.searchParams],Object.entries({event:'moore-2013',source:'nws-event-hub',revision:MOORE.revision}));
  assert.equal(source.hash,'#source-nws-event-hub');assert.equal(await page.locator(host+' .lab-reference-observation').count(),0);
 };
 await photograph();await page.evaluate(()=>window.__greensburgHold.release());
 await page.waitForFunction(()=>window.__greensburgHold.digestSettled);
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 assert.equal(await page.evaluate(()=>window.__greensburgHold.signalAborted),true);
 await photograph();assert.deepEqual(await state(page,'wind'),retained);await paused(page,'wind');
 t.diagnostic('Controlled fully read response delivered after selection retirement. Native abort timing and BFCache behavior remain covered separately by the maintained lifecycle suite.');
});

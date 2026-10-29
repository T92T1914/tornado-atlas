import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fixture,base} from './harness.mjs';

// These source identities and seven pairs come from the retained complete
// NOAA/NIST figure review, independently of the controller's configuration.
const asset='assets/joplin-2011/nist-radar-sequence.png';
const expectedSha='8d00dd1d87fc1607f855282337b5d1ee9b7d9f35605a5c28d691841e1b77cbd3';
const expectedBytes=1222331;
const pairs=[
 {label:'2224 UTC',gap:null,box:[67,8,396,267]},
 {label:'2229 UTC',gap:5,box:[475,8,398,267]},
 {label:'2234 UTC',gap:5,box:[67,273,396,266]},
 {label:'2239 UTC',gap:5,box:[475,273,398,266]},
 {label:'2243 UTC',gap:4,box:[67,536,396,266]},
 {label:'2248 UTC',gap:5,box:[475,536,398,266]},
 {label:'2253 UTC',gap:5,box:[67,798,396,266]},
];
const card=page=>page.locator('[data-recorded-observations="joplin-nist-seven"]');
const play=page=>card(page).locator('[data-observation-play]');
const picker=page=>card(page).locator('[data-observation-picker]');
const stage=page=>card(page).locator('[data-observation-stage]');
const status=page=>card(page).locator('[data-observation-status]');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const sourceRecord='dossier.html?event=joplin-2011&media=nist-joplin-radar-sequence#media-nist-joplin-radar-sequence';

async function open(page){
 const href=base+'/joplin.html?context=observations&t=73&source=retained#joplin-observation-heading';
 await page.goto(href);await play(page).waitFor({state:'visible'});await page.evaluate(()=>document.fonts.ready);
 return href;
}
async function stable(page){return page.evaluate(()=>({href:location.href,length:history.length,state:history.state,t:new URL(location.href).searchParams.get('t'),source:new URL(location.href).searchParams.get('source')}));}
async function shown(page,index){
 await page.waitForFunction(i=>{
  const root=document.querySelector('[data-recorded-observations="joplin-nist-seven"]'),stage=root?.querySelector('[data-observation-stage]'),svg=stage?.querySelector('svg');
  return stage&&!stage.hidden&&svg?.dataset.observationIndex===String(i)&&svg.querySelector('image')?.getAttribute('href')?.startsWith('blob:');
 },index);
 const actual=await stage(page).locator('svg').evaluate(node=>({viewBox:node.getAttribute('viewBox').trim().split(/\s+/).map(Number),asset:node.dataset.sourceAsset,sha:node.dataset.sourceSha256,index:node.dataset.observationIndex,href:node.querySelector('image').getAttribute('href'),width:node.querySelector('image').getAttribute('width'),height:node.querySelector('image').getAttribute('height'),title:node.querySelector('title').textContent}));
 assert.deepEqual(actual.viewBox,pairs[index].box);assert.equal(actual.asset,asset);assert.equal(actual.sha,expectedSha);assert.equal(actual.index,String(index));
 assert.equal(actual.width,'947');assert.equal(actual.height,'1326');assert.match(actual.title,/radial velocity at left and reflectivity at right/);
 const label=await card(page).locator('[data-observation-label]').textContent();
 assert.ok(label.includes(pairs[index].label));assert.match(label,/May 22, 2011/);
 if(pairs[index].gap===null)assert.match(label,/First retained observation/);else assert.ok(label.includes(pairs[index].gap+' minutes after'));
 return actual;
}
function sourceBodies(page){
 const tasks=[],proofs=[],failures=[],requests=[];
 page.on('request',request=>{if(request.url()===base+'/'+asset&&request.resourceType()==='fetch')requests.push(request.url());});
 page.on('response',response=>{
  if(response.url()!==base+'/'+asset||response.request().resourceType()!=='fetch'||response.status()!==200)return;
  tasks.push((async()=>{assert.equal(await response.finished(),null);const bytes=await response.body();assert.equal(bytes.length,expectedBytes);assert.equal(sha(bytes),expectedSha);proofs.push({bytes:bytes.length,sha256:sha(bytes),status:response.status()});})().catch(error=>failures.push(error.message)));
 });
 return {requests,proofs,async drain(){await Promise.all(tasks);assert.deepEqual(failures,[],'The actual checked-source response matches its retained original');}};
}
async function blobProof(page,href){
 return page.evaluate(async source=>{
  const response=await fetch(source);if(!response.ok)throw Error('Displayed Blob response failed');
  const bytes=await response.arrayBuffer(),digest=await crypto.subtle.digest('SHA-256',bytes),blob=new Blob([bytes],{type:'image/png'});
  const bitmap=await createImageBitmap(blob);try{return {bytes:bytes.byteLength,sha:[...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join(''),dimensions:[bitmap.width,bitmap.height]};}finally{bitmap.close();}
 },href);
}
async function preservedFigure(page){
 const original=page.locator('a[data-photo-id="nist-joplin-radar-sequence"]');
 assert.equal(await original.getAttribute('href'),asset);
 assert.equal(await original.locator('img').getAttribute('src'),asset);
 assert.equal(await original.locator('img').getAttribute('width'),'947');assert.equal(await original.locator('img').getAttribute('height'),'1326');
 assert.match(await original.locator('..').locator('figcaption').textContent(),/complete seven-pair figure, annotations, source credit and original caption/);
 assert.equal(await card(page).locator('a[href="'+sourceRecord+'"]').count(),1);
}

for(const [width,appearance]of [[390,'dark'],[1280,'light']])test('Joplin seven checked source-pair views and controlled pacing '+width+' '+appearance,{timeout:45000},async t=>{
 const page=await fixture(t,{viewport:{width,height:900},colorScheme:appearance,reducedMotion:'reduce',serviceWorkers:'block'}),native=sourceBodies(page);
 const href=await open(page),initial=await stable(page);
 await page.locator('#reading-appearance').selectOption(appearance);
 assert.equal(await page.locator('html').getAttribute('data-appearance'),appearance,'The requested reading appearance is actually selected');
 assert.equal(await stage(page).isVisible(),false);assert.deepEqual(native.requests,[],'No checked-source motion fetch occurs before a deliberate choice');
 await preservedFigure(page);
 let admittedHref=null;
 for(let index=0;index<pairs.length;index++){
  await picker(page).selectOption(String(index));const actual=await shown(page,index);
  assert.equal(await play(page).getAttribute('aria-pressed'),'false');
  if(admittedHref===null){admittedHref=actual.href;const proof=await blobProof(page,admittedHref);assert.deepEqual(proof,{bytes:expectedBytes,sha:expectedSha,dimensions:[947,1326]});}
  else assert.equal(actual.href,admittedHref,'Manual comparison reuses the same admitted complete source bytes');
  await stage(page).scrollIntoViewIfNeeded();
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'The reading controls and complete pair reflow without document overflow');
  const size=await stage(page).locator('svg').evaluate(node=>{const r=node.getBoundingClientRect();return {width:r.width,height:r.height};});
  assert.ok(Math.abs(size.width/size.height-pairs[index].box[2]/pairs[index].box[3])<.02,'The source-pair viewport retains its complete ratio');
  if(process.env.ATLAS_JOPLIN_OBSERVATION_CAPTURE){
   await mkdir(process.env.ATLAS_JOPLIN_OBSERVATION_CAPTURE,{recursive:true});
   await stage(page).screenshot({path:path.join(process.env.ATLAS_JOPLIN_OBSERVATION_CAPTURE,`joplin-pair-${index}-${width}-${appearance}.png`)});
  }
  assert.deepEqual(await stable(page),initial,'Manual observation display preserves the complete native route and history');
 }
 await native.drain();assert.equal(native.proofs.length,1);assert.equal(native.requests.length,1);
 await card(page).locator('[data-observation-prev]').focus();await page.keyboard.press('Enter');await shown(page,5);
 await card(page).locator('[data-observation-next]').focus();await page.keyboard.press('Enter');await shown(page,6);
 await play(page).focus();await page.keyboard.press('Enter');await shown(page,0);
 assert.equal(await play(page).getAttribute('aria-pressed'),'true');
 await page.waitForFunction(()=>document.querySelector('[data-observation-stage] svg')?.dataset.observationIndex==='6'&&document.querySelector('[data-observation-play]')?.getAttribute('aria-pressed')==='false'&&document.querySelector('[data-observation-status]')?.textContent.includes('seventh retained pair'),{},{timeout:13000});
 await shown(page,6);assert.deepEqual(await stable(page),initial);assert.equal(native.requests.length,1);
 await play(page).click();await shown(page,0);await play(page).click();await shown(page,0);assert.equal(await play(page).getAttribute('aria-pressed'),'false');

 await page.emulateMedia({reducedMotion:'no-preference'});await play(page).click();assert.equal(await play(page).getAttribute('aria-pressed'),'true');
 await page.emulateMedia({reducedMotion:'reduce'});await shown(page,0);assert.equal(await play(page).getAttribute('aria-pressed'),'false');assert.match(await status(page).textContent(),/reduced motion/);
 await play(page).click();await page.evaluate(()=>scrollTo(0,0));
 await page.waitForFunction(()=>document.querySelector('[data-observation-play]')?.getAttribute('aria-pressed')==='false');assert.match(await status(page).textContent(),/out of view/);

 await picker(page).scrollIntoViewIfNeeded();await picker(page).selectOption('5');await shown(page,5);
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));delete document.hidden;});
 await shown(page,0);assert.match(await status(page).textContent(),/page was hidden/);assert.equal(await play(page).getAttribute('aria-pressed'),'false');
 await page.evaluate(()=>{for(const node of document.querySelectorAll('[data-recorded-observations] h4,[data-recorded-observations] p,[data-recorded-observations] label,[data-recorded-observations] button,[data-recorded-observations] select,[data-recorded-observations] figcaption'))node.style.fontSize=parseFloat(getComputedStyle(node).fontSize)*2+'px';});
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Enlarged controls, source identity and captions remain in document order');
 assert.deepEqual(await stable(page),initial);
 await card(page).getByRole('link',{name:'Item identity, clocks and reuse',exact:true}).click();
 const record=page.locator('#media-nist-joplin-radar-sequence');await record.waitFor();assert.match(await record.textContent(),/selected report snapshots/);
 await record.getByRole('link',{name:'Inspect the source card',exact:true}).click();await page.locator('#source-nist-joplin-radar-sequence').waitFor();
 await page.goBack();await record.waitFor();await page.goBack();await play(page).waitFor({state:'visible'});
 assert.equal(page.url(),href);assert.equal(await play(page).getAttribute('aria-pressed'),'false');
 assert.equal(new URL(page.url()).searchParams.get('t'),'73');assert.equal(new URL(page.url()).searchParams.get('source'),'retained');
 t.diagnostic(JSON.stringify({width,appearance,source_body:native.proofs[0],displayed_candidate_pairs:pairs.map((pair,index)=>({index,...pair})),scope:'Actual checked PNG and seven SVG source-pair views. Captures require separate individual inspection; no continuous radar interval, measured cadence or physical-phone claim.'}));
});

test('Joplin source refusal, wrong bytes and truncated bytes keep the complete static figure and permit exact retry',{timeout:25000},async t=>{
 const page=await fixture(t,{viewport:{width:390,height:900},reducedMotion:'reduce',serviceWorkers:'block'}),original=await readFile(new URL('../../web/'+asset,import.meta.url));
 assert.equal(sha(original),expectedSha);let failure='http';const seen=[];
 await page.route('**/'+asset,route=>{
  if(route.request().resourceType()!=='fetch')return route.continue();seen.push(failure);
  if(failure==='http')return route.fulfill({status:503,contentType:'text/plain',body:'Controlled source refusal'});
  if(failure==='truncated')return route.fulfill({status:200,contentType:'image/png',body:original.subarray(0,512)});
  if(failure==='wrong'){const wrong=Buffer.from(original);wrong[wrong.length-1]^=1;return route.fulfill({status:200,contentType:'image/png',body:wrong});}
  return route.continue();
 });
 await open(page);const before=await stable(page);
 for(failure of ['http','wrong','truncated']){
  await play(page).click();await page.waitForFunction(()=>document.querySelector('[data-observation-status]')?.textContent.includes('could not be checked or displayed'));
  assert.equal(await stage(page).isVisible(),false);assert.equal(await play(page).getAttribute('aria-pressed'),'false');
  await preservedFigure(page);assert.deepEqual(await stable(page),before);
 }
 failure='positive';const native=sourceBodies(page);await play(page).click();const actual=await shown(page,0);await native.drain();assert.equal(native.proofs.length,1);
 assert.deepEqual(await blobProof(page,actual.href),{bytes:expectedBytes,sha:expectedSha,dimensions:[947,1326]});
 await play(page).click();assert.deepEqual(seen,['http','wrong','truncated','positive']);assert.deepEqual(await stable(page),before);
 t.diagnostic('Three controlled failed attempts remain failures. The following native positive source body is verified separately.');
});

test('a retired complete-source digest cannot replace a newer admitted observation',{timeout:20000},async t=>{
 const page=await fixture(t,{viewport:{width:1280,height:900},reducedMotion:'reduce',serviceWorkers:'block'});
 await page.addInitScript(()=>{
  const digest=crypto.subtle.digest.bind(crypto.subtle);let first=true;
  crypto.subtle.digest=async function(algorithm,bytes){const value=await digest(algorithm,bytes);if(first&&bytes.byteLength===1222331){first=false;window.joplinDigestHeld=true;await new Promise(resolve=>{window.releaseJoplinDigest=()=>{window.joplinDigestReleased=true;resolve();};});}return value;};
 });
 const native=sourceBodies(page);await open(page);const before=await stable(page);await play(page).click();
 await page.waitForFunction(()=>window.joplinDigestHeld===true);await play(page).click();await picker(page).selectOption('5');
 const current=await shown(page,5),message=await status(page).textContent();
 await page.evaluate(()=>window.releaseJoplinDigest());await page.waitForFunction(()=>window.joplinDigestReleased===true);
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 assert.deepEqual(await shown(page,5),current);assert.equal(await status(page).textContent(),message);assert.equal(await play(page).getAttribute('aria-pressed'),'false');
 await native.drain();assert.equal(native.proofs.length,2);assert.deepEqual(await stable(page),before);
 t.diagnostic('Controlled late completion after two complete native source bodies, not an incomplete-request success.');
});

for(const boundary of ['load','svg'])test('retired Joplin '+boundary+' callbacks cannot commit or retain owned URLs',{timeout:20000},async t=>{
 const page=await fixture(t,{viewport:{width:1280,height:900},reducedMotion:'reduce',serviceWorkers:'block'});
 await page.addInitScript(mode=>{
  window.joplinRetired=[];window.joplinAllocated=[];window.joplinRevoked=[];
  const create=URL.createObjectURL.bind(URL),revoke=URL.revokeObjectURL.bind(URL);
  URL.createObjectURL=value=>{const result=create(value);window.joplinAllocated.push(result);return result;};URL.revokeObjectURL=value=>{window.joplinRevoked.push(value);return revoke(value);};
  if(mode==='load'){
   const descriptor=Object.getOwnPropertyDescriptor(HTMLImageElement.prototype,'src');
   Object.defineProperty(HTMLImageElement.prototype,'src',{...descriptor,set(value){if(String(value).startsWith('blob:')){window.joplinRetired.push({node:this,load:this.onload,error:this.onerror});return;}return descriptor.set.call(this,value);}});
  }else{
   const set=SVGImageElement.prototype.setAttribute;
   SVGImageElement.prototype.setAttribute=function(name,value){if(name==='href'&&String(value).startsWith('blob:')){window.joplinRetired.push({node:this,load:this.onload,error:this.onerror});return;}return set.call(this,name,value);};
  }
 },boundary);
 const native=sourceBodies(page);await open(page);const before=await stable(page);
 await play(page).click();await page.waitForFunction(()=>window.joplinRetired.length===1);await play(page).click();
 await play(page).click();await page.waitForFunction(()=>window.joplinRetired.length===2);const pending=await status(page).textContent();
 await page.evaluate(async()=>{const old=window.joplinRetired[0];await old.load.call(old.node);old.error.call(old.node);});
 assert.equal(await status(page).textContent(),pending);assert.equal(await stage(page).isVisible(),false);assert.equal(await play(page).getAttribute('aria-pressed'),'true');
 await play(page).click();const stopped=await status(page).textContent();
 await page.evaluate(async()=>{const old=window.joplinRetired[1];await old.load.call(old.node);old.error.call(old.node);window.dispatchEvent(new Event('pagehide'));});
 assert.equal(await stage(page).isVisible(),false);assert.equal(await play(page).getAttribute('aria-pressed'),'false');assert.notEqual(await status(page).textContent(),pending);
 assert.equal(await page.evaluate(()=>window.joplinAllocated.length),2);
 assert.equal(await page.evaluate(()=>window.joplinAllocated.every(url=>window.joplinRevoked.includes(url))),true);
 await native.drain();assert.equal(native.proofs.length,2);assert.deepEqual(await stable(page),before);
 t.diagnostic(JSON.stringify({boundary,stopped,scope:'Controlled pending callbacks only. Separate positive cases require the native checked PNG, actual SVG source and seven presented views.'}));
});

test('a retired native decode promise cannot replace a committed pair and departure retires both URL owners',{timeout:20000},async t=>{
 const page=await fixture(t,{viewport:{width:1280,height:900},reducedMotion:'reduce',serviceWorkers:'block'});
 await page.addInitScript(()=>{
  window.joplinAllocated=[];window.joplinRevoked=[];let first=true;
  const create=URL.createObjectURL.bind(URL),revoke=URL.revokeObjectURL.bind(URL),decode=HTMLImageElement.prototype.decode;
  URL.createObjectURL=value=>{const result=create(value);window.joplinAllocated.push(result);return result;};
  URL.revokeObjectURL=value=>{window.joplinRevoked.push(value);return revoke(value);};
  HTMLImageElement.prototype.decode=async function(...args){
   const result=await decode.apply(this,args);
   if(first&&this.src.startsWith('blob:')&&this.naturalWidth===947&&this.naturalHeight===1326){
    first=false;window.joplinNativeDecodeHeld=true;
    await new Promise(resolve=>{window.releaseJoplinNativeDecode=()=>{window.joplinNativeDecodeReleased=true;resolve();};});
   }
   return result;
  };
 });
 const native=sourceBodies(page);await open(page);const before=await stable(page);
 await play(page).click();await page.waitForFunction(()=>window.joplinNativeDecodeHeld===true);
 await play(page).click();await picker(page).selectOption('5');const current=await shown(page,5),message=await status(page).textContent();
 assert.equal(await page.evaluate(()=>window.joplinAllocated.length),2);
 await page.evaluate(()=>window.releaseJoplinNativeDecode());await page.waitForFunction(()=>window.joplinNativeDecodeReleased===true);
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 assert.deepEqual(await shown(page,5),current);assert.equal(await status(page).textContent(),message);
 assert.equal(await page.evaluate(()=>window.joplinRevoked.includes(window.joplinAllocated[0])),true,'The retired pending source URL is revoked');
 assert.equal(await page.evaluate(()=>window.joplinRevoked.includes(window.joplinAllocated[1])),false,'The newer displayed URL remains owned while visible');
 await page.evaluate(()=>window.dispatchEvent(new Event('pagehide')));
 assert.equal(await stage(page).isVisible(),false);assert.equal(await stage(page).locator('image').getAttribute('href'),null);
 assert.equal(await page.evaluate(()=>window.joplinAllocated.every(url=>window.joplinRevoked.includes(url))),true,'Departure retires the admitted displayed URL too');
 await native.drain();assert.equal(native.proofs.length,2);assert.deepEqual(await stable(page),before);
 t.diagnostic('The native complete Blob load and decode both finish before the first decode promise is deliberately held. Its retired continuation cannot overwrite the newer checked pair.');
});

for(const blocked of ['scripts','owner'])test('Joplin full original figure remains usable when '+blocked+' is unavailable',{timeout:15000},async t=>{
 const page=await fixture(t,{javaScriptEnabled:blocked!=='scripts',viewport:{width:390,height:900},reducedMotion:'reduce',serviceWorkers:'block'});
 if(blocked==='owner')await page.route('**/recorded-animation.mjs',route=>route.fulfill({status:503,contentType:'text/plain',body:'Controlled motion owner refusal'}));
 await page.goto(base+'/joplin.html#radar-reading');const original=page.locator('a[data-photo-id="nist-joplin-radar-sequence"]');
 await original.scrollIntoViewIfNeeded();const image=original.locator('img');
 await page.waitForFunction(()=>{const image=document.querySelector('a[data-photo-id="nist-joplin-radar-sequence"] img');return image?.complete&&image.naturalWidth===947&&image.naturalHeight===1326;});
 assert.equal(await image.getAttribute('src'),asset);assert.equal(await play(page).isVisible(),false);assert.equal(await stage(page).isVisible(),false);
 await preservedFigure(page);assert.match(await card(page).textContent(),/Without scripts, use that figure and its enlargement link/);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fixture,base} from './harness.mjs';

// Expected source identities were recorded during independent source intake.
const items=[
 {id:'moore-ktlx-reflectivity-loop',gif:'assets/moore-2013/newcastle-moore-ref.gif',poster:'assets/moore-2013/newcastle-moore-ref-poster.png',bytes:4621244,sha:'ad49be3837ff98d9082d6c6e7525d546b12e4342b43a09fad7281c7ed43b2a41',posterSha:'62293ccff370acd1cdc2ffbd2f6823b7d42c704981f16e07dc912dc37911adb8',original:'https://www.weather.gov/images/oun/wxevents/20130520/radar/newcastle-moore-ref.gif'},
 {id:'moore-ktlx-storm-relative-velocity-loop',gif:'assets/moore-2013/newcastle-moore-srv.gif',poster:'assets/moore-2013/newcastle-moore-srv-poster.png',bytes:4256310,sha:'82f45919ef9752dcc009dd4c4ba31141776cb67606d357fbea172ad02eba576c',posterSha:'e4a6a61bdd0d2467307e84f6431855fedcfb8d6ad782268e4b585a6cc6719cb9',original:'https://www.weather.gov/images/oun/wxevents/20130520/radar/newcastle-moore-srv.gif'}
];
const selector=item=>'[data-recorded-animation="'+item.gif+'"]';
const cardFor=(page,item)=>page.locator(selector(item));
const control=(page,item)=>cardFor(page,item).locator('[data-animation-action]');
const status=(page,item)=>cardFor(page,item).locator('[data-animation-status]');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
async function settleImage(page,item,asset){
 const image=cardFor(page,item).locator('img');
 await cardFor(page,item).evaluate(node=>node.querySelector('img').scrollIntoView({block:'center',behavior:'instant'}));
 const deadline=Date.now()+10000;let state;
 do{
  state=await image.evaluate(node=>({src:node.getAttribute('src'),complete:node.complete,width:node.naturalWidth,height:node.naturalHeight}));
  if(state.src===asset&&state.complete&&state.width===800&&state.height===558)return image;
  await new Promise(resolve=>setTimeout(resolve,25));
 }while(Date.now()<deadline);
 assert.fail('The owned image did not reach its exact complete state: '+JSON.stringify(state));
}
async function stopped(page,item){
 const image=await settleImage(page,item,item.poster),button=control(page,item);
 assert.equal(await button.getAttribute('aria-pressed'),'false');assert.equal(await button.textContent(),'Play radar animation');
 return image;
}
async function stableState(page){
 return page.evaluate(()=>({href:location.href,historyLength:history.length,historyState:history.state,
  assignedTime:new URL(location.href).searchParams.get('t'),
  title:document.querySelector('#radar-motion h2').textContent,
  conflict:[...document.querySelectorAll('#radar-motion>p')].map(node=>node.textContent).join(' ')}));
}
function bodies(page){
 const proofs=[],tasks=[],failures=[],requests=[];
 page.on('request',request=>{if(items.some(item=>request.url()===base+'/'+item.gif))requests.push({url:request.url(),method:request.method()});});
 page.on('response',response=>{
  const item=items.find(item=>response.url()===base+'/'+item.gif);if(!item)return;
  tasks.push((async()=>{
   assert.equal(response.request().method(),'GET');assert.equal(response.status(),200);
   assert.equal(await response.finished(),null,'The native source request finished before body admission');
   const bytes=await response.body();assert.equal(bytes.length,item.bytes);assert.equal(sha(bytes),item.sha);
   proofs.push({asset:item.gif,bytes:bytes.length,sha256:item.sha,status:response.status()});
  })().catch(error=>failures.push(error.message)));
 });
 return {requests,proofs,async drain(){await Promise.all(tasks);assert.deepEqual(failures,[],'Native GIF body evidence remains complete');}};
}
async function pixelHash(page,image){
 // The screenshot observes the actual presented animated image. Decoding the
 // resulting PNG avoids depending on drawImage(animated GIF) frame semantics.
 const png=await image.screenshot({animations:'allow'});
 return page.evaluate(async encoded=>{
  const bytes=Uint8Array.from(atob(encoded),character=>character.charCodeAt(0));
  const bitmap=await createImageBitmap(new Blob([bytes],{type:'image/png'}));
  try{
   const canvas=document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;
   const ctx=canvas.getContext('2d');ctx.drawImage(bitmap,0,0);
   const digest=await crypto.subtle.digest('SHA-256',ctx.getImageData(0,0,canvas.width,canvas.height).data);
   return {width:canvas.width,height:canvas.height,sha256:[...new Uint8Array(digest)].map(value=>value.toString(16).padStart(2,'0')).join('')};
  }finally{bitmap.close();}
 },png.toString('base64'));
}
async function fullFrame(image){
 const box=await image.evaluate(node=>{const rect=node.getBoundingClientRect();return {width:rect.width,height:rect.height,naturalWidth:node.naturalWidth,naturalHeight:node.naturalHeight,documentWidth:document.documentElement.scrollWidth,viewport:innerWidth};});
 assert.equal(box.naturalWidth,800);assert.equal(box.naturalHeight,558);
 assert.ok(Math.abs(box.width/box.height-800/558)<.01,'The original complete display ratio is preserved');
 assert.ok(box.documentWidth<=box.viewport+1,'The article reflows without hiding the display');
}

for(const width of [320,1280])for(const scheme of ['light','dark'])test('Moore native radar motion and item source '+width+' '+scheme,{timeout:45000},async t=>{
 const page=await fixture(t,{viewport:{width,height:900},colorScheme:scheme,reducedMotion:'reduce',serviceWorkers:'block'});
 await page.addInitScript(()=>localStorage.setItem('tornado-atlas-appearance','system'));
 const native=bodies(page);
 await page.goto(base+'/moore.html#radar-motion');
 let state=await stableState(page);const initialHistory=state.historyLength;assert.equal(state.assignedTime,null);
 assert.match(state.conflict,/3:04 PM to 4:42 PM CDT/);assert.match(state.conflict,/19:04:13Z and 20:42:18Z/);assert.match(state.conflict,/one hour/);
 for(const item of items){
  await control(page,item).waitFor({state:'visible'});await stopped(page,item);
 }
 assert.deepEqual(native.requests,[],'Reduced motion entry presents only static posters before choice');
 await page.evaluate(()=>document.fonts.ready);
 if(width===320){await page.evaluate(()=>{document.documentElement.style.fontSize='200%';});for(const item of items)await fullFrame(await stopped(page,item));await page.evaluate(()=>{document.documentElement.style.fontSize='';});}
 if(process.env.ATLAS_RADAR_CAPTURE){await fs.mkdir(process.env.ATLAS_RADAR_CAPTURE,{recursive:true});await page.locator('#radar-motion').screenshot({path:path.join(process.env.ATLAS_RADAR_CAPTURE,'radar-'+width+'-'+scheme+'.png')});}
 for(const item of items){
  const card=cardFor(page,item),button=control(page,item);
  const poster=await stopped(page,item);await fullFrame(poster);
  assert.equal(await card.getByRole('link',{name:'Original NWS asset',exact:true}).getAttribute('href'),item.original);
  assert.match(await card.locator('figcaption').textContent(),/NOAA \/ National Weather Service Norman/);
  assert.match(await card.locator('figcaption').textContent(),/No government endorsement/);
  await button.focus();await page.keyboard.press('Enter');
  const playing=await settleImage(page,item,item.gif);
  assert.equal(await button.getAttribute('aria-pressed'),'true');assert.match(await status(page,item).textContent(),/^Playing the original published animation/);
  await fullFrame(playing);
  const first=await pixelHash(page,playing);await new Promise(resolve=>setTimeout(resolve,450));const second=await pixelHash(page,playing);
  assert.equal(first.width,second.width);assert.equal(first.height,second.height);
  assert.notEqual(first.sha256,second.sha256,'Actual presented GIF pixels change, independent of the button label');
  await native.drain();assert.ok(native.proofs.some(proof=>proof.asset===item.gif),'The changing display has an independently pinned native source body');
  assert.deepEqual(await stableState(page),state,'Radar choice does not assign time or change native history');
  await button.focus();await page.keyboard.press('Enter');await stopped(page,item);
  assert.match(await status(page,item).textContent(),/first frame/);
  assert.deepEqual(await stableState(page),state);

  const sourceLink=card.getByRole('link',{name:'Item identity and clock limits',exact:true});
  await sourceLink.focus();await page.keyboard.press('Enter');
  const record=page.locator('#media-'+item.id);await record.waitFor();
  assert.equal(new URL(page.url()).searchParams.get('event'),'moore-2013');
  assert.equal(new URL(page.url()).searchParams.get('media'),item.id);
  assert.match(await record.textContent(),/one hour/);assert.match(await record.textContent(),/No independent clock calibration/);
  assert.ok(await record.locator('a[href="'+item.original+'"]').count()>0);
  await page.goBack();await control(page,item).waitFor({state:'visible'});await stopped(page,item);
  const returned=await stableState(page);
  assert.equal(returned.href,state.href);assert.deepEqual(returned.historyState,state.historyState);
  assert.equal(returned.historyLength,initialHistory+1,'The first source navigation adds an entry; the second replaces its forward branch');
  assert.deepEqual({...returned,historyLength:state.historyLength},state,'Back restores the exact reading context after deliberate source navigation');
  state=returned;
  t.diagnostic(JSON.stringify({width,scheme,item:item.id,presented_pixels:[first,second],source_body:native.proofs.find(proof=>proof.asset===item.gif),scope:'Isolated native image presentations and exact source body, not a calibrated source clock or measured cadence'}));
 }
 await native.drain();
 // A change to the motion preference stops an already selected animation.
 await page.emulateMedia({reducedMotion:'no-preference'});
 await control(page,items[0]).click();await settleImage(page,items[0],items[0].gif);
 await page.emulateMedia({reducedMotion:'reduce'});await stopped(page,items[0]);
 assert.match(await status(page,items[0]).textContent(),/reduced motion/);
 assert.deepEqual(await stableState(page),state);
});

for(const [width,scheme]of [[320,'dark'],[1280,'light']])test('Moore radar failed native load retains poster and retries '+width,{timeout:30000},async t=>{
 const page=await fixture(t,{viewport:{width,height:900},colorScheme:scheme,reducedMotion:'reduce',serviceWorkers:'block'}),item=items[0];
 let fail=true;const statuses=[];
 page.on('response',response=>{if(response.url()===base+'/'+item.gif)statuses.push(response.status());});
 await page.route('**/newcastle-moore-ref.gif',route=>fail?route.fulfill({status:503,contentType:'text/plain',body:'Controlled radar source unavailable'}):route.continue());
 await page.goto(base+'/moore.html#radar-motion');await control(page,item).waitFor({state:'visible'});await stopped(page,item);
 const before=await stableState(page);
 await control(page,item).click();
 await page.waitForFunction(sel=>document.querySelector(sel+' [data-animation-status]').textContent.includes('could not load'),selector(item),{polling:20});
 await stopped(page,item);assert.ok(statuses.includes(503));
 assert.equal(await cardFor(page,item).getByRole('link',{name:'Original NWS asset',exact:true}).getAttribute('href'),item.original);
 fail=false;const native=bodies(page);
 await control(page,item).focus();await page.keyboard.press('Enter');await settleImage(page,item,item.gif);await native.drain();
 assert.ok(native.proofs.some(proof=>proof.asset===item.gif));
 await control(page,item).click();await stopped(page,item);assert.deepEqual(await stableState(page),before);
 t.diagnostic(JSON.stringify({width,controlled_statuses:statuses,scope:'The deliberate503 is retained; the actual retried200 body is checked separately'}));
});

for(const [width,scheme]of [[320,'dark'],[1280,'light']])test('Moore retired animation callbacks cannot replace a newer choice '+width,{timeout:20000},async t=>{
 const page=await fixture(t,{viewport:{width,height:900},colorScheme:scheme,reducedMotion:'reduce',serviceWorkers:'block'}),item=items[0];
 await page.addInitScript(()=>{
  const descriptor=Object.getOwnPropertyDescriptor(HTMLImageElement.prototype,'src');window.retiredRadarAttempts=[];
  const cloneNode=HTMLImageElement.prototype.cloneNode;window.retiredRadarClones=[];
  HTMLImageElement.prototype.cloneNode=function(deep){
   if(this.getAttribute('src')?.endsWith('/newcastle-moore-ref-poster.png')){
    // A controlled pending image must have no native poster load in flight.
    // WebKit can otherwise deliver the cloned poster's cached load event.
    const image=document.createElement('img');
    for(const {name,value} of this.attributes)if(name!=='src'&&name!=='srcset')image.setAttribute(name,value);
    window.retiredRadarClones.push(image);return image;
   }
   return cloneNode.call(this,deep);
  };
  Object.defineProperty(HTMLImageElement.prototype,'src',{...descriptor,set(value){
   if(new URL(String(value),location.href).pathname.endsWith('/newcastle-moore-ref.gif')){
    window.retiredRadarAttempts.push({image:this,load:this.onload,error:this.onerror});return;
   }
   return descriptor.set.call(this,value);
  }});
 });
 await page.goto(base+'/moore.html#radar-motion');await control(page,item).waitFor({state:'visible'});await stopped(page,item);
 const before=await stableState(page),button=control(page,item);
 await button.click();assert.equal(await page.evaluate(()=>window.retiredRadarAttempts.length),1);
 await button.click();await stopped(page,item);
 await button.click();assert.equal(await page.evaluate(()=>window.retiredRadarAttempts.length),2);
 assert.equal(await page.evaluate(()=>window.retiredRadarClones.length),2);
 assert.equal(await page.evaluate(()=>window.retiredRadarAttempts.every(row=>row.image.getAttribute('src')===null)),true,'Controlled pending images cannot receive native poster completion');
 const pending=await status(page,item).textContent();assert.match(pending,/Loading/);
 await page.evaluate(()=>{const old=window.retiredRadarAttempts[0];old.load.call(old.image);old.error.call(old.image);});
 assert.equal(await status(page,item).textContent(),pending);assert.equal(await button.getAttribute('aria-pressed'),'true');
 await button.click();await stopped(page,item);const stoppedStatus=await status(page,item).textContent();
 await page.evaluate(()=>{const old=window.retiredRadarAttempts[1];old.load.call(old.image);old.error.call(old.image);});
 await stopped(page,item);assert.equal(await status(page,item).textContent(),stoppedStatus);assert.deepEqual(await stableState(page),before);
 t.diagnostic('Controlled callback ownership fixture only. The separate positive cases require actual native GIF bodies and changing presented pixels.');
});

for(const width of [320,1280])for(const scheme of ['light','dark'])test('Moore radar retains static source reading without scripts '+width+' '+scheme,{timeout:20000},async t=>{
 const page=await fixture(t,{javaScriptEnabled:false,viewport:{width,height:900},colorScheme:scheme,reducedMotion:'reduce',serviceWorkers:'block'}),requests=[];
 page.on('request',request=>{if(items.some(item=>request.url()===base+'/'+item.gif))requests.push(request.url());});
 await page.goto(base+'/moore.html#radar-motion');
 assert.match(await page.locator('#radar-motion').textContent(),/one hour/);
 for(const item of items){
  const card=cardFor(page,item),image=await settleImage(page,item,item.poster);await fullFrame(image);
  assert.equal(await control(page,item).isVisible(),false);
  assert.equal(await card.getByRole('link',{name:'Open the original GIF',exact:true}).getAttribute('href'),item.gif);
  assert.equal(await card.getByRole('link',{name:'Original NWS asset',exact:true}).getAttribute('href'),item.original);
  assert.ok((await card.getByRole('link',{name:'Item identity and clock limits',exact:true}).getAttribute('href')).includes('media='+item.id));
  assert.match(await card.locator('figcaption').textContent(),/No government endorsement/);
 }
 assert.deepEqual(requests,[],'No script reading keeps both original GIFs as deliberate native links');
});

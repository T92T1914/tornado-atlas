import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fixture,base} from './harness.mjs';

for(const mode of ['settled-pointer','early-held-pointer','early-keyboard','early-drag-away','early-compensation-disabled'])test('documentary retry preserves early reader position '+mode,{timeout:22000},async t=>{
 const page=await fixture(t,{viewport:{width:1280,height:900},reducedMotion:'reduce'});
 const requests=[];let release,held=false,markHeld; const heldReady=new Promise(resolve=>markHeld=resolve);
 const gate=new Promise(resolve=>release=resolve);
 if(mode!=='settled-pointer')await page.route('**/reader-view.mjs',async route=>{held=true;markHeld();await gate;await route.continue();});
 await page.addInitScript(()=>{
  const rows=[];window.__atlasClipGestureRows=rows;
  for(const type of ['pointerdown','pointerup','pointercancel','click'])document.addEventListener(type,event=>{
   if(rows.length>=32)return;const button=document.querySelector('[data-clip-action]'),clip=document.querySelector('[data-documentary-clip]'),r=button?.getBoundingClientRect();
   rows.push({type,trusted:event.isTrusted,target:event.target?.tagName,target_is_button:event.target===button,text:event.target?.textContent?.slice(0,80),x:event.clientX,y:event.clientY,scrollY,ready:document.body?.dataset.exhibitReady??null,button_rect:r?[r.x,r.y,r.width,r.height]:null,clip:clip?{paused:clip.paused,time:clip.currentTime,ready:clip.readyState,network:clip.networkState}:null,now:performance.now()});
  },{capture:true,passive:true});
 });
 page.on('request',request=>{if(/bohac-opening-source-relative\.(mp4|webm)$/.test(request.url()))requests.push({path:new URL(request.url()).pathname,method:request.method()});});
 await page.route('**/bohac-opening-source-relative.*',r=>r.fulfill({status:404,body:'Controlled unavailable media'}));
 const snapshots=[];let actualError=null;
 const snapshot=async label=>snapshots.push({label,...await page.evaluate(()=>{const b=document.querySelector('[data-clip-action]'),r=b.getBoundingClientRect(),v=document.querySelector('[data-documentary-clip]');return{scrollY,ready:document.body.dataset.exhibitReady??null,button_rect:[r.x,r.y,r.width,r.height],button_label:b.textContent,time:v.currentTime,paused:v.paused,network:v.networkState,media_ready:v.readyState,historical:document.getElementById('published-position')?.value}})});
 try{
  await page.goto(base+'/index.html#bohac-opening-motion');
  if(mode==='settled-pointer')await page.waitForFunction(()=>document.body.dataset.exhibitReady==='true');
  else{await heldReady;assert.equal(held,true);assert.notEqual(await page.locator('body').getAttribute('data-exhibit-ready'),'true');}
  if(mode==='early-compensation-disabled')await page.addStyleTag({content:'html,body{overflow-anchor:none!important}'});
  const region=page.locator('#bohac-opening-motion'),button=region.locator('[data-clip-action]');
  await button.click();await page.waitForFunction(()=>document.querySelector('[data-clip-action]').textContent==='Retry short clip');
  assert.equal(await region.getByRole('link',{name:'Archived extended film'}).count(),1);
  const firstRequestCount=requests.length;await page.unroute('**/bohac-opening-source-relative.*');
  await button.scrollIntoViewIfNeeded();await snapshot('before_retry');
  if(mode==='early-keyboard'){
   await button.focus();await page.keyboard.press('Enter');
   await page.waitForFunction(()=>document.querySelector('[data-documentary-clip]').currentTime>0.1);
   release();await page.waitForFunction(()=>document.body.dataset.exhibitReady==='true');
  }else if(mode==='settled-pointer')await button.click();
  else{
   const rect=await button.boundingBox();assert.ok(rect);await page.mouse.move(rect.x+rect.width/2,rect.y+rect.height/2);await page.mouse.down();await snapshot('pointer_held_before_startup');
   release();await page.waitForFunction(()=>document.body.dataset.exhibitReady==='true');await snapshot('pointer_held_after_startup');
   const after=await button.boundingBox();
   const heldPoint={x:rect.x+rect.width/2,y:rect.y+rect.height/2};
   t.diagnostic('STARTUP_NATIVE_HELD_POINT '+JSON.stringify({before:rect,after,heldPoint,vertical_change:after.y-rect.y}));
   assert.ok(heldPoint.x>=after.x && heldPoint.x<=after.x+after.width && heldPoint.y>=after.y && heldPoint.y<=after.y+after.height,'Startup leaves the actual original pressed point on its native control');
   if(mode==='early-drag-away')await page.mouse.move(2,2);
   await page.mouse.up();
  }
  await snapshot('after_activation');
  if(mode==='early-drag-away'){
   assert.equal(requests.length,firstRequestCount,'Dragging away must not retry');
   assert.equal(await region.locator('video').evaluate(v=>v.currentTime),0);
   assert.equal(await button.textContent(),'Retry short clip');
  }else{
   const activation=await page.evaluate(()=>window.__atlasClipGestureRows.findLast(e=>e.type==='click'));assert.equal(activation?.target_is_button,true,'The unredirected native release still activates the pressed button');
   await page.waitForFunction(()=>{const v=document.querySelector('[data-documentary-clip]');return v.videoWidth===1280&&v.videoHeight===720&&v.currentTime>0.1&&!v.paused;});
   assert.ok(requests.length>firstRequestCount,'A genuine retry requests an original reviewed source');
   assert.equal(await page.locator('#published-position').inputValue(),'0');
  }
 }catch(error){actualError={name:error.name,message:error.message};throw error;}
 finally{
  release?.();
  const rows=await page.evaluate(()=>window.__atlasClipGestureRows??[]).catch(()=>[]);
  const record={mode,snapshots,events:rows,requests,error:actualError,scope:'Current source, isolated browser, trusted native input and held real reader dependency. Disabled CSS scroll compensation is a boundary control, not another engine or physical-device proof.'};
  if(process.env.ATLAS_DIAGNOSTIC_OUTPUT_DIR)await writeFile(path.join(process.env.ATLAS_DIAGNOSTIC_OUTPUT_DIR,'clip-gesture-'+mode+'.json'),JSON.stringify(record,null,2)+'\n');
  t.diagnostic(JSON.stringify(record));
 }
});

// Force a declared late layout change inside the real startup update. The
// opening film no longer depends on large upstream content being inserted.
const readerSource=await readFile(new URL('../../web/reader-view.mjs',import.meta.url),'utf8');
const readerLayout='export function mountReaderLayout() {';
assert.equal(readerSource.split(readerLayout).length,2);
const expandedReaderSource=readerSource.replace(readerLayout,readerLayout+`
 const clip=document.getElementById('bohac-opening-motion');
 const spacer=document.createElement('div');
 spacer.id='controlled-late-reader-expansion';
 spacer.setAttribute('aria-hidden','true');
 spacer.style.height='1200px';
 const before=clip.getBoundingClientRect().top;
 clip.before(spacer);
 window.__atlasLateLayoutControl={declared_height:1200,actual_height:spacer.getBoundingClientRect().height,shift:clip.getBoundingClientRect().top-before};
`);
for (const choice of ['keep-reader','wheel','keyboard-focus','pagehide']) test('documentary startup '+(choice==='keep-reader'?'preserves its current reader':'yields to newer '+choice), {timeout:22000}, async t => {
 const page = await fixture(t,{viewport:{width:1280,height:900},reducedMotion:'reduce'});
 let release, markHeld;
 const held = new Promise(resolve => markHeld = resolve), gate = new Promise(resolve => release = resolve);
 await page.route('**/reader-view.mjs',async route => {markHeld();await gate;await route.fulfill({status:200,contentType:'text/javascript',body:expandedReaderSource});});
 try {
  await page.goto(base+'/index.html#bohac-opening-motion');await held;
  await page.addStyleTag({content:'html,body{overflow-anchor:none!important}'});
  const button=page.locator('[data-clip-action]');
  await page.route('**/bohac-opening-source-relative.*',route=>route.fulfill({status:404,body:'Controlled unavailable media'}));
  await button.click();await page.waitForFunction(()=>document.querySelector('[data-clip-action]').textContent==='Retry short clip');
  if(choice==='wheel'){
   const initial=await page.evaluate(()=>scrollY);await page.mouse.wheel(0,80);
   await page.waitForFunction(expected=>scrollY===expected,initial+80);
  }
  if(choice==='keyboard-focus'){await page.keyboard.press('Tab');assert.equal(await button.evaluate(n=>n===document.activeElement),false);}
  if(choice==='pagehide')await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true})));
  const before=await button.evaluate(n=>({top:n.getBoundingClientRect().top,scroll:scrollY}));
  release();await page.waitForFunction(()=>document.body.dataset.exhibitReady==='true');
  const after=await button.evaluate(n=>({top:n.getBoundingClientRect().top,scroll:scrollY}));
  const growth=await page.evaluate(()=>window.__atlasLateLayoutControl);
  assert.equal(growth.declared_height,1200);assert.equal(growth.actual_height,1200);assert.equal(growth.shift,1200);
  t.diagnostic(JSON.stringify({choice,before,after,growth,scope:'Controlled 1200 pixel late reader expansion inside the real startup update. Native input except the explicitly synthetic pagehide lifecycle control.'}));
  if(choice==='keep-reader'){
   assert.ok(Math.abs(after.top-before.top)<=1,'The current reader retains its visible control through the declared late growth');
   assert.ok(after.scroll-before.scroll>1000,'The positive control exercises actual startup scroll compensation');
  }else{
   assert.ok(after.top-before.top>1000,'The retired reading anchor does not override the newer choice');
   assert.equal(after.scroll,before.scroll,'Startup adds no scroll after ownership is retired');
  }
  assert.equal(await page.locator('[data-documentary-clip]').evaluate(v=>v.currentTime),0);
 } finally {release?.();}
});

test('independent documentary clip survives failed exhibit initialization',{timeout:22000},async t=>{
 const page=await fixture(t,{viewport:{width:1280,height:900},reducedMotion:'reduce'});
 let release,markHeld;const held=new Promise(resolve=>markHeld=resolve),gate=new Promise(resolve=>release=resolve);
 await page.route('**/data.json',async route=>{markHeld();await gate;await route.fulfill({status:503,body:'Controlled unavailable exhibit data'});});
 try {
  await page.goto(base+'/index.html#bohac-opening-motion');await held;
  await page.addStyleTag({content:'html,body{overflow-anchor:none!important}'});
  const button=page.locator('[data-clip-action]');await button.focus();await page.keyboard.press('Enter');
  await page.waitForFunction(()=>{const v=document.querySelector('[data-documentary-clip]');return v.videoWidth===1280&&v.videoHeight===720&&v.currentTime>0.1&&!v.paused;});
  const before=await button.boundingBox();release();await page.waitForFunction(()=>document.body.dataset.exhibitReady==='error');
  const after=await button.boundingBox();assert.ok(Math.abs(before.y-after.y)<=1,'The actual error presentation preserves the early reading position');
  assert.equal(await page.locator('[data-documentary-clip]').evaluate(v=>v.paused),false);
  assert.equal(await page.locator('#timeline').isDisabled(),true,'Independent source playback never admits the unavailable historical clock');
  assert.equal(await page.locator('#bohac-opening-motion').getByRole('link',{name:'Archived extended film'}).count(),1);
 } finally {release?.();}
});

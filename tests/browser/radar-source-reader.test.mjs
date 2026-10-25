import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fixture,base} from './harness.mjs';

// Pin the previously retained PNGs independently of the new reader's model.
const originals=[
  [151,'230137','04131221cc0a961e12107b7155dbff638e4ac5e370f4936fcb9d7ac251e00070'],
  [154,'230510','54e73592caa0232558d2b53872ce6926076b36de4f7b02578957fa3899ef459c'],
  [157,'230843','03ba2de5aa4f5e02eb14f0803974d289eeb12ec324f424d5a4fcb78f61c597ee'],
  [160,'231216','8e24900351a543c8743816015faca10985ae24d440286422c4cfb5da1ffe985b'],
  [163,'231549','155a33cf3963126f10d2e794f209030f1ec4301354be5350745f8f92af51d0ab'],
  [166,'231922','c13901e692f71f6f2f19138ae31fb8048da95cd6ffbd8876fd2f471d2ea4ef94'],
  [169,'232256','39da6714f42f9f616b5f7a1faa4dac9af7609f87289dd020a3a1da08c712cb33'],
  [172,'232629','88548ba2a48fba7fb4451181f78e9bf4b2d6ac041f842b176440ea0818b62664'],
  [175,'233002','6fcf88cc04de9081cc4b3ed0fa3161559228c0c9374b2a098eb505f1cd9bfd42'],
  [178,'233335','6b0142e359246cd8b0f4892d3e24f297e75911a1ff3fa98b753711237b2d35d0'],
  [181,'233708','3caf587ba8832f9530e01a06be07ae9329f8ddb5e8cfe80fe4eb03862aa1c8b8'],
  [184,'234051','289307ddda63ded56ecfc55922b414a650c705061f6e7c6c3351eaa9c80743e2'],
].map(([id,clock,sha])=>({id,clock,sha,file:`assets/el-reno-2013/radar/frame-${id}.png`,
  label:`wseNWRT_Reflectivity_20130531-${clock}_00.51.png`,
  printed:`${clock.slice(0,2)}:${clock.slice(2,4)}:${clock.slice(4)}`}));
const original=id=>originals.find(row=>row.id===id);
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const pause=milliseconds=>new Promise(resolve=>setTimeout(resolve,milliseconds));
const painted=page=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
const picker=page=>page.locator('#radar-observation');
const play=page=>page.locator('#radar-play');
const figure=page=>page.locator('#radar-source-figure');
let capturedBytes=0;
async function captureReading(page,name){
  const directory=process.env.ATLAS_RADAR_CAPTURES;if(!directory)return;
  assert.ok(path.isAbsolute(directory));assert.match(name,/^[a-z0-9-]+$/);
  const section=page.locator('#radar-observations'),box=await section.boundingBox();
  assert.ok(box&&box.height<=12000,'The owned reading capture has a bounded height');
  const bytes=await section.screenshot({type:'png',animations:'disabled',timeout:10000});
  capturedBytes+=bytes.length;assert.ok(bytes.length<=4*1024*1024&&capturedBytes<=32*1024*1024);
  await mkdir(directory,{recursive:true});await writeFile(path.join(directory,name+'.png'),bytes,{flag:'wx'});
}

async function reader(page,query=''){
  await page.goto(base+'/radar-source.html'+query);
  await page.locator('#radar-reader-controls').waitFor({state:'visible'});
}
async function checked(page,id){
  await page.locator(`#radar-source-figure[data-state="ready"][data-frame-index="${id}"]`).waitFor();
  return coherent(page,id);
}
async function coherent(page,id){
  const expected=original(id);
  const value=await page.evaluate(async()=>{
    const image=document.querySelector('#radar-source-image'),frame=document.querySelector('#radar-source-figure');
    const response=await fetch(image.currentSrc),bytes=await response.arrayBuffer();
    const digest=await crypto.subtle.digest('SHA-256',bytes);
    return {id:frame.dataset.frameIndex,state:frame.dataset.state,complete:image.complete,
      width:image.naturalWidth,height:image.naturalHeight,src:image.currentSrc,
      sha256:[...new Uint8Array(digest)].map(value=>value.toString(16).padStart(2,'0')).join(''),
      caption:document.querySelector('#radar-source-caption').textContent,
      time:document.querySelector('#radar-source-time')?.textContent??'',
      original:document.querySelector('#radar-frame-original').getAttribute('href')};
  });
  assert.equal(value.id,String(id));assert.equal(value.complete,true);
  assert.equal(value.width,597);assert.equal(value.height,599);assert.equal(value.sha256,expected.sha);
  assert.ok(value.caption.includes(String(id)),'The displayed source frame number remains explicit');
  assert.ok(value.caption.includes(expected.label),'The displayed caption names the actual printed source filename');
  assert.equal(new URL(value.original,page.url()).href,base+'/'+expected.file);
  return value;
}
async function completeExtent(page){
  const value=await page.locator('#radar-source-image').evaluate(image=>{
    const rect=image.getBoundingClientRect(),frame=image.closest('figure').getBoundingClientRect(),style=getComputedStyle(image);
    const parent=image.parentElement,container=parent.getBoundingClientRect(),containerStyle=getComputedStyle(parent);
    return {width:rect.width,height:rect.height,top:rect.top,bottom:rect.bottom,
      figureTop:frame.top,figureBottom:frame.bottom,parentTop:container.top,parentBottom:container.bottom,
      objectFit:style.objectFit,clipPath:style.clipPath,overflow:containerStyle.overflow,
      documentWidth:document.documentElement.scrollWidth,viewport:innerWidth};
  });
  assert.ok(value.width>0&&value.height>0);
  assert.ok(Math.abs(value.width/value.height-597/599)<.01,'The whole original radar keeps its display ratio');
  assert.notEqual(value.objectFit,'cover');assert.equal(value.clipPath,'none');
  assert.ok(value.top>=value.figureTop-1&&value.bottom<=value.figureBottom+1,'The figure contains the full legend and bottom filename');
  if(/hidden|clip/.test(value.overflow))assert.ok(value.top>=value.parentTop-1&&value.bottom<=value.parentBottom+1,'No clipping parent hides either source edge');
  assert.ok(value.documentWidth<=value.viewport+1,'The reader reflows within the viewport');
  return value;
}
async function keyboard(page,locator,key='Enter'){
  await locator.focus();await page.keyboard.press(key);
}
async function paused(page){
  await page.waitForFunction(()=>{const button=document.querySelector('#radar-play');return button&&!/Pause/i.test(button.textContent);});
  assert.doesNotMatch(await play(page).textContent(),/Pause/i);
}
async function sameDisplayed(page,id){
  const value=await coherent(page,id);
  assert.equal(new URL(page.url()).searchParams.has('t'),false,'Display pacing does not assign a historical clock');
  return value;
}
async function localBytes(id){
  const item=original(id),bytes=await readFile(new URL('../../web/'+item.file,import.meta.url));
  assert.equal(sha(bytes),item.sha,'The adverse fixture itself retains the pinned source identity');
  return bytes;
}

async function bounded(promise,label){
  let timer;
  try{return await Promise.race([promise,new Promise((_,reject)=>timer=setTimeout(()=>reject(new Error(label+' did not settle within ten seconds')),10000))]);}
  finally{clearTimeout(timer);}
}
async function heldImage(t,page,id){
  const bytes=await localBytes(id);let enter,release,finish,routeResult,routeError;
  const requested=new Promise(resolve=>enter=resolve),released=new Promise(resolve=>release=resolve),settled=new Promise(resolve=>finish=resolve);
  t.after(()=>release());
  let attempts=0;
  await page.route('**/'+original(id).file,async route=>{
    attempts++;enter();await released;
    try{await route.fulfill({status:200,contentType:'image/png',body:bytes});routeResult='fulfilled';}
    catch(error){routeError=error;routeResult='retired: '+error.message;}
    finally{finish();}
  });
  return {requested:()=>bounded(requested,'Held PNG request'),release,
    async settled(){
      await bounded(settled,'Retired PNG route');
      if(routeError)assert.match(routeError.message,/abort|cancel|closed|disposed|interception|not intercepted/i,'Only an actually retired route may prevent delivery of the late source fixture');
    },attempts:()=>attempts,result:()=>routeResult};
}

async function persistedTransition(page,type){
  const event=await page.evaluate(type=>{
    const event=new PageTransitionEvent(type,{persisted:true});window.dispatchEvent(event);
    return {type:event.type,persisted:event.persisted,trusted:event.isTrusted};
  },type);
  assert.equal(event.persisted,true);assert.equal(event.trusted,false,'This lifecycle control is declared synthetic, not native BFCache evidence');
  return event;
}
async function unavailableSourceRecord(page,id,{pending=false}={}){
  if(pending)assert.notEqual(await figure(page).getAttribute('data-state'),'ready','A fresh pending request cannot make an absent image ready');
  else await page.locator('#radar-source-figure[data-state="unavailable"]').waitFor();
  const value=await page.evaluate(()=>{
    const image=document.querySelector('#radar-source-image');
    return {hidden:image.hidden,src:image.getAttribute('src'),
      caption:document.querySelector('#radar-source-caption').textContent,
      status:document.querySelector('#radar-reader-status').textContent,
      time:document.querySelector('#radar-source-time').textContent,
      source:document.querySelector('#radar-frame-original').getAttribute('href')};
  });
  assert.equal(value.hidden,true);assert.equal(value.src,null,'A retired or failed image is not presented as an intact display');
  const noImage=/\b(?:no (?:checked |intact |complete |radar )*image|image (?:is )?(?:not|unavailable|absent))\b/i;
  assert.match(value.status,noImage);assert.match(value.caption,noImage);
  assert.doesNotMatch(value.status,/\bstill showing\b|\bstatic frame (?:and original source links )?(?:remain|is) available\b/i);
  assert.doesNotMatch(value.time,/^Displayed observation/i,'A retained time label must not claim that an absent image is displayed');
  assert.ok(value.caption.includes(String(id)));assert.ok(value.caption.includes(original(id).label));
  assert.equal(new URL(value.source,page.url()).href,base+'/'+original(id).file);
  return value;
}

for(const [width,appearance] of [[320,'dark'],[1280,'light'],[320,'light'],[1280,'dark']]){
  test(`The complete radar reader remains readable at ${width} ${appearance}`,{timeout:30000},async t=>{
    const page=await fixture(t,{viewport:{width,height:900},colorScheme:appearance,reducedMotion:'reduce',serviceWorkers:'block'});
    await page.addInitScript(()=>localStorage.setItem('tornado-atlas-appearance','system'));
    await reader(page);await checked(page,151);
    assert.equal(await page.locator('#reading-appearance').inputValue(),'system');
    assert.equal(await picker(page).locator('option').count(),12);
    assert.deepEqual(await picker(page).locator('option').evaluateAll(nodes=>nodes.map(node=>node.value)),originals.map(row=>String(row.id)));
    assert.equal(await picker(page).inputValue(),'151');assert.equal(await play(page).textContent(),'Play display sequence');
    assert.equal(await page.locator('#radar-reader-status').getAttribute('role'),'status');
    assert.equal(await page.locator('#radar-prev').isDisabled(),true);assert.equal(await page.locator('#radar-next').isDisabled(),false);
    const initial=await coherent(page,151);assert.ok(initial.time.includes('23:01:37'));assert.match(initial.time,/UTC/);
    const text=await page.locator('main').textContent();
    assert.match(text,/12|twelve/i);assert.match(text,/display sequence/i);assert.match(text,/not.*(?:complete|242)|(?:12|twelve).*retained/i);
    assert.match(text,/not an independent (?:clock )?calibration/i);assert.match(text,/NOAA \/ National Weather Service/);
    await completeExtent(page);
    await picker(page).selectOption('169');const selected=await checked(page,169);
    assert.ok(selected.time.includes('23:22:56'));assert.match(selected.time,/214/);
    await keyboard(page,picker(page),'ArrowUp');await page.keyboard.press('Enter');await checked(page,166);
    assert.equal(await page.evaluate(()=>document.activeElement?.id),'radar-observation');
    for(const id of ['radar-observation','radar-prev','radar-next','radar-play']){
      const node=page.locator('#'+id),box=await node.boundingBox();assert.ok(box.height>=44,`${id} remains a usable control`);
      await node.focus();assert.equal(await node.evaluate(node=>{
        const style=getComputedStyle(node);
        return node.matches(':focus-visible')&&((style.outlineStyle!=='none'&&parseFloat(style.outlineWidth)>0)||style.boxShadow!=='none');
      }),true,'Keyboard focus remains visibly identified');
    }
    await captureReading(page,'radar-'+width+'-'+appearance+'-normal');
    // Force actual computed text enlargement rather than relying on rem sizing.
    await page.locator('main').evaluate(main=>{
      const nodes=[main,...main.querySelectorAll('*')],sizes=nodes.map(node=>parseFloat(getComputedStyle(node).fontSize));
      nodes.forEach((node,index)=>node.style.fontSize=`${sizes[index]*2}px`);
    });
    await completeExtent(page);await coherent(page,166);
    assert.match(await page.locator('#radar-source-caption').textContent(),/231922/);
    await captureReading(page,'radar-'+width+'-'+appearance+'-text200');
    t.diagnostic(JSON.stringify({width,appearance,scope:'Isolated viewport, source bytes, full image extent, keyboard focus and doubled computed text. Not a physical phone or comprehension study.'}));
  });
}

test('Native keyboard selection respects first and last boundaries without adding frame history',{timeout:30000},async t=>{
  const page=await fixture(t,{reducedMotion:'reduce',serviceWorkers:'block'});await reader(page);await checked(page,151);
  const history=await page.evaluate(()=>({length:window.history.length,state:window.history.state}));
  await keyboard(page,page.locator('#radar-next'));await checked(page,154);assert.equal(await picker(page).inputValue(),'154');
  await keyboard(page,picker(page),'End');await page.keyboard.press('Enter');await checked(page,184);
  assert.equal(await page.locator('#radar-next').isDisabled(),true);assert.equal(await page.locator('#radar-prev').isDisabled(),false);
  await keyboard(page,page.locator('#radar-prev'));await checked(page,181);
  await keyboard(page,picker(page),'Home');await page.keyboard.press('Enter');await checked(page,151);
  assert.equal(await page.locator('#radar-prev').isDisabled(),true);
  assert.equal(await page.evaluate(()=>window.history.length),history.length);
  assert.equal(new URL(page.url()).searchParams.get('frame'),'151');
  for(const query of ['0151','999','151.0']){
    await reader(page,'?frame='+query);await checked(page,151);
    assert.match(await page.locator('#radar-reader-status').textContent(),/unknown|unrecognized|not (?:a retained|in the retained selection|recognized|available)|invalid/i);
    await paused(page);
  }
});

test('Manual display motion presents different checked PNGs at its own dwell and stops at the last',{timeout:30000},async t=>{
  const page=await fixture(t,{reducedMotion:'no-preference',serviceWorkers:'block'});await reader(page,'?frame=178');
  const first=await checked(page,178),history=await page.evaluate(()=>window.history.length);
  await pause(1100);await sameDisplayed(page,178);await paused(page);
  // Observe actual committed DOM identities. The later assertion/crypto return
  // time can lag a presentation and cannot measure its on-screen dwell.
  await page.evaluate(()=>{
    const frame=document.getElementById('radar-source-figure');
    window.__radarCommitObservations=[];
    window.__radarCommitObserver=new MutationObserver(()=>{
      const image=document.getElementById('radar-source-image');
      window.__radarCommitObservations.push({id:Number(frame.dataset.frameIndex),at:performance.now(),
        complete:image.complete,width:image.naturalWidth,height:image.naturalHeight});
    });
    window.__radarCommitObserver.observe(frame,{attributes:true,attributeFilter:['data-frame-index']});
  });
  const began=Date.now();await keyboard(page,play(page));assert.match(await play(page).textContent(),/Pause/i);
  const second=await checked(page,181),secondAt=Date.now();assert.ok(secondAt-began>=900,'A successful presentation receives the declared one second dwell');
  const last=await checked(page,184),lastAt=Date.now();
  const commits=await page.evaluate(()=>{window.__radarCommitObserver.disconnect();return window.__radarCommitObservations;});
  t.diagnostic(JSON.stringify({commits,assertion_observation_deltas_ms:[secondAt-began,lastAt-secondAt]}));
  assert.deepEqual(commits.map(row=>row.id),[181,184]);
  for(const row of commits){assert.equal(row.complete,true);assert.equal(row.width,597);assert.equal(row.height,599);}
  assert.ok(commits[1].at-commits[0].at>=990,'Each committed presentation receives the declared dwell before its successor');
  assert.equal(new Set([first.sha256,second.sha256,last.sha256]).size,3,'Motion changes complete displayed pixels, not just button state');
  assert.match(last.time,/223/);await paused(page);assert.match(await play(page).textContent(),/first/i);
  await pause(1100);await sameDisplayed(page,184);assert.equal(await page.evaluate(()=>window.history.length),history);
  await keyboard(page,play(page));await checked(page,151);
  await picker(page).selectOption('163');await checked(page,163);await paused(page);
  await keyboard(page,play(page));await checked(page,166);
  await keyboard(page,page.locator('#radar-prev'));await checked(page,163);await paused(page);
  const stopped=await coherent(page,163);
  await pause(1100);assert.equal((await coherent(page,163)).sha256,stopped.sha256);
  t.diagnostic(JSON.stringify({presented:[first.sha256,second.sha256,last.sha256],commit_dwell_ms:commits[1].at-commits[0].at,scope:'Actual checked retained PNG presentations and independently observed DOM commit dwell. Assertion return times are separate. Display dwell is unrelated to source label intervals.'}));
});

test('A reduced motion preference change stops the selected sequence without automatic resumption',{timeout:30000},async t=>{
  const page=await fixture(t,{reducedMotion:'reduce',serviceWorkers:'block'});await reader(page);await checked(page,151);
  await pause(1100);await sameDisplayed(page,151);await paused(page);
  await page.emulateMedia({reducedMotion:'no-preference'});await keyboard(page,play(page));await checked(page,154);
  await page.emulateMedia({reducedMotion:'reduce'});await paused(page);const stopped=await coherent(page,154);
  await pause(1100);assert.equal((await coherent(page,154)).sha256,stopped.sha256);
  await page.emulateMedia({reducedMotion:'no-preference'});await pause(1100);await sameDisplayed(page,154);await paused(page);
});

test('Explicit keyboard Play reveals the offscreen observation and later wheel departure stops it',{timeout:30000},async t=>{
  const page=await fixture(t,{viewport:{width:1280,height:800},reducedMotion:'no-preference',serviceWorkers:'block'});
  await reader(page);await checked(page,151);
  const before=await figure(page).boundingBox();assert.ok(before.y>=800,'The original failed route starts below this viewport');
  await keyboard(page,play(page));assert.match(await play(page).textContent(),/Pause/i);
  assert.equal(await page.evaluate(()=>document.activeElement?.id),'radar-play','Revealing the image preserves the focused Pause control');
  const button=await play(page).boundingBox(),revealed=await figure(page).boundingBox();
  assert.ok(button.y>=0&&button.y+button.height<=800,'Pause stays in this viewport');
  assert.ok(revealed.y<800&&revealed.y+revealed.height>0,'The observation is actually visible');
  await checked(page,154);
  await page.mouse.wheel(0,-5000);await paused(page);
  const stopped=await coherent(page,154);assert.match(await page.locator('#radar-reader-status').textContent(),/out of view/);
  await figure(page).scrollIntoViewIfNeeded();await pause(1100);await paused(page);
  assert.equal((await coherent(page,154)).sha256,stopped.sha256,'Returning to the image does not restart motion');
  t.diagnostic(JSON.stringify({before,revealed,button,scope:'Actual isolated keyboard activation, current geometry and native wheel departure. No test pre-scroll to bypass the original defect.'}));
});

test('Declared hidden state retires pending motion and native departure returns paused',{timeout:40000},async t=>{
  const page=await fixture(t,{reducedMotion:'no-preference',serviceWorkers:'block'});
  await page.addInitScript(()=>{
    window.__radarFixtureHidden=false;window.__radarPageShows=[];
    Object.defineProperty(document,'hidden',{configurable:true,get:()=>window.__radarFixtureHidden});
    Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>window.__radarFixtureHidden?'hidden':'visible'});
    window.addEventListener('pageshow',event=>window.__radarPageShows.push({persisted:event.persisted,trusted:event.isTrusted}));
  });
  const held=await heldImage(t,page,154);await reader(page);await checked(page,151);
  await keyboard(page,play(page));await held.requested();await coherent(page,151);
  await page.evaluate(()=>{window.__radarFixtureHidden=true;document.dispatchEvent(new Event('visibilitychange'));});
  await paused(page);held.release();await held.settled();await painted(page);await coherent(page,151);
  await page.evaluate(()=>{window.__radarFixtureHidden=false;document.dispatchEvent(new Event('visibilitychange'));});
  await pause(1100);await sameDisplayed(page,151);await paused(page);
  await page.unroute('**/'+original(154).file);await keyboard(page,play(page));await checked(page,154);
  await page.goto(base+'/radar-source.html?frame=163');await checked(page,163);await paused(page);
  await page.goBack();await checked(page,154);await paused(page);await pause(1100);await sameDisplayed(page,154);
  t.diagnostic(JSON.stringify({hidden_control:'Declared document visibility getters and synthetic visibilitychange. Native tab hiding is not claimed.',retired_request:held.result(),native_pageshow:await page.evaluate(()=>window.__radarPageShows),departure:'Actual document navigation and native Back, with a fresh checked image.'}));
});

test('Pause during a held next image retains the last complete identified observation',{timeout:30000},async t=>{
  const page=await fixture(t,{reducedMotion:'no-preference',serviceWorkers:'block'}),held=await heldImage(t,page,154);
  await reader(page);await checked(page,151);await keyboard(page,play(page));await held.requested();
  assert.match(await play(page).textContent(),/Pause/i);await coherent(page,151);
  await keyboard(page,play(page));await paused(page);held.release();await held.settled();await painted(page);
  await coherent(page,151);await pause(1100);await sameDisplayed(page,151);assert.equal(held.attempts(),1);
  t.diagnostic(JSON.stringify({retired_request:held.result(),scope:'Held native PNG request released after an actual keyboard Pause. No automatic retry.'}));
});

test('A stale delayed selection cannot replace the newer image or its source identity',{timeout:30000},async t=>{
  const page=await fixture(t,{reducedMotion:'reduce',serviceWorkers:'block'}),held=await heldImage(t,page,154);
  await reader(page);await checked(page,151);await picker(page).selectOption('154');await held.requested();
  assert.equal(await picker(page).inputValue(),'154');await coherent(page,151);
  assert.match(await page.locator('#radar-reader-status').textContent(),/154|230510|23:05:10/);
  await picker(page).selectOption('157');const current=await checked(page,157);held.release();await held.settled();await painted(page);
  const after=await coherent(page,157);assert.equal(after.sha256,current.sha256);assert.equal(await picker(page).inputValue(),'157');
  assert.equal(new URL(page.url()).searchParams.get('frame'),'157');await paused(page);
  t.diagnostic(JSON.stringify({retired_request:held.result(),scope:'An older delayed PNG either completes or is physically cancelled. Neither outcome may commit stale source identity.'}));
});

test('A failed selected PNG keeps the complete previous source and retries only by choice',{timeout:30000},async t=>{
  const page=await fixture(t,{reducedMotion:'reduce',serviceWorkers:'block'}),bytes=await localBytes(154);let attempts=0;
  await page.route('**/'+original(154).file,route=>++attempts===1?route.abort('failed'):route.fulfill({status:200,contentType:'image/png',body:bytes}));
  await reader(page);await checked(page,151);await picker(page).selectOption('154');
  await page.locator('#radar-retry').waitFor({state:'visible'});await coherent(page,151);
  assert.equal(await picker(page).inputValue(),'154');assert.match(await page.locator('#radar-reader-status').textContent(),/154|230510|23:05:10/);
  await pause(100);assert.equal(attempts,1,'Failure does not start an automatic request loop');
  await keyboard(page,page.locator('#radar-retry'));await checked(page,154);assert.equal(attempts,2);await paused(page);
});

test('Another complete same size PNG cannot borrow the requested frame caption or time',{timeout:30000},async t=>{
  const page=await fixture(t,{reducedMotion:'reduce',serviceWorkers:'block'}),sibling=await localBytes(157),correct=await localBytes(154);let attempts=0;
  await page.route('**/'+original(154).file,route=>route.fulfill({status:200,contentType:'image/png',body:++attempts===1?sibling:correct}));
  await reader(page);await checked(page,151);await picker(page).selectOption('154');
  await page.locator('#radar-retry').waitFor({state:'visible'});await coherent(page,151);
  assert.match(await page.locator('#radar-reader-status').textContent(),/verif|mismatch|check|match|could not/i);
  assert.equal(await picker(page).inputValue(),'154');assert.equal(attempts,1);
  await keyboard(page,page.locator('#radar-retry'));await checked(page,154);assert.equal(attempts,2);
  assert.notEqual(original(154).sha,original(157).sha,'The rejection control is a valid complete sibling, not a broken image');
});

test('A declared persisted restore failure never claims a retired committed PNG is still displayed',{timeout:30000},async t=>{
  const page=await fixture(t,{viewport:{width:320,height:900},colorScheme:'dark',reducedMotion:'no-preference',serviceWorkers:'block'});
  await reader(page,'?frame=163');await checked(page,163);const url=page.url(),bytes=await localBytes(163);
  let attempts=0,departed=false,enter,retryRelease,finish,lateError=null;const departureRequests=[];
  const retryRequested=new Promise(resolve=>enter=resolve),retryReleased=new Promise(resolve=>retryRelease=resolve),retrySettled=new Promise(resolve=>finish=resolve);
  t.after(()=>retryRelease());
  page.on('request',request=>{if(departed&&/\/assets\/el-reno-2013\/radar\/frame-\d+\.png$/.test(request.url()))departureRequests.push(new URL(request.url()).pathname);});
  await page.route('**/'+original(163).file,async route=>{
    attempts++;
    if(attempts===1){await route.abort('failed');return;}
    if(attempts===2){
      enter();await retryReleased;
      try{await route.fulfill({status:200,contentType:'image/png',body:bytes});}
      catch(error){lateError=error;}
      finally{finish();}
      return;
    }
    await route.fulfill({status:200,contentType:'image/png',body:bytes});
  });
  await keyboard(page,play(page));assert.match(await play(page).textContent(),/Pause/i);
  departed=true;const hide=await persistedTransition(page,'pagehide');
  await page.locator('#radar-source-figure[data-state="retired"]').waitFor();
  assert.equal(await page.locator('#radar-source-image').getAttribute('src'),null);
  await pause(100);assert.deepEqual(departureRequests,[],'Departure must retire the displayed Blob without requesting a replacement PNG');
  departed=false;const show=await persistedTransition(page,'pageshow');
  await page.locator('#radar-retry').waitFor({state:'visible'});const failed=await unavailableSourceRecord(page,163);
  assert.equal(attempts,1);assert.equal(await picker(page).inputValue(),'163');assert.equal(page.url(),url);await paused(page);
  await keyboard(page,play(page));await bounded(retryRequested,'Fresh Play request after retired-image failure');
  assert.match(await play(page).textContent(),/Pause/i);await unavailableSourceRecord(page,163,{pending:true});
  await keyboard(page,play(page));await paused(page);const pausedAbsent=await unavailableSourceRecord(page,163,{pending:true});
  retryRelease();await bounded(retrySettled,'Retired fresh Play request');
  if(lateError)assert.match(lateError.message,/abort|cancel|closed|disposed|interception|not intercepted/i,'Only a retired request may prevent delivery of the held fresh image');
  await painted(page);await unavailableSourceRecord(page,163,{pending:true});await pause(1100);
  await unavailableSourceRecord(page,163,{pending:true});assert.equal(attempts,2,'Pause retires the pending image and does not retry or admit its late response');
  await picker(page).selectOption('166');await checked(page,166);await paused(page);
  await picker(page).selectOption('163');await checked(page,163);assert.equal(attempts,3);await paused(page);assert.equal(page.url(),url);
  departed=true;const secondHide=await persistedTransition(page,'pagehide');await pause(100);
  assert.deepEqual(departureRequests,[]);departed=false;const secondShow=await persistedTransition(page,'pageshow');
  await checked(page,163);assert.equal(attempts,4);await paused(page);assert.equal(page.url(),url);
  await pause(1100);await sameDisplayed(page,163);assert.equal(attempts,4,'A successful fresh restore stays paused without automatic replay or retry');
  t.diagnostic(JSON.stringify({events:[hide,show,secondHide,secondShow],failed_record:failed,paused_absent_record:pausedAbsent,late_request:lateError?.message??'fulfilled after retirement',departure_requests:departureRequests,scope:'Synthetic persisted lifecycle events with native checked PNG requests and an actual keyboard Play then Pause. This is not proof of browser BFCache admission.'}));
});

test('A declared persisted restore after pending initialization reports absent imagery when metadata fails',{timeout:30000},async t=>{
  const page=await fixture(t,{viewport:{width:320,height:900},colorScheme:'light',reducedMotion:'reduce',serviceWorkers:'block'});
  const index=await readFile(new URL('../../web/events.json',import.meta.url));
  let enter,release,finish,attempts=0,departed=false,firstError=null;
  const requested=new Promise(resolve=>enter=resolve),released=new Promise(resolve=>release=resolve),settled=new Promise(resolve=>finish=resolve);
  t.after(()=>release());const departureRequests=[];
  page.on('request',request=>{if(departed&&/\/assets\/el-reno-2013\/radar\/frame-\d+\.png$/.test(request.url()))departureRequests.push(new URL(request.url()).pathname);});
  await page.route('**/events.json',async route=>{
    attempts++;
    if(attempts!==1){await route.fulfill({status:503,contentType:'text/plain',body:'Declared source metadata failure'});return;}
    enter();await released;
    try{await route.fulfill({status:200,contentType:'application/json',body:index});}
    catch(error){firstError=error;}
    finally{finish();}
  });
  await page.goto(base+'/radar-source.html?frame=163');await bounded(requested,'Initial source metadata request');
  await page.waitForFunction(()=>{const image=document.querySelector('#radar-source-image');return image?.complete&&image.naturalWidth===597&&image.naturalHeight===599;});
  assert.equal(await page.locator('#radar-reader-controls').isVisible(),false);
  assert.equal(await page.locator('#radar-source-image').getAttribute('src'),original(151).file);
  const url=page.url();departed=true;const hide=await persistedTransition(page,'pagehide');
  assert.equal(await page.locator('#radar-source-image').getAttribute('src'),null);
  release();await bounded(settled,'Retired initialization route');
  if(firstError)assert.match(firstError.message,/abort|cancel|closed|disposed|interception|not intercepted/i,'Only a retired request may prevent delivery of the original held metadata');
  await pause(100);assert.deepEqual(departureRequests,[],'Pending initialization cannot start a replacement image request during departure');
  departed=false;const show=await persistedTransition(page,'pageshow');
  await page.locator('#radar-reader-reload').waitFor({state:'visible'});const failed=await unavailableSourceRecord(page,151);
  assert.equal(await page.locator('#radar-reader-controls').isVisible(),false);
  assert.equal(new URL(await page.locator('#radar-reader-reload').getAttribute('href'),page.url()).href,url);
  assert.equal(page.url(),url);assert.equal(attempts,2);
  await pause(1100);assert.equal(attempts,2,'The failed fresh initialization remains an explicit reload choice');
  assert.deepEqual(departureRequests,[]);
  t.diagnostic(JSON.stringify({events:[hide,show],failed_record:failed,metadata_attempts:attempts,retired_initial_request:firstError?.message??'fulfilled after retirement',scope:'Declared persisted lifecycle, a held native metadata request and a failed fresh metadata response. No native BFCache claim.'}));
});

test('Without scripts the original complete frame 151 and its source explanation remain readable',{timeout:20000},async t=>{
  const page=await fixture(t,{javaScriptEnabled:false,viewport:{width:320,height:900},serviceWorkers:'block'});
  await page.goto(base+'/radar-source.html?frame=184');
  await page.waitForFunction(()=>{const image=document.querySelector('#radar-source-image');return image?.complete&&image.naturalWidth===597&&image.naturalHeight===599;});
  assert.equal(await page.locator('#radar-reader-controls').isVisible(),false);
  const image=page.locator('#radar-source-image');assert.equal(await image.getAttribute('src'),original(151).file);
  assert.match(await page.locator('#radar-source-caption').textContent(),/Original GIF frame 151/);
  assert.match(await page.locator('#radar-source-caption').textContent(),/230137/);
  assert.equal(new URL(await page.locator('#radar-frame-original').getAttribute('href'),page.url()).href,base+'/'+original(151).file);
  const response=await page.request.get(base+'/'+original(151).file);assert.equal(response.status(),200);assert.equal(sha(await response.body()),original(151).sha);
  assert.match(await page.locator('main').textContent(),/The comparison establishes extraction fidelity/);
  assert.equal(await page.getByRole('link',{name:'Original published GIF',exact:true}).getAttribute('href'),'https://www.weather.gov/images/oun/wxevents/20130531/radar/NWRT_20130531_ElReno.gif');
  await completeExtent(page);
});

test('Native Replay to Reader to Back preserves time, radar source and documentary entry at both widths',{timeout:60000},async t=>{
  for(const width of [320,1280]){
    const page=await fixture(t,{viewport:{width,height:900},reducedMotion:'reduce',serviceWorkers:'block'});
    const sourceURL=base+'/reconstruction.html?event=el-reno-2013&t=720&footage_source=robinson-dashcam';
    await page.goto(sourceURL);await page.locator('#replay-time:not([disabled])').waitFor();
    assert.equal(await page.locator('#replay-time').inputValue(),'720');
    const before=await page.evaluate(()=>({href:location.href,state:history.state,length:history.length}));
    const link=page.locator('#replay-radar-reader');
    assert.equal(new URL(await link.getAttribute('href'),page.url()).href,base+'/radar-source.html?frame=163');
    assert.equal(await page.locator('#replay-radar-source').getAttribute('href'),'index.html#path');
    await keyboard(page,link);await checked(page,163);
    const readerHistory=await page.evaluate(()=>history.length);
    await picker(page).selectOption('166');await checked(page,166);
    assert.equal(await page.evaluate(()=>history.length),readerHistory,'Within-reader selection replaces only its current entry');
    await page.goBack();await page.locator('#replay-time:not([disabled])').waitFor();
    assert.equal(page.url(),before.href);assert.equal(await page.locator('#replay-time').inputValue(),'720');
    assert.equal(await page.locator('#replay-play').textContent(),'Play timeline');
    assert.deepEqual(await page.evaluate(()=>history.state),before.state);
    assert.equal(new URL(page.url()).searchParams.get('footage_source'),'robinson-dashcam');
    assert.match(await page.locator('#replay-radar-image').getAttribute('src'),/frame-163\.png$/);
    assert.equal(new URL(await link.getAttribute('href'),page.url()).searchParams.get('frame'),'163');
    await page.goto(base+'/index.html?t=720#path');await page.locator('#timeline:not([disabled])').waitFor();
    assert.equal(await page.locator('#timeline').inputValue(),'720');
    await page.locator('#timeline-media-mode').selectOption('radar');
    const documentary=page.locator('#timeline-media-caption a').filter({hasText:'Browse the retained radar observations and source'});
    assert.equal(new URL(await documentary.getAttribute('href'),page.url()).href,base+'/radar-source.html?frame=163');
    assert.equal(await page.locator('#timeline').inputValue(),'720');
  }
});

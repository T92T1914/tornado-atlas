import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,base} from './harness.mjs';

// These literal published identities are independent of the viewport adapter.
// Full bytes, rights, marks, real drawing and paused tracer coordinates also
// retain their separate controls in laboratory-reading-evidence and wind-appearance.
const REFERENCES={
 'el-reno-2013':{file:'el-reno-2013-854b56dffaf8720e27be.json',media:'nolte-231037-full-documentary',asset:'assets/el-reno-2013/nolte-231037-full.jpg',width:1920,height:1080},
 'joplin-2011':{file:'joplin-2011-68dca24097277ba2afb7.json',media:'friskey-joplin-storm',asset:'assets/joplin-2011/storm.jpg',width:1557,height:932},
 'blackwell-1955':{file:'blackwell-1955-9e74182ea8d0076dae45.json',media:'nara-blackwell-aerial-aftermath',asset:'assets/blackwell-1955/nara-283884.jpg',width:3000,height:2371},
 'tuscaloosa-birmingham-2011':{file:'tuscaloosa-birmingham-2011-63b08e0460f38874aeb9.json',media:'oliveira-2019-tornado-video-frames',asset:'assets/tuscaloosa-birmingham-2011/tornado-video-frames-oliveira2019.png',width:1351,height:767},
 'moore-2013':{file:'moore-2013-5ed36647a0e6141f8dde.json',media:'moore-medical-center-survey',asset:'assets/moore-2013/IMG_9287-800.jpg',width:800,height:533},
 'udall-1955':{file:'udall-1955-ea29259561776155de0d.json',media:'nws-blackwell-warning2',asset:'assets/blackwell-1955/nws-warning2.jpg',width:608,height:436},
};
const ABORTED=/Target page, context or browser has been closed|Request with the provided ID does not exist|Invalid InterceptionId|No resource with given identifier|interception.*(?:not found|cancelled|canceled)|request.*(?:cancelled|canceled|aborted)|Route is already handled/i;
const NATIVE_ABORT=/abort|cancel|NS_BINDING_ABORTED/i;
const small=error=>({name:String(error.name).slice(0,64),message:String(error.message).slice(0,240)});
function deferred(){let resolve;const promise=new Promise(value=>{resolve=value;});return{promise,resolve};}
async function bounded(promise,label,ms=10000){let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(label+' exceeded '+ms+'ms')),ms);})]);}finally{clearTimeout(timer);}}
async function frames(page){await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));}
const sceneId=kind=>kind==='form'?'scene':'wind-field';

// Register this before fixture's context-close hook. No response is fetched or
// copied: a positive held request is continued once, through the loopback server.
function ownedScope(t){
 let page,original=null,last=Date.now(),requests=0,documentSequence=0;
 const pending=new Set(),holds=[],routeTasks=new Set(),faults=[];
 const requestRows=new Map(),epoch=Date.now();
 const elapsed=()=>Date.now()-epoch;
 const requestIdentity=request=>requestRows.get(request)?.id??null;
 const documentState=async()=>{
  if(!page||page.isClosed())return{unavailable:'Owned page is absent or closed'};
  try{return await bounded(page.evaluate(()=>({url:location.href,timeOrigin:performance.timeOrigin,ready:document.readyState,event:document.getElementById('lab-reference-evidence')?.dataset.event??null,referenceState:document.getElementById('lab-reference-evidence')?.dataset.state??null})),'Read-only document diagnostic',1000);}
  catch(error){return{unavailable:small(error)};}
 };
 const fail=error=>{if(faults.length<24)faults.push(typeof error==='string'?error:small(error));};
 const record={holds:[],requests:0,rendering:null,scope:'Isolated controlled loading and geometry. No physical phone, historical fit or GPU measurement.'};
 t.after(async()=>{
  let cleanup=null;
  record.documentBeforeCleanup=await documentState();
  try{
   for(const hold of holds)hold.open.resolve();
   await bounded(Promise.all(holds.filter(hold=>hold.started).map(hold=>hold.done.promise)),'Held route retirement');
   const until=Date.now()+10000;
   while(pending.size||routeTasks.size||Date.now()-last<150){assert.ok(Date.now()<until,'Native request retirement exceeded 10000ms');await new Promise(resolve=>setTimeout(resolve,20));}
   assert.deepEqual(faults,[],'Unexpected request or route failure');
   record.drained=true;
  }catch(error){cleanup=error;record.cleanup=small(error);}
  try{if(page&&!page.isClosed())await page.evaluate(()=>window.__atlasViewportWatch?.stop());}catch(error){cleanup??=error;record.observationCleanup=small(error);}
  record.requests=requests;record.pending=pending.size;record.routeTasks=routeTasks.size;record.faults=faults;
  record.holds=holds.map(hold=>({stage:hold.phase,event:hold.event,started:hold.started,requestId:requestIdentity(hold.request),url:hold.request?.url().slice(0,240),method:hold.request?.method(),resource:hold.request?.resourceType(),retirement:hold.retirement,declaredSynthetic503:hold.failure,nativeFailure:hold.nativeFailure,failureClassification:hold.failureClassification??null,delivery:hold.delivery}));
  // Diagnostic selection is finite and never retires or reclassifies a request.
  // Preserve pending, failed and held identities first, then recent ordinary work.
  const selected=new Set([...pending].slice(-20));
  const priority=[...[...requestRows].filter(([,row])=>row.terminal==='failed').map(([request])=>request).reverse(),...holds.map(hold=>hold.request).filter(Boolean),...[...requestRows.keys()].reverse()];
  for(const request of priority){if(selected.size>=20)break;selected.add(request);}
  record.requestLifecycle={observedRows:requestRows.size,pendingIds:[...pending].map(requestIdentity).slice(-20),pendingDetailsTruncated:pending.size>20,failedNativeRequests:[...requestRows.values()].filter(row=>row.terminal==='failed').length,rows:[...selected].map(request=>requestRows.get(request)??{id:null,missing:true})};
  record.documentAfterCleanup=await documentState();
  if(original)record.original=small(original);
  const summary=JSON.stringify(record);assert.ok(Buffer.byteLength(summary,'utf8')<=32768,'Finite viewport diagnostic exceeds 32768 bytes');t.diagnostic('LAB_VIEWPORT '+summary);
  if(cleanup&&!original)throw cleanup;
 });
 return{
  record,
  documentSequence(){return documentSequence;},
  original(error){original=error;},
  attach(value){
   page=value;
   page.on('framenavigated',frame=>{if(frame===page.mainFrame())documentSequence++;});
   page.on('request',request=>{
    pending.add(request);last=Date.now();requests++;
    if(requestRows.size<256){let frameURL;try{frameURL=request.frame().url();}catch(error){frameURL='Unavailable: '+String(error.message);}
     const url=request.url();requestRows.set(request,{id:requests,url:url.slice(0,240),urlTruncated:url.length>240,method:request.method().slice(0,16),resource:request.resourceType().slice(0,24),frameURL:frameURL.slice(0,160),frameURLTruncated:frameURL.length>160,documentSequenceAtRequest:documentSequence,navigationRequest:request.isNavigationRequest(),observedMs:elapsed(),responseStatus:null,responseType:null,terminal:'pending',terminalEvents:[]});}
    if(requests>256){fail('Per-case request bound exceeded');page.context().close().catch(fail);}
   });
   page.on('response',response=>{const row=requestRows.get(response.request());if(row){row.responseStatus=response.status();row.responseType=(response.headers()['content-type']??null)?.slice(0,120)??null;row.responseMs=elapsed();}last=Date.now();});
   page.on('requestfinished',request=>{pending.delete(request);last=Date.now();const row=requestRows.get(request);if(row){row.terminal='finished';row.finishedMs=elapsed();if(row.terminalEvents.length<3)row.terminalEvents.push('finished');}});
   page.on('requestfailed',request=>{
    pending.delete(request);last=Date.now();const hold=holds.find(row=>row.request===request),error=String(request.failure()?.errorText??'Unknown native request failure').slice(0,240);
    const row=requestRows.get(request);if(row){row.terminal='failed';row.failure=error.slice(0,120);row.failedMs=elapsed();if(row.terminalEvents.length<3)row.terminalEvents.push('failed');}
    // The declared unsuccessful response is intentionally cancelled by the
    // bounded reader. Keep its native failed row; it is never a positive body.
    const declared503=hold?.failure===true&&row&&!row.urlTruncated&&row.url===hold.url&&row.method==='GET'&&row.resource==='fetch'&&row.responseStatus===503&&row.responseType==='text/plain'&&NATIVE_ABORT.test(error);
    if(declared503){hold.nativeFailure=error;hold.failureClassification='Declared synthetic 503 response-body cancellation';row.failureClassification=hold.failureClassification;}
    else if(hold?.retirement&&NATIVE_ABORT.test(error)){hold.nativeFailure=error;if(row)row.failureClassification='Explicitly retired held request';}
    else fail('Unexpected native request failure: '+error);
   });
  },
  async hold(event,phase,{failure=false}={}){
   const ref=REFERENCES[event];if(phase==='article')assert.equal(event,'moore-2013');
   const pathname=phase==='article'?'moore.html':phase==='index'?'archive/index.json':phase==='dossier'?'archive/'+ref.file:ref.asset;
   const hold={event,phase,url:base+'/'+pathname,failure,arrived:deferred(),open:deferred(),done:deferred(),started:false,request:null,retirement:null,nativeFailure:null,delivery:null};holds.push(hold);
   await page.route(base+'/'+pathname,route=>{
    const request=route.request();
    if(hold.started)return route.continue();
    hold.started=true;hold.request=request;
    const task=(async()=>{
     try{
      assert.equal(request.method(),'GET');assert.equal(request.resourceType(),phase==='article'?'document':'fetch');assert.equal(request.url(),base+'/'+pathname);
      if(phase==='article'){assert.equal(request.isNavigationRequest(),true);assert.equal(request.frame(),page.mainFrame());}
      hold.arrived.resolve();await hold.open.promise;
      if(failure){await route.fulfill({status:503,contentType:'text/plain',body:'Declared local documentary loading failure'});hold.delivery='declared synthetic 503';}
      else{await route.continue();hold.delivery='native continuation';}
     }catch(error){
      hold.delivery={error:small(error)};
      if(!(hold.retirement&&hold.nativeFailure&&ABORTED.test(error.message))){fail(error);try{await route.abort();}catch(abort){fail(abort);}}
     }finally{hold.done.resolve();last=Date.now();}
    })();routeTasks.add(task);task.catch(fail).finally(()=>{routeTasks.delete(task);last=Date.now();});return task;
   });
   return{
    wait:()=>bounded(hold.arrived.promise,'Actual '+phase+' request arrival'),
    release:async()=>{hold.open.resolve();await bounded(hold.done.promise,'Held '+phase+' continuation');},
    async terminal(){
     const until=Date.now()+10000;
     while(!['finished','failed'].includes(requestRows.get(hold.request)?.terminal)){assert.ok(Date.now()<until,'Actual '+phase+' native terminal exceeded 10000ms');await new Promise(resolve=>setTimeout(resolve,20));}
     const row=requestRows.get(hold.request);return{id:row.id,url:row.url,method:row.method,resource:row.resource,responseStatus:row.responseStatus,terminal:row.terminal,failure:row.failure??null};
    },
    retire(reason){hold.retirement=reason;},
   };
  },
  async quiet(label){
   const until=Date.now()+10000;
   while(pending.size||routeTasks.size||Date.now()-last<150){assert.ok(Date.now()<until,label+' exceeded 10000ms');await new Promise(resolve=>setTimeout(resolve,20));}
  },
 };
}

async function run(t,spec,body){
 const scope=ownedScope(t);
 try{
  const page=await fixture(t,{viewport:{width:spec.width,height:900},colorScheme:spec.scheme,reducedMotion:'reduce',serviceWorkers:'block'});scope.attach(page);
  await page.addInitScript(()=>{
   localStorage.setItem('tornado-atlas-appearance','system');
   const original=window.scrollBy;
   window.__atlasViewportScrollCalls=[];
   window.scrollBy=function(...args){
    const calls=window.__atlasViewportScrollCalls;if(calls.length<64)calls.push({at:performance.now(),top:typeof args[0]==='object'?args[0]?.top:args[1]});
    return Reflect.apply(original,this,args);
   };
  });
  await body(page,scope);
 }catch(error){scope.original(error);throw error;}
}
async function open(page,spec,held){
 await page.goto(base+'/'+(spec.kind==='form'?'study.html':'wind.html')+'?event='+spec.event,{waitUntil:'domcontentloaded'});
 await page.locator('#lab-context[data-experiment-ready="true"]').waitFor();await held.wait();
 if(spec.kind==='form')await page.waitForFunction(()=>!document.getElementById('motion').disabled||!document.getElementById('scene-failure').hidden);
 await page.evaluate(()=>document.fonts.ready);
 if(spec.enlarged)await enlargedText(page);
}
async function enlargedText(page){
 // Measure the normal computed source styles before doubling them. The hidden
 // probe makes the same CSS apply to future captions while their response is held.
 await page.evaluate(()=>{
  const probe=document.createElement('section');probe.id='lab-reference-evidence';probe.hidden=true;
  probe.innerHTML='<h3></h3><p class="lab-reference-role"></p><p class="lab-reference-boundary"></p><figure class="lab-reference-figure"><figcaption><p></p></figcaption></figure><nav class="lab-reference-actions"><a></a></nav>';
  document.getElementById('lab-context').append(probe);
  const selectors=['h3','.lab-reference-role','.lab-reference-boundary','.lab-reference-figure figcaption p','.lab-reference-actions a'];
  const styles=selectors.map(selector=>['#lab-reference-evidence '+selector,parseFloat(getComputedStyle(probe.querySelector(selector)).fontSize)*2]);probe.remove();
  const nodes=[document.body,...document.body.querySelectorAll('*')].filter(node=>node instanceof HTMLElement),fonts=nodes.map(node=>parseFloat(getComputedStyle(node).fontSize));
  nodes.forEach((node,index)=>{node.style.fontSize=fonts[index]*2+'px';});
  const style=document.createElement('style');style.textContent=styles.map(([selector,size])=>selector+'{font-size:'+size+'px!important}').join('\n');document.head.append(style);
 });
}
async function interact(page,kind,{key=true}={}){
 const scene=page.locator('#'+sceneId(kind));await scene.scrollIntoViewIfNeeded();await scene.focus();
 if(key)await page.keyboard.press('ArrowRight');
 await page.waitForFunction(()=>document.getElementById('lab-share').href===location.href);await frames(page);
 assert.equal(await page.evaluate(()=>document.activeElement?.id),sceneId(kind));
}
async function nativeControl(page,control){
 const target=page.locator('#'+control.id);await target.scrollIntoViewIfNeeded();await target.focus();
 const element=await target.evaluate(node=>({tag:node.tagName,type:node.type,value:node.value}));
 assert.equal(element.tag,control.id==='shape'?'SELECT':'INPUT');if(element.tag==='INPUT')assert.equal(element.type,'range');
 assert.notEqual(element.value,control.value,'The trusted key must change the actual control');
 await target.evaluate(node=>{
  window.__atlasNativeControlEvents=[];
  for(const type of ['keydown','input','change'])node.addEventListener(type,event=>{
   const events=window.__atlasNativeControlEvents;if(events.length<8)events.push({type:event.type,key:event.key??null,trusted:event.isTrusted,value:node.value});
  });
 });
 await page.keyboard.press(control.key);
 await page.waitForFunction(({id,value})=>document.getElementById(id).value===value&&window.__atlasNativeControlEvents.some(event=>event.type==='input'&&event.trusted&&event.value===value),{id:control.id,value:control.value});
 await settle(page);
 const events=await page.evaluate(()=>window.__atlasNativeControlEvents);
 assert.ok(events.some(event=>event.type==='keydown'&&event.trusted&&event.key===control.key),'The actual focused control receives the trusted key');
 assert.ok(events.some(event=>event.type==='input'&&event.trusted&&event.value===control.value),'The browser supplies the native input event and literal value');
 assert.equal(await target.inputValue(),control.value);assert.equal(await page.evaluate(()=>document.activeElement?.id),control.id);
 return{...control,events};
}
async function model(page,kind){
 return page.evaluate(async kind=>{
  const ids=kind==='form'?['shape','condensation','azimuth','elevation','distance','quality','sequence-coverage','sequence-rate','sequence-time']:['peak','radius','background','probe-x','probe-y','area','coefficient','travel','offset','threshold','capacity','passage-time','component-time'];
  const state={values:Object.fromEntries(ids.map(id=>[id,document.getElementById(id).value])),motion:document.getElementById(kind==='form'?'motion':'wind-motion').textContent};
  if(kind==='form'){state.dust=document.getElementById('dust').checked;state.sequence=document.getElementById('sequence-enabled').checked;state.stage=document.getElementById('sequence-stage').textContent;}
  else{
   state.passageMotion=document.getElementById('passage-play').textContent;state.componentMotion=document.getElementById('component-play').textContent;
   state.selected=[...document.querySelectorAll('#sampled-values-body tr[aria-current="true"]')].map(row=>row.id);
   const bytes=new TextEncoder().encode(document.getElementById('passage-line').getAttribute('d')??'');state.graph=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(value=>value.toString(16).padStart(2,'0')).join('');
  }
  return state;
 },kind);
}
async function position(page,kind,targetId=sceneId(kind)){
 return page.evaluate(({kind,targetId})=>{
  const node=document.getElementById(kind==='form'?'scene':'wind-field'),r=node.getBoundingClientRect();
  const area=Math.max(0,Math.min(r.right,innerWidth)-Math.max(r.left,0))*Math.max(0,Math.min(r.bottom,innerHeight)-Math.max(r.top,0));
  const target=document.getElementById(targetId).getBoundingClientRect(),targetArea=Math.max(0,Math.min(target.right,innerWidth)-Math.max(target.left,0))*Math.max(0,Math.min(target.bottom,innerHeight)-Math.max(target.top,0));
  return{rect:[r.left,r.top,r.width,r.height],visible:r.width*r.height>0?area/(r.width*r.height):0,targetId,targetRect:[target.left,target.top,target.width,target.height],targetVisible:target.width*target.height>0?targetArea/(target.width*target.height):0,scrollY,documentY:r.top+scrollY,focus:document.activeElement?.id,url:location.href,history:history.length,scrollCalls:window.__atlasViewportScrollCalls.length};
 },{kind,targetId});
}
async function watch(page,kind,targetId=sceneId(kind)){
 await page.evaluate(({kind,targetId})=>{
  const node=document.getElementById(kind==='form'?'scene':'wind-field'),first=node.getBoundingClientRect(),target=document.getElementById(targetId),firstTarget=target.getBoundingClientRect();let active=true,raf=0;
  const state={samples:0,frames:0,maxDx:0,maxDy:0,minVisible:1,targetMaxDx:0,targetMaxDy:0,targetMinVisible:1,capped:false};
  const visible=r=>{const area=Math.max(0,Math.min(r.right,innerWidth)-Math.max(r.left,0))*Math.max(0,Math.min(r.bottom,innerHeight)-Math.max(r.top,0));return r.width*r.height>0?area/(r.width*r.height):0;};
  const sample=()=>{const r=node.getBoundingClientRect(),control=target.getBoundingClientRect();state.samples++;state.maxDx=Math.max(state.maxDx,Math.abs(r.left-first.left));state.maxDy=Math.max(state.maxDy,Math.abs(r.top-first.top));state.minVisible=Math.min(state.minVisible,visible(r));state.targetMaxDx=Math.max(state.targetMaxDx,Math.abs(control.left-firstTarget.left));state.targetMaxDy=Math.max(state.targetMaxDy,Math.abs(control.top-firstTarget.top));state.targetMinVisible=Math.min(state.targetMinVisible,visible(control));};
  const observer=new ResizeObserver(()=>{if(active)sample();});observer.observe(node);if(target!==node)observer.observe(target);
  const tick=()=>{if(!active)return;sample();if(++state.frames>=1200){state.capped=true;stop();return;}raf=requestAnimationFrame(tick);};
  function stop(){active=false;cancelAnimationFrame(raf);observer.disconnect();return state;}
  window.__atlasViewportWatch={stop};tick();
 },{kind,targetId});
}
async function stopWatch(page){return page.evaluate(()=>window.__atlasViewportWatch.stop());}
async function reference(page,event){
 const ref=REFERENCES[event];await page.locator('#lab-reference-evidence[data-state="ready"][data-event="'+event+'"]').waitFor();
 const actual=await page.locator('#lab-reference-image').evaluate(image=>({complete:image.complete,hidden:image.hidden,width:image.naturalWidth,height:image.naturalHeight,asset:image.closest('a').getAttribute('href')}));
 assert.deepEqual(actual,{complete:true,hidden:false,width:ref.width,height:ref.height,asset:base+'/'+ref.asset});
 assert.equal(await page.locator('#lab-reference-evidence').getAttribute('data-media-id'),ref.media);
}
function stable(before,after,observed,kind){
 assert.equal(after.focus,before.focus,'Source arrival preserves current keyboard focus');
 assert.equal(after.url,before.url);assert.equal(after.history,before.history);
 for(const index of [0,1,2,3])assert.ok(Math.abs(after.rect[index]-before.rect[index])<=2,'Active scene geometry remains within 2 CSS pixels: '+JSON.stringify({before,after}));
 assert.equal(after.targetId,before.targetId);
 for(const index of [0,1,2,3])assert.ok(Math.abs(after.targetRect[index]-before.targetRect[index])<=2,'The chosen focus target remains within 2 CSS pixels: '+JSON.stringify({before,after}));
 assert.ok(!observed.capped,'Observation reached its finite frame bound');assert.ok(observed.samples>=2);
 assert.ok(observed.maxDx<=2&&observed.maxDy<=2,'Peak active scene movement remains within 2 CSS pixels: '+JSON.stringify(observed));
 assert.ok(observed.targetMaxDx<=2&&observed.targetMaxDy<=2,'Peak focused-control movement remains within 2 CSS pixels: '+JSON.stringify(observed));
 assert.ok(after.targetVisible>=.99&&observed.targetMinVisible>=.99,'The chosen initially visible target remains visible');
 // Native focus may put an external control on screen while the scene is already
 // offscreen. Keep that measured state distinct from crossing a visibility gate.
 if(kind==='form'&&before.visible>=.4)assert.ok(after.visible>=.4&&observed.minVisible>=.4,'Reference arrival does not cross the existing Form visibility threshold');
 if(kind==='form'&&before.targetId===sceneId(kind))assert.ok(before.visible>=.4,'Canvas cases retain their original Form visibility precondition');
 if(kind==='wind'&&before.visible>0)assert.ok(after.visible>0,'An initially visible Wind field remains visible; Form threshold is not assigned to Wind');
}
async function settle(page){await page.waitForFunction(()=>document.getElementById('lab-share').href===location.href);await frames(page);}
async function positive(page,scope,spec,held){
 const targetId=spec.control?.id??sceneId(spec.kind);
 if(spec.control)scope.record.nativeControl=await nativeControl(page,spec.control);else await interact(page,spec.kind);
 const before=await position(page,spec.kind,targetId),expected=await model(page,spec.kind);
 assert.equal(await page.locator('#lab-reference-evidence').getAttribute('data-state'),'loading');assert.equal(before.focus,targetId);assert.ok(before.targetVisible>=.99);
 if(!spec.control)assert.ok(before.visible>=.4,'Existing canvas positive cases retain their visibility precondition');
 scope.record.rendering=await page.evaluate(kind=>({available:document.getElementById(kind==='form'?'scene-failure':'wind-field-failure').hidden}),spec.kind);
 await watch(page,spec.kind,targetId);await held.release();await reference(page,spec.event);await frames(page);
 const after=await position(page,spec.kind,targetId),observed=await stopWatch(page);assert.deepEqual(await model(page,spec.kind),expected,'Reference arrival preserves the chosen model');
 scope.record.geometry={before,after,observed};stable(before,after,observed,spec.kind);
}

// Balanced reference/laboratory pairs. Each lab has both widths and appearances
// at every delay stage. Four cases double source text before any late insertion;
// four use an external native control, retaining eight canvas interaction cases.
const MATRIX=[
 ['el-reno-2013','form',1280,'dark','image',false,{id:'shape',key:'r',value:'rope'}],['el-reno-2013','wind',320,'light','index',true],
 ['joplin-2011','form',320,'light','image',false,{id:'condensation',key:'Home',value:'35'}],['joplin-2011','wind',1280,'dark','index',true,{id:'peak',key:'End',value:'250'}],
 ['blackwell-1955','form',1280,'light','dossier',true],['blackwell-1955','wind',320,'dark','image',false],
 ['tuscaloosa-birmingham-2011','form',320,'dark','dossier',true],['tuscaloosa-birmingham-2011','wind',1280,'light','image',false],
 ['moore-2013','form',1280,'dark','index',false],['moore-2013','wind',320,'light','dossier',false,{id:'peak',key:'Home',value:'10'}],
 ['udall-1955','form',320,'light','index',false],['udall-1955','wind',1280,'dark','dossier',false],
];
for(const[event,kind,width,scheme,phase,enlarged,control]of MATRIX)test('Active laboratory survives delayed '+phase+' '+kind+' '+event+' '+width+' '+scheme+(enlarged?' enlarged':'')+(control?' focused '+control.id:''),{timeout:25000},async t=>{
 const spec={event,kind,width,scheme,phase,enlarged,control};await run(t,spec,async(page,scope)=>{const held=await scope.hold(event,phase);await open(page,spec,held);await positive(page,scope,spec,held);});
});

for(const spec of [{kind:'form',width:320,scheme:'light',event:'el-reno-2013',phase:'image'},{kind:'wind',width:1280,scheme:'dark',event:'moore-2013',phase:'dossier'}])test('Unavailable reference and keyboard retry preserve active '+spec.kind,{timeout:25000},async t=>run(t,spec,async(page,scope)=>{
 const failed=await scope.hold(spec.event,spec.phase,{failure:true});await open(page,spec,failed);await interact(page,spec.kind);const expected=await model(page,spec.kind),before=await position(page,spec.kind);
 await watch(page,spec.kind);await failed.release();await page.locator('#lab-reference-evidence[data-state="unavailable"]').waitFor();await frames(page);
 const after=await position(page,spec.kind),observed=await stopWatch(page);stable(before,after,observed,spec.kind);assert.deepEqual(await model(page,spec.kind),expected);
 const retry=await scope.hold(spec.event,spec.phase);await page.locator('#lab-reference-retry').focus();await page.keyboard.press('Enter');await retry.wait();assert.deepEqual(await model(page,spec.kind),expected);
 await positive(page,scope,spec,retry);
}));

for(const spec of [{kind:'form',width:1280,scheme:'light',event:'el-reno-2013',phase:'index'},{kind:'wind',width:320,scheme:'dark',event:'joplin-2011',phase:'image'}])test('Actual reference deadline preserves active '+spec.kind,{timeout:35000},async t=>run(t,spec,async(page,scope)=>{
 const held=await scope.hold(spec.event,spec.phase);await open(page,spec,held);await interact(page,spec.kind);const before=await position(page,spec.kind),expected=await model(page,spec.kind);
 held.retire('Declared real source deadline');await watch(page,spec.kind);
 await page.locator('#lab-reference-evidence[data-state="unavailable"]').waitFor({timeout:13000});assert.match(await page.locator('#lab-reference-status').textContent(),/too long/);
 await held.release();await frames(page);const after=await position(page,spec.kind),observed=await stopWatch(page);stable(before,after,observed,spec.kind);assert.deepEqual(await model(page,spec.kind),expected);
 scope.record.geometry={before,after,observed};assert.equal(await page.locator('#lab-reference-retry').isVisible(),true);
}));

test('Empty Form reference retires late image and viewport work',{timeout:25000},async t=>{
 const spec={kind:'form',width:1280,scheme:'dark',event:'moore-2013'};await run(t,spec,async(page,scope)=>{
  const held=await scope.hold(spec.event,'image');await open(page,spec,held);await interact(page,spec.kind);const expected=await model(page,spec.kind);held.retire('Explicit empty reference selection');
  await page.locator('#lab-event').selectOption('');await settle(page);const current=await position(page,spec.kind);await held.release();await frames(page);
  assert.equal(await page.locator('#lab-reference-evidence').getAttribute('data-state'),'empty');assert.equal(await page.locator('#lab-reference-evidence').isHidden(),true);assert.equal(await page.locator('#lab-reference-image').count(),0);
  assert.deepEqual(await model(page,spec.kind),expected);assert.equal((await position(page,spec.kind)).scrollCalls,current.scrollCalls,'Retired work does not force an old position');
 });
});
test('Wind reference switch owns its source and ignores late dossier work',{timeout:25000},async t=>{
 const spec={kind:'wind',width:320,scheme:'light',event:'joplin-2011'};await run(t,spec,async(page,scope)=>{
  const held=await scope.hold(spec.event,'dossier');await open(page,spec,held);await interact(page,spec.kind);const expected=await model(page,spec.kind);held.retire('Explicit new reference selection');
  await page.locator('#lab-event').selectOption('el-reno-2013');await reference(page,'el-reno-2013');await settle(page);const current=await position(page,spec.kind);
  await held.release();await frames(page);await reference(page,'el-reno-2013');assert.deepEqual(await model(page,spec.kind),expected);
  const after=await position(page,spec.kind);assert.equal(after.scrollCalls,current.scrollCalls);assert.equal(after.url,current.url);assert.equal(after.history,current.history);
 });
});
test('Visitor wheel scroll retires the previous Form position',{timeout:25000},async t=>{
 const spec={kind:'form',width:1280,scheme:'dark',event:'el-reno-2013'};await run(t,spec,async(page,scope)=>{
  const held=await scope.hold(spec.event,'image');await open(page,spec,held);await interact(page,spec.kind);const initial=await position(page,spec.kind);
  await page.mouse.move(8,8);await page.mouse.wheel(0,180);await page.waitForFunction(value=>Math.abs(scrollY-value)>10,initial.scrollY);await frames(page);
  const current=await position(page,spec.kind),expected=await model(page,spec.kind);await held.release();await reference(page,spec.event);await frames(page);
  const after=await position(page,spec.kind);assert.equal(after.scrollCalls,current.scrollCalls,'Arrival must not undo trusted wheel intent');assert.equal(after.focus,current.focus);assert.deepEqual(await model(page,spec.kind),expected);
 });
});
test('Keyboard focus outside the Wind model retires the previous position',{timeout:25000},async t=>{
 const spec={kind:'wind',width:320,scheme:'light',event:'moore-2013'};await run(t,spec,async(page,scope)=>{
  const held=await scope.hold(spec.event,'image');await open(page,spec,held);await interact(page,spec.kind);await page.keyboard.press('Shift+Tab');
  const focus=await page.evaluate(()=>({tag:document.activeElement.tagName,href:document.activeElement.getAttribute('href'),inside:!!document.activeElement.closest('.study-controls,.scene-footer,.passage')}));
  assert.equal(focus.tag,'A');assert.equal(focus.inside,false);const expected=await model(page,spec.kind),current=await position(page,spec.kind);
  await held.release();await reference(page,spec.event);await frames(page);assert.deepEqual(await model(page,spec.kind),expected);
  assert.deepEqual(await page.evaluate(()=>({tag:document.activeElement.tagName,href:document.activeElement.getAttribute('href'),inside:!!document.activeElement.closest('.study-controls,.scene-footer,.passage')})),focus);
  assert.equal((await position(page,spec.kind)).scrollCalls,current.scrollCalls,'Arrival must not restore the abandoned model position');
 });
});
test('A new pointer orbit owns the current Form inspection',{timeout:25000},async t=>{
 const spec={kind:'form',width:320,scheme:'light',event:'blackwell-1955'};await run(t,spec,async(page,scope)=>{
  const held=await scope.hold(spec.event,'dossier');await open(page,spec,held);await interact(page,spec.kind);const first=await model(page,spec.kind),box=await page.locator('#scene').boundingBox();assert.ok(box);
  await page.mouse.move(box.x+box.width*.45,box.y+box.height*.5);await page.mouse.down();await page.mouse.move(box.x+box.width*.55,box.y+box.height*.52,{steps:3});await page.mouse.up();await settle(page);
  const available=await page.locator('#scene-failure').isHidden();scope.record.rendering={available};const expected=await model(page,spec.kind);if(available)assert.notEqual(expected.values.azimuth,first.values.azimuth);
  const before=await position(page,spec.kind);await watch(page,spec.kind);await held.release();await reference(page,spec.event);await frames(page);
  const after=await position(page,spec.kind),observed=await stopWatch(page);stable(before,after,observed,spec.kind);assert.deepEqual(await model(page,spec.kind),expected);scope.record.geometry={before,after,observed};
 });
});
test('Native departure and Back retire old Wind viewport work',{timeout:25000},async t=>{
 const spec={kind:'wind',width:1280,scheme:'dark',event:'moore-2013'};await run(t,spec,async(page,scope)=>{
  const held=await scope.hold(spec.event,'index');await open(page,spec,held);await interact(page,spec.kind);const expected=await model(page,spec.kind),saved=page.url();
  const previousDocument=await page.evaluate(()=>({url:location.href,timeOrigin:performance.timeOrigin})),previousSequence=scope.documentSequence(),article=await scope.hold(spec.event,'article');
  held.retire('Ordinary article navigation; old request drained before document commit');
  const link=page.locator('#lab-reference-links a').first();await link.focus();await page.keyboard.press('Enter');await article.wait();
  const beforeCommit={url:page.url(),frameURL:page.mainFrame().url(),sequence:scope.documentSequence()};
  assert.equal(beforeCommit.url,previousDocument.url);assert.equal(beforeCommit.frameURL,previousDocument.url);assert.equal(beforeCommit.sequence,previousSequence,'The native destination request is held before any document commit');
  scope.record.beforeDocumentCommit={previousDocument,beforeCommit};
  await held.release();scope.record.oldReferenceTerminal=await held.terminal();
  await article.release();await page.waitForURL(base+'/moore.html#damage-and-buildings');scope.record.articleTerminal=await article.terminal();
  assert.equal(scope.record.articleTerminal.terminal,'finished');assert.equal(scope.record.articleTerminal.responseStatus,200);
  // Do not orphan article images by returning while their native work is active.
  await scope.quiet('Article request retirement before Back');scope.record.articleQuietBeforeBack=true;
  await page.goBack();await page.locator('#lab-context[data-experiment-ready="true"]').waitFor();await reference(page,spec.event);await settle(page);
  assert.equal(page.url(),saved);assert.deepEqual(await model(page,spec.kind),expected);
  scope.record.returnedDocument=await page.evaluate(()=>({path:location.pathname,event:document.getElementById('lab-event').value,timeOrigin:performance.timeOrigin}));
  assert.equal(scope.record.returnedDocument.event,spec.event);
 });
});

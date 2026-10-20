import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fixture,base} from './harness.mjs';
import {observeLabReferenceNavigation} from './lab-reference-navigation-diagnostics.mjs';

// Existing published copy, independently pinned before this diagnostic increment.
const MOORE={asset:'assets/moore-2013/IMG_9287-800.jpg',bytes:339582,
  sha256:'f10b6b33fbcecd2c228632d2d681bbef47e58876246b753a04721dda3a58c6bb',
  width:800,height:533,revision:'b871ef828cd8a1c475bc73722264a178d63deb9266d9ecb4d699eb5c636c9b7c'};
const CANCELLED_FULFILL=/Target page, context or browser has been closed|Request with the provided ID does not exist|Invalid InterceptionId|No resource with given identifier|interception.*(?:not found|cancelled|canceled)|request.*(?:cancelled|canceled|aborted)|Route is already handled/i;
const smallError=error=>({name:String(error.name).slice(0,64),message:String(error.message).slice(0,256)});
function deferred(){let resolve;const promise=new Promise(value=>{resolve=value;});return {promise,resolve};}
async function bounded(promise,label){
  let timer;
  try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(label+' did not settle within 10000 milliseconds')),10000);})]);}
  finally{clearTimeout(timer);}
}
async function finish(t,diagnostics,label,record){
  const text=JSON.stringify({label,...record});
  assert.ok(Buffer.byteLength(text,'utf8')<=4096,'Finite control summary exceeds its diagnostic bound');
  t.diagnostic('LAB_REFERENCE_LIFECYCLE_CONTROL '+text);
  await diagnostics.report('body_finished');
}
async function closeBeforeCleanupRethrow(t,page,error,state){
  state.cleanup_context_close=page?'attempted':'no_owned_page_available';
  try{if(page){await bounded(page.context().close(),'Owned context close after cleanup failure');state.cleanup_context_close='closed';}}
  catch(closeError){state.cleanup_context_close='unconfirmed';state.cleanup_close_error=smallError(closeError);}
  try{t.diagnostic('LAB_REFERENCE_CLEANUP_FAILURE '+JSON.stringify({original:smallError(error),context:state.cleanup_context_close,close_error:state.cleanup_close_error??null}));}
  finally{throw error;}
}
function heldAsset(t){
  const arrived=deferred(),released=deferred(),finished=deferred(),nativeFailure=deferred();
  const state={enabled:false,started:false,retirement:null,native_failure:null,verified_status:null,
    verified_bytes:null,verified_sha256:null,fulfill:null,api_response_disposed:false,passed_fetches:0,passed_images:0};
  let page,request,unexpected=null;
  const requestFailed=value=>{
    if(value!==request)return;
    state.native_failure=String(value.failure()?.errorText??'unavailable').slice(0,256);nativeFailure.resolve();
  };
  // This precedes fixture registration, so held work is released before context close.
  t.after(async()=>{
    released.resolve();let cleanupFailure=unexpected;
    try{if(state.started)await bounded(finished.promise,'Owned held image retirement');}
    catch(error){cleanupFailure??=error;}
    finally{try{page?.off('requestfailed',requestFailed);}catch(error){cleanupFailure??=error;}}
    cleanupFailure??=unexpected;
    if(cleanupFailure)await closeBeforeCleanupRethrow(t,page,cleanupFailure,state);
  });
  return {state,
    async install(target){
      page=target;page.on('requestfailed',requestFailed);
      await page.route('**/'+MOORE.asset,async route=>{
        const candidate=route.request(),type=candidate.resourceType();
        if(type!=='fetch'||!state.enabled||state.started){
          if(type==='fetch')state.passed_fetches++;else if(type==='image')state.passed_images++;
          return route.continue();
        }
        state.started=true;request=candidate;let response;
        try{
          response=await route.fetch({maxRedirects:0,maxRetries:0,timeout:10000});
          const bytes=await response.body();
          state.verified_status=response.status();state.verified_bytes=bytes.length;
          state.verified_sha256=createHash('sha256').update(bytes).digest('hex');
          assert.equal(state.verified_status,200);assert.equal(bytes.length,MOORE.bytes);
          assert.equal(state.verified_sha256,MOORE.sha256);
          arrived.resolve();await released.promise;
          try{await route.fulfill({response,body:bytes});state.fulfill='returned';}
          catch(error){
            state.fulfill={error:smallError(error),native_failure:state.native_failure,retirement:state.retirement};
            if(!state.retirement||!state.native_failure||!CANCELLED_FULFILL.test(error.message))unexpected=error;
          }
        }catch(error){unexpected=error;arrived.resolve();}
        finally{
          try{if(response){await response.dispose();state.api_response_disposed=true;}}
          catch(error){unexpected??=error;}
          finished.resolve();
        }
      });
    },
    enable(){state.enabled=true;},
    async wait(){await bounded(arrived.promise,'Actual held image arrival');if(unexpected)throw unexpected;assert.equal(state.verified_status,200);},
    retiring(reason){state.retirement=reason;},
    async waitForFailure(){await bounded(nativeFailure.promise,'Actual retired image native failure');},
    async release(){released.resolve();await bounded(finished.promise,'Held image response release');if(unexpected)throw unexpected;assert.equal(state.api_response_disposed,true);}
  };
}
async function forceUnavailableForm(page){
  await page.addInitScript(()=>{
    const original=HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext=function(type,...args){
      return this.id==='scene'&&type==='webgl2'?null:Reflect.apply(original,this,[type,...args]);
    };
  });
}
async function experimentReady(page){
  await page.locator('#lab-context[data-experiment-ready="true"]').waitFor();
}
async function formState(page){
  return page.evaluate(()=>({selected:document.getElementById('lab-event').value,
    shape:document.getElementById('shape').value,condensation:document.getElementById('condensation').value,
    azimuth:document.getElementById('azimuth').value,quality:document.getElementById('quality').value,
    coverage:document.getElementById('sequence-coverage').value,position:document.getElementById('sequence-time').value,
    enabled:document.getElementById('sequence-enabled').checked,motion:document.getElementById('motion').textContent,
    motionDisabled:document.getElementById('motion').disabled,status:document.getElementById('motion-status').textContent}));
}
async function checkedMooreWidget(page){
  await page.locator('#lab-reference-evidence[data-state="ready"][data-event="moore-2013"]').waitFor();
  const image=page.locator('#lab-reference-image');
  const actual=await image.evaluate(async image=>{
    await image.decode();
    const bytes=await(await fetch(image.currentSrc)).arrayBuffer();
    const sha256=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(value=>value.toString(16).padStart(2,'0')).join('');
    return {bytes:bytes.byteLength,sha256,width:image.naturalWidth,height:image.naturalHeight,hidden:image.hidden};
  });
  assert.deepEqual(actual,{bytes:MOORE.bytes,sha256:MOORE.sha256,width:MOORE.width,height:MOORE.height,hidden:false});
  const host=page.locator('#lab-reference-evidence');
  assert.equal(await host.getAttribute('data-media-id'),'moore-medical-center-survey');
  assert.ok((await host.locator('.lab-reference-rights').innerText()).includes('NWS employee Doug Speheger'));
  assert.equal(await host.locator('.lab-reference-image-link').getAttribute('href'),base+'/'+MOORE.asset);
  const source=new URL(await host.getByRole('link',{name:'Read the item source and permission',exact:true}).getAttribute('href'));
  assert.equal(source.origin,new URL(base).origin);assert.equal(source.pathname,'/dossier.html');
  assert.deepEqual(Object.fromEntries(source.searchParams),{event:'moore-2013',source:'nws-event-hub',revision:MOORE.revision});
  assert.equal(source.hash,'#source-nws-event-hub');
  return actual;
}
// Literal complete default Form link, independent of the production serializer.
const SAVED_FORM_PARAMETERS={experiment:'form-1',event:'moore-2013',shape:'cone',condensation:'100',
  azimuth:'25',elevation:'12',distance:'7',dust:'1',quality:'7200',sequence:'0',
  coverage:'continuous',rate:'1',position:'0',phase:'0'};
async function savedMooreExperiment(page){
  const url=new URL(await page.locator('#lab-share').getAttribute('href'),base);
  assert.equal(url.origin,new URL(base).origin);assert.equal(url.pathname,'/study.html');
  assert.equal(url.hash,'');assert.equal(url.username,'');assert.equal(url.password,'');
  assert.equal([...url.searchParams].length,Object.keys(SAVED_FORM_PARAMETERS).length);
  assert.deepEqual(Object.fromEntries(url.searchParams),SAVED_FORM_PARAMETERS);
  return url.href;
}
async function nativeReturnAndBack(page,laboratoryURL){
  const link=page.locator('#scene-failure-return');
  assert.equal(await link.getAttribute('href'),'moore.html#survey-photographs');
  assert.match(await link.textContent(),/Moore.*documentary evidence/);
  await link.focus();assert.equal(await link.evaluate(node=>node===document.activeElement),true);
  await page.keyboard.press('Enter');await page.waitForURL(base+'/moore.html#survey-photographs');
  assert.equal(await page.locator('#survey-photographs').count(),1);
  await page.goBack();await experimentReady(page);await page.waitForURL(laboratoryURL);
  assert.equal(page.url(),laboratoryURL);
  assert.equal(await savedMooreExperiment(page),laboratoryURL);
}

test('Native caught image abort and bounded departing-document fetch evidence',{timeout:45000},async t=>{
  const held=heldAsset(t),replacementArrived=deferred(),replacementRelease=deferred(),replacementFinished=deferred();
  let replacementStarted=false,replacementError=null,ownedPage=null;
  const replacementCleanup={};
  t.after(async()=>{
    replacementRelease.resolve();let cleanupFailure=replacementError;
    try{if(replacementStarted)await bounded(replacementFinished.promise,'Owned replacement response');}
    catch(error){cleanupFailure??=error;}
    cleanupFailure??=replacementError;
    if(cleanupFailure)await closeBeforeCleanupRethrow(t,ownedPage,cleanupFailure,replacementCleanup);
  });
  const page=await fixture(t,{viewport:{width:320,height:900},serviceWorkers:'block'});ownedPage=page;
  const diagnostics=await observeLabReferenceNavigation(t,page,{base,label:'native-caught-fetch-control'});
  const record={control:'Synthetic same-origin document, no Atlas module',positive:null,abort:null,replacement:null};
  await held.install(page);
  const initial=base+'/__atlas-native-fetch-control.html',replacement=base+'/__atlas-native-fetch-replacement.html';
  await page.route(initial,route=>route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><meta charset="utf-8"><title>Native fetch control</title><p>Controlled native image fetch.</p>'}));
  await page.route(replacement,async route=>{
    replacementStarted=true;replacementArrived.resolve();
    try{await replacementRelease.promise;await route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><meta charset="utf-8"><title>Replacement control</title><p>Controlled replacement document.</p>'});}
    catch(error){replacementError=error;}
    finally{replacementFinished.resolve();}
  });
  try{
    await page.goto(initial);
    record.positive=await page.evaluate(async asset=>{
      const response=await fetch(asset,{cache:'no-store',credentials:'omit',redirect:'error',referrerPolicy:'no-referrer'});
      const bytes=await response.arrayBuffer();
      return {status:response.status,bytes:bytes.byteLength,sha256:[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(value=>value.toString(16).padStart(2,'0')).join(''),origin:location.origin};
    },MOORE.asset);
    assert.deepEqual(record.positive,{status:200,bytes:MOORE.bytes,sha256:MOORE.sha256,origin:new URL(base).origin});
    held.enable();
    await page.evaluate(asset=>{
      const controller=new AbortController();
      const state={controller,settled:false,handler_caught:false,error_name:null,error_message:null,signal_aborted:false};
      window.__atlasNativeAbortControl=state;
      state.promise=fetch(asset,{signal:controller.signal,cache:'no-store',credentials:'omit',redirect:'error',referrerPolicy:'no-referrer'})
        .then(()=>{state.outcome='unexpected_response';state.settled=true;})
        .catch(error=>{state.handler_caught=true;state.error_name=error.name;state.error_message=String(error.message).slice(0,256);state.signal_aborted=controller.signal.aborted;state.outcome='rejected';state.settled=true;});
    },MOORE.asset);
    await held.wait();held.retiring('explicit native AbortController.abort');
    await page.evaluate(()=>window.__atlasNativeAbortControl.controller.abort());
    await page.waitForFunction(()=>window.__atlasNativeAbortControl.settled);
    record.abort=await page.evaluate(()=>{const s=window.__atlasNativeAbortControl;return {outcome:s.outcome,handler_caught:s.handler_caught,error_name:s.error_name,error_message:s.error_message,signal_aborted:s.signal_aborted};});
    assert.equal(record.abort.outcome,'rejected');assert.equal(record.abort.handler_caught,true);
    assert.equal(record.abort.error_name,'AbortError');assert.equal(record.abort.signal_aborted,true);
    await held.waitForFailure();await held.release();
    const engine=page.context().browser().browserType().name();
    if(engine==='webkit'){
      const oldWindow=await page.evaluateHandle(()=>{window.__atlasNativeDocumentIdentity='retained-native-control';return window;});
      let navigationResult=null;
      const navigation=page.goto(replacement).then(()=>{navigationResult={status:'committed'};},error=>{navigationResult={status:'failed',error:smallError(error)};});
      try{
        await bounded(replacementArrived.promise,'Actual replacement document request');
        record.replacement_route_handlers_before=held.state.passed_fetches;
        record.replacement={executed:true,outcome:'pending_after_replacement_request'};
        record.replacement=await bounded(oldWindow.evaluate(async (old,asset)=>{
          const identity={marker:old.__atlasNativeDocumentIdentity,origin:old.location.origin,path:old.location.pathname};
          try{
            const response=await old.fetch(asset,{cache:'no-store',credentials:'omit',redirect:'error',referrerPolicy:'no-referrer'});
            const bytes=await response.arrayBuffer();
            return {executed:true,identity,outcome:'resolved',status:response.status,bytes:bytes.byteLength,
              sha256:[...new Uint8Array(await old.crypto.subtle.digest('SHA-256',bytes))].map(value=>value.toString(16).padStart(2,'0')).join('')};
          }catch(error){return {executed:true,identity,outcome:'caught_rejection',error_name:String(error.name).slice(0,64),error_message:String(error.message).slice(0,256)};}
        },MOORE.asset),'Caught fetch in retained departing document');
        assert.deepEqual(record.replacement.identity,{marker:'retained-native-control',origin:new URL(base).origin,path:'/__atlas-native-fetch-control.html'});
        // A departing document need not keep its request alive. Any pageerror still fails the strict fixture.
        assert.ok(['resolved','caught_rejection'].includes(record.replacement.outcome));
        if(record.replacement.outcome==='resolved'){
          assert.equal(record.replacement.status,200);assert.equal(record.replacement.bytes,MOORE.bytes);assert.equal(record.replacement.sha256,MOORE.sha256);
        }
      }finally{
        record.replacement_route_handlers_after=held.state.passed_fetches;
        try{await oldWindow.dispose();}finally{replacementRelease.resolve();}
        await bounded(navigation,'Replacement navigation after release');
        assert.deepEqual(navigationResult,{status:'committed'});
      }
    }else record.replacement={executed:false,reason:'WebKit-specific departing-document diagnostic; no replacement-stage acceptance on '+engine};
  }finally{
    record.held=held.state;replacementRelease.resolve();
    await finish(t,diagnostics,'native-caught-fetch-control',record);
  }
});

test('Pending documentary image retires on an empty Form reference selection',{timeout:45000},async t=>{
  const held=heldAsset(t);
  const page=await fixture(t,{viewport:{width:320,height:900},reducedMotion:'reduce',serviceWorkers:'block'});
  const diagnostics=await observeLabReferenceNavigation(t,page,{base,label:'widget-pending-empty-selection'});
  const record={control:'Actual widget, first Moore fetch held after checked source response'};
  await held.install(page);held.enable();await forceUnavailableForm(page);
  try{
    await page.goto(base+'/study.html');await experimentReady(page);
    await page.locator('#lab-event').selectOption('moore-2013');await held.wait();
    assert.equal(await page.locator('#lab-reference-evidence').getAttribute('data-state'),'loading');
    assert.equal(await page.locator('#scene-failure').isVisible(),true);
    held.retiring('actual empty reference selection');
    await page.locator('#lab-event').selectOption('');
    assert.equal(await page.locator('#lab-reference-evidence').isHidden(),true);
    assert.equal(await page.locator('#lab-reference-evidence').getAttribute('data-state'),'empty');
    await held.waitForFailure();await held.release();
    assert.equal(await page.locator('#lab-reference-image').count(),0);
    assert.equal(await page.locator('#scene-failure-return').getAttribute('href'),'atlas.html');
    assert.equal(await page.locator('#motion').isDisabled(),true);
    record.final=await formState(page);assert.equal(record.final.selected,'');
  }finally{record.held=held.state;await finish(t,diagnostics,'widget-pending-empty-selection',record);}
});

test('Pending documentary image retires through native Form return and Back',{timeout:45000},async t=>{
  const held=heldAsset(t);
  const page=await fixture(t,{viewport:{width:1280,height:900},reducedMotion:'reduce',serviceWorkers:'block'});
  const diagnostics=await observeLabReferenceNavigation(t,page,{base,label:'widget-pending-native-return'});
  const record={control:'Actual failure-return keyboard navigation and Back, original image still held'};
  await held.install(page);held.enable();await forceUnavailableForm(page);
  try{
    await page.goto(base+'/study.html');await experimentReady(page);
    await page.locator('#lab-event').selectOption('moore-2013');await held.wait();
    const before=await formState(page),laboratoryURL=await savedMooreExperiment(page);
    record.saved_laboratory_url=laboratoryURL;
    assert.equal(await page.locator('#lab-reference-evidence').getAttribute('data-state'),'loading');
    held.retiring('actual failure-return native navigation and Back');
    await nativeReturnAndBack(page,laboratoryURL);
    record.current=await checkedMooreWidget(page);
    // Navigation may retire this document without a requestfailed event. Record
    // the actual observation; the current decoded owner must survive late release.
    record.native_failure_observation={before_late_release:{
      observed:held.state.native_failure!==null,failure:held.state.native_failure}};
    await held.release();
    record.native_failure_observation.after_late_release={
      observed:held.state.native_failure!==null,failure:held.state.native_failure};
    assert.deepEqual(await formState(page),before);
    record.current_after_late_release=await checkedMooreWidget(page);
    assert.equal(await page.locator('#scene-failure').isVisible(),true);
    assert.equal(await page.locator('#motion').isDisabled(),true);
  }finally{record.held=held.state;await finish(t,diagnostics,'widget-pending-native-return',record);}
});

test('A fully decoded documentary reference preserves native Form return and Back',{timeout:45000},async t=>{
  const page=await fixture(t,{viewport:{width:320,height:900},reducedMotion:'reduce',serviceWorkers:'block'});
  const diagnostics=await observeLabReferenceNavigation(t,page,{base,label:'widget-complete-native-return'});
  const record={control:'Actual fully verified and decoded widget before native navigation'};
  await forceUnavailableForm(page);
  try{
    await page.goto(base+'/study.html?event=moore-2013');await experimentReady(page);
    record.before=await checkedMooreWidget(page);
    const before=await formState(page),laboratoryURL=await savedMooreExperiment(page);
    record.saved_laboratory_url=laboratoryURL;
    await nativeReturnAndBack(page,laboratoryURL);
    record.after=await checkedMooreWidget(page);
    assert.deepEqual(await formState(page),before);
    assert.equal(await page.locator('#scene-failure').isVisible(),true);
    assert.equal(await page.locator('#motion').isDisabled(),true);
  }finally{await finish(t,diagnostics,'widget-complete-native-return',record);}
});

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fixture,base} from './harness.mjs';
import {observeLabReferenceNavigation} from './lab-reference-navigation-diagnostics.mjs';

// Existing published copy, independently pinned before this diagnostic increment.
const MOORE={asset:'assets/moore-2013/IMG_9287-800.jpg',bytes:339582,
  sha256:'f10b6b33fbcecd2c228632d2d681bbef47e58876246b753a04721dda3a58c6bb',
  width:800,height:533,revision:'5ed36647a0e6141f8ddeeee30ef7be9e7bb6332613ed86428b3b9b5536b25e85'};
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
// Literal complete retained Form6 link, independent of the production serializer.
const SAVED_FORM_PARAMETERS={experiment:'form-6',event:'moore-2013',model:'genesis-v1',shape:'cone',condensation:'100',
  azimuth:'25',elevation:'12',distance:'7',dust:'1',quality:'7200',sequence:'1',
  coverage:'storm',rate:'1',position:'0',phase:'0',visibility:'ordinary',flow:'1',presentation:'storm-v1'};
const DEFAULT_FORM_PARAMETERS={...SAVED_FORM_PARAMETERS,experiment:'form-7',coverage:'storm-detail',presentation:'storm-v2'};
async function savedMooreExperiment(page,parameters=DEFAULT_FORM_PARAMETERS){
  const url=new URL(await page.locator('#lab-share').getAttribute('href'),base);
  assert.equal(url.origin,new URL(base).origin);assert.equal(url.pathname,'/study.html');
  assert.equal(url.hash,'');assert.equal(url.username,'');assert.equal(url.password,'');
  assert.equal([...url.searchParams].length,Object.keys(parameters).length);
  assert.deepEqual(Object.fromEntries(url.searchParams),parameters);
  return url.href;
}
async function nativeReturnAndBack(page,laboratoryURL,parameters=DEFAULT_FORM_PARAMETERS){
  const link=page.locator('#scene-failure-return');
  assert.equal(await link.getAttribute('href'),'moore.html#survey-photographs');
  assert.match(await link.textContent(),/Moore.*documentary evidence/);
  await link.focus();assert.equal(await link.evaluate(node=>node===document.activeElement),true);
  await page.keyboard.press('Enter');await page.waitForURL(base+'/moore.html#survey-photographs');
  assert.equal(await page.locator('#survey-photographs').count(),1);
  await page.goBack();await experimentReady(page);await page.waitForURL(laboratoryURL);
  assert.equal(page.url(),laboratoryURL);
  assert.equal(await savedMooreExperiment(page,parameters),laboratoryURL);
}

test('Native same-origin image success and caught abort preserve strict errors',{timeout:45000},async t=>{
  const held=heldAsset(t);
  const page=await fixture(t,{viewport:{width:320,height:900},serviceWorkers:'block'});
  const diagnostics=await observeLabReferenceNavigation(t,page,{base,label:'native-caught-fetch-control'});
  const record={control:'Synthetic same-origin document, no Atlas module',positive:null,abort:null};
  await held.install(page);
  const initial=base+'/__atlas-native-fetch-control.html';
  await page.route(initial,route=>route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><meta charset="utf-8"><title>Native fetch control</title><p>Controlled native image fetch.</p>'}));
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
  }finally{
    record.held=held.state;
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

async function stillPendingMoore(page,held){
  const host=page.locator('#lab-reference-evidence');
  assert.equal(await host.getAttribute('data-event'),'moore-2013');
  assert.equal(await host.getAttribute('data-state'),'loading');
  assert.equal(await host.getAttribute('aria-busy'),'true');
  assert.equal(await host.locator('#lab-reference-retry').isVisible(),false);
  assert.equal(held.state.native_failure,null);
}
async function stoppedPendingMoore(page){
  const host=page.locator('#lab-reference-evidence');
  await host.locator('#lab-reference-retry').waitFor({state:'visible'});
  assert.equal(await host.getAttribute('data-state'),'unavailable');
  assert.equal(await host.getAttribute('data-event'),'moore-2013');
  assert.equal(await host.getAttribute('aria-busy'),'false');
  assert.match(await host.locator('#lab-reference-status').innerText(),/image check stopped before leaving this page/i);
  assert.match(await host.locator('#lab-reference-status').innerText(),/If you stay here, retry the image/i);
  assert.equal(await host.getByRole('link',{name:'Read this item in its article',exact:true}).getAttribute('href'),base+'/moore.html#survey-photographs');
}
async function addControlLink(page,{id,href,target,download,prevented=false}){
  await page.evaluate(({id,href,target,download,prevented})=>{
    const link=document.createElement('a');link.id=id;link.href=href;link.textContent=id;
    if(target)link.target=target;if(download!==undefined)link.download=download;
    if(prevented)link.addEventListener('click',event=>{event.preventDefault();link.dataset.prevented=String(event.defaultPrevented);},{once:true});
    document.body.append(link);
  },{id,href,target,download,prevented});
  const link=page.locator('#'+id);await link.focus();
  assert.equal(await link.evaluate(node=>node===document.activeElement),true);
  return link;
}

test('Pending reference remains owned across same-document, prevented and new-context actions',{timeout:45000},async t=>{
  const held=heldAsset(t),ordinaryHeld=heldAsset(t),ordinaryAbort=deferred();let page,popup;
  t.after(async()=>{
    try{if(popup&&!popup.isClosed())await bounded(popup.close(),'Owned reference control popup close');}
    catch(error){await closeBeforeCleanupRethrow(t,page,error,{});}
  });
  page=await fixture(t,{viewport:{width:320,height:900},reducedMotion:'reduce',serviceWorkers:'block'});
  const diagnostics=await observeLabReferenceNavigation(t,page,{base,label:'widget-nondeparting-actions'});
  const record={control:'Actual pending widget; native same-document, prevented, new-tab, modified and download actions'};
  await held.install(page);held.enable();await forceUnavailableForm(page);
  const controlURL=base+'/__atlas-reference-owned-control.html',downloadURL=base+'/__atlas-reference-owned-control.txt';
  const eventPrefix='ATLAS_OWNED_DOWNLOAD_PHASE ',abortPrefix='ATLAS_OWNED_ORDINARY_IMAGE_ABORT ';
  const observed={columns:['phase','native','same_document','download_request','default_prevented','signal_aborted',
    'tag','id','source_href_is_owned','download','connected','owner_document_is_current','destination_is_owned','state','busy'],
    count:0,omitted:0,invalid:0,rows:[]};
  const observeConsole=message=>{
    const text=message.text();
    if(text.startsWith(eventPrefix)){
      observed.count++;
      try{
        const row=JSON.parse(text.slice(eventPrefix.length));
        if(!Array.isArray(row)||row.length!==observed.columns.length){observed.invalid++;return;}
        if(observed.rows.length<6)observed.rows.push(row);else observed.omitted++;
      }catch{observed.invalid++;}
    }else if(text.startsWith(abortPrefix)){
      try{ordinaryAbort.resolve(JSON.parse(text.slice(abortPrefix.length)));}
      catch{observed.invalid++;}
    }
  };
  page.on('console',observeConsole);t.after(()=>page.off('console',observeConsole));
  await page.addInitScript(({owned,prefix})=>{
    const observe=phase=>event=>{
      if(event.destination?.url!==owned)return;
      const source=event.sourceElement,attribute=source?.getAttribute?.('download');
      const host=document.getElementById('lab-reference-evidence');
      console.log(prefix+JSON.stringify([phase,event.isTrusted,event.destination.sameDocument,
        event.downloadRequest==null?null:true,event.defaultPrevented,event.signal?.aborted??null,
        source?.tagName?.slice(0,12)??null,source?.id?.slice(0,32)??null,source?.href===owned,
        attribute==null?null:String(attribute).slice(0,40),source?.isConnected??null,
        source?source.ownerDocument===document:null,true,host?.dataset.state??null,host?.getAttribute('aria-busy')??null]));
    };
    window.navigation?.addEventListener('navigate',observe('capture'),{capture:true});
    window.__atlasObserveOwnedDownloadLate=()=>{
      if(!window.navigation?.addEventListener)return false;
      window.navigation.addEventListener('navigate',observe('late'));return true;
    };
  },{owned:downloadURL,prefix:eventPrefix});
  await page.context().route(controlURL,route=>route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><title>Owned control</title><p id="owned-control-marker">Native new-context control.</p>'}));
  await page.route(downloadURL,route=>route.fulfill({status:200,contentType:'text/plain',headers:{'Content-Disposition':'attachment; filename="atlas-reference-control.txt"'},body:'Owned download control.'}));
  try{
    await page.goto(base+'/study.html');await experimentReady(page);
    record.download_event_api=await page.evaluate(()=>window.__atlasObserveOwnedDownloadLate());
    await page.locator('#lab-event').selectOption('moore-2013');await held.wait();
    const before=await formState(page);
    const contents=page.locator('.lab-contents a[href="#form-model-limits"]');
    await contents.focus();await page.keyboard.press('Enter');
    assert.equal(new URL(page.url()).hash,'#form-model-limits');await stillPendingMoore(page,held);
    const prevented=await addControlLink(page,{id:'owned-prevented-return',href:controlURL,prevented:true});
    await page.keyboard.press('Enter');assert.equal(await prevented.getAttribute('data-prevented'),'true');
    assert.equal(new URL(page.url()).pathname,'/study.html');await stillPendingMoore(page,held);
    await addControlLink(page,{id:'owned-blank-return',href:controlURL,target:'_blank'});
    let popupResponse;
    [popup,popupResponse]=await Promise.all([page.waitForEvent('popup'),
      page.context().waitForEvent('response',{timeout:10000,predicate:response=>response.url()===controlURL&&response.request().isNavigationRequest()}),
      page.keyboard.press('Enter')]);
    await popup.waitForLoadState('domcontentloaded');assert.equal(popup.url(),controlURL);
    assert.equal(popupResponse.request().frame().page(),popup);assert.equal(popupResponse.status(),200);
    assert.match(await popupResponse.text(),/id="owned-control-marker"/);
    assert.equal(await popup.locator('#owned-control-marker').innerText(),'Native new-context control.');
    await bounded(popup.close(),'Native new-tab control close');popup=null;
    await stillPendingMoore(page,held);
    const modified=await addControlLink(page,{id:'owned-modified-return',href:controlURL});
    const originalURL=page.url();
    await modified.evaluate(link=>link.addEventListener('click',event=>{
      const observed={trusted:event.isTrusted,ctrl:event.ctrlKey,meta:event.metaKey,button:event.button,
        default_before:event.defaultPrevented,target_is_link:event.target===link,href:link.href,target:link.target};
      event.preventDefault();observed.default_after=event.defaultPrevented;
      link.dataset.controlledModifier=JSON.stringify(observed);
    },{once:true}));
    await modified.click({modifiers:['Control']});
    const observedModifier=await modified.getAttribute('data-controlled-modifier');
    assert.notEqual(observedModifier,null,'The actual trusted Control-click must reach its target');
    const modifier=JSON.parse(observedModifier);
    assert.deepEqual(modifier,{trusted:true,ctrl:true,meta:false,button:0,default_before:false,
      target_is_link:true,href:controlURL,target:'',default_after:true});
    record.modified_navigation={scope:'CONTROLLED_PREVENTED_MODIFIER_ONLY',actual:modifier,
      unprevented_ctrl_newtab:'UNQUALIFIED: two retained native fixture attempts failed their event/response preconditions; no native Control-newtab pass or skip is claimed.'};
    assert.equal(page.url(),originalURL);
    await stillPendingMoore(page,held);
    await addControlLink(page,{id:'owned-download-return',href:downloadURL,download:'atlas-reference-control.txt'});
    const [download]=await Promise.all([page.waitForEvent('download'),page.keyboard.press('Enter')]);
    await bounded(download.cancel(),'Owned download cancellation');
    record.download={path:new URL(downloadURL).pathname,suggested_filename:download.suggestedFilename(),
      cancelled_by_control:true,event_count_before_assert:observed.count};
    record.download_events=observed;
    await stillPendingMoore(page,held);
    assert.equal(record.download.suggested_filename,'atlas-reference-control.txt');
    await held.release();record.current=await checkedMooreWidget(page);
    assert.deepEqual(await formState(page),before);record.final=await formState(page);
    // The same URL must still retire a new owner when the activation is no longer
    // a download. A remembered URL exemption would fail this positive control.
    await ordinaryHeld.install(page);ordinaryHeld.enable();
    await page.evaluate(({asset,prefix})=>{
      const original=window.fetch;
      window.fetch=function(...args){
        const result=Reflect.apply(original,this,args);
        try{
          const input=args[0],href=typeof input==='string'||input instanceof URL?String(input):input?.url;
          if(new URL(href,location.href).href===new URL(asset,location.href).href){
            const signal=args[1]?.signal;
            signal?.addEventListener('abort',()=>console.log(prefix+JSON.stringify({aborted:signal.aborted,
              event:document.getElementById('lab-reference-evidence')?.dataset.event??null})),{once:true});
          }
        }catch{console.log(prefix+JSON.stringify({observer_invalid:true}));}
        return result;
      };
    },{asset:MOORE.asset,prefix:abortPrefix});
    await page.locator('#lab-event').selectOption('');await page.locator('#lab-event').selectOption('moore-2013');
    await ordinaryHeld.wait();await stillPendingMoore(page,ordinaryHeld);
    const laboratoryURL=page.url(),saved=new URL(await page.locator('#lab-share').getAttribute('href'));
    assert.equal(saved.href,laboratoryURL);assert.equal(saved.origin,new URL(base).origin);assert.equal(saved.pathname,'/study.html');
    assert.equal(saved.hash,'#form-model-limits');assert.equal([...saved.searchParams].length,Object.keys(DEFAULT_FORM_PARAMETERS).length);
    assert.deepEqual(Object.fromEntries(saved.searchParams),DEFAULT_FORM_PARAMETERS);
    const oldTimeOrigin=await page.evaluate(()=>performance.timeOrigin);
    await page.locator('#owned-download-return').evaluate(link=>link.removeAttribute('download'));
    await page.unroute(downloadURL);
    await page.route(downloadURL,route=>route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><title>Ordinary same URL</title><p id="ordinary-same-url-marker">A normal document replaced the laboratory.</p>'}));
    await page.locator('#owned-download-return').focus();
    assert.equal(await page.locator('#owned-download-return').evaluate(link=>link===document.activeElement&&!link.hasAttribute('download')),true);
    ordinaryHeld.retiring('ordinary same-URL native activation after removing the download attribute');
    const [ordinaryResponse]=await Promise.all([page.waitForNavigation({waitUntil:'domcontentloaded',timeout:10000}),page.keyboard.press('Enter')]);
    assert.equal(page.url(),downloadURL);assert.equal(ordinaryResponse.status(),200);
    assert.match(await ordinaryResponse.text(),/id="ordinary-same-url-marker"/);
    assert.equal(await page.locator('#ordinary-same-url-marker').innerText(),'A normal document replaced the laboratory.');
    const actualAbort=await bounded(ordinaryAbort.promise,'Actual ordinary navigation image abort');
    assert.deepEqual(actualAbort,{aborted:true,event:'moore-2013'});
    const newTimeOrigin=await page.evaluate(()=>performance.timeOrigin);
    record.ordinary_same_url={pending_before:true,response_status:ordinaryResponse.status(),
      old_time_origin:oldTimeOrigin,new_time_origin:newTimeOrigin,new_document:newTimeOrigin!==oldTimeOrigin,signal_abort:actualAbort.aborted};
    assert.equal(record.ordinary_same_url.new_document,true);
    if(record.download_event_api){
      const lateOrdinary=observed.rows.filter(row=>row[0]==='late'&&row[9]===null).at(-1);
      record.ordinary_same_url.stopped_at_late_event=Boolean(lateOrdinary&&lateOrdinary[13]==='unavailable'&&lateOrdinary[14]==='false');
      assert.equal(record.ordinary_same_url.stopped_at_late_event,true);
    }
    await page.goBack();await experimentReady(page);await page.waitForURL(laboratoryURL);
    record.after_same_url_back=await checkedMooreWidget(page);
    assert.equal(await page.locator('#lab-share').getAttribute('href'),laboratoryURL);
    assert.deepEqual(await formState(page),before);
    await ordinaryHeld.release();
    assert.deepEqual(await checkedMooreWidget(page),record.after_same_url_back);
    assert.equal(observed.invalid,0);
  }finally{record.download_events=observed;record.held=held.state;record.ordinary_held=ordinaryHeld.state;
    await finish(t,diagnostics,'widget-nondeparting-actions',record);}
});

test('Canceled full-document departure leaves a stopped pending reference retryable',{timeout:45000},async t=>{
  const held=heldAsset(t);
  const page=await fixture(t,{viewport:{width:1280,height:900},reducedMotion:'reduce',serviceWorkers:'block'});
  const diagnostics=await observeLabReferenceNavigation(t,page,{base,label:'widget-canceled-native-departure'});
  const record={control:'Actual pending owner; native Navigation API departure canceled after the production listener'};
  await held.install(page);held.enable();await forceUnavailableForm(page);
  try{
    await page.goto(base+'/study.html');await experimentReady(page);
    await page.locator('#lab-event').selectOption('moore-2013');await held.wait();
    const before=await formState(page),laboratoryURL=await savedMooreExperiment(page),originalURL=page.url();
    record.original_document=await page.evaluate(()=>({time_origin:performance.timeOrigin,path:location.pathname}));
    held.retiring('full-document navigate event followed by native cancellation');
    record.cancellation=await page.evaluate(async href=>{
      const stoppedDocument=()=>{
        const host=document.getElementById('lab-reference-evidence'),button=document.getElementById('lab-reference-retry');
        const style=getComputedStyle(button),rect=button.getBoundingClientRect();
        return {time_origin:performance.timeOrigin,path:location.pathname,event:host.dataset.event,
          media:host.dataset.mediaId,state:host.dataset.state,busy:host.getAttribute('aria-busy'),hidden:host.hidden,
          status:document.getElementById('lab-reference-status').textContent,
          article:host.querySelector('.lab-reference-actions a').href,
          retry:{id:button.id,text:button.textContent,hidden:button.hidden,disabled:button.disabled,
            display:style.display,visibility:style.visibility,opacity:Number(style.opacity),width:rect.width,height:rect.height}};
      };
      if(typeof window.navigation?.navigate!=='function'){
        // Controlled existing-handler coverage only, not a native-cancellation claim.
        window.dispatchEvent(new Event('beforeunload',{cancelable:true}));
        return {native_api_available:false,native_cancellation_executed:false,controlled_beforeunload_dispatched:true,
          stopped_document:stoppedDocument()};
      }
      const observed={native_api_available:true,native_cancellation_executed:true,events:[]};
      const cancel=event=>{
        if(event.destination.url!==href)return;
        const row={same_document:event.destination.sameDocument,default_before:event.defaultPrevented};
        event.preventDefault();row.default_after=event.defaultPrevented;observed.events.push(row);
      };
      navigation.addEventListener('navigate',cancel);
      try{
        const result=navigation.navigate(href);
        // Attach both handlers immediately. A canceled NavigationResult rejects both.
        const watch=promise=>promise.then(()=>({outcome:'resolved'}),error=>({outcome:'rejected',name:error.name}));
        const committed=watch(result.committed),finished=watch(result.finished);
        [observed.committed,observed.finished]=await Promise.all([committed,finished]);
        observed.stopped_document=stoppedDocument();
        return observed;
      }finally{navigation.removeEventListener('navigate',cancel);}
    },base+'/__atlas-reference-canceled-departure.html');
    if(record.cancellation.native_api_available){
      assert.deepEqual(record.cancellation.events,[{same_document:false,default_before:false,default_after:true}]);
      assert.equal(record.cancellation.committed.outcome,'rejected');assert.equal(record.cancellation.finished.outcome,'rejected');
    }
    assert.equal(page.url(),originalURL);
    // Read the actual surviving document without locator action prechecks that
    // can remain blocked on the canceled WebKit navigation. No navigation is reset.
    const stopped=record.cancellation.stopped_document;
    assert.equal(stopped.time_origin,record.original_document.time_origin);assert.equal(stopped.path,'/study.html');
    assert.deepEqual({event:stopped.event,media:stopped.media,state:stopped.state,busy:stopped.busy,hidden:stopped.hidden},
      {event:'moore-2013',media:'moore-medical-center-survey',state:'unavailable',busy:'false',hidden:false});
    assert.equal(stopped.status,'The image check stopped before leaving this page. If you stay here, retry the image or use its article and source links.');
    assert.equal(stopped.article,base+'/moore.html#survey-photographs');
    assert.deepEqual({id:stopped.retry.id,text:stopped.retry.text,hidden:stopped.retry.hidden,disabled:stopped.retry.disabled},
      {id:'lab-reference-retry',text:'Retry documentary image',hidden:false,disabled:false});
    assert.notEqual(stopped.retry.display,'none');assert.equal(stopped.retry.visibility,'visible');
    assert.ok(stopped.retry.opacity>0&&stopped.retry.width>0&&stopped.retry.height>0);
    await held.waitForFailure();await held.release();
    record.retry_focus=await page.evaluate(()=>{
      const button=document.getElementById('lab-reference-retry');button.focus();
      return {id:document.activeElement?.id,exact_button:document.activeElement===button,
        hidden:button.hidden,disabled:button.disabled,time_origin:performance.timeOrigin};
    });
    assert.deepEqual(record.retry_focus,{id:'lab-reference-retry',exact_button:true,hidden:false,disabled:false,
      time_origin:record.original_document.time_origin});
    await page.keyboard.press('Enter');
    await page.waitForFunction(()=>document.getElementById('lab-reference-evidence')?.dataset.state==='ready',null,{timeout:10000});
    record.current=await page.evaluate(async()=>{
      const host=document.getElementById('lab-reference-evidence'),image=document.getElementById('lab-reference-image');
      await image.decode();const bytes=await(await fetch(image.currentSrc)).arrayBuffer();
      const source=new URL([...host.querySelectorAll('.lab-reference-actions a')].find(link=>link.textContent==='Read the item source and permission').href);
      return {image:{bytes:bytes.byteLength,sha256:[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))]
        .map(value=>value.toString(16).padStart(2,'0')).join(''),width:image.naturalWidth,height:image.naturalHeight,hidden:image.hidden},
        time_origin:performance.timeOrigin,event:host.dataset.event,media:host.dataset.mediaId,state:host.dataset.state,
        image_href:host.querySelector('.lab-reference-image-link').href,rights:host.querySelector('.lab-reference-rights').textContent,
        source:{origin:source.origin,path:source.pathname,query:Object.fromEntries(source.searchParams),hash:source.hash},
        saved:document.getElementById('lab-share').href,retry_hidden:document.getElementById('lab-reference-retry').hidden,
        controls:{selected:document.getElementById('lab-event').value,shape:document.getElementById('shape').value,
          condensation:document.getElementById('condensation').value,azimuth:document.getElementById('azimuth').value,
          quality:document.getElementById('quality').value,coverage:document.getElementById('sequence-coverage').value,
          position:document.getElementById('sequence-time').value,enabled:document.getElementById('sequence-enabled').checked,
          motion:document.getElementById('motion').textContent,motionDisabled:document.getElementById('motion').disabled,
          status:document.getElementById('motion-status').textContent}};
    });
    assert.deepEqual(record.current.image,{bytes:MOORE.bytes,sha256:MOORE.sha256,width:MOORE.width,height:MOORE.height,hidden:false});
    assert.equal(record.current.time_origin,record.original_document.time_origin);
    assert.equal(record.current.event,'moore-2013');assert.equal(record.current.media,'moore-medical-center-survey');
    assert.equal(record.current.state,'ready');assert.equal(record.current.image_href,base+'/'+MOORE.asset);
    assert.ok(record.current.rights.includes('NWS employee Doug Speheger'));
    assert.deepEqual(record.current.source,{origin:new URL(base).origin,path:'/dossier.html',
      query:{event:'moore-2013',source:'nws-event-hub',revision:MOORE.revision},hash:'#source-nws-event-hub'});
    assert.equal(record.current.saved,laboratoryURL);assert.deepEqual(record.current.controls,before);
    assert.equal(record.current.retry_hidden,true);
  }finally{record.held=held.state;await finish(t,diagnostics,'widget-canceled-native-departure',record);}
});

test('Existing beforeunload fallback stops pending work and preserves a ready reference',{timeout:45000},async t=>{
  const held=heldAsset(t);
  const page=await fixture(t,{viewport:{width:320,height:900},reducedMotion:'reduce',serviceWorkers:'block'});
  const diagnostics=await observeLabReferenceNavigation(t,page,{base,label:'widget-controlled-navigation-api-absence'});
  const record={control:'Controlled Navigation API absence; existing beforeunload callback, then actual native return and Back',
    synthetic_beforeunload_scope:'Direct callback contract only; not native canceled-unload or old-browser certification'};
  await page.addInitScript(()=>{
    const hadAPI=typeof window.navigation?.navigate==='function';
    Object.defineProperty(window,'navigation',{value:undefined,configurable:true});
    window.__atlasControlledNavigationAbsence={hadAPI,absent:window.navigation===undefined};
  });
  await held.install(page);held.enable();await forceUnavailableForm(page);
  try{
    await page.goto(base+'/study.html');await experimentReady(page);
    record.absence=await page.evaluate(()=>window.__atlasControlledNavigationAbsence);
    assert.equal(record.absence.absent,true);
    await page.locator('#lab-event').selectOption('moore-2013');await held.wait();
    const before=await formState(page),laboratoryURL=await savedMooreExperiment(page);
    held.retiring('existing beforeunload fallback with controlled Navigation API absence');
    await page.evaluate(()=>window.dispatchEvent(new Event('beforeunload',{cancelable:true})));
    await stoppedPendingMoore(page);await held.waitForFailure();await held.release();
    await page.locator('#lab-reference-retry').focus();await page.keyboard.press('Enter');
    record.ready=await checkedMooreWidget(page);
    const src=await page.locator('#lab-reference-image').getAttribute('src');
    await page.evaluate(()=>{
      window.__atlasReadyReferenceImage=document.getElementById('lab-reference-image');
      window.dispatchEvent(new Event('beforeunload',{cancelable:true}));
    });
    assert.equal(await page.locator('#lab-reference-evidence').getAttribute('data-state'),'ready');
    assert.equal(await page.locator('#lab-reference-evidence').getAttribute('aria-busy'),'false');
    assert.equal(await page.locator('#lab-reference-image').getAttribute('src'),src);
    assert.equal(await page.locator('#lab-reference-image').evaluate(image=>image===window.__atlasReadyReferenceImage),true);
    record.ready_after_fallback=await checkedMooreWidget(page);
    assert.deepEqual(record.ready_after_fallback,record.ready);assert.deepEqual(await formState(page),before);
    assert.equal(await savedMooreExperiment(page),laboratoryURL);
    await nativeReturnAndBack(page,laboratoryURL);record.after_back=await checkedMooreWidget(page);
    assert.deepEqual(await formState(page),before);
    assert.equal(await page.evaluate(()=>window.__atlasControlledNavigationAbsence.absent),true);
  }finally{record.held=held.state;await finish(t,diagnostics,'widget-controlled-navigation-api-absence',record);}
});


test('Retained Form6 storm1 parameters preserve their native documentary return',{timeout:45000},async t=>{
  const page=await fixture(t,{viewport:{width:320,height:900},reducedMotion:'reduce',serviceWorkers:'block'});
  const diagnostics=await observeLabReferenceNavigation(t,page,{base,label:'retained-form6-native-return'});
  const record={control:'Explicit complete retained Form6 URL, unchanged Moore image and native return/Back'};
  await forceUnavailableForm(page);
  try{
    await page.goto(base+'/study.html?'+new URLSearchParams(SAVED_FORM_PARAMETERS));await experimentReady(page);
    record.before=await checkedMooreWidget(page);
    const before=await formState(page),laboratoryURL=await savedMooreExperiment(page,SAVED_FORM_PARAMETERS);
    assert.equal(before.coverage,'storm');
    record.saved_laboratory_url=laboratoryURL;
    await nativeReturnAndBack(page,laboratoryURL,SAVED_FORM_PARAMETERS);
    record.after=await checkedMooreWidget(page);
    assert.deepEqual(await formState(page),before);
    assert.deepEqual(record.after,record.before);
    assert.equal(await page.locator('#scene-failure').isVisible(),true);
    assert.equal(await page.locator('#motion').isDisabled(),true);
  }finally{await finish(t,diagnostics,'retained-form6-native-return',record);}
});

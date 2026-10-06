import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fixture,base} from './harness.mjs';

const gallery=await readFile(new URL('../../web/tuscaloosa-radar-view.mjs',import.meta.url),'utf8');
const id='aerial-context-aftermath';

async function historySettled(page){
  await page.waitForFunction(()=>!document.getElementById('photo-dialog').open&&
    !new URL(location.href).searchParams.has('photo'));
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>{
    window.__photoFocusRecord?.('first-settled-frame');
    requestAnimationFrame(()=>{window.__photoFocusRecord?.('second-settled-frame');resolve();});
  })));
}

async function passiveFocusTrace(page){
  await page.evaluate(()=>{
    const trace=[];
    const identify=node=>node?{tag:node.tagName,id:node.id||null,
      photoId:node.dataset?.photoId||null,
      href:node.getAttribute?.('href')?.slice(0,160)||null}:null;
    window.__photoFocusTrace=trace;
    window.__photoFocusRecord=(kind,event)=>{
      if(trace.length>=80)return;
      trace.push({kind,active:identify(document.activeElement),
        target:identify(event?.target),related:identify(event?.relatedTarget),
        dialogOpen:document.getElementById('photo-dialog').open,
        photo:new URL(location.href).searchParams.get('photo'),
        stack:kind==='focusin'?new Error().stack?.slice(0,1200).split(String.fromCharCode(10)).slice(0,7):undefined});
    };
    for(const kind of ['focusin','focusout','close'])
      document.addEventListener(kind,event=>window.__photoFocusRecord(kind,event),true);
    window.addEventListener('popstate',event=>window.__photoFocusRecord('popstate',event),true);
  });
}

for(const [width,appearance] of [[320,'dark'],[1280,'light']]){
  test(`closing a photograph preserves a destination chosen before history returns ${width} ${appearance}`,{timeout:30000},async t=>{
    const page=await fixture(t,{viewport:{width,height:844},hasTouch:width<600,isMobile:width<600});
    await page.goto(base+'/tuscaloosa.html?context=focus#aerial-context');
    await page.waitForFunction(()=>document.body?.dataset.photoViewer==='ready');
    await page.locator('#reading-appearance').selectOption(appearance);
    const opener=page.locator('a[data-photo-id="'+id+'"]');
    const selector='#aerial-context a[href*="media=aerial-context-aftermath"]';
    const destination=page.locator(selector);
    await opener.focus();await page.keyboard.press('Enter');
    await page.waitForFunction(()=>document.getElementById('photo-dialog').open);
    await passiveFocusTrace(page);
    // Keep the browser's real close, history and animation-frame processing.
    assert.equal(await page.evaluate(selector=>{
      window.__photoFocusRecord('before-close');
      document.getElementById('photo-dialog').close();
      const destination=document.querySelector(selector);destination.focus();
      window.__photoFocusRecord('destination-chosen');
      return document.activeElement===destination;
    },selector),true);
    await historySettled(page);
    const settled=await destination.evaluate(node=>({focused:node===document.activeElement,
      trace:window.__photoFocusTrace}));
    assert.equal(settled.focused,true,
      'The destination chosen before history returns must retain focus. Bounded passive trace: '+JSON.stringify(settled.trace));
    await Promise.all([page.waitForURL('**/dossier.html?**'),page.keyboard.press('Enter')]);
    await page.waitForFunction(()=>document.body?.dataset.ready==='true');
    assert.equal(new URL(page.url()).searchParams.get('media'),id);
    assert.equal(await page.locator('#media-'+id).count(),1);
  });
}

async function closedWithQueuedFocus(t,viewport,claimSelector=null){
  const page=await fixture(t,{viewport});
  await page.addInitScript(()=>{window.__photoFocusFrames=[];});
  // Hold only this gallery's focus-restoration callback. Other page clocks run normally.
  await page.route('**/tuscaloosa-radar-view.mjs',route=>route.fulfill({
    status:200,contentType:'text/javascript',
    body:'const requestAnimationFrame=callback=>{window.__photoFocusFrames.push(callback);return window.__photoFocusFrames.length;};\n'+gallery,
  }));
  await page.goto(base+'/tuscaloosa.html?context=focus#aerial-context');
  await page.waitForFunction(()=>document.body?.dataset.photoViewer==='ready');
  const opener=page.locator('a[data-photo-id="'+id+'"]');
  await opener.click();
  await page.waitForFunction(()=>document.getElementById('photo-dialog').open);
  if(claimSelector){
    assert.equal(await page.evaluate(selector=>{
      const destination=document.querySelector(selector);
      document.getElementById('photo-dialog').addEventListener('close',()=>{
        window.__outsideClaimAtClose=document.activeElement===destination;
      },{capture:true,once:true});
      document.getElementById('photo-dialog').close();destination.focus();
      return document.activeElement===destination;
    },claimSelector),true);
  }else await page.locator('#photo-close').click();
  await page.waitForFunction(()=>!document.getElementById('photo-dialog').open&&
    !new URL(location.href).searchParams.has('photo')&&window.__photoFocusFrames.length>0);
  return {page,opener};
}
async function releaseFocus(page){
  return page.evaluate(()=>{
    const queued=window.__photoFocusFrames.splice(0);
    for(const callback of queued)callback();
    return queued.length;
  });
}

for(const [width,appearance] of [[320,'dark'],[1280,'light']]){
  test(`closing a photograph preserves the next keyboard destination ${width} ${appearance}`,{timeout:30000},async t=>{
    const {page}=await closedWithQueuedFocus(t,{width,height:844});
    await page.locator('#reading-appearance').selectOption(appearance);
    const destination=page.locator('#aerial-context a[href*="media=aerial-context-aftermath"]');
    await destination.focus();
    assert.equal(await destination.evaluate(node=>node===document.activeElement),true);
    assert.ok(await releaseFocus(page)>0);
    assert.equal(await destination.evaluate(node=>node===document.activeElement),true);
    await Promise.all([
      page.waitForURL('**/dossier.html?**',{timeout:10000}),
      page.keyboard.press('Enter'),
    ]);
    await page.waitForFunction(()=>document.body?.dataset.ready==='true');
    assert.equal(new URL(page.url()).searchParams.get('media'),id);
    assert.equal(await page.locator('#media-'+id).count(),1);
  });
}

test('a carried close destination cannot replace a newer outside destination',{timeout:30000},async t=>{
  const first='#aerial-context a[href*="media=aerial-context-aftermath"]';
  const {page}=await closedWithQueuedFocus(t,{width:1280,height:844},first);
  assert.equal(await page.evaluate(()=>window.__outsideClaimAtClose),true);
  const next=page.locator('#reading-appearance');
  await next.focus();
  assert.equal(await next.evaluate(node=>node===document.activeElement),true);
  assert.ok(await releaseFocus(page)>0);
  assert.equal(await next.evaluate(node=>node===document.activeElement),true);
});

test('closing a photograph restores its opener when focus remains unclaimed',{timeout:30000},async t=>{
  const {page,opener}=await closedWithQueuedFocus(t,{width:1280,height:844});
  await page.evaluate(()=>document.activeElement.blur());
  assert.equal(await page.evaluate(()=>document.activeElement===document.body),true);
  assert.ok(await releaseFocus(page)>0);
  assert.equal(await opener.evaluate(node=>node===document.activeElement),true);
  await page.keyboard.press('Enter');
  await page.waitForFunction(()=>document.getElementById('photo-dialog').open&&
    new URL(location.href).searchParams.get('photo')==='aerial-context-aftermath');
});

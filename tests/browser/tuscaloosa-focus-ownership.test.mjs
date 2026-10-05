import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fixture,base} from './harness.mjs';

const gallery=await readFile(new URL('../../web/tuscaloosa-radar-view.mjs',import.meta.url),'utf8');
const id='aerial-context-aftermath';

async function closedWithQueuedFocus(t,viewport){
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
  await page.locator('#photo-close').click();
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

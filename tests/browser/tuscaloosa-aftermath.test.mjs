import {test} from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {fixture,base} from './harness.mjs';

const id='birmingham-aftermath-april29',file='birmingham-aftermath-april29.jpg';
const survey='https://www.weather.gov/bmx/event_04272011tuscbirm';
async function shown(page){await page.waitForFunction(()=>{
  const img=document.getElementById('photo-full');
  return document.getElementById('photo-dialog').open&&!img.hidden&&img.naturalWidth===800&&img.naturalHeight===600;
});}
async function photoText(page){
  assert.match(await page.locator('#photo-title').textContent(),/damaged neighborhood north of Birmingham/);
  assert.match(await page.locator('#photo-location').textContent(),/April 29, 2011/);
  assert.match(await page.locator('#photo-location').textContent(),/capture time and time zone are unknown/);
  assert.match(await page.locator('#photo-credit').textContent(),/Individual photographer unknown/);
  assert.match(await page.locator('#photo-credit').textContent(),/Only embedded metadata was removed/);
  assert.equal(/KBMX|5:38|county crossing|preserved unchanged/.test(await page.locator('#photo-dialog').textContent()),false);
  assert.equal(await page.locator('#photo-source').getAttribute('href'),survey);
  assert.equal(await page.locator('#photo-license').getAttribute('href'),'https://www.weather.gov/disclaimer');
  assert.match(await page.locator('#photo-original').textContent(),/metadata-stripped publication copy/);
  assert.ok((await page.locator('#photo-original').getAttribute('href')).endsWith(file));
}
for(const [width,appearance] of [[320,'dark'],[1280,'light']]){
  test(`Tuscaloosa aftermath image and source journey ${width} ${appearance}`,async t=>{
    const page=await fixture(t,{viewport:{width,height:844},hasTouch:width<600,isMobile:width<600});
    const requests=[];page.on('request',r=>requests.push(r.url()));
    await page.goto(base+'/tuscaloosa.html?context=aftermath#path');
    await page.waitForFunction(()=>document.body?.dataset.photoViewer==='ready');
    await page.locator('#reading-appearance').selectOption(appearance);
    const link=page.locator(`[data-photo-id="${id}"]`);
    await link.locator('img').scrollIntoViewIfNeeded();await link.locator('img').evaluate(img=>img.decode());
    if(width<600)await link.tap();else{await link.focus();await page.keyboard.press('Enter');}
    await shown(page);await photoText(page);
    assert.equal(new URL(page.url()).searchParams.get('photo'),id);
    if(process.env.ATLAS_SCREENSHOT_DIR)await page.screenshot({path:path.join(process.env.ATLAS_SCREENSHOT_DIR,`tuscaloosa-aftermath-${width}-${appearance}.png`)});
    if(width===320){
      await page.locator('#photo-dialog').evaluate(dialog=>{
        const nodes=[...dialog.querySelectorAll('h2,p,a,button')];
        const sizes=nodes.map(node=>parseFloat(getComputedStyle(node).fontSize));
        nodes.forEach((node,i)=>node.style.fontSize=sizes[i]*2+'px');
      });
      const layout=await page.locator('#photo-dialog').evaluate(d=>({client:d.clientWidth,scroll:d.scrollWidth}));
      assert.ok(layout.scroll<=layout.client+1,JSON.stringify(layout));
    }
    await page.keyboard.press('Escape');
    await page.waitForFunction(id=>!document.getElementById('photo-dialog').open&&
      !new URL(location.href).searchParams.has('photo')&&document.activeElement?.dataset.photoId===id,id);
    await page.goForward();await shown(page);await photoText(page);await page.goBack();
    await page.waitForFunction(()=>!document.getElementById('photo-dialog').open);
    assert.equal(new URL(page.url()).hash,'#path');
    assert.equal(new URL(page.url()).searchParams.get('context'),'aftermath');
    // Switching back to a radar item must restore its own product labels.
    await page.locator('[data-photo-id="kbmx-reflectivity-county-crossing"]').click();
    await page.waitForFunction(()=>document.getElementById('photo-full').naturalWidth===755);
    assert.match(await page.locator('#photo-location').textContent(),/KBMX/);
    assert.match(await page.locator('#photo-original').textContent(),/original radar image/);
    await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.getElementById('photo-dialog').open);
    await page.getByRole('link',{name:'Inspect the photograph, attribution and reuse record',exact:true}).click();
    await page.waitForFunction(()=>document.body?.dataset.ready==='true');
    const media=page.locator('#media-'+id);await media.waitFor();
    assert.match(await media.textContent(),/printed April 29/);
    assert.match(await media.textContent(),/unregistered/);
    await media.getByRole('link',{name:'Inspect the source card',exact:true}).click();
    await page.locator('#source-bmx-birmingham-aftermath').waitFor();
    assert.match(await page.locator('#source-bmx-birmingham-aftermath').textContent(),/narrow inference/);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    assert.equal(requests.some(u=>!u.startsWith(base+'/')),false);
  });
}
test('failed aftermath image retains its own credit and retries the publication copy',async t=>{
  const page=await fixture(t);let failing=true;
  await page.route('**/'+file,route=>failing?route.fulfill({status:503,body:'Unavailable'}):route.continue());
  await page.goto(base+'/tuscaloosa.html?photo='+id+'#path');
  await page.locator('#photo-retry').waitFor({state:'visible'});await photoText(page);
  assert.equal(await page.locator('#photo-full').isVisible(),false);
  assert.match(await page.locator('#photo-full').getAttribute('alt'),/damaged or missing roofs/);
  failing=false;await page.locator('#photo-retry').click();await shown(page);
  assert.equal(await page.locator('#photo-failure').isVisible(),false);
  await page.locator('#photo-close').click();
  await page.waitForFunction(()=>!new URL(location.href).searchParams.has('photo'));
  assert.equal(new URL(page.url()).hash,'#path');
});
test('aftermath description and keyboard image link work without JavaScript',async t=>{
  const page=await fixture(t,{javaScriptEnabled:false,viewport:{width:320,height:844}});
  await page.goto(base+'/tuscaloosa.html#birmingham-aftermath');
  assert.match(await page.locator('#birmingham-aftermath').textContent(),/Individual photographer unknown/);
  const link=page.locator(`[data-photo-id="${id}"]`);await link.focus();
  await Promise.all([page.waitForURL(u=>u.pathname.endsWith(file)),page.keyboard.press('Enter')]);
});

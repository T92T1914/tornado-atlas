import {test} from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {fixture,base} from './harness.mjs';

const id='nist-joplin-radar-sequence';
const asset='assets/joplin-2011/nist-radar-sequence.png';
const source='https://www.govinfo.gov/content/pkg/GOVPUB-C13-a0ac8adb5269166f1b1e230423cf79ec/pdf/GOVPUB-C13-a0ac8adb5269166f1b1e230423cf79ec.pdf';
const figureName='Open the complete NOAA and NIST Joplin radar figure and caption';
async function ready(page){await page.waitForFunction(()=>document.body.dataset.photoViewer==='ready');}
async function shown(page){await page.waitForFunction(()=>document.getElementById('photo-dialog').open&&document.getElementById('photo-full').naturalWidth===947);}
async function fits(page){assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No horizontal document overflow');}

for(const [width,height,appearance] of [[1280,900,'light'],[390,844,'dark'],[700,320,'light']]){
  test(`Joplin radar source journey ${width}x${height} ${appearance}`,async t=>{
    const page=await fixture(t,{viewport:{width,height},hasTouch:width<800,isMobile:width<800});
    await page.goto(base+'/joplin.html?context=radar#radar-reading');await ready(page);
    await page.locator('#reading-appearance').selectOption(appearance);
    const note=page.locator('#radar-reading'),link=note.getByRole('link',{name:figureName,exact:true});
    const image=link.locator('img');await image.scrollIntoViewIfNeeded();await image.evaluate(i=>i.decode());
    assert.deepEqual(await image.evaluate(i=>[i.naturalWidth,i.naturalHeight]),[947,1326]);
    assert.match(await note.textContent(),/1.5 kilometers above the ground/);
    assert.match(await note.textContent(),/not raw radar data or an optical photograph/);
    await fits(page);await link.focus();await page.keyboard.press('Enter');await shown(page);
    assert.match(await page.locator('#photo-credit').textContent(),/NOAA radar images, enhanced by NIST/);
    assert.match(await page.locator('#photo-location').textContent(),/source-reported UTC radar labels/);
    assert.doesNotMatch(await page.locator('#photo-credit').textContent(),/embedded photograph/);
    assert.equal(await page.locator('#photo-source').getAttribute('href'),source+'#page=93');
    assert.equal(await page.locator('#photo-original').textContent(),'Open the complete radar figure and caption');
    assert.equal(await page.locator('#photo-license').getAttribute('href'),source+'#page=4');
    if(width===390){
      await page.locator('#photo-dialog').evaluate(dialog=>{
        const nodes=[...dialog.querySelectorAll('h2,p,button,a')];
        const sizes=nodes.map(node=>parseFloat(getComputedStyle(node).fontSize));
        nodes.forEach((node,index)=>node.style.fontSize=sizes[index]*2+'px');
      });
      assert.ok(await page.locator('#photo-dialog').evaluate(dialog=>dialog.scrollWidth<=dialog.clientWidth+1),'Doubled modal text stays inside the viewer');
      await page.keyboard.press('Escape');
      await page.waitForFunction(()=>!document.getElementById('photo-dialog').open&&!new URL(location.href).searchParams.has('photo'));
      await link.tap();await shown(page);
    }
    await page.goBack();await page.waitForFunction(()=>!document.getElementById('photo-dialog').open);
    await page.waitForFunction(()=>document.activeElement?.dataset.photoId==='nist-joplin-radar-sequence');
    await page.goForward();await shown(page);await page.keyboard.press('Escape');
    await page.waitForFunction(()=>!document.getElementById('photo-dialog').open&&!new URL(location.href).searchParams.has('photo'));
    assert.equal(new URL(page.url()).searchParams.get('context'),'radar');
    await note.getByRole('link',{name:'Inspect the radar record, credits and limits',exact:true}).click();
    const card=page.locator('#media-'+id);await card.waitFor();
    assert.match(await card.textContent(),/assertionsource reported/);
    await card.getByRole('link',{name:'Inspect the source card',exact:true}).click();
    await page.locator('#source-'+id).waitFor();
    assert.match(await page.locator('#source-'+id).textContent(),/NOAA/);
    await page.goBack();await card.waitFor();await page.goBack();await ready(page);
    const scales=await note.evaluate(note=>[...note.querySelectorAll('h3,p,figcaption')].map(node=>{
      const before=parseFloat(getComputedStyle(node).fontSize);node.style.fontSize=before*2+'px';
      return [before,parseFloat(getComputedStyle(node).fontSize)];
    }));
    for(const [before,after] of scales)assert.equal(after,before*2);
    await fits(page);
    if(process.env.ATLAS_SCREENSHOT_DIR){await note.scrollIntoViewIfNeeded();await page.screenshot({path:path.join(process.env.ATLAS_SCREENSHOT_DIR,`joplin-radar-${width}-${appearance}.png`)});}
  });
}

test('direct radar enlargement closes without losing the surrounding URL',async t=>{
  const page=await fixture(t);await page.goto(base+'/joplin.html?context=radar&photo='+id+'#radar-reading');await shown(page);
  await page.locator('#photo-close').click();await page.waitForFunction(()=>!document.getElementById('photo-dialog').open&&!new URL(location.href).searchParams.has('photo'));
  assert.equal(new URL(page.url()).searchParams.get('context'),'radar');
  assert.equal(new URL(page.url()).searchParams.has('photo'),false);
  assert.equal(new URL(page.url()).hash,'#radar-reading');
});

test('failed radar loading preserves provenance and retries the selected figure',async t=>{
  const page=await fixture(t);let failing=true;
  await page.route('**/'+asset,route=>failing?route.fulfill({status:503,body:'Unavailable'}):route.continue());
  await page.goto(base+'/joplin.html?photo='+id+'#radar-reading');await ready(page);
  await page.locator('#photo-retry').waitFor({state:'visible'});
  assert.match(await page.locator('#photo-credit').textContent(),/NOAA/);
  assert.equal(await page.locator('#photo-source').getAttribute('href'),source+'#page=93');
  failing=false;await page.locator('#photo-retry').click();await shown(page);
  assert.equal(await page.locator('#photo-failure').isVisible(),false);
});

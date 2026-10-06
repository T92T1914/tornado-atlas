import test from 'node:test';
import assert from 'node:assert/strict';
import {settledFragment} from './fragment-ready.mjs';
import path from 'node:path';
import {fixture, base} from './harness.mjs';

const items = [
  {id:'friskey-joplin-storm', file:'storm.jpg', width:1557, height:932,
   title:/Daniel Friskey/, credit:/uploader WikiSal/, clock:/May 22, 2011/,
   source:'https://commons.wikimedia.org/wiki/File:Joplin,_Missouri_tornado_of_2011.jpg',
   rights:'https://creativecommons.org/licenses/by-sa/4.0/', sourceId:'commons-friskey-joplin'},
  {id:'nws-joplin-aftermath', file:'damage.jpg', width:1024, height:768,
   title:/aftermath/, credit:/uploader Wxtrackercody/, clock:/May 23 at 13:19/,
   source:'https://commons.wikimedia.org/wiki/File:22_May_2011_Joplin_tornado_damage.jpg',
   rights:'https://commons.wikimedia.org/wiki/File:22_May_2011_Joplin_tornado_damage.jpg#Licensing',
   sourceId:'commons-nws-joplin-aftermath'},
];
const ready = page => page.waitForFunction(() => document.body.dataset.photoViewer === 'ready');
async function shown(page, item) {
  await page.waitForFunction(({width,height,file}) => {
    const image=document.getElementById('photo-full');
    return document.getElementById('photo-dialog').open && !image.hidden && image.complete &&
      image.naturalWidth===width && image.naturalHeight===height &&
      new URL(image.currentSrc || image.src).pathname.endsWith('/'+file);
  }, item);
  await page.locator('#photo-full').evaluate(image => image.decode());
}
async function labels(page, item) {
  assert.match(await page.locator('#photo-title').textContent(), item.title);
  assert.match(await page.locator('#photo-credit').textContent(), item.credit);
  assert.match(await page.locator('#photo-location').textContent(), item.clock);
  assert.match(await page.locator('#photo-location').textContent(), /unregistered/);
  assert.equal(await page.locator('#photo-source').getAttribute('href'), item.source);
  assert.equal(await page.locator('#photo-license').getAttribute('href'), item.rights);
  assert.equal(await page.locator('#photo-source').textContent(), 'Inspect the original file, credit and reuse record');
  assert.match(await page.locator('#photo-original').textContent(), /unchanged original photograph/);
  assert.ok((await page.locator('#photo-original').getAttribute('href')).endsWith(item.file));
  assert.equal(/Complete report figure|PNG derivative/.test(await page.locator('#photo-credit').textContent()), false);
}
async function closed(page, id) {
  await page.waitForFunction(id => !document.getElementById('photo-dialog').open &&
    !new URL(location.href).searchParams.has('photo') && document.activeElement?.dataset.photoId===id, id);
}

for (const [width,appearance] of [[320,'dark'], [1280,'light']]) {
  test(`Joplin original photographs: ${width}px ${appearance}, credits, history and source cards`, async t => {
    const page=await fixture(t,{viewport:{width,height:844},hasTouch:width<600,isMobile:width<600,reducedMotion:'reduce'});
    const requests=[]; page.on('request', request => requests.push(request.url()));
    await page.goto(base+'/joplin.html?context=originals#visibility'); await ready(page);
    await page.locator('#reading-appearance').selectOption(appearance);
    assert.match(await page.locator('#visibility').textContent(), /140 survivor interviews/);
    for (const item of items) {
      const opener=page.locator(`a[data-photo-id="${item.id}"]`);
      await opener.scrollIntoViewIfNeeded();
      await opener.locator('img').evaluate(image => image.decode());
      if(width<600) await opener.tap(); else {await opener.focus();await page.keyboard.press('Enter');}
      await shown(page,item); await labels(page,item);
      if(process.env.ATLAS_SCREENSHOT_DIR) await page.screenshot({
        path:path.join(process.env.ATLAS_SCREENSHOT_DIR,`${item.id}-${width}-${appearance}.png`)});
      await page.keyboard.press('Escape');await closed(page,item.id);
      await page.goForward();await shown(page,item);await labels(page,item);
      await page.goBack();await closed(page,item.id);
      assert.equal(new URL(page.url()).searchParams.get('context'),'originals');
      assert.equal(new URL(page.url()).hash,'#visibility');
    }
    // Returning from a context image must also reset the existing NIST source label.
    await page.locator('[data-photo-id="nist-west-tower"]').click();
    await shown(page,{file:'nist-west-tower.jpg',width:901,height:541});
    assert.match(await page.locator('#photo-credit').textContent(),/National Institute of Standards/);
    assert.equal(await page.locator('#photo-source').textContent(),'Complete source figure and caption');
    assert.match(await page.locator('#photo-license').getAttribute('href'),/#page=4$/);
    await page.keyboard.press('Escape');await closed(page,'nist-west-tower');
    const item=items[1];
    await page.locator(`a[href*="media=${item.id}"]`).click();
    await page.waitForFunction(()=>document.body.dataset.ready==='true');
    const media=page.locator('#media-'+item.id); await media.waitFor();
    assert.match(await media.textContent(),/May 23, 2011 at 13:19/);
    assert.match(await media.textContent(),/unregistered/);
    await media.getByRole('link',{name:'Inspect the source card',exact:true}).click();
    await page.locator('#source-'+item.sourceId).waitFor();
    assert.match(await page.locator('#source-'+item.sourceId).textContent(),/PD-US-NOAA-NWS/);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    assert.equal(requests.some(url=>!url.startsWith(base+'/')),false);
  });
}

test('Joplin direct storm photograph survives reload and closes only its selection', async t => {
  const page=await fixture(t),item=items[0];
  await page.goto(base+`/joplin.html?context=direct&photo=${item.id}#visibility`);
  await ready(page);await shown(page,item);await labels(page,item);
  await page.reload();await ready(page);await shown(page,item);await labels(page,item);
  await page.locator('#photo-close').click();await closed(page,item.id);
  assert.equal(new URL(page.url()).searchParams.get('context'),'direct');
  assert.equal(new URL(page.url()).hash,'#visibility');
});

test('Joplin failed aftermath image retains its own credit and retries without the storm bitmap', async t => {
  const page=await fixture(t);let failing=true;
  await page.route('**/damage.jpg',route=>failing?route.fulfill({status:503,body:'Unavailable'}):route.continue());
  await page.goto(base+'/joplin.html');await ready(page);
  await page.locator('[data-photo-id="friskey-joplin-storm"]').click();await shown(page,items[0]);
  await page.keyboard.press('Escape');await closed(page,items[0].id);
  const item=items[1];await page.locator(`[data-photo-id="${item.id}"]`).click();
  await page.locator('#photo-retry').waitFor({state:'visible'});await labels(page,item);
  assert.equal(await page.locator('#photo-full').isVisible(),false);
  assert.match(await page.locator('#photo-full').getAttribute('alt'),/broken timber/i);
  failing=false;await page.locator('#photo-retry').click();await shown(page,item);
  assert.equal(await page.locator('#photo-failure').isVisible(),false);
  await page.locator('#photo-close').click();await closed(page,item.id);
});

test('Joplin original photographs and visibility account remain useful without JavaScript', async t => {
  const page=await fixture(t,{javaScriptEnabled:false,viewport:{width:320,height:844}});
  await page.goto(base+'/joplin.html#visibility');
  assert.match(await page.locator('#visibility').textContent(),/separate views with different clock evidence/);
  for(const item of items) {
    const opener=page.locator(`[data-photo-id="${item.id}"]`);
    assert.ok((await opener.getAttribute('href')).endsWith(item.file));
    assert.match(await opener.locator('..').textContent(),/Inspect its/);
  }
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  const opener=page.locator(`[data-photo-id="${items[1].id}"]`);
  await settledFragment(page, 'visibility', items[1].id);
  await opener.scrollIntoViewIfNeeded();await opener.locator('img').evaluate(image=>image.decode());
  await opener.focus();
  await Promise.all([page.waitForURL(url=>url.pathname.endsWith('damage.jpg')),page.keyboard.press('Enter')]);
});

test('Joplin long original attribution remains readable at enlarged text in short landscape', async t => {
  const page=await fixture(t,{viewport:{width:568,height:320},hasTouch:true,isMobile:true,reducedMotion:'reduce'});
  const item=items[1];await page.goto(base+`/joplin.html?photo=${item.id}#damage`);
  await ready(page);await shown(page,item);await labels(page,item);
  await page.locator('#photo-dialog').evaluate(dialog=>{
    const nodes=[...dialog.querySelectorAll('h2,p,a,button')];
    const sizes=nodes.map(node=>parseFloat(getComputedStyle(node).fontSize));
    nodes.forEach((node,index)=>node.style.fontSize=sizes[index]*2+'px');
  });
  const layout=await page.locator('#photo-dialog').evaluate(dialog=>({client:dialog.clientWidth,scroll:dialog.scrollWidth,
    height:dialog.clientHeight,scrollHeight:dialog.scrollHeight}));
  assert.ok(layout.scroll<=layout.client+1,JSON.stringify(layout));
  assert.ok(layout.scrollHeight>=layout.height,JSON.stringify(layout));
  await page.locator('#photo-close').click();await closed(page,item.id);
});

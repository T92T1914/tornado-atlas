import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fixture,base} from './harness.mjs';
import {readDossierDownload} from './dossier-download-helper.mjs';

const originals = [
  {id:'nws-blackwell-warning1',file:'assets/blackwell-1955/nws-warning1.jpg',size:[609,409]},
  {id:'nws-blackwell-warning2',file:'assets/blackwell-1955/nws-warning2.jpg',size:[608,436]},
];
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
async function loaded(page,item) {
  const image = page.locator(`img[src="${item.file}"]`);
  await image.scrollIntoViewIfNeeded();
  await page.waitForFunction(file => {
    const image = document.querySelector(`img[src="${file}"]`);
    return image?.complete && image.naturalWidth > 0;
  },item.file);
  return image;
}
async function ready(page) { await page.waitForFunction(() => document.body?.dataset.ready === 'true'); }

for (const viewport of [{width:1280,height:900},{width:390,height:844},{width:320,height:900},{width:844,height:320}]) {
  for (const appearance of ['dark','light']) test(`Blackwell warning documents and source return ${viewport.width}x${viewport.height} ${appearance}`,async t => {
    const page = await fixture(t,{viewport,acceptDownloads:true});
    await page.goto(base+'/blackwell.html#warning-context');
    await page.locator('#reading-appearance').selectOption(appearance);
    const section = page.locator('#warning-context');
    assert.equal(await section.count(),1);
    assert.match(await section.innerText(),/Blackwell/);
    for (const [number,item] of originals.entries()) {
      let image = await loaded(page,item);
      assert.deepEqual(await image.evaluate(node => [node.naturalWidth,node.naturalHeight]),item.size);
      assert.ok(await image.getAttribute('alt'));
      const local = await readFile(new URL('../../web/'+item.file,import.meta.url));
      const response = await page.request.get(base+'/'+item.file);
      assert.equal(response.status(),200);
      assert.equal(sha(await response.body()),sha(local),'The full-image route serves the retained original bytes');
      const aid = section.getByText(`Reading the ${number===0?'first':'second'} bulletin`,{exact:true});
      await aid.click();
      assert.equal(await aid.locator('..').evaluate(node => node.open),true);
      const original = image.locator('..');
      assert.equal(await original.getAttribute('href'),item.file);
      await original.focus();
      await page.keyboard.press('Enter');
      await page.waitForURL('**/'+item.file);
      await page.goBack();
      image = await loaded(page,item);
      assert.equal(await image.locator('..').getAttribute('href'),item.file);
      const route = section.locator(`a[href*="media=${item.id}"]`);
      await route.click();
      await ready(page);
      const card = page.locator('#media-'+item.id);
      await card.waitFor();
      assert.equal(await card.locator('dt:has-text("Temporal") + dd').textContent(),'unregistered');
      assert.equal(await card.locator('dt:has-text("Spatial") + dd').textContent(),'unregistered');
      assert.match(await card.innerText(),/Wichita/);
      const {dossier:metadata} = await readDossierDownload(page);
      const media = metadata.media.find(row => row.id===item.id);
      assert.ok(media);
      assert.equal(media.status.rights,'permitted_hosting');
      for (const role of ['event','capture','video','alignment']) assert.equal(media.time[role],null);
      assert.equal(media.place.coordinates,null);
      assert.equal(metadata.reconstruction.intervals.length,0);
      await page.goBack();
      await page.locator('#warning-context').waitFor();
    }
    if (viewport.width===390 && process.env.ATLAS_CONTEXT_SCREENSHOT_DIR) {
      await mkdir(process.env.ATLAS_CONTEXT_SCREENSHOT_DIR,{recursive:true});
      await section.locator('figure').first().screenshot({path:path.join(process.env.ATLAS_CONTEXT_SCREENSHOT_DIR,`blackwell-warning-first-390-${appearance}.png`)});
    }
    await page.addStyleTag({content:'body {font-size:200%}'});
    for (const summary of ['Reading the first bulletin','Reading the second bulletin']) {
      const aid = page.getByText(summary,{exact:true});
      await aid.locator('..').evaluate(node => { node.open = true; });
    }
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth<=innerWidth),true,'Text and complete document images stay within the viewport');
    if (viewport.width===390 && process.env.ATLAS_CONTEXT_SCREENSHOT_DIR) {
      await mkdir(process.env.ATLAS_CONTEXT_SCREENSHOT_DIR,{recursive:true});
      await section.scrollIntoViewIfNeeded();
      await section.screenshot({path:path.join(process.env.ATLAS_CONTEXT_SCREENSHOT_DIR,`blackwell-warnings-390-${appearance}.png`)});
    }
  });
}

test('Unavailable bulletin images retain readable context and original-source routes',async t => {
  const page = await fixture(t,{viewport:{width:390,height:844}});
  await page.route('**/assets/blackwell-1955/nws-warning*.jpg',route => route.abort());
  await page.goto(base+'/blackwell.html#warning-context');
  const section = page.locator('#warning-context');
  for (const item of originals) {
    await section.locator(`img[src="${item.file}"]`).scrollIntoViewIfNeeded();
    await page.waitForFunction(file => {
      const image=document.querySelector(`img[src="${file}"]`);
      return image?.complete && image.naturalWidth===0;
    },item.file);
  }
  for (const summary of ['Reading the first bulletin','Reading the second bulletin']) await section.getByText(summary,{exact:true}).click();
  assert.match(await section.innerText(),/Blackwell/);
  assert.equal(await section.locator('a[href="#source-warnings"]').count(),1);
  assert.equal(await page.locator('#source-warnings a[href="https://www.weather.gov/ict/udall"]').count(),1);
  for (const number of [1,2]) assert.equal(await section.locator(`a[href="https://www.weather.gov/images/ict/wxstory/udall/warning${number}.jpg"]`).count(),1);
  assert.equal(await section.locator('a[href*="dossier.html?event=blackwell-1955"]').count(),2);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth<=innerWidth),true);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,base} from './harness.mjs';

for(const width of [320,390,1280])test(`Tuscaloosa published sample context and source comparison at ${width}`,async t=>{
  const page=await fixture(t,{viewport:{width,height:844},isMobile:width<600,hasTouch:width<600});
  const requests=[];page.on('request',r=>requests.push(r.url()));
  await page.goto(base+'/tuscaloosa.html#rosolowski-published-samples');
  const section=page.locator('#rosolowski-published-samples');
  for(const text of ['04:22','04:27','04:30','04:32','not historical UTC','150 to 200','counterclockwise 7°'])
    assert.ok((await section.textContent()).includes(text));
  assert.equal(await section.locator('img,iframe,video,audio').count(),0);
  assert.equal(await page.locator('iframe').count(),0);
  assert.equal(await section.getByRole('link',{name:/Figure 8/}).getAttribute('href'),
    'https://twister.caps.ou.edu/papers/Oliveira_Xue_RobertsBAMS2022.pdf#page=13');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
  const compare=section.getByRole('link',{name:'Compare the published account with the inspected opening'});
  await compare.focus();await page.keyboard.press('Enter');
  await page.waitForFunction(()=>document.body.dataset.ready==='true');
  const comparison=page.locator('#evidence-comparison');
  assert.match(await comparison.textContent(),/04:27/);
  assert.match(await comparison.textContent(),/opening paused presentation/i);
  assert.match(await comparison.textContent(),/unknown|unregistered/);
  assert.equal(await page.locator('iframe').count(),0);
  await page.goto(base+'/dossier.html?event=tuscaloosa-birmingham-2011&source=oliveira-2022-trailing-vortices');
  await page.waitForFunction(()=>document.body.dataset.ready==='true');
  assert.equal(await page.locator('#source-oliveira-2022-trailing-vortices').count(),1);
  const camera=page.locator('#observation-rosolowski-2022-reported-viewpoint');
  assert.match(await camera.textContent(),/damage-path centerline/);
  for(const p of 'abcd')assert.equal(await page.locator('#observation-rosolowski-2022-panel-'+p).count(),1);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
  assert.equal(requests.some(u=>!u.startsWith(base+'/')),false);
});

test('published source context is readable without scripting and retains the original watch link',async t=>{
  const page=await fixture(t,{viewport:{width:390,height:844},javaScriptEnabled:false});
  await page.goto(base+'/tuscaloosa.html#rosolowski-published-samples');
  assert.match(await page.locator('#rosolowski-published-samples').textContent(),/current player edition has not been checked/);
  const original=page.locator('[data-documentary-video="5ohIVzIZLuQ"]');
  assert.equal(await original.locator('a[href="https://www.youtube.com/watch?v=5ohIVzIZLuQ"]').count(),1);
  assert.equal(await original.locator('iframe,video,audio').count(),0);
});

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fixture,open,detail} from './harness.mjs';

async function tabTo(page,selector){
  for(let steps=0;steps<100;steps++){
    if(await page.evaluate(selector=>document.activeElement?.matches(selector),selector))return;
    await page.keyboard.press('Tab');
  }
  assert.fail('Keyboard traversal did not reach '+selector);
}

test('catalogue search, filtering, selection and image closure use keyboard traversal',async t=>{
  const page=await fixture(t,{viewport:{width:390,height:844},reducedMotion:'reduce'});
  await open(page);
  await tabTo(page,'#query');await page.keyboard.type('El Reno');await page.keyboard.press('Enter');
  await tabTo(page,'#advanced summary');await page.keyboard.press('Enter');
  await tabTo(page,'#year');await page.keyboard.press('Home');
  for(let steps=0;steps<80&&await page.locator('#year').inputValue()!=='2013';steps++)await page.keyboard.press('ArrowDown');
  assert.equal(await page.locator('#year').inputValue(),'2013');
  await page.keyboard.press('Tab');
  await tabTo(page,'#show-list');await page.keyboard.press('Enter');
  await tabTo(page,'#results [data-record="ncei:453682"]');await page.keyboard.press('Enter');
  await detail(page,'ncei:453682');
  assert.equal(new URL(page.url()).searchParams.get('year'),'2013');
  await tabTo(page,'[data-photo="storm-1"]');await page.keyboard.press('Enter');
  await page.waitForFunction(()=>document.getElementById('photo-dialog').open);
  await page.keyboard.press('Escape');
  await page.waitForFunction(()=>!document.getElementById('photo-dialog').open);
  assert.equal(await page.locator('#detail .eyebrow').textContent(),'ncei:453682');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
});

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {setTimeout as delay} from 'node:timers/promises';
import {fixture,base} from './harness.mjs';

async function observedVisibility(page,expected) {
  // IntersectionObserver is compositor-driven, independent of the authored
  // timer clock. Wait a bounded amount of client time for its actual callback.
  for(let attempt=0;attempt<20;attempt++) {
    if(await page.evaluate(()=>window.passageObservedVisible)===expected)return;
    await delay(25);
  }
  assert.equal(await page.evaluate(()=>window.passageObservedVisible),expected);
}

// Exercise the real page and consumer with an authored five-frame-per-second
// schedule. This is a controlled browser fixture, not a device benchmark.
for(const [width,appearance] of [[390,'dark'],[1280,'light']]) {
  test(`Wind passage clock and controls ${width} ${appearance}`,{timeout:45000},async t=>{
    const page=await fixture(t,{viewport:{width,height:900},hasTouch:width<600,
      isMobile:width<600,reducedMotion:'reduce',serviceWorkers:'block'});
    await page.clock.install();
    await page.addInitScript(()=>{
      const NativeObserver=window.IntersectionObserver;
      window.IntersectionObserver=class extends NativeObserver {
        constructor(callback,options) {super((entries,observer)=>{
          if(entries[0]?.target.id==='passage')window.passageObservedVisible=entries[0].isIntersecting;
          callback(entries,observer);
        },options);}
      };
    });
    await page.route('**/passage.js',async route=>{
      const response=await route.fetch();
      await route.fulfill({response,body:`
        window.requestAnimationFrame = callback => setTimeout(() => callback(performance.now()), 200);
        window.cancelAnimationFrame = id => clearTimeout(id);
        ${await response.text()}`});
    });
    await page.goto(base+'/wind.html');
    await page.waitForFunction(()=>document.querySelector('#passage-peak').textContent.includes('mph'));
    await page.locator('#reading-appearance').selectOption(appearance);
    await page.locator('#passage-play').scrollIntoViewIfNeeded();
    await observedVisibility(page,true);
    await page.clock.pauseAt(await page.evaluate(()=>Date.now()+200));
    const samples=await page.locator('#passage-line').getAttribute('d');
    const model=await page.locator('#component-peak').textContent();
    const indices=()=>page.evaluate(()=>['passage-time','component-time'].map(id=>Number(document.getElementById(id).value)));
    const buttons=()=>page.evaluate(()=>['passage-play','component-play'].map(id=>document.getElementById(id).textContent));
    await page.locator('#passage-play').focus();await page.keyboard.press('Enter');
    assert.deepEqual(await buttons(),['Pause passage','Pause passage']);
    await page.clock.runFor(24000);
    assert.deepEqual(await indices(),[480,480]);
    assert.deepEqual(await buttons(),['Play passage','Play passage']);
    assert.equal(await page.locator('#passage-line').getAttribute('d'),samples);
    assert.equal(await page.locator('#component-peak').textContent(),model);
    await page.keyboard.press('Enter');await page.clock.runFor(1250);
    await page.keyboard.press('Enter');
    assert.deepEqual(await indices(),[25,25],'Pause settles the 50ms since the last authored frame');
    await page.clock.runFor(5000);assert.deepEqual(await indices(),[25,25]);
    for(const [id,index] of [['component-time',120],['passage-time',0]]) {
      await page.locator('#'+id).evaluate((node,value)=>{node.value=value;node.dispatchEvent(new Event('input',{bubbles:true}));},index);
      assert.deepEqual(await indices(),[index,index]);
      assert.deepEqual(await buttons(),['Play passage','Play passage']);
    }
    await page.locator('#passage-play').focus();await page.keyboard.press('Enter');
    await page.clock.runFor(1000);assert.deepEqual(await indices(),[20,20]);
    // Offscreen interruption is observed by the actual IntersectionObserver.
    await page.evaluate(()=>window.scrollTo(0,0));
    await observedVisibility(page,false);
    assert.deepEqual(await buttons(),['Play passage','Play passage']);
    const stopped=await indices();await page.clock.runFor(5000);assert.deepEqual(await indices(),stopped);
    await page.locator('#passage-play').focus();
    await page.locator('#passage-play').evaluate(node=>node.scrollIntoView({block:'center'}));
    await observedVisibility(page,true);
    await page.clock.runFor(200);assert.deepEqual(await buttons(),['Play passage','Play passage']);
    await page.locator('#travel').evaluate(node=>{node.value='60';node.dispatchEvent(new Event('input',{bubbles:true}));});
    assert.equal(await page.locator('#travel-value').textContent(),'60 mph');
    assert.deepEqual(await buttons(),['Play passage','Play passage']);
    await page.locator('#wind-reset').focus();await page.keyboard.press('Enter');
    assert.deepEqual(await indices(),[0,0]);
    assert.equal(await page.locator('#travel').inputValue(),'30');
    assert.equal(await page.locator('#passage-line').getAttribute('d'),samples);
    assert.equal(await page.locator('#component-peak').textContent(),model);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
  });
}

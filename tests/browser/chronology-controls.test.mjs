import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fixture,base} from './harness.mjs';

for(const [width,appearance] of [[320,'dark'],[1280,'light']]) {
  test(`Joplin chronology controls preserve a single clock ${width} ${appearance}`,async t=>{
    const page=await fixture(t,{viewport:{width,height:900},hasTouch:width<600,
      isMobile:width<600,reducedMotion:'reduce',serviceWorkers:'block'});
    // The real page, loader, DOM and chronology consumer use an authored clock.
    // This isolates the specific control/queued-frame ordering, not host speed.
    await page.addInitScript(()=>{
      window.chronologyWall=100;window.chronologyFrames=new Map();window.chronologyFrameId=0;
    });
    await page.route('**/chronology-view.mjs',async route=>{
      const response=await route.fetch();
      await route.fulfill({response,body:`
        const performance={now:()=>window.chronologyWall};
        const requestAnimationFrame=callback=>{const id=++window.chronologyFrameId;window.chronologyFrames.set(id,callback);return id;};
        const cancelAnimationFrame=id=>window.chronologyFrames.delete(id);
        ${await response.text()}`});
    });
    await page.goto(base+'/reconstruction.html?event=joplin-2011');
    await page.getByRole('button',{name:'Play chronology',exact:true}).waitFor();
    await page.locator('#reading-appearance').selectOption(appearance);
    assert.equal(await page.locator('#replay-content').isVisible(),false,'Documentary has no borrowed geographic replay');
    const play=page.getByRole('button',{name:'Play chronology',exact:true});
    const frames=()=>page.evaluate(()=>window.chronologyFrames.size);
    const draw=async(wall,timestamp)=>page.evaluate(({wall,timestamp})=>{
      window.chronologyWall=wall;
      if(window.chronologyFrames.size!==1)throw Error('Expected one owned chronology callback');
      const [id,callback]=window.chronologyFrames.entries().next().value;
      window.chronologyFrames.delete(id);callback(timestamp);
    },{wall,timestamp});
    await play.focus();await page.keyboard.press('Enter');assert.equal(await frames(),1);
    await draw(116.2,116);
    await page.evaluate(()=>window.chronologyWall=132.2);
    await page.getByRole('combobox',{name:'Chronology playback speed'}).selectOption('120');
    await draw(132.2,132); // The old caller throws Invalid wall clock here.
    await draw(1132.2,1132);
    assert.equal(await frames(),1);
    assert.equal(await page.locator('#chronology-time').inputValue(),'120');
    assert.match(await page.locator('#chronology-time').getAttribute('aria-valuetext'),/CDT/);
    await page.getByRole('button',{name:'Pause chronology',exact:true}).focus();
    await page.keyboard.press('Enter');assert.equal(await frames(),0);
    assert.equal(new URL(page.url()).searchParams.get('t'),'120');
    await page.getByRole('button',{name:'Next entry',exact:true}).focus();await page.keyboard.press('Enter');
    const selected=await page.locator('#chronology-entry').inputValue();
    const selectedURL=page.url();assert.notEqual(new URL(selectedURL).searchParams.get('t'),'120');
    await page.goBack();
    assert.equal(new URL(page.url()).searchParams.get('t'),'120');assert.equal(await frames(),0);
    await page.goForward();assert.equal(page.url(),selectedURL);
    assert.equal(await page.locator('#chronology-entry').inputValue(),selected);assert.equal(await frames(),0);
    const text=await page.locator('.chronology-record').textContent();
    const source=await page.locator('.chronology-record a').getAttribute('href');
    assert.match(source,/Joplin_tornado\.pdf#page=\d+$/);
    await page.evaluate(()=>{
      const nodes=[document.querySelector('#replay-chronology'),...document.querySelectorAll('#replay-chronology *')];
      const sizes=nodes.map(node=>parseFloat(getComputedStyle(node).fontSize));
      nodes.forEach((node,i)=>node.style.fontSize=`${sizes[i]*2}px`);
    });
    assert.equal(await page.locator('.chronology-record').textContent(),text);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
    await page.locator('.chronology-record a').focus();
    assert.equal(await page.evaluate(()=>document.activeElement?.tagName),'A');
    assert.equal(await page.locator('.chronology-record a').getAttribute('href'),source);
  });
}

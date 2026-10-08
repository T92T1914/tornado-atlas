import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fixture,base} from './harness.mjs';

for(const [width,appearance] of [[390,'dark'],[1280,'light']]){
  test(`El Reno replay chapters and issued bulletins at ${width}px ${appearance}`,async t=>{
    const page=await fixture(t,{viewport:{width,height:900}});
    await page.goto(base+'/reconstruction.html?event=el-reno-2013&t=0&footage_source=robinson-dashcam');
    await page.locator('#replay-time:not([disabled])').waitFor();
    await page.locator('#reading-appearance').selectOption(appearance);
    const time=page.locator('#replay-time');
    assert.equal(await page.locator('#replay-context').isVisible(),true);
    assert.match(await page.locator('#replay-chapter-title').textContent(),/6:03 PM CDT.*Formation southwest of town/);
    assert.match(await page.locator('#replay-chapter-account').textContent(),/map begins with the first published position at 6:04/);
    assert.match(await page.locator('#replay-chapter-list button').first().textContent(),/Source: 6:03 PM CDT.*Map: 6:04 PM CDT/);
    assert.match(await page.locator('#replay-warning-title').textContent(),/Warning continued as the storm approached/);
    assert.match(await page.locator('#replay-warning-issued').textContent(),/5:50/);
    assert.match(await page.locator('#replay-warning-source').getAttribute('href'),/201305312250/);
    await time.fill('239');
    assert.match(await page.locator('#replay-warning-title').textContent(),/Warning continued/);
    await time.fill('240');
    assert.match(await page.locator('#replay-warning-title').textContent(),/A large tornado reported southwest of El Reno/);
    assert.match(await page.locator('#replay-warning-issued').textContent(),/6:08/);
    await time.fill('239');
    assert.match(await page.locator('#replay-warning-title').textContent(),/Warning continued/);
    const maximum=page.locator('#replay-chapter-list button').filter({hasText:'Maximum size'});
    await maximum.click();
    assert.equal(await time.inputValue(),'1200');
    assert.match(await page.locator('#replay-chapter-title').textContent(),/Maximum size/);
    assert.match(await page.locator('#replay-chapter-title').textContent(),/6:24/);
    assert.equal(await maximum.getAttribute('aria-current'),'step');
    assert.equal(new URL(page.url()).searchParams.get('footage_source'),'robinson-dashcam');
    assert.match(await page.locator('#replay-chapter-source').getAttribute('href'),/weather\.gov\/oun\/events-20130531/);
    await page.locator('#replay-chapter-previous').click();
    assert.equal(await time.inputValue(),'900');
    assert.match(await page.locator('#replay-chapter-title').textContent(),/Crossing Highway 81/);
    await page.goBack();
    assert.equal(await time.inputValue(),'1200');
    assert.match(await page.locator('#replay-chapter-title').textContent(),/Maximum size/);
    await page.goForward();
    assert.equal(await time.inputValue(),'900');
    await page.reload();
    await page.locator('#replay-time:not([disabled])').waitFor();
    assert.equal(await time.inputValue(),'900');
    assert.match(await page.locator('#replay-chapter-title').textContent(),/Crossing Highway 81/);
    assert.equal(await page.locator('#registered-footage iframe').count(),0);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  });
}

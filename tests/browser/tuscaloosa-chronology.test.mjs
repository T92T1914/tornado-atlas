import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fixture,base} from './harness.mjs';

const data=JSON.parse(await readFile(new URL('../../exhibits/tuscaloosa-birmingham-2011/chronology.json',import.meta.url),'utf8'));
const survey=data.sources.find(row=>row.id==='nws-bmx-survey'),assessment=data.sources.find(row=>row.id==='nws-assessment');

for(const width of [320,1280]) {
  test(`Tuscaloosa chronology cites the archived survey and the printed CST interval ${width}`,async t=>{
    const page=await fixture(t,{viewport:{width,height:900},hasTouch:width<600,isMobile:width<600,
      reducedMotion:'reduce',serviceWorkers:'block'});
    await page.goto(base+'/reconstruction.html?event=tuscaloosa-birmingham-2011');
    await page.getByRole('button',{name:'Play chronology',exact:true}).waitFor();
    const card=page.locator('.chronology-record');
    assert.equal(await card.locator('h3').textContent(),'Approximate start in the survey');
    // An archived web page is cited by its address, with no PDF page fragment.
    assert.equal(await card.locator('a').first().getAttribute('href'),survey.url);
    assert.match(await card.textContent(),/Source clock: 443 pm\. Approximate time/);
    const options=await page.locator('#chronology-entry option').allTextContents();
    assert.deepEqual(options,['About 4:43 PM CDT: Approximate start in the survey','4:50 PM CDT: Assessment Table 1 interval begins',
      '5:45 PM CDT: Assessment Table 1 interval ends','About 6:14 PM CDT: Approximate end in the survey']);
    await page.locator('#chronology-entry').selectOption('1');
    await page.waitForFunction(()=>document.querySelector('.chronology-record > h3')?.textContent==='Assessment Table 1 interval begins');
    assert.equal(await card.locator('a').first().getAttribute('href'),assessment.url+'#page=14');
    assert.match(await card.textContent(),/Source clock: 3:50 – 4:45 p\.m\., in a column headed Time \(CST\)\./);
    assert.match(await card.textContent(),/disagrees with the survey/);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'No horizontal page scroll');
  });
}

test('coverage admits the Tuscaloosa chronology as documentary',async t=>{
  const page=await fixture(t,{viewport:{width:1280,height:900},serviceWorkers:'block'});
  await page.goto(base+'/coverage.html');
  const layer=page.locator('.coverage-event[data-event="tuscaloosa-birmingham-2011"] .coverage-layer[data-layer="chronology"]');
  assert.equal(await layer.getAttribute('data-state'),'documentary');
  assert.equal(await layer.getByRole('link',{name:'Open documentary chronology'}).getAttribute('href'),
    'reconstruction.html?event=tuscaloosa-birmingham-2011');
});

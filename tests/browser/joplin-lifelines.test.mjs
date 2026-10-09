import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fixture,base} from './harness.mjs';

for(const scenario of [
  {name:'narrow dark, enlarged reading',viewport:{width:320,height:844},colorScheme:'dark',enlarge:true},
  {name:'desktop light',viewport:{width:1280,height:900},colorScheme:'light'},
  {name:'narrow script-disabled reading',viewport:{width:320,height:844},javaScriptEnabled:false}
])test('Joplin hospital service comparison: '+scenario.name,async t=>{
  const {name,enlarge,...options}=scenario;
  const page=await fixture(t,options);
  await page.goto(base+'/joplin.html#hospital-services');
  if(scenario.javaScriptEnabled!==false){
    await page.locator('#reading-appearance').selectOption(scenario.colorScheme);
    assert.equal(await page.locator('html').getAttribute('data-appearance'),scenario.colorScheme);
  }
  const section=page.locator('#hospital-services');
  assert.match(await section.innerText(),/outside the damaged area/);
  assert.match(await section.innerText(),/cannot isolate/);
  assert.equal(await section.locator('.hospital-service-comparison article').count(),2);
  if(scenario.enlarge)await section.evaluate(node=>{
    for(const element of node.querySelectorAll('p,dt,dd,h2,h3,h4,li,summary')){
      element.style.fontSize=parseFloat(getComputedStyle(element).fontSize)*2+'px';
    }
  });
  const reporting=page.locator('#utility-reporting-record summary');
  await reporting.focus();await reporting.press('Enter');
  assert.equal(await page.locator('#utility-reporting-record').getAttribute('open'),'');
  const rows=page.locator('.utility-reporting-entries li');
  assert.equal(await rows.count(),15);
  assert.match(await rows.nth(0).innerText(),/blank estimate cell/);
  assert.match(await rows.nth(3).innerText(),/13,700/);
  assert.match(await rows.nth(4).innerText(),/17,000/);
  assert.match(await rows.nth(4).innerText(),/additional customers reporting/);
  const unavailable=rows.filter({hasText:'May 25 · 5pm'});
  assert.equal(await unavailable.count(),1);
  assert.match(await unavailable.innerText(),/unavailable/);
  assert.match(await unavailable.innerText(),/lightning strike/);
  assert.equal((await rows.allInnerTexts()).filter(text=>/Reported estimate: NR/.test(text)).length,3);
  assert.match(await rows.nth(14).innerText(),/able to receive service/);
  await page.locator('#care-phase-accounts summary').focus();
  await page.keyboard.press('Enter');
  const phases=await page.locator('#care-phase-accounts').innerText();
  assert.match(phases,/May 28, 2011/);assert.match(phases,/May 29, 2011/);
  assert.match(phases,/2012 is inferred/);assert.match(phases,/has not been reconciled/);
  assert.match(phases,/not independent corroboration/);
  assert.equal(await section.locator('time[datetime]').count(),0);
  assert.equal(await section.locator('img').count(),0);
  const layout=await section.evaluate(node=>({
    width:document.documentElement.scrollWidth,viewport:innerWidth,
    escaped:[...node.querySelectorAll('article,p,dt,dd,li,summary')].filter(element=>{
      const r=element.getBoundingClientRect();return r.width&& (r.left < -1||r.right > innerWidth+1);
    }).map(element=>element.tagName)
  }));
  assert.ok(layout.width<=layout.viewport+1,JSON.stringify(layout));
  assert.deepEqual(layout.escaped,[]);
  const link=section.locator('a[href*="observation=nist-freeman-service-continuity"]').first();
  await link.focus();await link.press('Enter');
  await page.waitForURL(/dossier\.html\?event=joplin-2011/);
  if(scenario.javaScriptEnabled!==false){
    await page.waitForFunction(()=>document.getElementById('observation-nist-freeman-service-continuity'));
    assert.match(await page.locator('#observation-nist-freeman-service-continuity').innerText(),/backup power/);
  }else assert.match(await page.locator('body').innerText(),/JavaScript|JSON|metadata|dossier/i);
  await page.goBack();
  await page.waitForURL(/joplin\.html#hospital-services$/);
  assert.equal(await page.locator('#hospital-services-heading').textContent(),'Restoring electricity did not restore every hospital.');
});

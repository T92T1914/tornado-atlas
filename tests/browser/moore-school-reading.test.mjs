import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,base} from './harness.mjs';
import {waitForDossier} from './dossier-readiness.mjs';
import {assertReadingReflow} from './reading-reflow-diagnostics.mjs';

for(const width of [320,1280])test('School testimony, structural outcome and lab limits keep exact source return '+width,{timeout:45000},async t=>{
 const page=await fixture(t,{viewport:{width,height:900},reducedMotion:'reduce'});
 await page.goto(base+'/moore.html#plaza-towers-refuge');await page.waitForFunction(()=>document.querySelector('.documentary-contents').dataset.focusReveal==='ready');
 const cases=[['plaza-reported-refuge-change','plaza-towers-refuge','printed page 29 / PDF page 53',/teacher/i],['plaza-roof-wall-performance','plaza-towers-refuge','printed page 31 / PDF page 55',/suggests/i],['briarwood-400-refuge-envelope','briarwood-refuge','printed page 36 / PDF page 60',/Building 400/]];
 for(const [id,anchor,locator,kind] of cases){
  const link=page.locator('#schools a[href*="observation='+id+'"]');const href=await link.evaluate(n=>n.href);await link.focus();await link.press('Enter');await waitForDossier(page,{href,elementId:'observation-'+id});const card=page.locator('#observation-'+id);const text=await card.innerText();assert.ok(text.includes(locator),text);assert.match(text,kind);assert.match(text,/unregistered/i);
  await card.getByText('Continue in the current article',{exact:true}).click();const back=card.locator('a[href="'+base+'/moore.html#'+anchor+'"]');assert.equal(await back.count(),1);await back.focus();await back.press('Enter');await page.waitForURL(url=>url.pathname.endsWith('/moore.html')&&url.hash==='#'+anchor);
 }
 assert.match(await page.locator('#schools').textContent(),/NIST's December 2013 school section also retains that initial interpretation/);assert.match(await page.locator('#schools').textContent(),/further evaluation supported EF4/);
 await assertReadingReflow(page,'Moore school account');await page.locator('#schools-and-model-limits a').focus();await page.locator('#schools-and-model-limits a').press('Enter');await page.waitForURL('**/wind.html?event=moore-2013#wind-model-limits');await page.locator('#lab-context[data-experiment-ready="true"]').waitFor();assert.equal(await page.locator('#lab-event').inputValue(),'moore-2013');assert.equal(await page.locator('#peak').inputValue(),'100');assert.equal(await page.locator('#capacity').inputValue(),'1');assert.match(await page.locator('#wind-model-limits').textContent(),/Read the model/);await page.goBack();await page.waitForURL(url=>url.pathname.endsWith('/moore.html'));assert.match(await page.locator('#schools-and-model-limits').textContent(),/No school outcome here calibrates the experiment or certifies a shelter/);
});

import test from 'node:test';import assert from 'node:assert/strict';
import {fixture,base} from './harness.mjs';import {waitForDossier} from './dossier-readiness.mjs';
const tasks=[
{file:'blackwell.html',event:'blackwell-1955',anchor:'power-system-assessment',ids:['interior-blackwell-electric-distribution-study'],source:'interior-blackwell-power-study-fy1955',limit:/OCR.*original scan/,sourceLimit:/OCR fidelity/},
{file:'joplin.html',event:'joplin-2011',anchor:'post-investigation-changes',ids:['nist-joplin-school-shelter-code-changes','nist-joplin-existing-refuge-selection'],source:'nist-joplin-standards-impacts',limit:/do not establish local adoption or certify/,sourceLimit:/complete standards review/}];
for(const width of [320,1280])for(const task of tasks){
test('qualified aftermath account to observation, source and article '+task.event+' '+width,async t=>{
const page=await fixture(t,{viewport:{width,height:1000},reducedMotion:'reduce'});
await page.goto(base+'/'+task.file+'#'+task.anchor);
const note=page.locator('#'+task.anchor);assert.match(await note.textContent(),task.limit);
assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
for(const id of task.ids){
const entry=note.locator('a[href*="observation='+id+'"]');await entry.focus();await entry.press('Enter');await waitForDossier(page,{href:page.url(),elementId:'observation-'+id});
const card=page.locator('#observation-'+id);await card.waitFor();assert.match(await card.textContent(),/source|report|NIST|Interior/i);
await card.getByRole('link',{name:'Inspect the source card'}).click();await waitForDossier(page,{href:page.url(),elementId:'source-'+task.source});const source=page.locator('#source-'+task.source);await source.waitFor();assert.match(await source.textContent(),task.sourceLimit);
const details=source.locator('details').filter({has:page.getByText('Continue in the current article',{exact:true})});await details.locator('summary').click();
const back=details.locator('a[href$="/'+task.file+'#'+task.anchor+'"]');assert.equal(new URL(await back.getAttribute('href')).pathname,'/'+task.file);await back.focus();await back.press('Enter');await page.waitForURL(u=>u.pathname.endsWith('/'+task.file)&&u.hash==='#'+task.anchor);assert.equal(new URL(page.url()).hash,'#'+task.anchor);await page.locator('#'+task.anchor).waitFor();
}
});
test('qualified aftermath no-script reading '+task.event+' '+width,async t=>{
const page=await fixture(t,{viewport:{width,height:1000},javaScriptEnabled:false});await page.goto(base+'/'+task.file+'#'+task.anchor);assert.match(await page.locator('#'+task.anchor).textContent(),task.limit);
assert.equal(await page.locator('#'+task.anchor+' a[href*="dossier.html"]').count(),task.ids.length);
assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
});
}

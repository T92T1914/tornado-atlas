import test from 'node:test';import assert from 'node:assert/strict';
import {fixture,base} from './harness.mjs';import {waitForDossier} from './dossier-readiness.mjs';
const tasks=[
{file:'blackwell.html',event:'blackwell-1955',anchor:'power-system-assessment',ids:['interior-blackwell-electric-distribution-study'],source:'interior-blackwell-power-study-fy1955',limit:/The original scan confirms this selected OCR account/,sourceLimit:/Selected OCR passage compared with the original report scan/},
{file:'joplin.html',event:'joplin-2011',anchor:'post-investigation-changes',ids:['nist-joplin-school-shelter-code-changes','nist-joplin-existing-refuge-selection'],source:'nist-joplin-standards-impacts',limit:/do not establish local adoption or certify/,sourceLimit:/complete standards review/}];
// Exact inspected original and prior OCR identities are separate evidence.
const blackwellScan='https://www.govinfo.gov/content/pkg/GOVPUB-I-4777581ea2c4a034cd4eb4b914c8e576/pdf/GOVPUB-I-4777581ea2c4a034cd4eb4b914c8e576.pdf#page=166';
const blackwellPdfSha='5a9ecfa9dbec58097aa2be7b7fb5a70dcc8b3fc7cf83b727971a659d5d461cdd';
const blackwellOcrSha='d8c64dc077c7b8ce9a83c0ada5309e6d870d4f52c477b26be7bf7f20241260ed';
async function blackwellReading(note){
 const text=await note.textContent();
 for(const limit of ['no resulting estimate','outage duration','repair-completion date','exact study date'])assert.ok(text.includes(limit),limit+' remains unknown');
 const original=note.locator('a[href="'+blackwellScan+'"]');assert.equal(await original.count(),1);
 assert.match(await original.textContent(),/printed page 118 \/ PDF page 166, 63 MiB/);
}
for(const width of [320,1280])for(const task of tasks){
test('qualified aftermath account to observation, source and article '+task.event+' '+width,async t=>{
const page=await fixture(t,{viewport:{width,height:1000},reducedMotion:'reduce'});
await page.goto(base+'/'+task.file+'#'+task.anchor);
const note=page.locator('#'+task.anchor);assert.match(await note.textContent(),task.limit);
if(task.event==='blackwell-1955')await blackwellReading(note);
assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
for(const id of task.ids){
const entry=note.locator('a[href*="observation='+id+'"]');await entry.focus();await entry.press('Enter');await waitForDossier(page,{href:page.url(),elementId:'observation-'+id});
const card=page.locator('#observation-'+id);await card.waitFor();assert.match(await card.textContent(),/source|report|NIST|Interior/i);
if(task.event==='blackwell-1955'){const text=await card.textContent();for(const limit of ['resulting estimate','outage duration','repair-completion date','exact study date'])assert.match(text,new RegExp(limit,'i'));assert.match(text,/original engineering study and supporting estimates remain uninspected/);}
await card.getByRole('link',{name:'Inspect the source card'}).click();await waitForDossier(page,{href:page.url(),elementId:'source-'+task.source});const source=page.locator('#source-'+task.source);await source.waitFor();assert.match(await source.textContent(),task.sourceLimit);
if(task.event==='blackwell-1955'){assert.equal(await source.getByRole('link',{name:'Read original source',exact:true}).getAttribute('href'),blackwellScan);const text=await source.textContent();for(const sha of [blackwellPdfSha,blackwellOcrSha])assert.ok(text.includes(sha),'Retained source identity '+sha);assert.match(text,/printed pages 117 and 118 \/ PDF pages 165 and 166/);assert.match(text,/complete 456-page report and original engineering study have not been reviewed/);assert.equal(await source.locator('img,iframe,video,picture').count(),0);}
const details=source.locator('details').filter({has:page.getByText('Continue in the current article',{exact:true})});await details.locator('summary').click();
const back=details.locator('a[href$="/'+task.file+'#'+task.anchor+'"]');assert.equal(new URL(await back.getAttribute('href')).pathname,'/'+task.file);await back.focus();await back.press('Enter');await page.waitForURL(u=>u.pathname.endsWith('/'+task.file)&&u.hash==='#'+task.anchor);assert.equal(new URL(page.url()).hash,'#'+task.anchor);await page.locator('#'+task.anchor).waitFor();
}
});
test('qualified aftermath no-script reading '+task.event+' '+width,async t=>{
const page=await fixture(t,{viewport:{width,height:1000},javaScriptEnabled:false});await page.goto(base+'/'+task.file+'#'+task.anchor);assert.match(await page.locator('#'+task.anchor).textContent(),task.limit);
if(task.event==='blackwell-1955')await blackwellReading(page.locator('#'+task.anchor));
assert.equal(await page.locator('#'+task.anchor+' a[href*="dossier.html"]').count(),task.ids.length);
assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
});
}

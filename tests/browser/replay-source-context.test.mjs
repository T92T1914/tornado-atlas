import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,readFile} from 'node:fs/promises';
import path from 'node:path';
import {fixture,base} from './harness.mjs';
const data=JSON.parse(await readFile(new URL('../../web/data.json',import.meta.url),'utf8'));
const config=JSON.parse(await readFile(new URL('../../web/events/el-reno-2013.json',import.meta.url),'utf8'));
const sequence=data.appearance_timeline.photo_sequences.find(s=>s.id==='nolte-reported-stills');
const origin=Date.parse(config.clock.start_utc);
const seconds=s=>(Date.parse(s.reported_utc)-origin)/1000;
const url=s=>base+'/reconstruction.html?event=el-reno-2013&t='+seconds(s)+'&appearance_view=photo&appearance_photo='+sequence.id;
const painted=page=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
async function assertSample(page,sample){
 await page.waitForFunction(id=>document.querySelector('[data-photo-sample="'+id+'"]').getAttribute('aria-pressed')==='true',sample.id);
 assert.equal(await page.locator('#replay-time').inputValue(),String(seconds(sample)));
 assert.equal(await page.locator('#replay-photo-original').getAttribute('href'),sample.image.original_url);
 const c=sample.source_comparison;assert.equal(await page.locator('#replay-photo-movie-context').count(),c?1:0);
 if(c){assert.match(await page.locator('#replay-photo-movie-context').textContent(),/exact photographic exposure has not been identified/);
  assert.ok((await page.locator('#replay-photo-movie-context').textContent()).includes(c.printed_clock+' UTC'));
  const expected=new URL(c.url);expected.searchParams.set('t',Math.floor(c.requested_seconds)+'s');
  assert.equal(await page.locator('#replay-photo-movie-original').getAttribute('href'),expected.href);
 }
 assert.equal(await page.locator('#replay-appearance-canvas').getAttribute('data-partial-form'),'false');
}
for(const width of [320,1280])for(const index of [0,1]){
 test('checked Nolte movie context '+sequence.samples[index].id+' at '+width+'px preserves labels, gaps and history',async t=>{
  const page=await fixture(t,{viewport:{width,height:1000}}),sample=sequence.samples[index],c=sample.source_comparison;
  const providers=[];page.on('request',request=>{if(/youtube|nnwx\.us|googlevideo|ytimg/.test(new URL(request.url()).hostname))providers.push(request.url());});
  await page.goto(url(sample));await page.locator('#replay-time:not([disabled])').waitFor();await assertSample(page,sample);
  const details=page.locator('#replay-photo-details'),summary=details.locator('summary');
  assert.equal(await details.getAttribute('open'),null);await summary.focus();await page.keyboard.press('Enter');
  await page.waitForFunction(()=>document.getElementById('replay-photo-details').open);
  const text=await details.textContent();
  for(const value of [c.requested_seconds,c.callback_seconds,c.paused_seconds])assert.ok(text.includes(String(value)));
  if(index===1){const visible=await page.locator('#replay-photo-movie-context').textContent();assert.match(visible,/tooltip obscures some fractional clock digits/);assert.equal(visible.includes('23:10:59.'),false);}
  await page.locator('#replay-photo-movie-original').focus();
  await page.setViewportSize({width:width===320?390:1024,height:1000});await painted(page);
  assert.equal(await page.evaluate(()=>document.activeElement.id),'replay-photo-movie-original');
  assert.equal(await details.evaluate(d=>d.open),true);await assertSample(page,sample);
  await page.setViewportSize({width,height:1000});await painted(page);
  const gap=seconds(sample)+.254;await page.locator('#replay-time').fill(String(gap));await painted(page);
  assert.equal(await page.locator('#replay-photo-movie-context').count(),0);assert.equal(await page.locator('#replay-photo-record').textContent(),'');
  assert.equal(await page.locator('#replay-appearance-canvas').getAttribute('data-evidence-state'),'unknown');
  await page.locator('[data-photo-sample="'+sample.id+'"]').focus();await page.keyboard.press('Enter');await assertSample(page,sample);
  await page.locator('#replay-play').click();await page.locator('#replay-photo-movie-context').waitFor({state:'detached'});await page.locator('#replay-play').click();
  await page.locator('[data-photo-sample="'+sample.id+'"]').click();await assertSample(page,sample);
  const next=sequence.samples[index+1];await page.locator('[data-photo-sample="'+next.id+'"]').click();await assertSample(page,next);
  await page.goBack();await assertSample(page,sample);await page.goForward();await assertSample(page,next);await page.goBack();await assertSample(page,sample);
  await page.reload();await page.locator('#replay-time:not([disabled])').waitFor();await assertSample(page,sample);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
  assert.deepEqual(providers,[],'No provider or source-image request before source link activation');
  const folder=process.env.ATLAS_SOURCE_CONTEXT_CAPTURE;if(folder){await mkdir(folder,{recursive:true});await page.locator('#replay-photo-movie-context').screenshot({path:path.join(folder,width+'-'+sample.id+'.png')});}
 });
}

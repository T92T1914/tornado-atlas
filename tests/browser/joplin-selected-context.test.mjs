import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fixture,base} from './harness.mjs';
const data=JSON.parse(await readFile(new URL('../../exhibits/joplin-2011/chronology.json',import.meta.url),'utf8'));
const reference=data.reading_context.reference;
const doc=JSON.parse(await readFile(new URL('../../web/'+reference.file,import.meta.url),'utf8'));
const section='#chronology-reading-context';
const ids=data.reading_context.observations.map(row=>row.id);
const report=data.sources[0].url;
const warning31Seconds=(Date.parse(data.entries.find(row=>row.id==='warning-31').utc)-Date.parse(data.entries[0].utc))/1000;
assert.equal(warning31Seconds,13620);
async function clockReady(page,seconds){
  try{
  await page.waitForFunction(value=>document.querySelector('#chronology-time')?.value===String(value)&&new URL(location.href).searchParams.get('t')===String(value),seconds);
  }catch(error){
    console.error('JOPLIN_CONTEXT_CLOCK_DIAGNOSTIC '+JSON.stringify(await page.evaluate(expected=>{const range=document.querySelector('#chronology-time');return {expected,url:location.href,ready:document.readyState,active:{tag:document.activeElement?.tagName,id:document.activeElement?.id},range:{value:range?.value,min:range?.min,max:range?.max,step:range?.step},picker:document.querySelector('#chronology-entry')?.value,entry:document.querySelector('.chronology-record > h3')?.textContent,contextVisible:!document.querySelector('#chronology-reading-context')?.hidden};},seconds)));throw error;
  }
  assert.equal(await page.getByRole('button',{name:'Play chronology',exact:true}).count(),1);
}
async function fit(page){assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);}
async function contextIds(page){return page.locator(section+' > section').evaluateAll(nodes=>nodes.map(node=>node.dataset.observation));}
async function fullContext(page,expected){
  assert.deepEqual(await contextIds(page),expected);
  assert.equal(await page.locator('.chronology-record > a').getAttribute('href'),report+'#page=8');
  for(const id of expected){
    const observation=doc.observations.find(row=>row.id===id),route=data.reading_context.observations.find(row=>row.id===id);
    const record=page.locator(section+' > section[data-observation="'+id+'"]');
    assert.equal(await record.locator('h5').textContent(),observation.title);
    assert.equal(await record.locator(':scope > p').nth(0).textContent(),observation.account);
    assert.equal(await record.locator(':scope > p').nth(1).textContent(),observation.limits);
    const link=record.getByRole('link',{name:'Read the evidence account, limits and inspection record',exact:true});
    const url=new URL(await link.getAttribute('href'),base);
    assert.equal(url.searchParams.get('event'),data.event_id);assert.equal(url.searchParams.get('revision'),reference.dossier_sha256);
    assert.equal(url.searchParams.get('observation'),id);assert.equal(url.hash,'#observation-'+id);
    assert.equal(await record.getByRole('link',{name:doc.sources.find(s=>s.id===route.source_id).title+': report passage',exact:true}).getAttribute('href'),report+'#page='+route.report_page);
    assert.equal(await record.getByRole('link',{name:'Read this account in the historical chapter',exact:true}).getAttribute('href'),'joplin.html#'+route.documentary_anchor);
  }
  await fit(page);
}
async function capture(page,name,locator=page.locator(section)){
  if(!process.env.ATLAS_JOPLIN_CONTEXT_CAPTURE)return;
  await mkdir(process.env.ATLAS_JOPLIN_CONTEXT_CAPTURE,{recursive:true});
  await locator.evaluate(node=>node.scrollIntoView({behavior:'instant',block:'start'}));
  await page.screenshot({path:path.join(process.env.ATLAS_JOPLIN_CONTEXT_CAPTURE,name+'.png')});
}

test('Joplin selected assessment keeps exact evidence, history, unknown timing and enlarged reading at 320 dark',async t=>{
  const page=await fixture(t,{viewport:{width:320,height:900},isMobile:true,hasTouch:true,reducedMotion:'reduce',serviceWorkers:'block'});
  await page.goto(base+'/reconstruction.html?event=joplin-2011&t=13140');await clockReady(page,13140);
  await page.locator('#reading-appearance').selectOption('dark');
  assert.equal(await page.locator('.chronology-record > h3').textContent(),'First warning area');
  await fullContext(page,[ids[0]]);
  await page.getByRole('button',{name:'Next entry',exact:true}).focus();await page.keyboard.press('Enter');
  await clockReady(page,13260);await fullContext(page,ids);
  assert.match(await page.locator(section).textContent(),/different scope/);
  await capture(page,'joplin-320-dark-first-siren');
  for(const id of ids){
    const record=page.locator(section+' > section[data-observation="'+id+'"]');
    await record.getByRole('link',{name:'Read the evidence account, limits and inspection record',exact:true}).focus();await page.keyboard.press('Enter');
    await page.locator('#observation-'+id).waitFor();
    await page.waitForFunction(()=>document.body.dataset.ready==='true');
    assert.equal(new URL(page.url()).searchParams.get('revision'),reference.dossier_sha256);
    assert.equal(new URL(page.url()).searchParams.get('observation'),id);
    assert.equal(new URL(page.url()).hash,'#observation-'+id);
    const observation=doc.observations.find(row=>row.id===id),card=page.locator('#observation-'+id);
    assert.equal(await card.locator(':scope > p').nth(1).textContent(),observation.account);
    assert.equal(await card.locator(':scope > p').nth(2).textContent(),observation.limits);
    for(const [heading,value] of [['Clock roles and registration',observation.time],['Place and its limits',observation.place]]){
      const disclosure=card.locator('details').filter({has:page.locator('summary').filter({hasText:heading})});
      await disclosure.locator('summary').focus();await page.keyboard.press('Enter');
      assert.equal(await disclosure.getAttribute('open')!==null,true);
      assert.deepEqual(JSON.parse(await disclosure.locator('pre').textContent()),value);
    }
    await card.getByRole('link',{name:'Inspect the source card',exact:true}).focus();await page.keyboard.press('Enter');
    await page.locator('#source-nws-assessment').waitFor();await page.waitForFunction(()=>document.body.dataset.ready==='true');
    assert.equal(new URL(page.url()).searchParams.get('revision'),reference.dossier_sha256);
    assert.equal(new URL(page.url()).searchParams.get('source'),'nws-assessment');
    assert.equal(await page.locator('#source-nws-assessment').getByRole('link',{name:'Read original source',exact:true}).getAttribute('href'),report);
    assert.match(await page.locator('#source-nws-assessment').textContent(),/selected-page reading is not a full-report visual review/);
    await page.goBack();await page.locator('#observation-'+id).waitFor();
    await page.goBack();await clockReady(page,13260);await fullContext(page,ids);
  }
  await page.reload();await clockReady(page,13260);await fullContext(page,ids);
  for(const seconds of [13320,13380,13440]){
    await page.locator('#chronology-time').focus();await page.keyboard.press('ArrowRight');await clockReady(page,seconds);
  }
  assert.equal(await page.locator('.chronology-record > h3').textContent(),'First siren alert');
  assert.match(await page.locator('.chronology-record > p').first().textContent(),/Latest earlier entry.*No new observation/);
  await fullContext(page,ids);assert.equal(data.entries.some(row=>row.utc==='2011-05-22T22:14:00Z'),false);
  await page.getByRole('button',{name:'Next entry',exact:true}).focus();await page.keyboard.press('Enter');await clockReady(page,warning31Seconds);
  assert.equal(await page.locator(section).isVisible(),false);assert.deepEqual(await contextIds(page),[]);
  await page.goBack();await clockReady(page,13440);await fullContext(page,ids);
  await page.goForward();await clockReady(page,warning31Seconds);assert.equal(await page.locator(section).isVisible(),false);
  await page.goBack();await clockReady(page,13440);await fullContext(page,ids);
  const before=await page.locator(section).textContent();
  const sizes=await page.evaluate(()=>{
    const nodes=[document.querySelector('#replay-chronology'),...document.querySelectorAll('#replay-chronology *')];
    const values=nodes.map(node=>parseFloat(getComputedStyle(node).fontSize));
    nodes.forEach((node,i)=>node.style.fontSize=values[i]*2+'px');
    return nodes.map((node,i)=>[values[i],parseFloat(getComputedStyle(node).fontSize)]);
  });
  for(const [before,after] of sizes)assert.equal(after,before*2);
  assert.equal(await page.locator(section).textContent(),before);await fullContext(page,ids);
  for(const link of await page.locator(section+' a').all()){await link.focus();assert.equal(await link.evaluate(node=>node===document.activeElement),true);}
  await capture(page,'joplin-320-dark-enlarged',page.locator(section+' > section').last());
});

test('Joplin later assessment remains complete beside its original citation at 1280 light',async t=>{
  const page=await fixture(t,{viewport:{width:1280,height:900},reducedMotion:'reduce',serviceWorkers:'block'});
  await page.goto(base+'/reconstruction.html?event=joplin-2011&t=13260');await clockReady(page,13260);
  await page.locator('#reading-appearance').selectOption('light');await fullContext(page,ids);
  assert.equal(await page.locator('#chronology-radar-snapshot').count(),1);
  await capture(page,'joplin-1280-light-first-siren');
});

test('unavailable or invalid optional reading leaves the actual chronology and radar usable',async t=>{
  for(const mutate of [
    d=>d.reading_context.associations[0].entry_id='missing',
    d=>d.reading_context.reference.file_sha256='0'.repeat(64),
    d=>d.reading_context=null,
    d=>delete d.reading_context
  ]){
    const page=await fixture(t,{viewport:{width:320,height:900},reducedMotion:'reduce'});
    await page.route('**/events/joplin-2011-chronology.json',async route=>{const response=await route.fetch();const changed=await response.json();mutate(changed);await route.fulfill({response,json:changed});});
    await page.goto(base+'/reconstruction.html?event=joplin-2011&t=13140');await clockReady(page,13140);
    assert.equal(await page.locator(section).isVisible(),false);
    assert.equal(await page.locator('#chronology-radar-snapshot').count(),1);
    assert.match(await page.locator('#replay-chronology').textContent(),/later assessment context could not be verified.*clock remains usable/);
    assert.equal(await page.getByRole('link',{name:'Read the historical chapter and source accounts',exact:true}).getAttribute('href'),'joplin.html');
    await page.getByRole('button',{name:'Next entry',exact:true}).focus();await page.keyboard.press('Enter');await clockReady(page,13260);
    await fit(page);
  }
});

test('Joplin static documentary preserves both original qualified passages without scripts',async t=>{
  const page=await fixture(t,{viewport:{width:320,height:900},javaScriptEnabled:false,colorScheme:'dark'});
  for(const [anchor,id,pdfPage] of [['warning-context',ids[0],19],['siren-response',ids[1],11]]){
    await page.goto(base+'/joplin.html#'+anchor);const passage=page.locator('#'+anchor);
    assert.equal(await passage.isVisible(),true);
    assert.equal(await passage.locator('a[href="'+report+'#page='+pdfPage+'"]').count()>0,true);
    assert.equal(await passage.locator('a[href*="observation='+id+'"]').count()>0,true);
    await fit(page);
  }
  assert.match(await page.locator('#siren-response').textContent(),/54 residents.*63 interviews.*nine excluded/);
  await page.evaluate(()=>{const nodes=[document.body,...document.body.querySelectorAll('*')],sizes=nodes.map(node=>parseFloat(getComputedStyle(node).fontSize));nodes.forEach((node,i)=>node.style.fontSize=sizes[i]*2+'px');});
  await fit(page);await capture(page,'joplin-320-dark-nojs-enlarged',page.locator('#siren-response'));
});

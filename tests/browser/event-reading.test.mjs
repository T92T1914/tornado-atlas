import {test} from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {mkdir} from 'node:fs/promises';
import {fixture,base} from './harness.mjs';

const tasks=[
  {file:'joplin.html',first:'#warning-context',source:'#source-nws-assessment',media:'#visibility',wording:/first siren/i},
  {file:'blackwell.html',first:'#clocks',source:'#source-report',media:'#archive-prints',wording:/labels.*reconciliation/i},
  {file:'tuscaloosa.html',first:'#path',source:'#source-survey',media:'#railway-bridge',wording:/different outcomes/i}
];
test('unenhanced entry pages name the actual system appearance and keep the switch unavailable',async t=>{
  const pages=['atlas.html','index.html','joplin.html','blackwell.html','tuscaloosa.html','dossier.html','coverage.html','reconstruction.html','survey.html','radar-source.html','study.html','wind.html','japan.html','curator.html'];
  for(const scheme of ['light','dark']){
    const page=await fixture(t,{viewport:{width:320,height:900},javaScriptEnabled:false,colorScheme:scheme});
    for(const file of pages){
      await page.goto(base+'/'+file);assert.equal(await page.locator('#reading-appearance').isDisabled(),true,file);
      assert.equal(await page.locator('#reading-appearance').inputValue(),'system',file);
      assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).colorScheme),scheme,file+' reflects the declared system preference');
    }
  }
});
for(const enabled of [false,true])for(const task of tasks)test(`${task.file}: purposeful reading route, scripts ${enabled}`,async t=>{
  const page=await fixture(t,{viewport:{width:320,height:900},javaScriptEnabled:enabled});
  await page.goto(base+'/'+task.file);
  const guide=page.locator('.museum-reading-start');
  assert.equal(await guide.count(),1);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
  const originalIDs=await page.locator('[id]').evaluateAll(nodes=>nodes.map(node=>node.id));
  assert.equal(originalIDs.length,new Set(originalIDs).size);
  const first=guide.locator(`a[href="${task.first}"]`);await first.focus();await page.keyboard.press('Enter');
  assert.equal(new URL(page.url()).hash,task.first);
  assert.match(await page.locator(task.first).textContent(),task.wording);
  const citation=guide.locator('a[href="#sources"]');await citation.focus();await page.keyboard.press('Enter');
  assert.equal(new URL(page.url()).hash,'#sources');
  await page.locator(task.source).evaluate(node=>node.scrollIntoView({behavior:'instant',block:'start'}));
  assert.match(await page.locator(task.source).locator('a[href^="https://"]').first().getAttribute('href'),/^https:\/\//);
  await page.goBack();assert.equal(new URL(page.url()).hash,task.first);
  await page.goBack();assert.equal(new URL(page.url()).hash,'');
  await guide.locator(`a[href="${task.media}"]`).focus();await page.keyboard.press('Enter');
  assert.equal(new URL(page.url()).hash,task.media);
  if(task.file==='blackwell.html')assert.match(await page.locator(task.media).textContent(),/not.*(?:host|inspected)|unreviewed|permission/i);
  if(task.file==='tuscaloosa.html'){
    assert.match(await page.locator(task.media).textContent(),/Individual photographer unknown/);
    assert.match(await page.locator(task.media).getAttribute('data-photo-location'),/bridge, waterway and particular place are unnamed/);
  }
  await page.goto(base+'/'+task.file);await page.evaluate(()=>{const nodes=[document.body,...document.body.querySelectorAll('*')],sizes=nodes.map(node=>parseFloat(getComputedStyle(node).fontSize));nodes.forEach((node,index)=>node.style.fontSize=sizes[index]*2+'px');});
  if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)){
    console.log('EVENT_START_REFLOW '+JSON.stringify(await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,scrollX,overflow:[...document.querySelectorAll('body *')].map(node=>({tag:node.tagName,id:node.id,cls:typeof node.className==='string'?node.className:null,width:node.getBoundingClientRect().width,right:node.getBoundingClientRect().right+scrollX,clientWidth:node.clientWidth,scrollWidth:node.scrollWidth,text:node.textContent?.slice(0,140)})).filter(row=>(row.right>innerWidth+1||row.scrollWidth>row.clientWidth+1)&&row.width>0).slice(0,24)}))));
    if(process.env.ATLAS_EVENT_READING_CAPTURE)await page.screenshot({path:path.join(process.env.ATLAS_EVENT_READING_CAPTURE,task.file.replace('.html',`-reflow-failure-${enabled}.png`))});
  }
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
  if(process.env.ATLAS_EVENT_READING_CAPTURE){await mkdir(process.env.ATLAS_EVENT_READING_CAPTURE,{recursive:true});await page.screenshot({path:path.join(process.env.ATLAS_EVENT_READING_CAPTURE,task.file.replace('.html',`-320-${enabled?'enhanced':'nojs'}-enlarged.png`))});}
});

test('three event entrances keep the full account and media reachable on a wide light page',async t=>{
  const page=await fixture(t,{viewport:{width:1280,height:900},colorScheme:'light'});
  for(const task of tasks){
    await page.goto(base+'/'+task.file);await page.locator('#reading-appearance').selectOption('light');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
    assert.ok((await page.locator('.documentary-reading').innerText()).length>4000);
    for(const link of await page.locator('.museum-reading-start a[href^="#"]').evaluateAll(nodes=>nodes.map(node=>node.getAttribute('href'))))assert.equal(await page.locator(link).count(),1,link+' reaches one retained destination');
    if(process.env.ATLAS_EVENT_READING_CAPTURE){await mkdir(process.env.ATLAS_EVENT_READING_CAPTURE,{recursive:true});await page.screenshot({path:path.join(process.env.ATLAS_EVENT_READING_CAPTURE,task.file.replace('.html','-1280-light.png'))});}
  }
});

import {test} from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {mkdir} from 'node:fs/promises';
import {fixture,base} from './harness.mjs';
import {assertReadingReflow} from './reading-reflow-diagnostics.mjs';

const tasks=[
  {file:'joplin.html',first:'#warning-context',source:'#source-nws-assessment',media:'#visibility',wording:/first siren/i},
  {file:'blackwell.html',first:'#clocks',source:'#source-report',media:'#archive-prints',wording:/labels.*reconciliation/i},
  {file:'tuscaloosa.html',first:'#path-greene',source:'#source-survey',media:'#railway-bridge',wording:/rural beginning/i}
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
for(const enabled of [false,true])for(const task of tasks)test(`${task.file}: purposeful reading route, scripts ${enabled}`,{timeout:60000},async t=>{
  const page=await fixture(t,{viewport:{width:320,height:900},javaScriptEnabled:enabled});
  await page.goto(base+'/'+task.file);
  await page.locator('.reading-options > summary').click();
  const guide=page.locator('.museum-reading-start');
  assert.equal(await guide.count(),1);
  for(const href of await guide.locator('a[href^="#"]').evaluateAll(nodes=>nodes.map(node=>node.getAttribute('href')))){
    const destination=page.locator(href);
    assert.equal(await destination.count(),1,task.file+' '+href);
    assert.equal(await destination.isVisible(),true,task.file+' '+href+' must be a visible reading destination');
  }
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
  const originalIDs=await page.locator('[id]').evaluateAll(nodes=>nodes.map(node=>node.id));
  assert.equal(originalIDs.length,new Set(originalIDs).size);
  const first=guide.locator(`a[href="${task.first}"]`);await first.focus();
  await Promise.all([
    page.waitForURL(url=>url.hash===task.first),
    page.keyboard.press('Enter')
  ]);
  assert.equal(new URL(page.url()).hash,task.first);
  assert.match(await page.locator(task.first).textContent(),task.wording);
  const citation=guide.locator('a[href="#sources"]');await citation.focus();
  await Promise.all([
    page.waitForURL(url=>url.hash==='#sources'),
    page.keyboard.press('Enter')
  ]);
  assert.equal(new URL(page.url()).hash,'#sources');
  await page.locator(task.source).evaluate(node=>node.scrollIntoView({behavior:'instant',block:'start'}));
  assert.match(await page.locator(task.source).locator('a[href^="https://"]').first().getAttribute('href'),/^https:\/\//);
  await page.goBack();assert.equal(new URL(page.url()).hash,task.first);
  await page.goBack();assert.equal(new URL(page.url()).hash,'');
  await guide.locator(`a[href="${task.media}"]`).focus();
  await Promise.all([
    page.waitForURL(url=>url.hash===task.media),
    page.keyboard.press('Enter')
  ]);
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
  if(task.file==='tuscaloosa.html'){
    // Test spacing on a fresh document, separately from the doubled-text phase.
    let phase='comparison navigation';
    try{
      await page.goto(base+'/tuscaloosa.html#survey-worked-comparison');
      // A fragment goto can retain the prior document and its inline doubled sizes.
      phase='fresh comparison document';await page.reload();
      if(enabled){phase='enhanced contents readiness';await page.waitForFunction(()=>document.querySelector('.documentary-contents')?.dataset.focusReveal==='ready');}
      phase='spacing style insertion';
      // Insert synchronously: addStyleTag awaits a style load callback, including when scripts are disabled.
      const rules=await page.evaluate(content=>{const style=document.createElement('style');style.textContent=content;document.head.appendChild(style);return style.sheet.cssRules.length;},
        'p{margin-bottom:2em!important}body *{line-height:1.5!important;letter-spacing:.12em!important;word-spacing:.16em!important}');
      assert.equal(rules,2,'Both spacing rules are present without enabling page scripts');
      phase='spacing reflow assertion';await assertReadingReflow(page,'Tuscaloosa spaced reading, scripts '+enabled);
      phase='worked comparison qualification';assert.match(await page.locator('#survey-worked-comparison').innerText(),/EF3 and EF4/);
      // Match the retained article sequence, where a fragment return keeps doubled sizes before spacing.
      phase='combined fresh comparison navigation';await page.goto(base+'/tuscaloosa.html#survey-worked-comparison');
      phase='combined fresh comparison document';await page.reload();
      if(enabled){phase='combined enhanced contents readiness';await page.waitForFunction(()=>document.querySelector('.documentary-contents')?.dataset.focusReveal==='ready');}
      phase='combined snapshot font doubling';
      await page.evaluate(()=>{const nodes=[document.body,...document.body.querySelectorAll('*')],sizes=nodes.map(node=>parseFloat(getComputedStyle(node).fontSize));nodes.forEach((node,index)=>node.style.fontSize=sizes[index]*2+'px');});
      phase='combined doubled comparison reflow';await assertReadingReflow(page,'Tuscaloosa doubled comparison, scripts '+enabled);
      phase='combined native contents open';
      const summary=page.locator('#article-contents');if(!await summary.evaluate(node=>node.parentElement.open))await summary.click();
      phase='combined native storm navigation';await page.locator('.documentary-contents a[href="#storm"]').focus();await page.keyboard.press('Enter');
      await page.waitForURL(url=>url.hash==='#storm');
      phase='combined doubled storm reflow';await assertReadingReflow(page,'Tuscaloosa doubled storm, scripts '+enabled);
      phase='combined same-document comparison return';await page.goto(base+'/tuscaloosa.html#survey-worked-comparison');
      if(enabled){phase='combined returned contents readiness';await page.waitForFunction(()=>document.querySelector('.documentary-contents')?.dataset.focusReveal==='ready');}
      phase='combined spacing style insertion';
      const combinedRules=await page.evaluate(content=>{const style=document.createElement('style');style.textContent=content;document.head.appendChild(style);return style.sheet.cssRules.length;},
        'p{margin-bottom:2em!important}body *{line-height:1.5!important;letter-spacing:.12em!important;word-spacing:.16em!important}');
      assert.equal(combinedRules,2,'Both spacing rules accompany the retained doubled sizes');
      phase='combined spacing reflow assertion';await assertReadingReflow(page,'Tuscaloosa doubled and spaced reading, scripts '+enabled);
      phase='combined worked comparison qualification';assert.match(await page.locator('#survey-worked-comparison').innerText(),/EF3 and EF4/);
    }catch(error){
      console.log('EVENT_SPACING_FAILURE '+JSON.stringify({file:task.file,scripts:enabled,phase,error_name:error.name,error_message:String(error.message).slice(0,256)}));
      throw error;
    }
  }
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

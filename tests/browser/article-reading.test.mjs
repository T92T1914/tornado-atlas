import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {mkdir} from 'node:fs/promises';
import {fixture,base} from './harness.mjs';
import {waitForDossier} from './dossier-readiness.mjs';

// Expected passages and qualifications come from the preserved historical accounts.
const tasks=[
  {file:'index.html',event:'el-reno-2013',section:'history',lesson:'tracked-feature-radar',
    card:'observation-wakimoto-2016-dust-feature-radar-comparison',qualifier:/qualitative consistency/,media:'nolte-documentary-photographs'},
  {file:'joplin.html',event:'joplin-2011',section:'before',lesson:'utility-worked-comparison',
    card:'observation-nist-joplin-utility-restoration',qualifier:/rather than zero/,media:'photographs-and-film'},
  {file:'tuscaloosa.html',event:'tuscaloosa-birmingham-2011',section:'storm',lesson:'survey-worked-comparison',
    card:'source-bmx-estimated-damage-map',qualifier:/EF3 and EF4/,media:'photographs-and-film'},
  {file:'blackwell.html',event:'blackwell-1955',section:'record',lesson:'storm-and-tornadoes',
    card:'observation-nws-parent-storm-separate-tornadoes',qualifier:/probably part/,media:'archive-prints'},
];
async function ready(page,task){
  if(task.file==='index.html')await page.waitForFunction(()=>document.body.dataset.exhibitReady==='true');
  else await page.waitForFunction(()=>document.querySelector('.documentary-contents')?.dataset.focusReveal==='ready');
}
async function reflow(page){assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Article has no horizontal document overflow');}
async function contents(page,task){
  const summary=page.locator('#article-contents');
  if(!await summary.evaluate(n=>n.parentElement.open))await summary.click();
  return page.locator(task.file==='index.html'?'#exhibit-contents':'.documentary-contents');
}
async function capture(page,name){
  if(process.env.ATLAS_ARTICLE_READING_CAPTURE){await mkdir(process.env.ATLAS_ARTICLE_READING_CAPTURE,{recursive:true});
    await page.screenshot({path:path.join(process.env.ATLAS_ARTICLE_READING_CAPTURE,name+'.png')});}
}
for(const task of tasks)for(const width of [320,1280])test(task.file+': account, selected source and named return '+width,async t=>{
  const page=await fixture(t,{viewport:{width,height:900},colorScheme:width===320?'dark':'light',reducedMotion:'reduce'});
  await page.goto(base+'/'+task.file);await ready(page,task);
  await page.locator('#reading-appearance').selectOption(width===320?'dark':'light');await reflow(page);
  if(task.file!=='index.html'){
    assert.equal(await page.locator('.reading-options').evaluate(n=>n.open),false,'Optional starting routes are compact');
    assert.equal(await page.locator('.documentary-contents').evaluate(n=>n.open),width>1080);
  }
  const rail=await contents(page,task),chapter=rail.locator('a[href="#'+task.section+'"]');
  await chapter.focus();await page.keyboard.press('Enter');await page.waitForURL(u=>u.hash==='#'+task.section);
  const back=page.locator('#'+task.section+' > .article-return');await back.focus();await page.keyboard.press('Enter');
  await page.waitForURL(u=>u.hash==='#article-contents');
  assert.equal(await page.evaluate(()=>document.activeElement?.id),'article-contents','Native fragment returns keyboard focus to contents');
  await page.goto(base+'/'+task.file+'#'+task.lesson);await ready(page,task);
  assert.match(await page.locator('#'+task.lesson).innerText(),task.qualifier);
  await capture(page,task.file.replace('.html','')+'-lesson-'+width);
  const evidence=page.locator('#'+task.lesson+' a[href*="dossier.html"]').first();
  const target={href:await evidence.evaluate(n=>n.href),elementId:task.card};
  await evidence.click();await waitForDossier(page,target);
  const card=page.locator('#'+task.card);
  await card.getByText('Continue in the current article',{exact:true}).click();
  const named=card.locator('a[href$="#'+task.lesson+'"]');assert.equal(await named.count(),1);
  await named.focus();await page.keyboard.press('Enter');
  await page.waitForURL(u=>u.pathname.endsWith('/'+task.file)&&u.hash==='#'+task.lesson);await ready(page,task);
  assert.match(await page.locator('#'+task.lesson).innerText(),task.qualifier);await reflow(page);
});

for(const width of [390,768,1440])test('Four article entries and readable prose at '+width,async t=>{
  const page=await fixture(t,{viewport:{width,height:900},colorScheme:'dark',reducedMotion:'reduce'});
  for(const task of tasks){
    await page.goto(base+'/'+task.file);await ready(page,task);await reflow(page);
    const metrics=await page.locator('#'+task.lesson+' > p').first().evaluate(n=>({size:parseFloat(getComputedStyle(n).fontSize),width:n.getBoundingClientRect().width}));
    assert.ok(metrics.size>=17,task.file+' ordinary prose remains at least 17 CSS px');
    assert.ok(metrics.width<900,task.file+' prose stays bounded while media can be wider');
    if(width===390)await capture(page,task.file.replace('.html','')+'-entry-390');
  }
});
for(const task of tasks)test(task.file+': enlarged text, spacing and 320 CSSpx reflow',async t=>{
  const page=await fixture(t,{viewport:{width:320,height:900},reducedMotion:'reduce'});
  await page.goto(base+'/'+task.file+'#'+task.lesson);await ready(page,task);
  await page.evaluate(()=>{const nodes=[document.body,...document.body.querySelectorAll('*')],sizes=nodes.map(n=>parseFloat(getComputedStyle(n).fontSize));
    nodes.forEach((n,i)=>n.style.fontSize=sizes[i]*2+'px');});
  await reflow(page);const rail=await contents(page,task);
  await rail.locator('a[href="#'+task.section+'"]').focus();await page.keyboard.press('Enter');
  await page.waitForURL(u=>u.hash==='#'+task.section);await reflow(page);
  await page.goto(base+'/'+task.file+'#'+task.lesson);await ready(page,task);
  await page.addStyleTag({content:'p{margin-bottom:2em!important}body *{line-height:1.5!important;letter-spacing:.12em!important;word-spacing:.16em!important}'});
  await reflow(page);assert.match(await page.locator('#'+task.lesson).innerText(),task.qualifier);
});
for(const task of tasks)test(task.file+': native contents, account and original routes without script',async t=>{
  const page=await fixture(t,{viewport:{width:320,height:900},javaScriptEnabled:false,colorScheme:'light'});
  await page.goto(base+'/'+task.file);const rail=await contents(page,task);
  await rail.locator('a[href="#'+task.section+'"]').click();await page.waitForURL(u=>u.hash==='#'+task.section);
  assert.equal(await page.locator('#'+task.media).count(),1);
  const back=page.locator('#'+task.section+' > .article-return');await back.focus();await page.keyboard.press('Enter');
  await page.waitForURL(u=>u.hash==='#article-contents');await reflow(page);
});

test('Tuscaloosa continuation preserves the optional complete bank and distinct accounts',async t=>{
  const page=await fixture(t,{viewport:{width:320,height:900},reducedMotion:'reduce'}),task=tasks[2];
  await page.goto(base+'/tuscaloosa.html#survey-worked-comparison');await ready(page,task);
  const bank=page.locator('#survey-accounts');assert.equal(await bank.evaluate(n=>n.open),false,'Bank was and remains a native optional disclosure');
  assert.equal(await bank.locator('[id^="survey-account-"]').count(),198);
  const onward=page.getByRole('link',{name:'Continue the historical account: how the aftermath was recorded',exact:true});
  await onward.focus();await page.keyboard.press('Enter');await page.waitForURL(u=>u.hash==='#field-survey');
  await page.goBack();await page.getByRole('link',{name:'Inspect all 198 survey accounts',exact:true}).click();
  await page.waitForURL(u=>u.hash==='#survey-accounts');await bank.locator(':scope > summary').click();
  for(const id of [0,158,16])assert.equal(await page.locator('#survey-account-'+id).isVisible(),true);
  assert.match(await page.locator('#survey-account-0').innerText(),/EF3/);
  assert.match(await page.locator('#survey-account-158').innerText(),/EF4/);
  assert.match(await page.locator('#survey-account-16').innerText(),/EF0/);
  await page.getByRole('link',{name:'Return to the worked survey comparison',exact:true}).click();
  await page.waitForURL(u=>u.hash==='#survey-worked-comparison');
});
test('Blackwell contents follow the actual narrative and preserve remembrance',async t=>{
  const page=await fixture(t),task=tasks[3];await page.goto(base+'/blackwell.html');await ready(page,task);
  const rail=await contents(page,task),hrefs=await rail.locator('a').evaluateAll(ns=>ns.map(n=>n.hash));
  const sequence=['#storm-and-tornadoes','#record','#aftermath','#archive-prints','#clocks','#remembrance'];
  for(let i=1;i<sequence.length;i++)assert.ok(hrefs.indexOf(sequence[i])>hrefs.indexOf(sequence[i-1]),sequence.join(' to '));
  assert.match(await page.locator('#remembrance').innerText(),/20|nineteen|people/i);
});
test('Joplin collection history restores each actual opener and keeps full original routes',async t=>{
  const page=await fixture(t,{viewport:{width:320,height:900},reducedMotion:'reduce'});
  await page.goto(base+'/joplin.html#photographs-and-film');await ready(page,tasks[1]);
  const names=['friskey-joplin-storm','nws-joplin-aftermath'];
  for(const id of names){
    const opener=page.locator('#photographs-and-film a[data-photo-id="'+id+'"]');
    await opener.click();await page.waitForFunction(()=>document.getElementById('photo-dialog').open&&!document.getElementById('photo-full').hidden);
    assert.match(await page.locator('#photo-location').innerText(),/unregistered/);
    await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.getElementById('photo-dialog').open&&!new URL(location).searchParams.has('photo'));
    await page.waitForFunction(id=>document.activeElement===document.querySelector('#photographs-and-film a[data-photo-id="'+id+'"]'),id);
    await page.goForward();await page.waitForFunction(()=>document.getElementById('photo-dialog').open);
    await page.keyboard.press('Escape');await page.waitForFunction(id=>!new URL(location).searchParams.has('photo')&&document.activeElement===document.querySelector('#photographs-and-film a[data-photo-id="'+id+'"]'),id);
    assert.equal(await opener.locator('..').getByRole('link',{name:'Open the unchanged full JPEG',exact:true}).count(),1);
  }
  await page.locator('#photographs-and-film a[data-photo-id="'+names[1]+'"]').click();
  await page.waitForFunction(()=>document.getElementById('photo-dialog').open);
  await page.reload();await ready(page,tasks[1]);await page.waitForFunction(()=>document.getElementById('photo-dialog').open);
  await page.keyboard.press('Escape');await page.waitForFunction(()=>!new URL(location).searchParams.has('photo'));
  assert.equal(new URL(page.url()).hash,'#photographs-and-film');
});
test('El Reno keeps visible discrete limits beside uncropped media and native context',async t=>{
  const page=await fixture(t,{viewport:{width:390,height:844},reducedMotion:'reduce'});
  await page.goto(base+'/index.html#nolte-documentary-photographs');await ready(page,tasks[0]);
  const group=page.locator('#nolte-documentary-photographs');
  assert.match(await group.innerText(),/discrete|registration|calibrat/i);
  const context=group.getByText('Camera and publication context',{exact:true});assert.equal(await context.count(),1);
  await context.click();assert.match(await group.innerText(),/GoPro|Sony/);
  assert.equal(await group.locator('img').count(),3);
  assert.equal(await page.locator('#reading-films-and-encyclopedias a[href="#nolte-documentary-photographs"]').count(),1);
  assert.equal(await page.locator('#tracked-feature-radar a[href="#bohac-opening-motion"]').count(),1);
});

test('Joplin synthetic selection replacement keeps each owned Back opener',async t=>{
  const page=await fixture(t,{reducedMotion:'reduce'});
  await page.goto(base+'/joplin.html#photographs-and-film');await ready(page,tasks[1]);
  const storm='#photographs-and-film a[data-photo-id="friskey-joplin-storm"]';
  const aftermath='#photographs-and-film a[data-photo-id="nws-joplin-aftermath"]';
  await page.locator(storm).click();await page.waitForFunction(()=>document.getElementById('photo-dialog').open);
  // Controlled callback replacement while the first modal owns focus.
  await page.locator(aftermath).evaluate(n=>n.click());
  await page.waitForURL(u=>u.searchParams.get('photo')==='nws-joplin-aftermath');
  await page.goBack();await page.waitForURL(u=>u.searchParams.get('photo')==='friskey-joplin-storm');
  await page.waitForFunction(()=>document.getElementById('photo-dialog').open);
  await page.keyboard.press('Escape');
  await page.waitForFunction(selector=>!new URL(location).searchParams.has('photo')&&document.activeElement===document.querySelector(selector),storm);
});

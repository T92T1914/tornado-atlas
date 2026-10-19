import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {mkdir} from 'node:fs/promises';
import {fixture,base} from './harness.mjs';
import {waitForDossier} from './dossier-readiness.mjs';
import {assertReadingReflow} from './reading-reflow-diagnostics.mjs';

// Fixed from the retained source assessment, not the generated Udall article.
const records=['ncei:10096418','ncei:10027629','ncei:10027630','ncei:10027631','ncei:10027632'];
const sections=['damage-and-aftermath','regional-forecast','records','boundary-and-identity','clocks-and-counts','original-images','remembrance','sources','assumed-experiments'];
const asset='assets/blackwell-1955/nws-warning2.jpg';
const original='https://www.weather.gov/images/ict/wxstory/udall/warning2.jpg';
const source='nws-wichita-storm-report';
const contexts=[{width:320,scheme:'dark'},{width:1280,scheme:'light'}];

async function openArticle(page,scheme,scripts=true){
  await page.goto(base+'/udall.html');
  if(scripts){
    await page.waitForFunction(()=>document.querySelector('.documentary-contents')?.dataset.focusReveal==='ready');
    await page.locator('#reading-appearance').selectOption(scheme);
  }else{
    assert.equal(await page.locator('#reading-appearance').isDisabled(),true);
    assert.equal(await page.locator('#reading-appearance').inputValue(),'system');
  }
}
async function openContents(page){
  const summary=page.locator('#article-contents');
  if(!await summary.evaluate(node=>node.parentElement.open))await summary.click();
}
async function focusedInView(page,selector){
  await page.locator(selector).focus();
  await page.waitForFunction(selector=>{
    const node=document.querySelector(selector),r=node?.getBoundingClientRect();
    return node===document.activeElement&&r.width>0&&r.height>0&&r.left>=-1&&r.right<=innerWidth+1&&r.top>=-1&&r.bottom<=innerHeight+1;
  },selector);
}
async function fragment(page,id){
  await openContents(page);
  const selector='.documentary-contents a[href="#'+id+'"]';
  await focusedInView(page,selector);
  await page.locator(selector).press('Enter');
  await page.waitForURL(url=>url.pathname.endsWith('/udall.html')&&url.hash==='#'+id);
}
async function capture(page,name){
  const folder=process.env.ATLAS_UDALL_READING_CAPTURE;
  if(!folder)return;
  await mkdir(folder,{recursive:true});
  await page.screenshot({path:path.join(folder,name+'.png')});
}
async function warning(page,loaded=true){
  const figure=page.locator('#udall-regional-forecast'),image=figure.locator('img');
  assert.equal(await image.count(),1);
  assert.equal(await image.getAttribute('src'),asset);
  assert.equal(await image.getAttribute('width'),'608');
  assert.equal(await image.getAttribute('height'),'436');
  assert.match(await image.getAttribute('alt'),/\S/);
  assert.ok(await figure.locator('a[href="'+asset+'"]').count()>=1);
  assert.equal(await figure.locator('a[href="'+original+'"]').count(),1);
  assert.ok(await figure.locator('a[href*="media=nws-blackwell-warning2"]').count()>=1);
  const caption=await figure.locator('figcaption').innerText();
  assert.match(caption,/caption/i);
  assert.match(caption,/unidentified|unknown|not identified/i);
  await image.scrollIntoViewIfNeeded();
  if(loaded){
    await page.waitForFunction(()=>{const image=document.querySelector('#udall-regional-forecast img');return image.complete&&image.naturalWidth===608&&image.naturalHeight===436;});
    const layout=await image.evaluate(node=>{
      const r=node.getBoundingClientRect(),clips=[];
      for(let p=node.parentElement;p&&p!==document.body;p=p.parentElement){
        const style=getComputedStyle(p),b=p.getBoundingClientRect();
        if(['hidden','clip'].includes(style.overflowY)&&(r.top<b.top-1||r.bottom>b.bottom+1))clips.push(p.id||p.tagName);
      }
      return {ratio:r.height/r.width,fit:getComputedStyle(node).objectFit,clips};
    });
    assert.ok(Math.abs(layout.ratio-436/608)<.015,'The complete document keeps its aspect ratio');
    assert.notEqual(layout.fit,'cover');
    assert.deepEqual(layout.clips,[],'No ancestor cuts off the lower document caption');
  }else{
    await page.waitForFunction(()=>{const image=document.querySelector('#udall-regional-forecast img');return image.complete&&image.naturalWidth===0;});
  }
}
async function checkRecords(page){
  const links=await page.locator('#records a[href*="dossier.html?record="]').evaluateAll(nodes=>nodes.map(node=>new URL(node.href).searchParams.get('record')));
  assert.deepEqual(links,records,'Five separately addressed source records retain their source order');
  const text=await page.locator('#records').innerText();
  for(const label of ['22:00','22:15','22:45','23:00','23:15','56.4','273'])assert.ok(text.includes(label),'Reported field '+label+' remains readable');
  assert.match(await page.locator('#boundary-and-identity').innerText(),/-97\.15/);
  assert.match(await page.locator('#boundary-and-identity').innerText(),/-97\.25/);
}
async function rawRecordReturn(page){
  await fragment(page,'records');
  const record=page.locator('#records a[href*="10027630"]');assert.equal(await record.count(),1);
  const href=await record.evaluate(node=>node.href);
  assert.equal(new URL(href).searchParams.get('record'),'ncei:10027630');
  await record.focus();await record.press('Enter');
  await waitForDossier(page,{href,elementId:'content'});
  assert.equal(await page.locator('#content h1').innerText(),'Cowley, Kansas');
  for(const [name,expected] of [['Source times',{begin:{local:'1955-05-25T22:45',zone:'CST',utc:null}}],['Reported impacts',{deaths_direct:75,injuries_direct:270}]]){
    const detail=page.locator('#content details').filter({has:page.getByText(name,{exact:true})});
    await detail.locator('summary').click();
    const value=JSON.parse(await detail.locator('pre').innerText());
    if(name==='Source times'){for(const [key,item]of Object.entries(expected.begin))assert.equal(value.begin[key],item);assert.equal(value.end.utc,null);}
    else for(const [key,item]of Object.entries(expected))assert.equal(value[key],item);
  }
  await page.goBack();await page.waitForURL(url=>url.pathname.endsWith('/udall.html')&&url.hash==='#records');
}
async function coverageReturn(page){
  const articleURL=page.url();
  await page.goto(base+'/coverage.html?event=udall-1955&layer=damage');
  await page.waitForFunction(()=>document.getElementById('coverage-event').value==='udall-1955'&&document.getElementById('coverage-status').textContent==='1 event and 1 evidence layer shown.');
  const card=page.locator('[data-event="udall-1955"] [data-layer="damage"]');
  assert.equal(await card.getAttribute('data-state'),'context','Reviewed report text is damage context, not a calibrated survey/replay');
  await card.locator(':scope > details > summary').click();
  const targets=await card.locator('h4 > a').evaluateAll(nodes=>nodes.map(n=>new URL(n.href).searchParams.get('observation')));
  assert.deepEqual(targets,['udall-damage-account','phillips-survey-continuity']);
  assert.match(await card.innerText(),/Time: Unregistered/);
  assert.match(await card.innerText(),/Place: Unregistered/);
  assert.equal(await page.locator('[data-event="udall-1955"] [data-layer="appearance"]').getAttribute('data-state'),'not_admitted');
  assert.equal(await page.locator('[data-event="udall-1955"] [data-layer="geography"]').getAttribute('data-state'),'not_classified');
  await assertReadingReflow(page,'Udall reviewed damage context');
  await page.goBack();await page.waitForURL(articleURL);
}
async function sourceReturn(page){
  await fragment(page,'damage-and-aftermath');
  const citation=page.locator('#damage-and-aftermath a[href*="source='+source+'"]').first();
  assert.equal(await citation.count(),1);
  const href=await citation.evaluate(node=>node.href);
  await citation.focus();await citation.press('Enter');
  await waitForDossier(page,{href,elementId:'source-'+source});
  const card=page.locator('#source-'+source);
  assert.equal(await card.locator('a[href="https://www.weather.gov/ict/udall_stormreport"]').count(),1);
  await card.getByText('Continue in the current article',{exact:true}).click();
  const back=card.locator('a[href="'+base+'/udall.html#damage-and-aftermath"]');
  assert.equal(await back.count(),1);
  await back.focus();await back.press('Enter');
  await page.waitForURL(url=>url.pathname.endsWith('/udall.html')&&url.hash==='#damage-and-aftermath');
  assert.match(await page.locator('#damage-and-aftermath').innerText(),/Phillips/);
  await page.goBack();
  await waitForDossier(page,{href,elementId:'source-'+source});
  await page.goBack();
  await page.waitForURL(url=>url.pathname.endsWith('/udall.html')&&url.hash==='#damage-and-aftermath');
}
for(const {width,scheme} of contexts)test('Udall account, exact document and source return '+width+' '+scheme,{timeout:60000},async t=>{
  const page=await fixture(t,{viewport:{width,height:900},colorScheme:scheme,reducedMotion:'reduce'});
  await page.goto(base+'/atlas.html');
  const entrance=page.locator('.museum-nav a[href="udall.html"]');
  assert.equal(await entrance.count(),1);
  const exhibitMenu=page.locator('.museum-nav details').filter({has:page.locator('a[href="udall.html"]')});
  if(!await exhibitMenu.evaluate(node=>node.open))await exhibitMenu.locator('summary').click();
  await entrance.focus();await entrance.press('Enter');
  await page.waitForURL('**/udall.html');await openArticle(page,scheme);
  for(const id of sections)assert.equal(await page.locator('#'+id).count(),1);
  assert.equal(await page.locator('video[autoplay],audio[autoplay],iframe,img[src$=".gif"]').count(),0);
  assert.equal(await page.evaluate(()=>matchMedia('(prefers-reduced-motion: reduce)').matches),true);
  await checkRecords(page);await rawRecordReturn(page);await sourceReturn(page);
  await fragment(page,'clocks-and-counts');
  const clockLink=page.locator('#clocks-and-counts a[href*="observation=source-clock-disagreement"]');
  const clockHref=await clockLink.evaluate(n=>n.href);await clockLink.focus();await clockLink.press('Enter');
  await waitForDossier(page,{href:clockHref,elementId:'observation-source-clock-disagreement'});
  const clockCard=page.locator('#observation-source-clock-disagreement');
  assert.match(await clockCard.innerText(),/reported roar around 2220 CST/);
  assert.match(await clockCard.innerText(),/collapse at 2235 CST/);
  assert.match(await clockCard.innerText(),/2245 CST/);
  assert.match(await clockCard.innerText(),/not calibrated arrivals or a measured elapsed duration/);
  await clockCard.getByText('Continue in the current article',{exact:true}).click();
  const clockBack=clockCard.locator('a[href="'+base+'/udall.html#clocks-and-counts"]');await clockBack.focus();await clockBack.press('Enter');
  await page.waitForURL(u=>u.pathname.endsWith('/udall.html')&&u.hash==='#clocks-and-counts');
  await coverageReturn(page);
  await fragment(page,'regional-forecast');await warning(page);
  await capture(page,'udall-document-'+width+'-'+scheme);
  // Documentary reference may select context, never historical model presets.
  for(const [file,control,value] of [['wind.html','#peak','100'],['study.html','#shape','cone']]){
    const link=page.locator('#assumed-experiments a[href="'+file+'?event=udall-1955"]');
    assert.equal(await link.count(),1);await link.focus();await link.press('Enter');
    await page.locator('#lab-context[data-experiment-ready="true"]').waitFor();
    assert.equal(await page.locator('#lab-event').inputValue(),'udall-1955');
    assert.equal(await page.locator(control).inputValue(),value);
    assert.match(await page.locator('#lab-state').innerText(),/paused/i);
    const limits=await page.locator('#lab-reference-account').innerText();
    if(file==='study.html'){
      assert.match(limits,/no calibrated camera/i);
      assert.match(limits,/measured funnel or continuous appearance/i);
    }else{
      assert.match(limits,/F5 and damage width/i);
      assert.match(limits,/do not set.*core radius.*capacity/i);
    }
    await page.goBack();await page.waitForURL(url=>url.pathname.endsWith('/udall.html'));
  }
  await assertReadingReflow(page,'Udall complete reading '+width);
});
for(const {width,scheme} of contexts)test('Udall doubled text preserves native contents, records and caption '+width,{timeout:45000},async t=>{
  const page=await fixture(t,{viewport:{width,height:900},colorScheme:scheme,reducedMotion:'reduce'});
  await openArticle(page,scheme);
  await openContents(page);
  // Measure rendered article roles independently before changing any sizes.
  const selectors=[['prose','#damage-and-aftermath > p:not(.eyebrow)'],['record label','#records .udall-records dt'],['record value','#records .udall-records dd'],['caption','#udall-regional-forecast figcaption p'],['contents','.documentary-contents a[href="#assumed-experiments"]']];
  const measure=()=>page.evaluate(rows=>rows.map(([role,selector])=>{
    const node=document.querySelector(selector);if(!node)return {role,selector,rendered:false};
    const style=getComputedStyle(node),rect=node.getBoundingClientRect();
    return {role,selector,rendered:rect.width>0&&rect.height>0&&style.display!=='none'&&style.visibility!=='hidden',font:parseFloat(style.fontSize),line:parseFloat(style.lineHeight),letter:parseFloat(style.letterSpacing),word:parseFloat(style.wordSpacing),margin:parseFloat(style.marginBottom),paragraph:node.tagName==='P'};
  }),selectors);
  const baseline=await measure();
  for(const row of baseline)assert.ok(row.rendered&&Number.isFinite(row.font)&&row.font>0,row.role+' has an actual rendered baseline');
  // Snapshot every size before any write; the selected visible roles prove the result.
  await page.evaluate(()=>{const nodes=[document.body,...document.body.querySelectorAll('*')],sizes=nodes.map(node=>parseFloat(getComputedStyle(node).fontSize));nodes.forEach((node,index)=>node.style.fontSize=sizes[index]*2+'px');});
  const doubled=await measure(),mismatches=doubled.flatMap((row,index)=>row.rendered&&row.font===baseline[index].font*2?[]:[{role:row.role,before:baseline[index].font,expected:baseline[index].font*2,actual:row.font,rendered:row.rendered}]);
  if(mismatches.length)console.log('UDALL_ENLARGEMENT_MISMATCH '+JSON.stringify(mismatches.slice(0,5)));
  assert.deepEqual(mismatches,[],'Rendered prose,record labels/values,caption and contents actually double');
  const ruleCount=await page.evaluate(()=>{const style=document.createElement('style');style.textContent='p{margin-bottom:2em!important}body *{line-height:1.5!important;letter-spacing:.12em!important;word-spacing:.16em!important}';document.head.appendChild(style);return style.sheet.cssRules.length;});
  assert.equal(ruleCount,2,'Both text-spacing rules are inserted synchronously');
  const spaced=await measure(),spacingMismatches=[];
  for(let index=0;index<spaced.length;index++){
    const row=spaced[index],expected={font:baseline[index].font*2,line:row.font*1.5,letter:row.font*.12,word:row.font*.16};
    if(row.paragraph)expected.margin=row.font*2;
    for(const [metric,value]of Object.entries(expected))if(!row.rendered||!Number.isFinite(row[metric])||Math.abs(row[metric]-value)>.01)spacingMismatches.push({role:row.role,metric,expected:value,actual:row[metric],rendered:row.rendered});
  }
  if(spacingMismatches.length)console.log('UDALL_SPACING_MISMATCH '+JSON.stringify(spacingMismatches.slice(0,5)));
  assert.deepEqual(spacingMismatches,[],'Actual rendered line,letter,word and paragraph spacing follow the overrides');
  await focusedInView(page,'.documentary-contents a[href="#damage-and-aftermath"]');
  await focusedInView(page,'.documentary-contents a[href="#assumed-experiments"]');
  await fragment(page,'records');await checkRecords(page);
  await assertReadingReflow(page,'Udall doubled record fields '+width);
  await fragment(page,'regional-forecast');await warning(page);
  await figureSourceFocus(page);
  await assertReadingReflow(page,'Udall doubled document and caption '+width);
  await capture(page,'udall-doubled-document-'+width+'-'+scheme);
});
async function figureSourceFocus(page){
  const link=page.locator('#udall-regional-forecast a[href*="media=nws-blackwell-warning2"]').first();
  await link.focus();
  await page.waitForFunction(()=>{const node=document.querySelector('#udall-regional-forecast a[href*="media=nws-blackwell-warning2"]'),r=node?.getBoundingClientRect();return node===document.activeElement&&r.width>0&&r.height>0&&r.left>=-1&&r.right<=innerWidth+1&&r.top>=-1&&r.bottom<=innerHeight+1;});
}
for(const {width,scheme} of contexts)test('Udall no-script article and honest evidence fallback '+width,{timeout:45000},async t=>{
  const page=await fixture(t,{viewport:{width,height:900},javaScriptEnabled:false,colorScheme:scheme,reducedMotion:'reduce'});
  await openArticle(page,scheme,false);
  await fragment(page,'records');await checkRecords(page);
  await fragment(page,'regional-forecast');await warning(page);
  assert.match(await page.locator('#damage-and-aftermath').innerText(),/Phillips/);
  assert.match(await page.locator('#damage-and-aftermath').innerText(),/roar at about 2220 CST/);
  assert.match(await page.locator('#damage-and-aftermath').innerText(),/collapse at 2235 CST/);
  assert.match(await page.locator('#clocks-and-counts').innerText(),/2235/);
  assert.match(await page.locator('#clocks-and-counts').innerText(),/2245/);
  await capture(page,'udall-nojs-document-'+width+'-'+scheme);
  const href=await page.locator('#damage-and-aftermath a[href*="source='+source+'"]').first().evaluate(node=>node.href);
  await page.goto(href);
  assert.equal(await page.locator('#documentary-js-required').isVisible(),true);
  const fallback=page.locator('#documentary-chapters a[href="udall.html"]');assert.equal(await fallback.count(),1);
  await fallback.focus();await fallback.press('Enter');await page.waitForURL('**/udall.html');
  await assertReadingReflow(page,'Udall no-script reading '+width);
});
test('Udall failed regional image retains the account, caption and exact source actions',{timeout:45000},async t=>{
  const page=await fixture(t,{viewport:{width:320,height:900},colorScheme:'dark',reducedMotion:'reduce'});
  let failed=0;
  await page.route('**/'+asset,route=>{failed++;return route.abort();});
  await openArticle(page,'dark');await fragment(page,'regional-forecast');await warning(page,false);
  assert.ok(failed>=1,'The failed-image control reached the actual requested asset');
  assert.match(await page.locator('#regional-forecast').innerText(),/broadcast/i);
  assert.match(await page.locator('#regional-forecast').innerText(),/receipt|received|resident/i);
  await assertReadingReflow(page,'Udall failed warning image');
  await capture(page,'udall-failed-document-320-dark');
});
test('Udall evidence failure keeps its current chapter and retries the same source successfully',{timeout:45000},async t=>{
  const page=await fixture(t,{viewport:{width:1280,height:900},colorScheme:'light',reducedMotion:'reduce'});
  await openArticle(page,'light');
  const citation=page.locator('#damage-and-aftermath a[href*="source='+source+'"]').first();
  const href=await citation.evaluate(node=>node.href);
  let failed=0;
  await page.route('**/archive/index.json',route=>{failed++;return route.abort();});
  await citation.focus();await citation.press('Enter');
  await page.waitForFunction(()=>document.body.dataset.ready==='error');
  assert.ok(failed>=1);
  assert.equal(await page.getByRole('heading',{name:'Evidence unavailable',exact:true}).count(),1);
  const retry=page.getByRole('link',{name:'Retry this view',exact:true});assert.equal(await retry.count(),1);
  const fallback=page.locator('#documentary-chapters a[href="udall.html"]');assert.equal(await fallback.count(),1);
  await fallback.focus();await fallback.press('Enter');await page.waitForURL('**/udall.html');
  await page.goBack();await page.waitForURL(href);
  await page.unroute('**/archive/index.json');
  await page.getByRole('link',{name:'Retry this view',exact:true}).focus();
  await page.keyboard.press('Enter');await waitForDossier(page,{href,elementId:'source-'+source});
  assert.equal(await page.locator('#source-'+source).count(),1,'Valid retry renders the selected source, not another event');
  await assertReadingReflow(page,'Udall recovered evidence view');
});

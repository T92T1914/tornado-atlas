import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fixture,base} from './harness.mjs';

const section='#lightning-figure-clock-labels';
const sourceId='ntrs-2014-large-charge-moment';
const observationId='ntrs-2014-reported-lightning-event';
const original='https://ntrs.nasa.gov/api/citations/20140011687/downloads/20140011687.pdf#page=11';
const index=JSON.parse(await readFile(new URL('../../web/archive/index.json',import.meta.url),'utf8'));
const entry=index.events.find(row=>row.id==='el-reno-2013');
const branch=page=>page.locator(section+' + .article-branch');

async function keyboardFollow(page,link){
  await link.focus();assert.equal(await link.evaluate(node=>node===document.activeElement),true);
  await page.keyboard.press('Enter');
}
async function account(page){
  const reading=page.locator(section);
  assert.equal(await reading.isVisible(),true);
  const text=await reading.textContent();
  for(const expected of ['23:15:19 UTC','May 31, 2013','2315 UTC','121 C km',
    'first two milliseconds','does not establish a 19-second difference',
    'not identified an independent optical exposure'])assert.ok(text.includes(expected),expected);
  assert.equal(await reading.getByRole('link',{name:'Lang and colleagues: original Figure 7, PDF page 11',exact:true}).getAttribute('href'),original);
  assert.equal(await reading.locator('img,video,iframe,object,embed').count(),0);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
  return reading;
}
async function doubleText(page,target,label,t){
  const before=await target.evaluate(node=>parseFloat(getComputedStyle(node).fontSize));
  await page.evaluate(()=>{
    const nodes=[document.body,...document.body.querySelectorAll('*')];
    const sizes=nodes.map(node=>parseFloat(getComputedStyle(node).fontSize));
    nodes.forEach((node,index)=>{node.style.fontSize=sizes[index]*2+'px';});
  });
  const after=await target.evaluate(node=>parseFloat(getComputedStyle(node).fontSize));
  assert.ok(before>0);assert.equal(after,before*2,'The actual '+label+' text doubles');
  t.diagnostic(JSON.stringify({text:label,before_px:before,after_px:after,ratio:after/before}));
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
}

for(const width of [320,1280])test(`reported lightning example keeps source identity and keyboard return at ${width}px`,async t=>{
  const page=await fixture(t,{viewport:{width,height:900},reducedMotion:'reduce'});
  const requests=[];page.on('request',request=>requests.push(request.url()));
  await page.goto(base+'/index.html'+section);
  await page.waitForFunction(()=>document.body?.dataset.exhibitReady==='true');
  const reading=await account(page);
  assert.equal(await page.locator('#timeline').inputValue(),'0','The publication example does not seek the clock');
  await doubleText(page,reading.locator(':scope > p').first(),'article paragraph',t);
  await keyboardFollow(page,branch(page).getByRole('link',{name:'Inspect the reported flash and clock limits',exact:true}));
  const observation=page.locator('#observation-'+observationId);await observation.waitFor();
  assert.equal(new URL(page.url()).searchParams.get('observation'),observationId);
  const evidence=await observation.textContent();
  assert.match(evidence,/positive cloud-to-ground/);assert.match(evidence,/121 C km/);
  assert.match(evidence,/time difference are unknown/);assert.doesNotMatch(evidence,/-341/);
  await keyboardFollow(page,observation.getByRole('link',{name:'Inspect the source card',exact:true}));
  const source=page.locator('#source-'+sourceId);await source.waitFor();
  assert.equal(await source.getByRole('link',{name:'Read original source',exact:true}).getAttribute('href'),original);
  assert.match(await source.textContent(),/Danyal Petersen/);
  assert.match(await source.textContent(),/Lizxandra Flores-Rivera/);
  assert.match(await source.textContent(),/Selected-page coverage, not full-paper review/);
  assert.match(await source.textContent(),/No source figure, PDF, video frame or underlying measurement dataset is hosted/);
  await doubleText(page,source.locator(':scope > p').first(),'source paragraph',t);
  await page.goBack();await page.locator('#observation-'+observationId).waitFor();
  await page.goForward();await page.locator('#source-'+sourceId).waitFor();
  await keyboardFollow(page,source.getByText('Continue in the current article',{exact:true}));
  const back=source.getByRole('link',{name:'Read the flash and radar clock labels',exact:true});
  await keyboardFollow(page,back);
  await page.waitForURL('**/index.html#lightning-figure-clock-labels');
  await account(page);
  await page.reload();await account(page);
  assert.equal(requests.some(url=>url.includes('ntrs.nasa.gov')),false,'Original PDF is an ordinary link and is not prefetched');
  if(process.env.ATLAS_CONTEXT_SCREENSHOT_DIR){
    await mkdir(process.env.ATLAS_CONTEXT_SCREENSHOT_DIR,{recursive:true});
    await page.locator(section).screenshot({path:path.join(process.env.ATLAS_CONTEXT_SCREENSHOT_DIR,`ntrs-lightning-${width}.png`)});
  }
});

test('lightning explanation and original links survive without scripts or image loading',async t=>{
  const page=await fixture(t,{viewport:{width:320,height:900},javaScriptEnabled:false});
  await page.route('**/assets/**',route=>route.abort());
  await page.goto(base+'/index.html'+section);
  const reading=await account(page);
  const source=branch(page).getByRole('link',{name:'Read the publication and inspection record',exact:true});
  assert.equal(await source.getAttribute('href'),`dossier.html?event=el-reno-2013&source=${sourceId}#source-${sourceId}`);
  await keyboardFollow(page,source);
  await page.waitForURL('**/dossier.html?event=el-reno-2013&source='+sourceId+'#source-'+sourceId);
  assert.equal(await page.locator('noscript').count(),1,'The dossier preserves its stated static fallback');
  await page.goBack();await account(page);
});

test('failed dossier metadata leaves a readable article return with no substituted lightning account',async t=>{
  const page=await fixture(t,{viewport:{width:320,height:900},reducedMotion:'reduce'});
  await page.route('**/'+entry.file,route=>route.fulfill({status:503,body:'Unavailable selected publication'}));
  await page.goto(base+'/index.html'+section);const reading=await account(page);
  await keyboardFollow(page,branch(page).getByRole('link',{name:'Inspect the reported flash and clock limits',exact:true}));
  await page.getByRole('heading',{name:'Evidence unavailable',exact:true}).waitFor();
  assert.equal(await page.locator('#observation-'+observationId).count(),0);
  assert.equal(await page.getByRole('link',{name:'Retry this view',exact:true}).count(),1);
  await page.goBack();await account(page);
});

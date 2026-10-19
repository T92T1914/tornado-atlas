import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {mkdir} from 'node:fs/promises';
import {fixture,base} from './harness.mjs';
import {waitForDossier} from './dossier-readiness.mjs';
import {assertReadingReflow} from './reading-reflow-diagnostics.mjs';

async function capture(page,name){if(process.env.ATLAS_REALISM_CAPTURE){await mkdir(process.env.ATLAS_REALISM_CAPTURE,{recursive:true});await page.screenshot({path:path.join(process.env.ATLAS_REALISM_CAPTURE,name+'.png')});}}
async function checkImage(page,id,dimensions){
  const image=page.locator('#'+id+' img');await image.scrollIntoViewIfNeeded();
  await image.evaluate(async n=>{await n.decode();});
  assert.deepEqual(await image.evaluate(n=>[n.naturalWidth,n.naturalHeight]),dimensions);
  const shape=await image.evaluate(n=>{const b=n.getBoundingClientRect();return [b.width,b.height,getComputedStyle(n).objectFit];});
  assert.ok(Math.abs(shape[0]/shape[1]-dimensions[0]/dimensions[1])<.01,'The complete image aspect ratio survives layout');
  assert.notEqual(shape[2],'cover','Full image is not cropped into a card');
}
for(const [width,appearance] of [[320,'dark'],[1280,'light']])test('Moore story, source editions, photographs and named return '+width,{timeout:45000},async t=>{
  const page=await fixture(t,{viewport:{width,height:900},reducedMotion:'reduce'});
  await page.goto(base+'/moore.html');
  await page.waitForFunction(()=>document.querySelector('.documentary-contents').dataset.focusReveal==='ready');
  await page.locator('#reading-appearance').selectOption(appearance);
  assert.equal(await page.locator('h1').textContent(),'Newcastle and MooreMay 20, 2013');
  assert.match(await page.locator('.documentary-facts').textContent(),/EF5/);
  assert.match(await page.locator('#one-track-two-records').textContent(),/451537/);
  assert.match(await page.locator('#one-track-two-records').textContent(),/451572/);
  assert.equal(await page.locator('#moore-medical-center-survey').evaluate(n=>Boolean(n.compareDocumentPosition(document.getElementById('article-contents'))&Node.DOCUMENT_POSITION_FOLLOWING)),true,'Purposeful agency image precedes the long account');
  await checkImage(page,'moore-medical-center-survey',[800,533]);
  await page.locator('#moore-medical-center-survey').scrollIntoViewIfNeeded();
  await capture(page,'moore-medical-survey-'+width+'-'+appearance);
  await checkImage(page,'moore-briarwood-survey',[800,600]);
  assert.match(await page.locator('#schools').textContent(),/EF4/);
  assert.match(await page.locator('#schools').textContent(),/initial EF5/);
  assert.match(await page.locator('#moore-briarwood-survey figcaption').textContent(),/source annotations/);
  await page.locator('#moore-briarwood-survey').scrollIntoViewIfNeeded();
  await capture(page,'moore-briarwood-survey-'+width+'-'+appearance);
  const link=page.locator('#schools a[href*="observation=briarwood-rating-revision"]');
  const target={href:await link.evaluate(n=>n.href),elementId:'observation-briarwood-rating-revision'};
  await link.focus();await page.keyboard.press('Enter');await waitForDossier(page,target);
  const card=page.locator('#observation-briarwood-rating-revision');
  assert.match(await card.innerText(),/EF4/);
  await card.getByText('Continue in the current article',{exact:true}).click();
  const named=card.locator('a[href="'+base+'/moore.html#schools"]');
  assert.equal(await named.count(),1);await named.focus();await page.keyboard.press('Enter');
  await page.waitForURL(u=>u.pathname.endsWith('/moore.html')&&u.hash==='#schools');
  await page.reload();await page.waitForFunction(()=>document.querySelector('.documentary-contents').dataset.focusReveal==='ready');
  assert.match(await page.locator('#schools').textContent(),/whole-track maximum remains EF5/);
  await assertReadingReflow(page,'Moore reading');
});

test('Moore native reading, enlarged text and failed photograph keep source routes',{timeout:30000},async t=>{
  const page=await fixture(t,{javaScriptEnabled:false,viewport:{width:320,height:900},reducedMotion:'reduce'});
  let failedImageRequests=0;
  await page.route('**/IMG_2314-800.jpg',route=>{failedImageRequests++;return route.abort();});
  await page.goto(base+'/moore.html');
  await page.locator('#moore-briarwood-survey img').scrollIntoViewIfNeeded();
  await page.waitForFunction(()=>{const image=document.querySelector('#moore-briarwood-survey img');return image.complete&&image.naturalWidth===0;});
  assert.equal(failedImageRequests,1,'The exact lazy image request reached the intentional failure route');
  assert.deepEqual(await page.locator('#moore-briarwood-survey img').evaluate(n=>[n.complete,n.naturalWidth,n.naturalHeight]),[true,0,0],'The photograph actually failed before its retained source routes are checked');
  assert.match(await page.locator('#briarwood-rating').textContent(),/rating revision/);
  assert.match(await page.locator('#schools').textContent(),/EF4/);
  assert.equal(await page.locator('#moore-briarwood-survey a[href*="media=moore-briarwood-survey"]').count(),1);
  assert.equal(await page.locator('#moore-briarwood-survey a[href^="https://www.weather.gov/images/"]').count(),1);
  const originalFont=await page.locator('#schools > p').first().evaluate(n=>parseFloat(getComputedStyle(n).fontSize));
  await page.evaluate(()=>{const nodes=[document.body,...document.body.querySelectorAll('*')],sizes=nodes.map(n=>parseFloat(getComputedStyle(n).fontSize));nodes.forEach((n,i)=>n.style.fontSize=sizes[i]*2+'px');});
  await page.evaluate(css=>{const style=document.createElement('style');style.textContent=css;document.head.append(style);},'p,small,li,dt,dd,a,span{letter-spacing:.12em!important;word-spacing:.16em!important;line-height:1.5!important}p{margin-bottom:2em!important}');
  const enlarged=await page.locator('#schools > p').first().evaluate(n=>({font:parseFloat(getComputedStyle(n).fontSize),spacing:parseFloat(getComputedStyle(n).letterSpacing)}));
  assert.equal(enlarged.font,originalFont*2,'Ordinary no-script prose is actually doubled');
  assert.ok(enlarged.spacing>0,'Text spacing override actually applied');
  await assertReadingReflow(page,'Moore native enlarged reading');
  const rail=page.locator('.documentary-contents');if(!await rail.evaluate(n=>n.open))await rail.locator('summary').click();
  await rail.locator('a[href="#warnings-and-clocks"]').focus();await page.keyboard.press('Enter');
  await page.waitForURL(u=>u.hash==='#warnings-and-clocks');
  assert.match(await page.locator('#warnings-and-clocks').textContent(),/not synchronized/);
});

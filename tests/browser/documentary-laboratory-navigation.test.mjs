import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,base} from './harness.mjs';

// Literal story routes are independent of the generated navigation and reference list.
const stories=[['index.html','el-reno-2013','index.html#photos'],['joplin.html','joplin-2011','joplin.html#photographs-and-film'],['blackwell.html','blackwell-1955','blackwell.html#observations'],['tuscaloosa.html','tuscaloosa-birmingham-2011','tuscaloosa.html#photographs-and-film'],['moore.html','moore-2013','moore.html#survey-photographs'],['udall.html','udall-1955','udall.html#original-images']];

for(const width of [320,1280])test('Documentary contents and laboratory entry keep their reference '+width,{timeout:60000},async t=>{
  const page=await fixture(t,{viewport:{width,height:900},reducedMotion:'reduce'});
  for(const [file,event] of stories){
    await page.goto(base+'/'+file);
    const rail=page.locator(file==='index.html'?'#exhibit-contents':'.documentary-contents');
    if(!await rail.evaluate(n=>n.open))await rail.locator('summary').click();
    const entry=rail.locator('a[href="#assumed-experiments"]');
    assert.equal(await entry.count(),1,file+' has an explicit native contents entry');
    await entry.focus();await page.keyboard.press('Enter');
    await page.waitForURL(u=>u.hash==='#assumed-experiments');
    assert.equal(await page.locator('#assumed-experiments').count(),1);
    for(const lab of ['study','wind']){
      assert.equal(await page.locator('.museum-nav a[href="'+lab+'.html?event='+event+'"]').count(),1);
      assert.equal(await page.locator('#assumed-experiments a[href="'+lab+'.html?event='+event+'"]').count(),1);
    }
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,file);
  }
  // Seed this separate Moore journey explicitly rather than using the last list item.
  await page.goto(base+'/moore.html#assumed-experiments');
  for(const lab of ['study','wind']){
    const entry=page.locator('#assumed-experiments a[href=\"'+lab+'.html?event=moore-2013\"]');
    await entry.focus();await page.keyboard.press('Enter');
    await page.waitForURL(base+'/'+lab+'.html?event=moore-2013');
    await page.waitForFunction(()=>document.querySelector('#lab-context')?.dataset.experimentReady==='true');
    assert.equal(new URL(page.url()).pathname,new URL(base+'/'+lab+'.html').pathname);
    assert.equal(await page.locator('#lab-event').inputValue(),'moore-2013');
    assert.equal(await page.locator(lab==='wind'?'#peak':'#shape').inputValue(),lab==='wind'?'100':'cone','Documentary reference does not assign model assumptions');
    assert.match(await page.locator('#lab-state').textContent(),/paused/);
    const laboratoryURL=await page.locator('#lab-share').getAttribute('href');
    const account=page.locator('#lab-reference-links a').first();
    assert.match(await account.textContent(),/Moore/);await account.focus();await page.keyboard.press('Enter');
    await page.waitForURL(u=>u.pathname.endsWith('/moore.html'));
    assert.equal(new URL(page.url()).hash,lab==='wind'?'#damage-and-buildings':'#survey-photographs');
    await page.goBack();await page.waitForURL(laboratoryURL);
    await page.waitForFunction(()=>document.querySelector('#lab-context')?.dataset.experimentReady==='true');
    assert.equal(await page.locator('#lab-event').inputValue(),'moore-2013');
    await page.goBack();await page.waitForURL(u=>u.pathname.endsWith('/moore.html')&&u.hash==='#assumed-experiments');
  }
});

for(const width of [320,1280])test('Unavailable Form Study returns to its actual documentary '+width,{timeout:45000},async t=>{
  const page=await fixture(t,{viewport:{width,height:900},reducedMotion:'reduce'});
  await page.addInitScript(()=>{const native=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(kind,...rest){return kind==='webgl2'?null:native.call(this,kind,...rest);};});
  await page.goto(base+'/study.html?event=joplin-2011');
  await page.waitForFunction(()=>document.querySelector('#lab-event').value==='joplin-2011');
  assert.equal(await page.locator('#scene-failure').isVisible(),true);
  assert.equal(await page.locator('#scene-failure-return').getAttribute('href'),'joplin.html#photographs-and-film');
  for(const [,event,destination] of stories){
    await page.locator('#lab-event').selectOption(event);
    assert.equal(await page.locator('#scene-failure-return').getAttribute('href'),destination);
    assert.equal(await page.locator('#scene-failure').isVisible(),true,'Reference selection preserves original renderer failure');
    assert.equal(await page.locator('#motion').isDisabled(),true);
  }
  await page.locator('#lab-event').selectOption('moore-2013');
  const failureReturn=page.locator('#scene-failure-return');
  const laboratoryURL=page.url();
  assert.match(await failureReturn.textContent(),/Moore.*documentary evidence/);
  await failureReturn.focus();await page.keyboard.press('Enter');
  await page.waitForURL(u=>u.pathname.endsWith('/moore.html')&&u.hash==='#survey-photographs');
  await page.goBack();await page.waitForURL(laboratoryURL);
  await page.waitForFunction(()=>document.querySelector('#lab-context')?.dataset.experimentReady==='true');
  assert.equal(await page.locator('#lab-event').inputValue(),'moore-2013');
  assert.equal(await page.locator('#scene-failure').isVisible(),true);
  await page.locator('#lab-event').selectOption('');
  assert.equal(await page.locator('#scene-failure-return').getAttribute('href'),'atlas.html');
  await page.goto(base+'/study.html?event=unknown-storm');
  await page.waitForFunction(()=>document.querySelector('#lab-state').dataset.state==='invalid');
  assert.equal(await page.locator('#scene-failure-return').getAttribute('href'),'atlas.html');
  assert.equal(await page.locator('#lab-event').inputValue(),'');
});

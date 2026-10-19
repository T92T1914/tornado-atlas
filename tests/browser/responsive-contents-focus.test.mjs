import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,base} from './harness.mjs';

const chapters=['joplin.html','blackwell.html','tuscaloosa.html'];
async function settle(page){
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
}
async function visibleFocus(page){
  return page.evaluate(()=>{
    const node=document.activeElement,box=node?.getBoundingClientRect();
    const style=node&&getComputedStyle(node);
    return Boolean(node?.isConnected&&node!==document.body&&box?.width>0&&box.height>0&&
      box.top>=0&&box.bottom<=innerHeight&&style.display!=='none'&&style.visibility!=='hidden');
  });
}
for(const file of chapters)for(const enlarged of [false,true])test(file+': responsive contents focus, '+(enlarged?'doubled':'ordinary')+' text',async t=>{
  const page=await fixture(t,{viewport:{width:1081,height:900},reducedMotion:'reduce'});
  await page.goto(base+'/'+file);
  await page.waitForFunction(()=>document.querySelector('.documentary-contents')?.dataset.focusReveal==='ready');
  const rail=page.locator('.documentary-contents'),summary=page.locator('#article-contents');
  if(enlarged)await page.evaluate(()=>{
    const nodes=[document.body,...document.body.querySelectorAll('*')];
    const sizes=nodes.map(node=>parseFloat(getComputedStyle(node).fontSize));
    nodes.forEach((node,index)=>node.style.fontSize=sizes[index]*2+'px');
  });
  // A layout change must leave a control outside the contents alone.
  await page.locator('#reading-appearance').focus();
  await page.setViewportSize({width:1080,height:900});await settle(page);
  assert.equal(await page.evaluate(()=>document.activeElement?.id),'reading-appearance');
  await page.setViewportSize({width:1081,height:900});await settle(page);
  assert.equal(await page.evaluate(()=>document.activeElement?.id),'reading-appearance');

  const links=rail.locator('nav a'),count=await links.count();
  const first=await links.first().getAttribute('href');
  await summary.focus();
  for(let index=0;index<count;index++)await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute('href')),'#assumed-experiments');
  await page.keyboard.press('Shift+Tab');
  assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute('href')),'#sources','Sources remains the explicit preceding native focus destination');
  assert.equal(await visibleFocus(page),true,'Sources focus remains visible');
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute('href')),'#assumed-experiments');
  await page.setViewportSize({width:1080,height:900});await settle(page);
  assert.equal(await rail.evaluate(node=>node.open),false);
  assert.equal(await page.evaluate(()=>document.activeElement?.id),'article-contents',
    'Automatic collapse retains the keyboard reading position on the native summary');
  assert.equal(await visibleFocus(page),true,'Recovered summary is visible in the viewport');

  await page.keyboard.press('Shift+Tab');
  assert.equal(await visibleFocus(page),true,'Keyboard can leave the collapsed contents');
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(()=>document.activeElement?.id),'article-contents');
  await page.keyboard.press('Enter');
  assert.equal(await rail.evaluate(node=>node.open),true,'Native summary reopens the contents');
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute('href')),first);
  await page.setViewportSize({width:1081,height:900});await settle(page);
  assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute('href')),first,
    'Expansion does not seize focus from the current link');
  await page.setViewportSize({width:1080,height:900});await settle(page);
  assert.equal(await page.evaluate(()=>document.activeElement?.id),'article-contents');
  await page.setViewportSize({width:1081,height:900});await settle(page);
  assert.equal(await page.evaluate(()=>document.activeElement?.id),'article-contents',
    'Expansion also preserves summary focus');
  const sources=rail.locator('a[href="#sources"]');await sources.focus();
  assert.equal(await sources.evaluate(node=>node===document.activeElement),true);
  assert.equal(await visibleFocus(page),true,'Explicit Sources focus remains visible after expansion');
  await Promise.all([page.waitForURL(url=>url.hash==='#sources'),page.keyboard.press('Enter')]);
  assert.equal(await page.locator('#sources').isVisible(),true,'Native Sources activation retains the source destination');
});

test('El Reno retains its separate contents focus across the documentary breakpoint',async t=>{
  const page=await fixture(t,{viewport:{width:1081,height:900},reducedMotion:'reduce'});
  await page.goto(base+'/index.html');
  await page.waitForFunction(()=>document.body.dataset.exhibitReady==='true');
  const summary=page.locator('#article-contents');
  await summary.focus();
  await page.setViewportSize({width:1080,height:900});await settle(page);
  assert.equal(await page.evaluate(()=>document.activeElement?.id),'article-contents');
  await page.setViewportSize({width:1081,height:900});await settle(page);
  assert.equal(await page.evaluate(()=>document.activeElement?.id),'article-contents');
});

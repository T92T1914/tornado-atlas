import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fixture,base} from './harness.mjs';

const groupNames=['Exhibits','Explore','Sources'];
function group(page,label){assert.ok(groupNames.includes(label));return page.locator('.museum-nav > details').nth(groupNames.indexOf(label));}
async function only(page,label){
  assert.deepEqual(await page.locator('.museum-nav > details[open] > summary').allTextContents(),label?[label+' ▾']:[]);
}
async function activate(page,label,key='Enter'){
  const summary=group(page,label).locator(':scope > summary');await summary.focus();await page.keyboard.press(key);return summary;
}
async function reflow(page){
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'Header navigation must fit the reading viewport');
  const fragments=await page.locator('.museum-nav details[open] .museum-menu a').evaluateAll(nodes=>nodes.flatMap(node=>{
    const range=document.createRange();range.selectNodeContents(node);
    return [...range.getClientRects()].filter(rect=>rect.width>0).map(rect=>({left:rect.left,right:rect.right}));
  }));
  const width=await page.evaluate(()=>innerWidth);
  assert.ok(fragments.length>0);for(const box of fragments)assert.ok(box.left>=-1&&box.right<=width+1,'An open menu text fragment remains inside the viewport');
}

for(const width of [320,1280])for(const fallback of [false,true])test('Museum navigation owns one disclosure and native focus '+width+(fallback?' without native grouping':''),{timeout:30000},async t=>{
  const page=await fixture(t,{viewport:{width,height:900},reducedMotion:'reduce',serviceWorkers:'block'});
  await page.goto(base+'/index.html');await page.locator('#reading-appearance:not([disabled])').waitFor();
  await page.locator('body[data-exhibit-ready="true"]').waitFor();
  assert.deepEqual(await page.locator('.museum-nav > details > summary').allTextContents(),groupNames.map(name=>name+' ▾'));
  assert.deepEqual(await page.locator('.museum-nav > details').evaluateAll(nodes=>nodes.map(node=>node.getAttribute('name'))),Array(3).fill('museum-navigation'));
  if(fallback)await page.locator('.museum-nav > details').evaluateAll(nodes=>nodes.forEach(node=>node.removeAttribute('name')));
  const startingURL=page.url(),history=await page.evaluate(()=>window.history.length);
  await group(page,'Explore').locator('summary').click();await only(page,'Explore');
  await group(page,'Sources').locator('summary').click();await only(page,'Sources');
  await group(page,'Sources').locator('summary').click();await only(page,null);
  await activate(page,'Exhibits','Space');await only(page,'Exhibits');
  await activate(page,'Explore');await only(page,'Explore');
  await page.keyboard.press('Tab');
  assert.equal(await group(page,'Explore').locator('a').first().evaluate(node=>node===document.activeElement),true,'Native Tab enters the selected disclosure');
  await page.keyboard.press('Escape');await only(page,null);
  assert.equal(await group(page,'Explore').locator('summary').evaluate(node=>node===document.activeElement),true,'Escape returns to the owning summary');
  assert.equal(page.url(),startingURL);assert.equal(await page.evaluate(()=>window.history.length),history);

  await activate(page,'Sources');await group(page,'Sources').locator('a').last().focus();await page.keyboard.press('Tab');
  await only(page,null);
  assert.equal(await page.locator('.museum-nav').evaluate(node=>node.contains(document.activeElement)),false,'Tab keeps its outside destination');
  assert.equal(await page.evaluate(()=>document.activeElement!==document.body),true);
  await activate(page,'Sources');
  await page.locator('#reading-appearance').focus();await only(page,null);
  assert.equal(await page.locator('#reading-appearance').evaluate(node=>node===document.activeElement),true,'Outside focus is not returned to the menu');

  await activate(page,'Sources');
  // The real article link must still perform its native same-document action.
  await page.locator('#overview a.text-link[href="#path"]').click();await page.waitForURL(url=>url.hash==='#path');await only(page,null);
  assert.equal(await page.locator('.museum-nav').evaluate(node=>node.contains(document.activeElement)),false,'The fragment destination retains native focus outside navigation');
  await activate(page,'Exhibits');
  const nodes=page.locator('.museum-nav summary,.museum-nav a');
  const originals=await nodes.evaluateAll(nodes=>nodes.map(node=>({inline:node.style.fontSize,pixels:parseFloat(getComputedStyle(node).fontSize)})));
  await nodes.evaluateAll((nodes,sizes)=>nodes.forEach((node,index)=>node.style.fontSize=sizes[index].pixels*2+'px'),originals);
  assert.equal(await nodes.first().evaluate(node=>parseFloat(getComputedStyle(node).fontSize)),originals[0].pixels*2,'The actual navigation text doubles');
  await reflow(page);await only(page,'Exhibits');
  if(process.env.ATLAS_NAV_CAPTURE&&!fallback){
    assert.ok(path.isAbsolute(process.env.ATLAS_NAV_CAPTURE));await mkdir(process.env.ATLAS_NAV_CAPTURE,{recursive:true});
    await page.locator('header').screenshot({path:path.join(process.env.ATLAS_NAV_CAPTURE,'navigation-'+width+'-enlarged.png')});
  }
  await nodes.evaluateAll((nodes,sizes)=>nodes.forEach((node,index)=>node.style.fontSize=sizes[index].inline),originals);
  await page.keyboard.press('Escape');await only(page,null);
  assert.equal(await group(page,'Exhibits').locator('summary').evaluate(node=>node===document.activeElement),true);
});

for(const width of [320,1280])test('Museum navigation remains exclusive and linked without scripts '+width,{timeout:30000},async t=>{
  const page=await fixture(t,{javaScriptEnabled:false,viewport:{width,height:900}});
  await page.goto(base+'/index.html');
  await activate(page,'Explore');await only(page,'Explore');
  await activate(page,'Sources','Space');await only(page,'Sources');
  assert.equal(await group(page,'Sources').locator('a').count(),5);
  await activate(page,'Exhibits');await only(page,'Exhibits');
  assert.equal(await group(page,'Exhibits').locator('a').count(),6);await reflow(page);
  await activate(page,'Explore');
  const wind=group(page,'Explore').getByRole('link',{name:'Wind laboratory',exact:true});
  assert.equal(await wind.getAttribute('href'),'wind.html?event=el-reno-2013');
  await wind.focus();await page.keyboard.press('Enter');await page.waitForURL(url=>url.pathname.endsWith('/wind.html'));
  assert.equal(new URL(page.url()).searchParams.get('event'),'el-reno-2013');
  await page.goto(base+'/curator.html');
  const links=page.locator('.museum-nav a');
  assert.ok(await links.count()>10);
  assert.equal(await links.evaluateAll(nodes=>nodes.every(node=>node.getAttribute('target')==='_blank'&&node.rel.includes('noopener')&&node.rel.includes('noreferrer')&&node.href.startsWith('https://t92t1914.github.io/tornado-atlas/'))),true,'Curator destinations retain their public-window and privacy attributes');
});

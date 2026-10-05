import {test} from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {fixture,base} from './harness.mjs';

const event='tuscaloosa-birmingham-2011';
const source='bmx-pre-event-outlooks';
const observation='pre-event-outlook-progression';
const original='https://www.weather.gov/bmx/event_04272011hwo';
const issues=['2011-04-22T06:49','2011-04-26T05:54','2011-04-27T03:19'];

async function inspectNativeRows(page){
  const block=page.locator('#pre-event-outlooks');
  assert.equal(await block.locator('li').count(),3);
  assert.deepEqual(await block.locator('time').evaluateAll(rows=>rows.map(row=>row.dateTime)),issues);
  assert.match(await block.textContent(),/forecast issue times, not tornado arrival/);
  assert.match(await block.textContent(),/publication date is unknown/);
  assert.equal(await block.getByRole('link',{name:'Original outlook text',exact:true}).getAttribute('href'),original);
}

for(const [width,appearance] of [[320,'dark'],[1280,'light']]){
  test(`Tuscaloosa outlook clocks and source routes ${width} ${appearance}`,async t=>{
    const page=await fixture(t,{viewport:{width,height:844},hasTouch:width<600,isMobile:width<600});
    const requests=[];page.on('request',request=>requests.push(request.url()));
    await page.goto(base+'/tuscaloosa.html#pre-event-outlooks',{waitUntil:'domcontentloaded'});
    await page.locator('#reading-appearance').selectOption(appearance);
    await inspectNativeRows(page);
    const ratios=await page.locator('#pre-event-outlooks').evaluate(block=>{
      const nodes=[...block.querySelectorAll('*')].filter(node=>
        [...node.childNodes].some(child=>child.nodeType===Node.TEXT_NODE&&child.textContent.trim()));
      const sizes=nodes.map(node=>({font:parseFloat(getComputedStyle(node).fontSize),
        line:parseFloat(getComputedStyle(node).lineHeight)}));
      nodes.forEach((node,i)=>{node.style.fontSize=sizes[i].font*2+'px';
        if(Number.isFinite(sizes[i].line))node.style.lineHeight=sizes[i].line*2+'px';});
      return nodes.map((node,i)=>parseFloat(getComputedStyle(node).fontSize)/sizes[i].font);
    });
    assert.ok(ratios.length>0&&ratios.every(ratio=>ratio===2),'Every actual outlook text node is doubled');
    const layout=await page.locator('#pre-event-outlooks').evaluate(block=>{
      const overflow=[],walker=document.createTreeWalker(block,NodeFilter.SHOW_TEXT);
      while(walker.nextNode()){
        const range=document.createRange();range.selectNodeContents(walker.currentNode);
        if([...range.getClientRects()].some(rect=>rect.right>innerWidth+1))overflow.push(walker.currentNode.textContent);
      }
      return {width:document.documentElement.scrollWidth,viewport:innerWidth,overflow};
    });
    assert.ok(layout.width<=layout.viewport+1&&layout.overflow.length===0,JSON.stringify(layout));
    if(process.env.ATLAS_SCREENSHOT_DIR)await page.locator('#pre-event-outlooks').screenshot({
      path:path.join(process.env.ATLAS_SCREENSHOT_DIR,`tuscaloosa-outlooks-${width}-${appearance}-200.png`)});
    const link=page.locator('#pre-event-outlooks').getByRole('link',{name:'Inspect forecast progression',exact:true});
    await link.focus();
    await Promise.all([page.waitForURL(url=>url.pathname.endsWith('/dossier.html')&&
      url.searchParams.get('observation')===observation,{waitUntil:'domcontentloaded'}),page.keyboard.press('Enter')]);
    await page.waitForFunction(()=>document.body?.dataset.ready==='true');
    const card=page.locator('#observation-'+observation);
    await card.waitFor();
    assert.match(await card.textContent(),/forecast|outlook/i);
    await card.getByRole('link',{name:'Inspect the source card',exact:true}).click();
    await page.waitForFunction(()=>document.body?.dataset.ready==='true');
    const sourceCard=page.locator('#source-'+source);await sourceCard.waitFor();
    assert.ok(await sourceCard.locator(`a[href="${original}"]`).count()>0);
    await page.goBack();await page.waitForFunction(()=>document.body?.dataset.ready==='true');
    assert.equal(new URL(page.url()).searchParams.get('observation'),observation);
    await page.goBack();
    assert.equal(new URL(page.url()).pathname,'/tuscaloosa.html');
    assert.equal(new URL(page.url()).hash,'#pre-event-outlooks');
    await inspectNativeRows(page);
    assert.equal(requests.some(url=>!url.startsWith(base+'/')),false);
  });
}

test('Tuscaloosa outlook comparison is readable native HTML without JavaScript',async t=>{
  const page=await fixture(t,{viewport:{width:320,height:844},hasTouch:true,isMobile:true,javaScriptEnabled:false});
  await page.goto(base+'/tuscaloosa.html#pre-event-outlooks',{waitUntil:'domcontentloaded'});
  // Protocol-side inspection is test instrumentation, not page scripting.
  await inspectNativeRows(page);
  const nav=page.locator('.documentary-contents a[href="#pre-event-outlooks"]');
  await nav.focus();await page.keyboard.press('Enter');
  assert.equal(new URL(page.url()).hash,'#pre-event-outlooks');
  const sourceLink=page.locator('#pre-event-outlooks').getByRole('link',{name:'Inspect source record',exact:true});
  assert.equal(await sourceLink.getAttribute('href'),
    `dossier.html?event=${event}&source=${source}#source-${source}`);
});

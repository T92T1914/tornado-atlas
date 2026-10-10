import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fixture,base} from './harness.mjs';
import {tuscaloosaRequestForbidden} from './tuscaloosa-request-contract.mjs';

for(const [width,appearance,fallback] of [[320,'dark'],[390,'dark'],[1280,'light'],[320,'light',true],[390,'light',true]]) {
  test(`Tuscaloosa account and source dossier ${width} ${appearance}${fallback?' fallback fonts':''}`,async t=>{
    const page=await fixture(t,{viewport:{width,height:844},isMobile:width<600,hasTouch:width<600});
    let forbiddenRequestCount=0;
    const forbiddenRequests=[],origin=new URL(base).origin;
    page.on('request',request=>{
      const url=request.url();
      if(!tuscaloosaRequestForbidden(url,base))return;
      forbiddenRequestCount++;
      if(forbiddenRequests.length<12){
        const target=new URL(url);
        forbiddenRequests.push({origin:target.origin.slice(0,128),
          path:target.origin===origin?target.pathname.slice(0,256):'<external path omitted>'});
      }
    });
    await page.goto(base+'/tuscaloosa.html');
    await page.locator('#reading-appearance').selectOption(appearance);
    if(fallback)await page.addStyleTag({content:':root {--interface-font:"Atlas unavailable font",Arial,sans-serif}' +
      '.documentary-intro h1,.documentary-reading h2,.documentary-facts dd {font-family:"Atlas unavailable serif",serif}'});
    const ratios=await page.evaluate(()=>{
      const paragraph=document.querySelector('.documentary-reading p');
      const before=parseFloat(getComputedStyle(paragraph).fontSize);
      const title=document.querySelector('.documentary-intro h1'),titleBefore=parseFloat(getComputedStyle(title).fontSize);
      // Emulate doubled text, including fixed pixel rules. Changing only
      // body's font size would leave much of this article unchanged.
      const rows=[...document.querySelectorAll('main *')].filter(node=>
        [...node.childNodes].some(child=>child.nodeType===Node.TEXT_NODE&&child.textContent.trim()));
      const baseline=rows.map(node=>({node,font:parseFloat(getComputedStyle(node).fontSize),
        line:parseFloat(getComputedStyle(node).lineHeight)}));
      for(const {node,font,line} of baseline){node.style.fontSize=font*2+'px';
        if(Number.isFinite(line))node.style.lineHeight=line*2+'px';}
      return [parseFloat(getComputedStyle(paragraph).fontSize)/before,parseFloat(getComputedStyle(title).fontSize)/titleBefore];
    });
    assert.deepEqual(ratios,[2,2],'The actual article text and title are doubled');
    const layout=await page.evaluate(()=>{
      const overflowing=[],walker=document.createTreeWalker(document.querySelector('main'),NodeFilter.SHOW_TEXT);
      while(walker.nextNode()){
        const node=walker.currentNode,range=document.createRange();range.selectNodeContents(node);
        const right=Math.max(0,...[...range.getClientRects()].map(box=>box.right));
        if(right>innerWidth+1&&overflowing.length<12)overflowing.push({tag:node.parentElement.tagName,
          text:node.textContent.slice(0,100),right,font:getComputedStyle(node.parentElement).fontSize});
      }
      return {viewport:innerWidth,width:document.documentElement.scrollWidth,overflowing};
    });
    assert.ok(layout.width<=layout.viewport+1,`Doubled text must fit the viewport: ${JSON.stringify(layout)}`);
    const chapter=page.locator('.documentary-contents a[href="#path"]');
    await chapter.focus();
    await Promise.all([page.waitForURL(url=>url.pathname.endsWith('/tuscaloosa.html')&&
      url.hash==='#path',{waitUntil:'domcontentloaded'}),page.keyboard.press('Enter')]);
    assert.equal(new URL(page.url()).hash,'#path');
    assert.equal(await page.locator('#path .documentary-timeline li').count(),6);
    assert.match(await page.locator('#warnings').textContent(),/best practice/i);
    assert.equal(forbiddenRequestCount>0,false,`Unexpected Tuscaloosa requests: ${JSON.stringify({
      count:forbiddenRequestCount,samples:forbiddenRequests,omitted:forbiddenRequestCount-forbiddenRequests.length})}`);
    await page.goto(base+'/dossier.html?event=tuscaloosa-birmingham-2011');
    await page.waitForFunction(()=>document.body?.dataset.ready==='true');
    assert.match(await page.locator('#content').textContent(),/No inspected media|No media|unregistered/i);
    const source=page.locator('#source-bmx-track-survey');
    assert.equal(await source.count(),1);
    assert.equal(await source.locator('a[href="https://www.weather.gov/bmx/event_04272011tuscbirm"]').count()>0,true);
    const record=page.getByRole('link',{name:'ncei:314662',exact:true});
    await record.focus();
    await Promise.all([page.waitForURL(url=>url.pathname.endsWith('/dossier.html')&&
      url.searchParams.get('record')==='ncei:314662',{waitUntil:'domcontentloaded'}),
      page.keyboard.press('Enter')]);
    await page.waitForFunction(()=>document.body?.dataset.ready==='true');
    assert.match(await page.locator('#content').textContent(),/44/);
    assert.match(await page.locator('#content').textContent(),/Tuscaloosa/);
    await page.goBack();await page.waitForFunction(()=>document.body?.dataset.ready==='true');
    assert.equal(new URL(page.url()).searchParams.get('event'),'tuscaloosa-birmingham-2011');
    await page.reload();await page.waitForFunction(()=>document.body?.dataset.ready==='true');
    assert.equal(await page.locator('#source-bmx-track-survey').count(),1);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
    // A failed dossier fetch must retain a readable account and retry route.
    await page.route('**/archive/tuscaloosa-birmingham-2011-*.json',route=>route.abort());
    await page.reload();await page.waitForFunction(()=>document.body?.dataset.ready==='error');
    assert.equal(await page.getByRole('link',{name:'Retry this view',exact:true}).count(),1);
    await page.goto(base+'/tuscaloosa.html#warnings');
    assert.match(await page.locator('#warnings').textContent(),/warning/i);
  });
}

for(const width of [320,390,1280]) {
  test(`Joplin shares the fact grid and headings at doubled text ${width}`,async t=>{
    const page=await fixture(t,{viewport:{width,height:844},isMobile:width<600,hasTouch:width<600});
    await page.goto(base+'/joplin.html');
    const ratios=await page.evaluate(()=>{
      const grid=document.querySelector('.documentary-facts');
      const value=grid.querySelector('dd'),before=parseFloat(getComputedStyle(value).fontSize);
      const heading=document.querySelector('.documentary-reading h2');
      const headingBefore=parseFloat(getComputedStyle(heading).fontSize);
      const title=document.querySelector('.documentary-intro h1'),titleBefore=parseFloat(getComputedStyle(title).fontSize);
      const baseline=[...grid.querySelectorAll('dt,dd,small'),...document.querySelectorAll('.documentary-intro h1,.documentary-reading h2,.documentary-reading h3')].map(node=>({node,
        font:parseFloat(getComputedStyle(node).fontSize),line:parseFloat(getComputedStyle(node).lineHeight)}));
      for(const {node,font,line} of baseline){node.style.fontSize=font*2+'px';
        if(Number.isFinite(line))node.style.lineHeight=line*2+'px';}
      return [parseFloat(getComputedStyle(value).fontSize)/before,parseFloat(getComputedStyle(heading).fontSize)/headingBefore,
        parseFloat(getComputedStyle(title).fontSize)/titleBefore];
    });
    assert.deepEqual(ratios,[2,2,2],'The shared fact values, headings and title are doubled');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
    assert.equal(await page.locator('.documentary-facts>div').count(),4);
    assert.match(await page.locator('.documentary-facts').textContent(),/EF5/);
  });
}

test('Blackwell shares heading wrapping at doubled text and 320 pixels',async t=>{
  const page=await fixture(t,{viewport:{width:320,height:844},isMobile:true,hasTouch:true});
  await page.goto(base+'/blackwell.html');
  await page.addStyleTag({content:':root {--interface-font:"Atlas unavailable font",Arial,sans-serif}' +
    '.documentary-intro h1,.documentary-reading h2 {font-family:"Atlas unavailable serif",serif}'});
  const ratio=await page.evaluate(()=>{
    const title=document.querySelector('.documentary-intro h1'),before=parseFloat(getComputedStyle(title).fontSize);
    const baseline=[...document.querySelectorAll('.documentary-intro h1,.documentary-reading h2,.documentary-reading h3')].map(node=>({node,
      font:parseFloat(getComputedStyle(node).fontSize),line:parseFloat(getComputedStyle(node).lineHeight)}));
    for(const {node,font,line} of baseline){node.style.fontSize=font*2+'px';
      if(Number.isFinite(line))node.style.lineHeight=line*2+'px';}
    return parseFloat(getComputedStyle(title).fontSize)/before;
  });
  assert.equal(ratio,2,'The shared Blackwell title is doubled');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
  assert.equal(await page.locator('.documentary-intro h1').textContent(),'BlackwellMay 25, 1955');
  assert.equal(await page.locator('.exhibit-orientation').textContent(),'Blackwell, after dark.');
});

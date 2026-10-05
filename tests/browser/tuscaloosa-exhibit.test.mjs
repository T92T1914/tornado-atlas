import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fixture,base} from './harness.mjs';

for(const [width,appearance] of [[390,'dark'],[1280,'light']]) {
  test(`Tuscaloosa account and source dossier ${width} ${appearance}`,async t=>{
    const page=await fixture(t,{viewport:{width,height:844},isMobile:width<600,hasTouch:width<600});
    const requests=[];page.on('request',r=>requests.push(r.url()));
    await page.goto(base+'/tuscaloosa.html');
    await page.locator('#reading-appearance').selectOption(appearance);
    const ratio=await page.evaluate(()=>{
      const paragraph=document.querySelector('.documentary-reading p');
      const before=parseFloat(getComputedStyle(paragraph).fontSize);
      // Emulate doubled text, including fixed pixel rules. Changing only
      // body's font size would leave much of this article unchanged.
      const rows=[...document.querySelectorAll('main *')].filter(node=>
        [...node.childNodes].some(child=>child.nodeType===Node.TEXT_NODE&&child.textContent.trim()));
      const baseline=rows.map(node=>({node,font:parseFloat(getComputedStyle(node).fontSize),
        line:parseFloat(getComputedStyle(node).lineHeight)}));
      for(const {node,font,line} of baseline){node.style.fontSize=font*2+'px';
        if(Number.isFinite(line))node.style.lineHeight=line*2+'px';}
      return parseFloat(getComputedStyle(paragraph).fontSize)/before;
    });
    assert.equal(ratio,2,'The actual article text is doubled');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
    const chapter=page.locator('.documentary-contents a[href="#path"]');
    await chapter.focus();await page.keyboard.press('Enter');
    assert.equal(new URL(page.url()).hash,'#path');
    assert.equal(await page.locator('#path .documentary-timeline li').count(),6);
    assert.match(await page.locator('#warnings').textContent(),/best practice/i);
    assert.equal(requests.some(u=>/youtube|catalogue\/index|\.jpg|\.png/.test(u)),false);
    await page.goto(base+'/dossier.html?event=tuscaloosa-birmingham-2011');
    await page.waitForFunction(()=>document.body.dataset.ready==='true');
    assert.match(await page.locator('#content').textContent(),/No inspected media|No media|unregistered/i);
    const source=page.locator('#source-bmx-track-survey');
    assert.equal(await source.count(),1);
    assert.equal(await source.locator('a[href="https://www.weather.gov/bmx/event_04272011tuscbirm"]').count()>0,true);
    const record=page.getByRole('link',{name:'ncei:314662',exact:true});
    await record.focus();
    await Promise.all([page.waitForEvent('framenavigated',frame=>frame===page.mainFrame()),
      page.keyboard.press('Enter')]);
    await page.waitForFunction(()=>document.body.dataset.ready==='true');
    assert.match(await page.locator('#content').textContent(),/44/);
    assert.match(await page.locator('#content').textContent(),/Tuscaloosa/);
    await page.goBack();await page.waitForFunction(()=>document.body.dataset.ready==='true');
    assert.equal(new URL(page.url()).searchParams.get('event'),'tuscaloosa-birmingham-2011');
    await page.reload();await page.waitForFunction(()=>document.body.dataset.ready==='true');
    assert.equal(await page.locator('#source-bmx-track-survey').count(),1);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
    // A failed dossier fetch must retain a readable account and retry route.
    await page.route('**/archive/tuscaloosa-birmingham-2011-*.json',route=>route.abort());
    await page.reload();await page.waitForFunction(()=>document.body.dataset.ready==='error');
    assert.equal(await page.getByRole('link',{name:'Retry this view',exact:true}).count(),1);
    await page.goto(base+'/tuscaloosa.html#warnings');
    assert.match(await page.locator('#warnings').textContent(),/warning/i);
  });
}

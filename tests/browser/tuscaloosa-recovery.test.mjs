import {test} from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {fixture,base} from './harness.mjs';

for(const [width,appearance] of [[320,'dark'],[1280,'light']]){
  test(`Tuscaloosa recovery, source and article return ${width} ${appearance}`,async t=>{
    const page=await fixture(t,{viewport:{width,height:844},isMobile:width<600,hasTouch:width<600,reducedMotion:'reduce'});
    const requests=[];page.on('request',request=>requests.push(request.url()));
    await page.goto(base+'/tuscaloosa.html?context=recovery#recovery-and-remembrance');
    await page.locator('#reading-appearance').selectOption(appearance);
    const section=page.locator('#recovery-and-remembrance');
    const text=await section.textContent();
    for(const term of ['Tuscaloosa Forward','Holt In Action','May 2011','Forest Lake',
      'Alberta Park','Mary Harmon Park','April 23, 2021','5:13 p.m.','not plotted death locations'])
      assert.ok(text.includes(term),term);
    assert.equal(await section.locator('img,iframe,video,audio').count(),0);
    if(width===320){
      await section.evaluate(section=>{
        const nodes=[...section.querySelectorAll('h2,h3,p')];
        const sizes=nodes.map(node=>parseFloat(getComputedStyle(node).fontSize));
        nodes.forEach((node,index)=>node.style.fontSize=sizes[index]*2+'px');
      });
    }
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
    const source=section.getByRole('link',{name:'Read the source scope',exact:true});
    await source.focus();
    assert.equal(await source.evaluate(node=>node===document.activeElement),true);
    if(process.env.ATLAS_SCREENSHOT_DIR)await page.screenshot({path:path.join(process.env.ATLAS_SCREENSHOT_DIR,
      `tuscaloosa-recovery-${width}-${appearance}.png`)});
    await page.keyboard.press('Enter');
    await page.waitForFunction(()=>document.body.dataset.ready==='true');
    const card=page.locator('#source-tuscaloosa-city-recovery-area');
    await card.waitFor();
    assert.equal(await card.getByRole('link',{name:'Read original source',exact:true}).getAttribute('href'),
      'https://www.tuscaloosa.com/tornadorecovery/desktop-dashboard');
    assert.match(await card.textContent(),/not independently inspected|No embedded dashboard/);
    assert.match(await card.textContent(),/ten-year and fifteen-year/);
    const continued=page.getByRole('link',{name:'Read recovery planning and local remembrance',exact:true});
    assert.equal(await continued.count(),1);
    await continued.focus();await page.keyboard.press('Enter');
    await page.waitForURL(url=>url.pathname.endsWith('/tuscaloosa.html')&&url.hash==='#recovery-and-remembrance');
    assert.match(await page.locator('#recovery-and-remembrance').textContent(),/not establish that each project was built/);
    await page.goBack();await card.waitFor();
    assert.equal(requests.some(url=>!url.startsWith(base+'/')),false);
  });
}

test('Tuscaloosa recovery remains a complete source-linked reading without scripting',async t=>{
  const page=await fixture(t,{javaScriptEnabled:false,viewport:{width:320,height:844},reducedMotion:'reduce'});
  const requests=[];page.on('request',request=>requests.push(request.url()));
  await page.goto(base+'/tuscaloosa.html#recovery-and-remembrance');
  const section=page.locator('#recovery-and-remembrance');
  assert.match(await section.textContent(),/commemoration clock/);
  assert.match(await section.textContent(),/not establish that the events occurred/);
  assert.equal(await section.getByRole('link',{name:"City's memorial account",exact:true}).getAttribute('href'),
    'https://www.tuscaloosa.com/tornadorecovery');
  const damage=section.getByRole('link',{name:'NWS estimated footprint and individual survey accounts',exact:true});
  await damage.focus();await page.keyboard.press('Enter');
  assert.equal(new URL(page.url()).hash,'#damage-map');
  assert.match(await page.locator('#damage-map').textContent(),/198 source accounts/);
  assert.equal(await page.locator('iframe').count(),0);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
  assert.equal(requests.some(url=>!url.startsWith(base+'/')),false);
});

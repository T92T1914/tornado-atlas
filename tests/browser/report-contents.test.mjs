import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fixture,base} from './harness.mjs';

const data=JSON.parse(await readFile(new URL('../../web/data.json',import.meta.url),'utf8'));
const entries=data.history.report.map(section=>({text:section.title,href:'#'+section.id}));
const widths=[390,375,320,1280];

async function contentsReady(page){
  await page.locator('#documentary-report article').last().waitFor();
  await page.waitForLoadState('networkidle');
  await page.evaluate(()=>document.fonts.ready);
}
async function geometry(page){
  return page.locator('.report-contents').evaluate(nav=>{
    const rect=node=>{const box=node.getBoundingClientRect();return {x:box.x,y:box.y,width:box.width,height:box.height,bottom:box.bottom,right:box.right};};
    const heading=nav.querySelector('strong'),links=[...nav.querySelectorAll('a')];
    const style=getComputedStyle(nav),header=document.querySelector('header nav');
    return {nav:rect(nav),heading:rect(heading),links:links.map(link=>({text:link.textContent,href:link.getAttribute('href'),...rect(link)})),
      font:style.fontFamily,fontSize:style.fontSize,display:style.display,gap:style.gap,
      viewport:innerWidth,documentWidth:document.documentElement.scrollWidth,
      header:{display:getComputedStyle(header).display,gap:getComputedStyle(header).gap,
        links:[...header.querySelectorAll('a')].map(link=>({href:link.getAttribute('href'),...rect(link)}))}};
  });
}
async function capture(page,name,metrics){
  if(!process.env.ATLAS_SCREENSHOT_DIR)return;
  await mkdir(process.env.ATLAS_SCREENSHOT_DIR,{recursive:true});
  await page.locator('.report-contents').scrollIntoViewIfNeeded();
  await page.waitForLoadState('networkidle');
  await page.locator('.report-contents').screenshot({path:path.join(process.env.ATLAS_SCREENSHOT_DIR,name+'.png')});
  await writeFile(path.join(process.env.ATLAS_SCREENSHOT_DIR,name+'.json'),JSON.stringify(metrics,null,2)+'\n');
}
function checkLayout(metrics,enlarged){
  assert.deepEqual(metrics.links.map(({text,href})=>({text,href})),entries,'Report content and anchors stay intact');
  assert.ok(metrics.links[0].y>=metrics.heading.bottom+4,'The title occupies its own row above the first link');
  assert.ok(parseFloat(metrics.fontSize)>=14,'Contents use readable text instead of inheriting small header navigation text');
  assert.ok(metrics.nav.x>=-1&&metrics.nav.right<=metrics.viewport+1,'Contents stay within the viewport');
  for(const [index,link] of metrics.links.entries()){
    assert.ok(link.height>=44&&link.width>=44,'Each link has a continuous 44px tap target: '+link.text);
    assert.ok(link.x>=metrics.nav.x&&link.right<=metrics.nav.right+1,'Link text can wrap inside the panel');
    assert.ok(Math.abs(link.x-metrics.links[0].x)<=1,'Every link starts in the same column');
    if(index){
      const gap=link.y-metrics.links[index-1].bottom;
      assert.ok(gap>=-1&&gap<=2,'Contents flow compactly without inherited flex row gaps: '+gap);
    }
  }
  if(enlarged)assert.ok(metrics.links.some(link=>link.height>70),'The doubled text fixture exercises multiline reflow');
  assert.equal(metrics.header.display,'flex','Header navigation retains its own layout');
}

for(const appearance of ['dark','light'])for(const width of widths){
  test(`El Reno history contents ${appearance} at ${width}px`,async t=>{
    const page=await fixture(t,{viewport:{width,height:900},isMobile:width<600,hasTouch:width<600,reducedMotion:'reduce'});
    await page.goto(base+'/index.html');await contentsReady(page);
    await page.locator('#reading-appearance').selectOption(appearance);
    const metrics=await geometry(page);
    await capture(page,`history-${appearance}-${width}`,metrics);
    checkLayout(metrics,false);
    const links=page.locator('.report-contents a');
    if(process.env.ATLAS_BROWSER_ENGINE==='webkit'){
      // This WebKit fixture skips links in its default sequential Tab mode.
      // Focused Enter activation and hash navigation remain required below.
      t.diagnostic('Sequential link Tab is not established by this WebKit fixture.');
      await links.nth(1).focus();
    }else{
      await links.first().focus();await page.keyboard.press('Tab');
      assert.equal(await links.nth(1).evaluate(link=>link===document.activeElement),true,'Keyboard focus follows the visible order');
    }
    await page.keyboard.press('Enter');
    await page.waitForFunction(hash=>location.hash===hash,entries[1].href);
    const target=page.locator(entries[1].href);
    assert.equal(await target.locator('h3').textContent(),entries[1].text);
    assert.ok((await target.boundingBox()).y>=-1&&(await target.boundingBox()).y<100,'The anchor moves to its matching report section');
    await page.reload();await contentsReady(page);
    assert.equal(new URL(page.url()).hash,entries[1].href,'The saved hash route survives reload');
    assert.ok(metrics.documentWidth<=metrics.viewport+1,'The page stays within the configured viewport');
  });
}

for(const appearance of ['dark','light']){
  test(`El Reno history contents ${appearance} reflows with doubled text at 320px`,async t=>{
    const page=await fixture(t,{viewport:{width:320,height:900},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
    await page.goto(base+'/index.html');await contentsReady(page);
    await page.locator('#reading-appearance').selectOption(appearance);
    // This bounded fixture doubles computed contents text. It does not claim
    // physical phone text settings, browser zoom or virtual keyboard evidence.
    await page.locator('.report-contents').evaluate(nav=>{
      const nodes=[nav,...nav.querySelectorAll('*')];
      const sizes=nodes.map(node=>parseFloat(getComputedStyle(node).fontSize));
      nodes.forEach((node,index)=>node.style.fontSize=sizes[index]*2+'px');
    });
    const metrics=await geometry(page);
    await capture(page,`history-${appearance}-320-enlarged`,metrics);
    checkLayout(metrics,true);
    await page.locator('.report-contents a').last().tap();
    await page.waitForFunction(hash=>location.hash===hash,entries.at(-1).href);
    assert.equal(await page.locator(entries.at(-1).href+' h3').textContent(),entries.at(-1).text);
    assert.ok(metrics.documentWidth<=metrics.viewport+1,'The page stays within the configured viewport');
  });
}

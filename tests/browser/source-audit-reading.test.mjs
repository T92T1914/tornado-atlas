import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fixture,base} from './harness.mjs';

const raw=await readFile(new URL('../../web/source-audit.json',import.meta.url));
const report=JSON.parse(raw),unresolved=report.results.filter(row=>row.access!=='reachable');
assert.equal(raw.length,404375);
assert.equal(createHash('sha256').update(raw).digest('hex'),'8eb49d8934de469fff531cfd8f53e6be3c16b7ab9fdb3b24201d30c500619faa');

for(const width of [320,1280])for(const scripts of [false,true]){
  test(`dated source audit remains ordinary reading ${width} scripts=${scripts}`,async t=>{
    const page=await fixture(t,{viewport:{width,height:900},javaScriptEnabled:scripts,
      colorScheme:width===320?'dark':'light',reducedMotion:'reduce',serviceWorkers:'block'});
    const auditRequests=[];
    page.on('request',request=>{if(new URL(request.url()).pathname==='/source-audit.json')auditRequests.push(request);});
    await page.goto(base+'/index.html?t=0#corrections');
    if(scripts){
      await page.waitForFunction(()=>document.body.dataset.exhibitReady==='true');
      await page.locator('#reading-appearance').selectOption(width===320?'dark':'light');
      assert.equal(await page.locator('html').getAttribute('data-appearance'),width===320?'dark':'light');
    }
    const audit=page.locator('#link-audit-summary'),initial=await audit.innerHTML();
    assert.match(await audit.locator(':scope>p').textContent(),/Link access checked 2026-09-21 UTC: 524 distinct URLs, 511 reachable, 13 with unresolved access, 0 returned missing pages/);
    assert.equal(await audit.locator('time').getAttribute('datetime'),'2026-09-21T07:34:33.515091+00:00');
    const summary=audit.locator('summary');await summary.focus();await page.keyboard.press('Enter');
    assert.equal(await audit.locator('details').evaluate(node=>node.open),true);
    assert.deepEqual(await audit.locator('li>a').evaluateAll(nodes=>nodes.map(node=>node.getAttribute('href'))),unresolved.map(row=>row.url));
    assert.deepEqual(await audit.locator('li>a').evaluateAll(nodes=>nodes.map(node=>[node.getAttribute('target'),node.getAttribute('rel')])),unresolved.map(()=>['_blank','noopener']));
    assert.deepEqual(await audit.locator('li').allTextContents(),unresolved.map(row=>new URL(row.url).hostname+' · '+(row.http_status?'HTTP '+row.http_status:row.error)+' · '+row.url));
    assert.equal(await page.locator('#corrections a[href="source-audit.json"]').count(),1);
    await audit.evaluate(node=>{node.style.fontSize='200%';});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'Complete source labels fit enlarged reading');
    if(process.env.ATLAS_AUDIT_CAPTURE_DIR){
      await mkdir(process.env.ATLAS_AUDIT_CAPTURE_DIR,{recursive:true});
      await audit.scrollIntoViewIfNeeded();
      await page.screenshot({path:path.join(process.env.ATLAS_AUDIT_CAPTURE_DIR,`audit-${width}-${scripts?'enhanced':'noscript'}.png`)});
    }
    // Restore only this controlled presentation change before comparing content.
    await audit.evaluate(node=>node.style.removeProperty('font-size'));
    await summary.focus();await page.keyboard.press('Enter');
    const beforeDeparture=await audit.innerHTML();
    assert.equal(beforeDeparture,initial);
    if(scripts){
      const link=page.locator('.museum-nav a[href="study.html"]');
      await link.locator('xpath=ancestor::details').locator('summary').click();
      await link.focus();await page.keyboard.press('Enter');
      await page.waitForURL(base+'/study.html');
      await page.locator('#lab-context[data-experiment-ready="true"]').waitFor();
      await page.goBack();
      await page.waitForFunction(()=>document.body.dataset.exhibitReady==='true');
      assert.equal(page.url(),base+'/index.html?t=0#corrections');
      assert.equal(await page.locator('#link-audit-summary').innerHTML(),beforeDeparture);
    }
    assert.equal(auditRequests.length,0,'The static dated report has no automatic request');
    if(width===1280&&scripts){
      const responsePromise=page.waitForResponse(response=>response.url()===base+'/source-audit.json');
      await page.locator('#corrections a[href="source-audit.json"]').click();
      const response=await responsePromise;
      assert.equal(response.status(),200);
      assert.deepEqual(await response.body(),raw,'Explicit raw-file navigation returns the complete retained bytes');
      assert.equal(auditRequests.length,1);
    }
  });
}

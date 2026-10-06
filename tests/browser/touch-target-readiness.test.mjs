import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fixture,base} from './harness.mjs';
import {waitForSettledTouchTarget} from './touch-target-readiness.mjs';

test('Touch target readiness rejects continuing viewport movement before a real tap',async t=>{
  const page=await fixture(t,{viewport:{width:390,height:844},hasTouch:true,isMobile:true});
  await page.goto(base+'/blackwell.html');
  // Disposable geometry only. No retained exhibit, asset or route is changed.
  await page.setContent('<style>html{scroll-behavior:auto}body{margin:20px;min-height:2200px;font:16px/1.9 sans-serif}p{margin-top:1000px;max-width:350px}</style><p>A deliberately wrapped pressure reading in a disposable fixture. <a id="touch-target" href="#chosen">Inspect the pressure account</a>.</p><div id="chosen">Chosen</div>');
  const target=page.locator('#touch-target');
  await target.scrollIntoViewIfNeeded();
  await page.evaluate(()=>{
    const start=scrollY;let frame=0;
    window.__atlasMoveTouchFixture=true;
    const move=()=>{
      if(!window.__atlasMoveTouchFixture)return;
      scrollTo(0,start+frame++);
      requestAnimationFrame(move);
    };
    requestAnimationFrame(move);
  });
  await assert.rejects(waitForSettledTouchTarget(page,target,{timeout:250}),/Timeout/);
  assert.equal(new URL(page.url()).hash,'','Readiness failure cannot navigate the fixture');
  await page.evaluate(()=>{window.__atlasMoveTouchFixture=false;});
  await target.scrollIntoViewIfNeeded();
  await waitForSettledTouchTarget(page,target);
  await target.tap();
  await page.waitForURL(base+'/blackwell.html#chosen');
  assert.equal(new URL(page.url()).hash,'#chosen','The settled target still requires actual touch navigation');
});

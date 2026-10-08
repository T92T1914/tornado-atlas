import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fixture,base} from './harness.mjs';

// Two authored provider versions at one clock reading. This tests the software
// contract, not the availability or registration of another historical upload.
async function sources(page,{delayed=false}={}){
  const root=new URL('../../web/',import.meta.url);
  const data=JSON.parse(await readFile(new URL('data.json',root),'utf8'));
  const config=JSON.parse(await readFile(new URL('events/el-reno-2013.json',root),'utf8'));
  const source={...data.footage.sources[0],id:'synthetic-source-b',creator:'Synthetic provider B',video_id:'abcdefghijk',url:'https://www.youtube.com/watch?v=abcdefghijk'};
  const anchor={...data.footage.anchors[0],id:'synthetic-anchor-b',source_id:source.id,video_seconds:20,note:'Synthetic source-switch test, not a historical observation.'};
  data.footage.sources.push(source);data.footage.anchors.splice(1,0,anchor);
  const body=JSON.stringify(data);config.bundle_sha256=createHash('sha256').update(body).digest('hex');
  await page.route('**/data.json',route=>route.fulfill({contentType:'application/json',body}));
  await page.route('**/events/el-reno-2013.json',route=>route.fulfill({contentType:'application/json',body:JSON.stringify(config)}));
  await page.addInitScript(({delayed})=>{
    window.providerFixture={players:[],delayed};
    window.YT={Player:class{
      constructor(mount,options){
        this.options=options;this.destroyed=false;this.seeks=[];this.pauses=0;
        this.frame=document.createElement('iframe');this.frame.title='Synthetic provider test';mount.replaceWith(this.frame);
        window.providerFixture.players.push(this);
        if(!window.providerFixture.delayed)queueMicrotask(()=>this.ready());
      }
      ready(){this.options.events.onReady({target:this});}
      mute(){this.muted=true;}
      pauseVideo(){this.pauses++;this.options.events.onStateChange({target:this,data:2});}
      seekTo(value){this.seeks.push(value);}
      destroy(){this.destroyed=true;this.frame.remove();}
      state(value){this.options.events.onStateChange({target:this,data:value});}
      error(){this.options.events.onError({target:this,data:101});}
    }};
  },{delayed});
}

for(const width of [1280,320])test(`visible share link restores selected source, checked moment and gap at ${width}px`,async t=>{
  const page=await fixture(t,{viewport:{width,height:900},hasTouch:width===320});
  await sources(page);
  // Optional local failure proof uses the unchanged accepted consumer bytes.
  // It changes only the loopback response, never the retained source or data.
  if(process.env.ATLAS_SHARE_BASELINE_SOURCE){
    const body=await readFile(process.env.ATLAS_SHARE_BASELINE_SOURCE);
    assert.equal(createHash('sha256').update(body).digest('hex'),'60bad7f02a68510bbe860e61ce9f3e923f69f715d1b9b2a1df9a9fac7646d7c8');
    await page.route('**/reconstruction.js',route=>route.fulfill({contentType:'text/javascript',body}));
  }
  await page.goto(base+'/reconstruction.html?event=el-reno-2013&t=783.5&context=kept');
  await page.locator('#footage-source:visible').waitFor();
  await page.locator('#footage-source').selectOption('synthetic-source-b');
  await page.waitForFunction(()=>new URL(location.href).searchParams.get('footage_source')==='synthetic-source-b');
  assert.equal(new URL(page.url()).searchParams.get('t'),'783.5');
  assert.equal(new URL(page.url()).searchParams.has('footage'),false,'A fractional address does not claim an exact anchor');
  const link=page.locator('#replay-link');
  const shared=new URL(await link.getAttribute('href'),page.url());
  assert.equal(shared.searchParams.get('t'),'783','The existing whole-second share contract is preserved');
  assert.equal(shared.searchParams.get('footage_source'),'synthetic-source-b');
  assert.equal(shared.searchParams.get('footage'),'synthetic-anchor-b');
  assert.equal(shared.searchParams.get('context'),'kept');
  await link.focus();
  await Promise.all([page.waitForURL(shared.href),page.keyboard.press('Enter')]);
  await page.locator('#footage-source:visible').waitFor();
  assert.equal(await page.locator('#footage-source').inputValue(),'synthetic-source-b');
  assert.equal(await page.locator('#replay-time').inputValue(),'783');
  assert.match(await page.locator('#footage-status').textContent(),/Synthetic provider B.*0:20/);
  assert.equal(await page.locator('#registered-footage iframe').count(),0);
  assert.equal(await page.evaluate(()=>window.providerFixture.players.length),0,'Opening the link never loads the provider');
  await page.locator('#replay-time').fill('782');
  const gap=new URL(await link.getAttribute('href'),page.url());
  assert.equal(gap.searchParams.get('t'),'782');
  assert.equal(gap.searchParams.get('footage_source'),'synthetic-source-b');
  assert.equal(gap.searchParams.has('footage'),false,'The gap has no invented anchor');
  assert.notEqual(gap.hash,'#registered-footage');
  await page.goto(gap.href);
  await page.locator('#footage-source:visible').waitFor();
  assert.equal(await page.locator('#footage-source').inputValue(),'synthetic-source-b');
  assert.equal(await page.locator('#replay-time').inputValue(),'782');
  assert.match(await page.locator('#footage-status').textContent(),/No checked video frame/);
  assert.equal(await page.getByRole('button',{name:'Load original YouTube player',exact:true}).isDisabled(),true);
  assert.equal(await page.locator('#registered-footage iframe').count(),0);
  assert.equal(await page.evaluate(()=>window.providerFixture.players.length),0);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
});

for(const width of [1280,390])test(`one source-owned player at ${width}px with history, buffering and gaps`,async t=>{
  const page=await fixture(t,{viewport:{width,height:1000}});await sources(page);
  await page.goto(base+'/reconstruction.html?event=el-reno-2013&t=783');
  await page.locator('#footage-source:visible').waitFor();
  assert.equal(await page.locator('#registered-footage iframe').count(),0);
  await page.getByRole('button',{name:'Load original YouTube player',exact:true}).click();
  await page.waitForFunction(()=>window.providerFixture.players[0]?.muted);
  assert.equal(await page.evaluate(()=>window.providerFixture.players[0].options.videoId),'MxgU1QcFMJM');
  await page.locator('#footage-source').selectOption('synthetic-source-b');
  assert.equal(await page.locator('#registered-footage iframe').count(),0);
  assert.equal(await page.evaluate(()=>window.providerFixture.players[0].destroyed),true);
  assert.match(await page.locator('#footage-status').textContent(),/Synthetic provider B.*0:20/);
  await page.getByRole('button',{name:'Load original YouTube player',exact:true}).click();
  await page.waitForFunction(()=>window.providerFixture.players[1]?.muted);
  assert.equal(await page.evaluate(()=>window.providerFixture.players[1].options.videoId),'abcdefghijk');
  assert.equal(await page.locator('#registered-footage iframe').count(),1);
  const visiblePauses=await page.evaluate(()=>window.providerFixture.players[1].pauses);
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});window.providerFixture.players[1].state(1);delete document.hidden;});
  assert.ok(await page.evaluate(()=>window.providerFixture.players[1].pauses)>visiblePauses);
  // Deliver immediate buffering from the real click task, before a clock frame can enter a gap.
  await page.evaluate(()=>document.getElementById('replay-play').addEventListener('click',()=>{
    queueMicrotask(()=>window.providerFixture.players[1].state(3));
  },{once:true}));
  await page.locator('#replay-play').click();
  assert.equal(await page.locator('#replay-play').textContent(),'Play timeline');
  assert.equal(await page.locator('#replay-time').inputValue(),'783');
  assert.match(await page.locator('.footage-controls + .footage-player + p').textContent(),/buffering.*map stays paused/);
  await page.locator('#replay-time').fill('782');
  assert.match(await page.locator('#footage-status').textContent(),/No checked video frame/);
  const pauses=await page.evaluate(()=>window.providerFixture.players[1].pauses);
  await page.evaluate(()=>window.providerFixture.players[1].state(1));
  assert.ok(await page.evaluate(()=>window.providerFixture.players[1].pauses)>pauses);
  assert.equal(await page.locator('.footage-player').isVisible(),false);
  await page.locator('#replay-time').fill('783');
  assert.match(await page.locator('#footage-status').textContent(),/Synthetic provider B/);
  await page.goBack();
  assert.equal(await page.locator('#footage-source').inputValue(),'robinson-dashcam');
  assert.equal(await page.evaluate(()=>window.providerFixture.players[1].destroyed),true);
  await page.goForward();
  assert.equal(await page.locator('#footage-source').inputValue(),'synthetic-source-b');
  assert.equal(await page.locator('#registered-footage iframe').count(),0);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
});

test('a late buffering event in an unknown second does not rewind to an old checked frame',async t=>{
  const page=await fixture(t,{viewport:{width:390,height:1000}});await sources(page);
  await page.goto(base+'/reconstruction.html?event=el-reno-2013&t=783');
  await page.locator('#footage-source:visible').waitFor();
  await page.getByRole('button',{name:'Load original YouTube player',exact:true}).click();
  await page.waitForFunction(()=>window.providerFixture.players[0]?.muted);
  await page.locator('#replay-play').click();
  await page.waitForFunction(()=>document.getElementById('footage-status').textContent.includes('No checked video frame'));
  await page.locator('#replay-play').click();
  assert.equal(await page.locator('#replay-play').textContent(),'Play timeline');
  const time=await page.locator('#replay-time').inputValue();
  assert.ok(Number(time)>783);
  const pauses=await page.evaluate(()=>window.providerFixture.players[0].pauses);
  await page.evaluate(()=>window.providerFixture.players[0].state(3));
  assert.ok(await page.evaluate(()=>window.providerFixture.players[0].pauses)>pauses);
  assert.equal(await page.locator('#replay-time').inputValue(),time);
  assert.equal(await page.locator('#replay-play').textContent(),'Play timeline');
  assert.match(await page.locator('#footage-status').textContent(),/No checked video frame/);
  assert.equal(await page.locator('.footage-player').isVisible(),false);
});

test('source history restores the default in an unassigned second',async t=>{
  const page=await fixture(t);await sources(page);
  await page.goto(base+'/reconstruction.html?event=el-reno-2013&t=782');
  await page.locator('#footage-source:visible').waitFor();
  await page.locator('#footage-source').selectOption('synthetic-source-b');
  await page.goBack();
  assert.equal(await page.locator('#footage-source').inputValue(),'robinson-dashcam');
  assert.equal(await page.locator('#replay-time').inputValue(),'782');
  assert.equal(await page.getByRole('button',{name:'Load original YouTube player',exact:true}).isDisabled(),true);
  await page.goForward();
  assert.equal(await page.locator('#footage-source').inputValue(),'synthetic-source-b');
  assert.equal(await page.locator('#registered-footage iframe').count(),0);
});

test('a valid linked anchor takes precedence over a conflicting source',async t=>{
  const page=await fixture(t);await sources(page);
  const data=JSON.parse(await readFile(new URL('../../web/data.json',import.meta.url),'utf8'));
  await page.goto(base+`/reconstruction.html?event=el-reno-2013&t=782&footage=${data.footage.anchors[0].id}&footage_source=synthetic-source-b`);
  await page.locator('#footage-source:visible').waitFor();
  assert.equal(await page.locator('#footage-source').inputValue(),'robinson-dashcam');
  assert.equal(await page.locator('#replay-time').inputValue(),'783');
  assert.equal(new URL(page.url()).searchParams.get('footage_source'),'robinson-dashcam');
  await page.locator('#replay-time').fill('782');
  assert.equal(await page.locator('#footage-source').inputValue(),'robinson-dashcam');
  assert.match(await page.locator('#footage-status').textContent(),/No checked video frame/);
});

test('a late provider callback cannot resurrect a closed source',async t=>{
  const page=await fixture(t);await sources(page,{delayed:true});
  await page.goto(base+'/reconstruction.html?event=el-reno-2013&t=783');
  await page.locator('#footage-source:visible').waitFor();
  await page.getByRole('button',{name:'Load original YouTube player',exact:true}).click();
  await page.waitForFunction(()=>window.providerFixture.players.length===1);
  await page.locator('#footage-source').selectOption('synthetic-source-b');
  await page.evaluate(()=>window.providerFixture.players[0].ready());
  assert.equal(await page.locator('#registered-footage iframe').count(),0);
  assert.equal(await page.evaluate(()=>window.providerFixture.players[0].destroyed),true);
  await page.getByRole('button',{name:'Load original YouTube player',exact:true}).click();
  await page.waitForFunction(()=>window.providerFixture.players.length===2);
  await page.evaluate(()=>{const player=window.providerFixture.players[1];player.ready();player.error();});
  assert.equal(await page.locator('#registered-footage iframe').count(),0);
  assert.match(await page.locator('.footage-controls + .footage-player + p').textContent(),/could not play/);
  assert.match(await page.getByRole('link',{name:'Watch this moment on the original upload'}).getAttribute('href'),/abcdefghijk&t=20s/);
});

test('a direct alternate-source moment retains its source through a gap and reload',async t=>{
  const page=await fixture(t);await sources(page);
  await page.goto(base+'/reconstruction.html?event=el-reno-2013&footage=synthetic-anchor-b');
  await page.locator('#footage-source:visible').waitFor();
  assert.equal(await page.locator('#footage-source').inputValue(),'synthetic-source-b');
  await page.locator('#replay-time').fill('782');
  assert.equal(new URL(page.url()).searchParams.get('footage_source'),'synthetic-source-b');
  await page.reload();await page.locator('#footage-source:visible').waitFor();
  assert.equal(await page.locator('#footage-source').inputValue(),'synthetic-source-b');
  assert.equal(await page.locator('#replay-time').inputValue(),'782');
  assert.match(await page.locator('#footage-status').textContent(),/No checked video frame/);
});

test('paused provider status clears buffering without changing evidence',async t=>{
  const page=await fixture(t);await sources(page);
  await page.goto(base+'/reconstruction.html?event=el-reno-2013&t=783&context=kept');
  await page.locator('#footage-source:visible').waitFor();
  await page.getByRole('button',{name:'Load original YouTube player',exact:true}).click();
  await page.waitForFunction(()=>window.providerFixture.players[0]?.muted);
  const status=page.locator('.footage-controls + .footage-player + p');
  const before={url:page.url(),time:await page.locator('#replay-time').inputValue(),
    source:await page.locator('#footage-source').inputValue()};
  await page.evaluate(()=>window.providerFixture.players[0].state(3));
  assert.match(await status.textContent(),/buffering.*map stays paused/);
  await page.evaluate(()=>window.providerFixture.players[0].state(2));
  assert.equal(await page.locator('#replay-play').textContent(),'Play timeline');
  assert.deepEqual({url:page.url(),time:await page.locator('#replay-time').inputValue(),
    source:await page.locator('#footage-source').inputValue()},before);
  assert.match(await status.textContent(),/Source playback is paused.*map remains at the checked moment/);
  assert.doesNotMatch(await status.textContent(),/buffering|Source playback is running/);
  await page.evaluate(()=>window.providerFixture.players[0].state(1));
  assert.match(await status.textContent(),/Source playback is running/);
  await page.evaluate(()=>window.providerFixture.players[0].state(2));
  assert.match(await status.textContent(),/Source playback is paused/);
  await page.locator('#replay-time').fill('782');
  const gap=await status.textContent();
  assert.match(gap,/Unreviewed intervals are left unassigned/);
  await page.evaluate(()=>window.providerFixture.players[0].state(2));
  assert.equal(await status.textContent(),gap);
  assert.equal(await page.locator('.footage-player').isVisible(),false);
  await page.locator('#replay-time').fill('783');
  await page.locator('#footage-source').selectOption('synthetic-source-b');
  const changed=await status.textContent();
  await page.evaluate(()=>{const old=window.providerFixture.players[0];old.state(2);old.state(3);});
  assert.equal(await status.textContent(),changed);
  assert.equal(await page.locator('#registered-footage iframe').count(),0);
  assert.equal(await page.evaluate(()=>window.providerFixture.players[0].destroyed),true);
  assert.equal(await page.locator('#footage-source').inputValue(),'synthetic-source-b');
  assert.equal(await page.locator('#replay-time').inputValue(),'783');
  assert.equal(new URL(page.url()).searchParams.get('context'),'kept');
});

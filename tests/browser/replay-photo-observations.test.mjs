import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fixture,base} from './harness.mjs';

const web=new URL('../../web/',import.meta.url);
const knownConfig=JSON.parse(await readFile(new URL('events/el-reno-2013.json',web),'utf8'));
const knownData=JSON.parse(await readFile(new URL('data.json',web),'utf8'));
const sharedText=await readFile(new URL('../photo-observations.test.mjs',import.meta.url),'utf8');
const match=sharedText.match(/\/\* PHOTO_CASES\r?\n([\s\S]*?)\r?\nPHOTO_CASES \*\//);
assert.ok(match,'Shared synthetic photo cases are present');
const spec=JSON.parse(match[1]);
const eventId='synthetic-player-photo';
const sourceId='synthetic-player-video';
const singleId='player-single-instant',pairId='player-sparse-pair';
const origin=Date.parse('2001-01-01T12:00:00Z');
const shifted=value=>new Date(origin+Date.parse(value)-Date.parse(spec.clock.start_utc)).toISOString().replace('.000Z','Z');
const painted=page=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));

function packet({video=false,photos=true}={}){
  const publication=structuredClone(spec.source);
  publication.id='synthetic-player-publication';
  publication.url='https://example.test/player-publication?edition=1&fixture=synthetic';
  publication.title='Synthetic <em>photo publication</em>';
  publication.creator='Synthetic creator <script>untrusted</script>';
  publication.publisher='Synthetic publisher & archive';
  const sequences=photos?spec.sequences.map(descriptor=>({
    id:'player-'+descriptor.id,basis:descriptor.basis,
    samples:descriptor.samples.map(entry=>{
      const sample=structuredClone(spec.sample);
      sample.id='player-'+entry.id;sample.source_id=publication.id;
      sample.exposure_id='player-'+entry.exposure_id;sample.reported_utc=shifted(entry.reported_utc);
      sample.image.panel_locator='Synthetic <panel & clock> '+entry.panel_locator;
      sample.image.original_url=publication.url+'#'+sample.exposure_id;
      return sample;
    }),
  })):[];
  const sources=[],windows=[];
  if(video){
    const source={...structuredClone(spec.registered_source),id:sourceId,
      url:spec.registered_source.url+'?fixture=player',title:'Synthetic player video',
      clock_basis:'Authored video clock for software checks only.',
      limits:'Synthetic declaration. No historical video was inspected.',
      rights:'External links only. This fixture establishes no reuse permission.'};
    sources.push(source);
    const registered=structuredClone(spec.registered_window);
    registered.id='synthetic-player-registered';registered.source_id=source.id;
    registered.start_utc=shifted(registered.start_utc);registered.end_utc=shifted(registered.end_utc);
    registered.registration.source.url=source.url;
    registered.registration.source.original_locator=source.url;
    for(const anchor of registered.registration.timing.anchors)anchor.utc=shifted(anchor.utc);
    const authored=structuredClone(spec.legacy_window);
    authored.id='synthetic-player-authored';
    authored.start_utc=shifted(authored.start_utc);authored.end_utc=shifted(authored.end_utc);
    windows.push(registered,authored);
  }
  const clock={...structuredClone(spec.clock),start_utc:shifted(spec.clock.start_utc),
    end_utc:shifted(spec.clock.end_utc),basis:'Authored player fixture clock. No historical alignment.'};
  const provenance={url:'https://example.test/synthetic-player-geography',sha256:'a'.repeat(64)};
  const properties=(role,extra={})=>({role,source_url:provenance.url,source_sha256:provenance.sha256,...extra});
  const coordinates=[[0,0],[.01,.01],[.02,.02]];
  const features=coordinates.map((point,index)=>({
    type:'Feature',geometry:{type:'Point',coordinates:point},
    properties:properties('published_center_position',{
      utc:new Date(origin+index*60000).toISOString().replace('.000Z','Z'),
      display_time:`Synthetic minute ${index}`,
    }),
  }));
  features.push(
    {type:'Feature',geometry:{type:'LineString',coordinates},
      properties:properties('published_center_path')},
    {type:'Feature',geometry:{type:'Polygon',coordinates:[
      [[-.01,-.01],[.03,-.01],[.03,.03],[-.01,.03],[-.01,-.01]],
    ]},properties:properties('published_tornado_outline')},
  );
  const anchors=video?[20,40].map((seconds,index)=>({
    id:'synthetic-player-anchor-'+index,source_id:sourceId,video_seconds:index?10:0,
    utc:new Date(origin+seconds*1000).toISOString().replace('.000Z','Z'),
    evidence:'onscreen_clock_sample',coordinates:null,bearing:null,
    note:'Authored paused-video sample. No historical inspection.',
  })):[];
  const data={
    exhibit:{id:eventId,title:'Synthetic photograph player checks'},
    geometry:{type:'FeatureCollection',source:provenance,features},
    timeline_media:{...structuredClone(knownData.timeline_media),event:eventId,frames:[],
      credit:'Authored empty radar fixture. No media is acquired.'},
    footage:{...structuredClone(knownData.footage),event:eventId,sources,anchors,
      access_checks:[],reviewed:'2026-10-10',
      introduction:'Synthetic video declarations for player checks only.',
      method:'Authored software fixture. No footage was inspected.',
      coverage:'Only the authored sample clocks are declared.'},
    appearance_timeline:{schema_version:2,event:eventId,windows,
      photo_sources:photos?[publication]:[],photo_sequences:sequences},
  };
  const manifest={...structuredClone(knownConfig),schema_version:2,event_id:eventId,
    bundle:'synthetic-player-photo.json',clock,geography_source:provenance,
    coverage:{positions:'published_minute_samples',between_positions:'linear_longitude_latitude',
      camera:'free_orbit',appearance:'bounded_timeline'}};
  const body=JSON.stringify(data);
  manifest.bundle_sha256=createHash('sha256').update(body).digest('hex');
  const index={schema_version:2,default_event:eventId,events:[{
    id:eventId,title:'Synthetic photograph player checks',documentary:'fixture.html',
    replay:`events/${eventId}.json`,chronology:null,
  }]};
  return {data,manifest,index,body};
}

async function synthetic(page,options={}){
  const value=packet(options),mediaRequests=[];
  page.context().on('request',request=>{
    const url=request.url();
    if(url.startsWith('https://example.test/')||/https:\/\/[^/]*(?:youtube|ytimg)/.test(url))mediaRequests.push(url);
  });
  await page.context().route(base+'/events.json',route=>route.fulfill({
    contentType:'application/json',body:JSON.stringify(value.index),
  }));
  await page.context().route(base+`/events/${eventId}.json`,route=>route.fulfill({
    contentType:'application/json',body:JSON.stringify(value.manifest),
  }));
  await page.context().route(base+'/synthetic-player-photo.json',route=>route.fulfill({
    contentType:'application/json',body:value.body,
  }));
  return {...value,mediaRequests};
}

async function ready(page,query='t=0'){
  await page.goto(base+`/reconstruction.html?event=${eventId}&${query}`);
  await page.locator('#replay-time:not([disabled])').waitFor();
}

function sampleButton(page,id){
  return page.locator(`[data-photo-sample="player-${id}"]`);
}

async function photoState(page,state){
  await page.waitForFunction(state=>
    document.querySelector('#replay-appearance-canvas')?.dataset.evidenceState===state,state);
}

function nativePhotoClockReading({seconds,duration}){
  const actual=document.querySelector('#replay-time'),expected=document.createElement('input');
  expected.type='range';expected.min='0';expected.max=String(duration);expected.step='any';expected.value=seconds;
  return {type:actual.type,min:actual.min,max:actual.max,step:actual.step,
    value:actual.value,numeric:actual.valueAsNumber,
    expectedValue:expected.value,expectedNumeric:expected.valueAsNumber};
}

test('typed photo selection shows its own publication, exact panel and declared limits',async t=>{
  const page=await fixture(t,{viewport:{width:390,height:900}});
  const value=await synthetic(page);
  await ready(page,`t=20&appearance_view=photo&appearance_photo=${pairId}`);
  await photoState(page,'photo_observed');
  assert.equal(await page.locator('#replay-appearance-mode').inputValue(),'photo:'+pairId);
  const sample=value.data.appearance_timeline.photo_sequences[1].samples[0];
  const source=value.data.appearance_timeline.photo_sources[0];
  const record=await page.locator('#replay-photo-record').textContent();
  for(const text of [source.title,source.creator,source.publisher,source.publication_identity,
    source.version_identity,source.original_locator,source.identity_basis,
    sample.image.panel_locator,sample.image.identity_basis,sample.reported_utc,
    sample.timing.basis,sample.timing.uncertainty_basis,sample.viewpoint.description,
    sample.viewpoint.basis,sample.inspection.pixels,sample.inspection.basis,
    source.rights.rights_holder,source.rights.basis,...sample.characteristics,...sample.boundary_limits]){
    assert.ok(record.includes(text),`Retains its own declaration: ${text}`);
  }
  assert.match(record,/12:00:20.*UTC/);
  assert.match(record,/Timing uncertaintyUnquantified/);
  assert.match(record,/Unknown: coordinates, bearing, pitch, roll/);
  assert.match(record,/position uncertainty, orientation uncertainty and lens calibration/);
  assert.match(record,/Orbit controls are authored display choices/);
  assert.match(record,/Schema validation does not repeat inspection or authenticate the source/);
  assert.equal(await page.locator('#replay-appearance-source').getAttribute('href'),source.url);
  assert.equal(await page.locator('#replay-photo-original').getAttribute('href'),sample.image.original_url);
  assert.equal(await page.locator('#replay-photo-record script,#replay-photo-record em').count(),0);
  assert.equal(await page.locator('#replay-appearance img').count(),0);
  assert.equal(await sampleButton(page,'sample-first').getAttribute('aria-pressed'),'true');
  assert.equal(await sampleButton(page,'sample-second').getAttribute('aria-pressed'),'false');
  assert.equal(await page.locator('#replay-play').textContent(),'Play timeline');
  await page.locator('#replay-appearance-source').focus();
  assert.equal(await page.evaluate(()=>document.activeElement.id),'replay-appearance-source');
  await page.locator('#replay-photo-original').focus();
  assert.equal(await page.evaluate(()=>document.activeElement.id),'replay-photo-original');
  assert.deepEqual(value.mediaRequests,[]);
});

test('photo-only and empty packages keep geography usable without video controls or requests',async t=>{
  for(const photos of [true,false]){
    const page=await fixture(t);
    const value=await synthetic(page,{photos});
    await ready(page,photos?`t=10&appearance_view=photo&appearance_photo=${singleId}`:'t=10');
    if(photos){
      await photoState(page,'photo_observed');
      assert.equal(await page.locator('#replay-appearance-drawing').isVisible(),true);
      assert.match(await page.locator('#replay-photo-sequence').textContent(),/One reported instant.*no duration/);
    }else{
      assert.equal(await page.locator('#replay-appearance').isVisible(),true);
      assert.equal(await page.locator('#replay-appearance-drawing').isVisible(),false);
    }
    assert.match(await page.locator('#footage-status').textContent(),/No video source or checked video moment/);
    assert.equal(await page.locator('#footage-source').count(),0);
    assert.equal(await page.locator('#registered-footage button,#registered-footage iframe').count(),0);
    assert.equal(await page.locator('script[src*="youtube"]').count(),0);
    await page.locator('#replay-time').fill('60');
    assert.match(await page.locator('#replay-basis').textContent(),/Published source minute position/);
    assert.equal(await page.locator('#replay-documentary').isVisible(),true);
    assert.equal(await page.locator('#replay-error').isVisible(),false);
    assert.deepEqual(value.mediaRequests,[]);
  }
});

test('mixed video to photo uses the existing renderer to clear the previous form',async t=>{
  const page=await fixture(t);
  const value=await synthetic(page,{video:true});
  await ready(page,`t=40&footage_source=${sourceId}`);
  await photoState(page,'observed');
  const graphics=await page.locator('#replay-appearance-canvas').evaluate(canvas=>{
    if(canvas.hidden)return false;
    const gl=canvas.getContext('webgl2');if(!gl)return false;
    window.photoDraws={clears:0,lines:0,points:0};
    const clear=gl.clear,draw=gl.drawArrays;
    gl.clear=function(...args){window.photoDraws.clears++;return clear.apply(this,args);};
    gl.drawArrays=function(...args){
      if(args[0]===gl.LINES)window.photoDraws.lines++;
      if(args[0]===gl.POINTS)window.photoDraws.points++;
      return draw.apply(this,args);
    };
    return true;
  });
  await page.locator('#replay-time').fill('45');
  await photoState(page,'interpolated');
  if(graphics)await page.waitForFunction(()=>window.photoDraws.points>0);
  else t.diagnostic('WebGL 2 rendering is unavailable. Actual particle clearing is unverified in this browser.');
  const before=graphics?await page.evaluate(()=>({...window.photoDraws})):null;
  await page.locator('#replay-appearance-mode').selectOption('photo:'+pairId);
  await photoState(page,'unknown');
  await painted(page);
  if(graphics){
    const after=await page.evaluate(()=>({...window.photoDraws}));
    assert.ok(after.clears>before.clears,'The existing renderer clears the previous canvas');
    assert.ok(after.lines>before.lines,'The existing renderer still draws its reference grid');
    assert.equal(after.points,before.points,'A photo gap draws no particle form');
  }
  const gap=graphics?await page.evaluate(()=>({...window.photoDraws})):null;
  await sampleButton(page,'sample-first').click();
  await photoState(page,'photo_observed');
  await painted(page);
  if(graphics){
    const after=await page.evaluate(()=>({...window.photoDraws}));
    assert.ok(after.clears>gap.clears,'An exact photo observation also clears the canvas');
    assert.equal(after.points,gap.points,'An exact photo observation draws no particle form');
  }
  assert.equal(new URL(page.url()).searchParams.get('footage_source'),sourceId);
  assert.equal(new URL(page.url()).searchParams.has('footage'),false,'A coincident video anchor is not a photo link');
  await page.locator('#replay-appearance-canvas').evaluate(canvas=>
    canvas.dispatchEvent(new Event('webglcontextlost',{cancelable:true})));
  await sampleButton(page,'sample-second').click();
  await photoState(page,'photo_observed');
  assert.equal(await page.locator('#replay-photo-record').isVisible(),true);
  assert.equal(await page.locator('#replay-photo-original').isVisible(),true);
  assert.equal(await page.locator('#replay-appearance-mode').isVisible(),true);
  assert.deepEqual(value.mediaRequests,[]);
});

test('exact photo seeks pause one clock and preserve typed history, source, filters and hash',async t=>{
  const page=await fixture(t);
  await synthetic(page,{video:true});
  const retained={survey:'270271',fatality:'synthetic-unassigned',surveyRating:'EF3',
    surveySearch:'synthetic',surveyPhotos:'0',surveyOrder:'source',footage_source:sourceId};
  const query=new URLSearchParams({t:'40',...retained});
  await ready(page,query.toString()+'#synthetic-reading');
  const initialCount=await page.evaluate(()=>history.length);
  await page.locator('#replay-appearance-mode').selectOption('photo:'+pairId);
  assert.equal(await page.evaluate(()=>history.length),initialCount+1);
  await page.locator('#replay-rate').selectOption('1');
  await page.locator('#replay-play').click();
  await page.waitForFunction(()=>Number(document.querySelector('#replay-time').value)>40.05);
  const beforeSample=await page.evaluate(()=>history.length);
  await sampleButton(page,'sample-first').click();
  await photoState(page,'photo_observed');
  assert.equal(await page.locator('#replay-time').inputValue(),'20');
  assert.equal(await page.locator('#replay-play').textContent(),'Play timeline');
  assert.equal(await page.evaluate(()=>history.length),beforeSample+1);
  const url=new URL(page.url());
  for(const [key,value] of Object.entries(retained))assert.equal(url.searchParams.get(key),value);
  assert.equal(url.hash,'#synthetic-reading');
  assert.equal(url.searchParams.get('appearance_view'),'photo');
  assert.equal(url.searchParams.get('appearance_photo'),pairId);
  assert.equal(url.searchParams.has('footage'),false);
  const share=new URL(await page.locator('#replay-link').getAttribute('href'));
  assert.equal(share.href,url.href);
  await sampleButton(page,'sample-first').click();
  assert.equal(await page.evaluate(()=>history.length),beforeSample+1,'Reselecting the same instant adds no duplicate history');
  await sampleButton(page,'sample-second').click();
  await photoState(page,'photo_observed');
  await page.goBack();
  await page.waitForFunction(()=>document.querySelector('#replay-time').value==='20');
  assert.equal(await page.locator('#replay-appearance-mode').inputValue(),'photo:'+pairId);
  assert.equal(await sampleButton(page,'sample-first').getAttribute('aria-pressed'),'true');
  assert.equal(await page.locator('#replay-play').textContent(),'Play timeline');
  await page.goForward();
  await page.waitForFunction(()=>document.querySelector('#replay-time').value==='30');
  assert.equal(await sampleButton(page,'sample-second').getAttribute('aria-pressed'),'true');
  await page.reload();
  await page.locator('#replay-time:not([disabled])').waitFor();
  await photoState(page,'photo_observed');
  assert.equal(await page.locator('#replay-time').inputValue(),'30');
  assert.equal(await page.locator('#replay-appearance-mode').inputValue(),'photo:'+pairId);
  assert.equal(new URL(page.url()).hash,'#synthetic-reading');
});

test('mode changes during playback record the displayed clock and history restores a paused choice',async t=>{
  const page=await fixture(t);
  await synthetic(page,{video:true});
  await ready(page,`t=40&footage_source=${sourceId}`);
  await page.locator('#replay-rate').selectOption('1');
  await page.locator('#replay-play').click();
  await page.waitForFunction(()=>Number(document.querySelector('#replay-time').value)>40.2);
  await page.locator('#replay-appearance-mode').selectOption('photo:'+pairId);
  const selected=new URL(page.url()),seconds=selected.searchParams.get('t');
  assert.ok(Number(seconds)>40.2);
  assert.equal(selected.searchParams.get('appearance_view'),'photo');
  assert.equal(selected.searchParams.get('appearance_photo'),pairId);
  assert.equal(selected.searchParams.has('footage'),false);
  assert.equal(await page.locator('#replay-play').textContent(),'Pause timeline');
  await page.goBack();
  await page.waitForFunction(()=>document.querySelector('#replay-time').value==='40');
  assert.equal(await page.locator('#replay-appearance-mode').inputValue(),'source');
  assert.equal(await page.locator('#replay-play').textContent(),'Play timeline');
  await photoState(page,'observed');
  await page.goForward();
  await photoState(page,'unknown');
  assert.equal(new URL(page.url()).searchParams.get('t'),seconds,'History retains the complete clock value');
  assert.equal(new URL(await page.locator('#replay-link').getAttribute('href')).searchParams.get('t'),seconds,'Sharing retains the complete clock value');
  const nativeReading=await page.evaluate(nativePhotoClockReading,{seconds,duration:120});
  t.diagnostic('PHOTO_HISTORY_NATIVE_CLOCK '+JSON.stringify({seconds,...nativeReading}));
  assert.equal(nativeReading.type,'range');
  assert.equal(nativeReading.min,'0');
  assert.equal(nativeReading.max,'120');
  assert.equal(nativeReading.step,'any');
  assert.equal(nativeReading.value,nativeReading.expectedValue,
    'The range restores the exact native serialization of the complete history clock');
  assert.equal(nativeReading.numeric,nativeReading.expectedNumeric);
  assert.equal(await page.locator('#replay-appearance-mode').inputValue(),'photo:'+pairId);
  assert.equal(await page.locator('#replay-play').textContent(),'Play timeline');
  await photoState(page,'unknown');
});

test('video caption links restore their exact video moment from a photo gap and same-second mode changes',async t=>{
  const page=await fixture(t);
  await synthetic(page,{video:true});
  await ready(page,`t=20.25&appearance_view=photo&appearance_photo=${pairId}&footage_source=${sourceId}&surveySearch=synthetic#synthetic-reading`);
  await photoState(page,'unknown');
  const link=page.locator('.footage-caption a').filter({hasText:'Link to this moment in the exhibit'});
  async function videoLink(){
    const url=new URL(await link.getAttribute('href'));
    assert.equal(url.searchParams.has('appearance_view'),false,'An explicit video link has no photo appearance selection');
    assert.equal(url.searchParams.has('appearance_photo'),false);
    assert.equal(url.searchParams.get('t'),'20');
    assert.equal(url.searchParams.get('footage'),'synthetic-player-anchor-0');
    assert.equal(url.searchParams.get('footage_source'),sourceId);
    assert.equal(url.searchParams.get('surveySearch'),'synthetic');
    assert.equal(url.hash,'#registered-footage');
    return url;
  }
  const initial=await videoLink();
  await page.locator('#replay-appearance-mode').selectOption('source');
  assert.equal((await videoLink()).href,initial.href,'An unchanged checked second keeps an explicit video link');
  await page.locator('#replay-appearance-mode').selectOption('photo:'+pairId);
  assert.equal((await videoLink()).href,initial.href);
  const pending=page.waitForEvent('popup');
  await link.click();
  const target=await pending;
  await target.locator('#replay-time:not([disabled])').waitFor();
  assert.equal(await target.locator('#replay-time').inputValue(),'20');
  assert.equal(await target.locator('#replay-appearance-mode').inputValue(),'source');
  assert.equal(await target.locator('#replay-photo-record').textContent(),'');
  assert.equal(new URL(target.url()).searchParams.get('footage'),'synthetic-player-anchor-0');
  await target.close();
});

test('sparse gaps, single instants and fractional share links never hold or resurrect a photo',async t=>{
  const page=await fixture(t);
  await synthetic(page);
  await ready(page,`t=20&appearance_view=photo&appearance_photo=${pairId}`);
  await photoState(page,'photo_observed');
  const time=page.locator('#replay-time'),detail=page.locator('#replay-appearance-detail');
  for(const [seconds,relation] of [['19','Before'],['20.25','Between'],['25','Between'],['31','After']]){
    await time.fill(seconds);await photoState(page,'unknown');
    assert.match(await detail.textContent(),new RegExp(relation));
    assert.equal(await page.locator('#replay-photo-samples button').count(),2);
    assert.equal(await page.locator('#replay-photo-samples [aria-pressed="true"]').count(),0);
    assert.equal(await page.locator('#replay-photo-record').textContent(),'');
    assert.equal(await page.locator('#replay-appearance-source').isVisible(),false);
  }
  await time.fill('20.25');
  await page.evaluate(()=>{
    window.photoStatusMutations=0;
    new MutationObserver(records=>window.photoStatusMutations+=records.length)
      .observe(document.querySelector('#replay-appearance-state'),{childList:true,characterData:true,subtree:true});
  });
  await time.fill('25');
  await painted(page);
  assert.equal(await page.evaluate(()=>window.photoStatusMutations),0,'An unchanged gap does not rewrite the live status');
  for(const seconds of ['20.25','20.000000001']){
    await page.goto(base+`/reconstruction.html?event=${eventId}&t=${seconds}&appearance_view=photo&appearance_photo=${pairId}`);
    await page.locator('#replay-time:not([disabled])').waitFor();
    await photoState(page,'unknown');
    const share=new URL(await page.locator('#replay-link').getAttribute('href'));
    assert.equal(share.searchParams.get('t'),seconds,'Photo sharing retains the exact fractional clock');
    assert.equal(share.searchParams.has('footage'),false);
    await page.goto(share.href);
    await page.locator('#replay-time:not([disabled])').waitFor();
    await photoState(page,'unknown');
    await page.reload();
    await page.locator('#replay-time:not([disabled])').waitFor();
    await photoState(page,'unknown');
    assert.equal(new URL(page.url()).searchParams.get('t'),seconds);
  }
  await page.locator('#replay-appearance-mode').selectOption('photo:'+singleId);
  await sampleButton(page,'sample-instant').click();
  await photoState(page,'photo_observed');
  assert.equal(await time.inputValue(),'10');
  assert.equal(await page.locator('#replay-photo-samples button').count(),1);
  assert.match(await page.locator('#replay-photo-sequence').textContent(),/no duration/);
  for(const seconds of ['9','11']){
    await time.fill(seconds);await photoState(page,'unknown');
    assert.equal(await sampleButton(page,'sample-instant').getAttribute('aria-pressed'),'false');
  }
});

test('invalid explicit photo URLs remain unavailable and never borrow video or another photo',async t=>{
  const page=await fixture(t);
  await synthetic(page,{video:true});
  for(const id of ['absent-sequence','Bad ID','']){
    const query=new URLSearchParams({t:'40',appearance_view:'photo',appearance_photo:id,
      footage:'synthetic-player-anchor-0',footage_source:sourceId});
    await ready(page,query.toString());
    await photoState(page,'unknown');
    assert.equal(await page.locator('#replay-appearance-mode').inputValue(),'unavailable-photo');
    assert.match(await page.locator('#replay-appearance-state').textContent(),/Photograph selection unavailable/);
    assert.match(await page.locator('#replay-appearance-detail').textContent(),/No source has been substituted/);
    assert.equal(await page.locator('#replay-time').inputValue(),'40','An explicit photo URL does not restore a video anchor clock');
    assert.equal(await page.locator('#replay-appearance-source').isVisible(),false);
    assert.equal(await page.locator('#replay-photo-samples button').count(),0);
    assert.equal(new URL(page.url()).searchParams.has('footage'),false);
    assert.equal(new URL(page.url()).searchParams.get('appearance_photo'),id);
    await page.reload();
    await page.locator('#replay-time:not([disabled])').waitFor();
    await photoState(page,'unknown');
    assert.equal(await page.locator('#replay-appearance-mode').inputValue(),'unavailable-photo');
  }
});

test('photo text and native controls remain available at 320px with doubled text and no WebGL',async t=>{
  const page=await fixture(t,{viewport:{width:320,height:900}});
  await page.addInitScript(()=>{
    const getContext=HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext=function(kind,...args){
      return kind==='webgl2'?null:getContext.call(this,kind,...args);
    };
  });
  const value=await synthetic(page);
  await ready(page,`t=20&appearance_view=photo&appearance_photo=${pairId}`);
  await photoState(page,'photo_observed');
  await page.evaluate(()=>{
    const nodes=[...document.querySelectorAll('#replay-appearance,#replay-appearance *')];
    const sizes=nodes.map(node=>Number.parseFloat(getComputedStyle(node).fontSize));
    nodes.forEach((node,index)=>{node.style.fontSize=`${sizes[index]*2}px`;});
  });
  await painted(page);
  assert.equal(await page.locator('#replay-appearance-canvas').isVisible(),false);
  assert.match(await page.locator('#replay-appearance-renderer-status').textContent(),/Source and coverage text remain available/);
  for(const id of ['replay-appearance-mode','replay-photo-sequence','replay-photo-record',
    'replay-appearance-source','replay-photo-original']){
    assert.equal(await page.locator('#'+id).isVisible(),true,`${id} remains readable without graphics`);
  }
  const controls=await page.locator('#replay-photo-samples button').evaluateAll(buttons=>
    buttons.map(button=>({height:button.getBoundingClientRect().height,
      width:button.getBoundingClientRect().width,parent:button.parentElement.getBoundingClientRect().width})));
  assert.equal(controls.length,2);
  for(const control of controls){
    assert.ok(control.height>=44,'Sample buttons retain a 44px minimum target');
    assert.ok(control.width<=control.parent+1,'Sample buttons wrap inside their container');
  }
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
  await sampleButton(page,'sample-second').click();
  await photoState(page,'photo_observed');
  assert.equal(await page.locator('#replay-time').inputValue(),'30');
  assert.match(await page.locator('#replay-photo-record').textContent(),/Synthetic creator/);
  assert.deepEqual(value.mediaRequests,[]);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateReportedWidths,reportedWidthAt,groundCircle,reportedWidthTag,reportedWidthCaption,SCALE_NOTE} from '../web/reported-widths-model.mjs';
import {localPoint,sceneProject} from '../web/reconstruction-model.mjs';

const bundle=JSON.parse(readFileSync(new URL('../web/data.json',import.meta.url),'utf8'));
const config=JSON.parse(readFileSync(new URL('../web/events/el-reno-2013.json',import.meta.url),'utf8'));
const manifest=bundle.reported_widths;
const copy=()=>structuredClone(manifest);
const valid=value=>validateReportedWidths(value,'el-reno-2013',config.clock);
const offset=utc=>(Date.parse(utc)-Date.parse(config.clock.start_utc))/1000;

test('the published El Reno record holds the two reported funnel widths and nothing else',()=>{
  assert.equal(valid(manifest),manifest);
  assert.deepEqual(manifest.widths.map(width=>[width.metres,width.approximate,width.start_utc,width.end_utc,width.source_id]),[
    [500,true,'2013-05-31T23:24:38Z','2013-05-31T23:24:50Z','wakimoto-2015'],
    [800,true,'2013-05-31T23:24:54Z','2013-05-31T23:25:06Z','wakimoto-2015'],
  ]);
  assert.deepEqual(manifest.widths.map(width=>[offset(width.start_utc),offset(width.end_utc)]),[[1238,1250],[1254,1266]]);
});

test('the record names the same edition of the paper as the appearance timeline',()=>{
  assert.equal(manifest.sources.length,1);
  const [source]=manifest.sources,recorded=bundle.appearance_timeline.photo_sources.find(item=>item.id===source.id);
  assert.ok(recorded,'The appearance timeline declares the same source identity.');
  assert.equal(source.url,recorded.url);
  assert.equal(source.retained_copy,recorded.original_locator);
  assert.equal(source.sha256,recorded.sha256);
  assert.deepEqual(manifest.widths.map(width=>width.locator_url),[recorded.original_locator+'#page=12',recorded.original_locator+'#page=20']);
});

test('a width applies while the whole second of the clock is inside its period, and at no other clock',()=>{
  const at=seconds=>reportedWidthAt(manifest,config.clock.start_utc,seconds)?.metres??null;
  for(const seconds of [1238,1238.5,1244,1250,1250.4,1250.999])assert.equal(at(seconds),500,`500 m at ${seconds} s`);
  for(const seconds of [1254,1260,1266,1266.999])assert.equal(at(seconds),800,`800 m at ${seconds} s`);
  for(const seconds of [0,488,1237,1237.999,1251,1252,1253.999,1267,1269,2280])assert.equal(at(seconds),null,`no width at ${seconds} s`);
  assert.equal(reportedWidthAt(null,config.clock.start_utc,1244),null);
  for(const bad of [NaN,Infinity,'1244'])assert.throws(()=>reportedWidthAt(manifest,config.clock.start_utc,bad),RangeError);
});

test('the ground circle has the reported diameter around its center and lies on the ground',()=>{
  const center=[1.25,-3.5,0];
  for(const metres of [500,800]){
    const ring=groundCircle(center,metres);
    assert.equal(ring.length,64);
    for(const point of ring){
      assert.ok(Math.abs(Math.hypot(point[0]-center[0],point[1]-center[1])-metres/2000)<1e-12);
      assert.equal(point[2],0);
    }
    const span=axis=>Math.max(...ring.map(point=>point[axis]))-Math.min(...ring.map(point=>point[axis]));
    assert.ok(Math.abs(span(0)-metres/1000)<1e-12,'East to west it measures the reported width in kilometers.');
    assert.ok(Math.abs(span(1)-metres/1000)<1e-12,'North to south it measures the same.');
  }
  for(const bad of [[[0,0],500],[[0,0,0],0],[[0,0,0],-5],[[0,0,NaN],500]])assert.throws(()=>groundCircle(...bad),RangeError);
  assert.throws(()=>groundCircle([0,0,0],500,7),RangeError);
});

test('projected through the scene camera the circle spans the reported width at the center depth',()=>{
  // Looking north, the east and west ends of the circle are as deep as its
  // center, so their distance on screen is the width times the center scale.
  // The ring has a point at each of those two ends.
  const origin=[-97.95,35.5],center=localPoint([-97.93,35.49],origin);
  const camera={azimuth:0,elevation:48,distance:8,focus:center};
  const middle=sceneProject(center,camera,1280,520);
  for(const metres of [500,800]){
    const ring=groundCircle(center,metres).map(point=>sceneProject(point,camera,1280,520));
    const span=Math.max(...ring.map(point=>point.x))-Math.min(...ring.map(point=>point.x));
    assert.ok(Math.abs(span-metres/1000*middle.scale)<1e-9,`${metres} m spans ${metres/1000} km of screen scale.`);
  }
});

test('the tag and the caption say what the circle is, where its size comes from and where it was put',()=>{
  const [first,second]=manifest.widths;
  assert.equal(reportedWidthTag(first),'Reported width, about 500 m. For scale, not a footprint.');
  assert.equal(reportedWidthTag(second),'Reported width, about 800 m. For scale, not a footprint.');
  assert.equal(reportedWidthCaption(manifest,first),
    'Dashed circle: Wakimoto and colleagues give a visible funnel width of about 500 m at 2° elevation for 23:24:38 to 23:24:50 UTC. '+
    'They found its northern edge difficult to discern. '+
    'The circle\'s center is interpolated between the NWS minute positions and was not observed. '+
    'The circle shows that size at the scale of the scene. It is not a footprint, a damage width or a wind field.');
  // A center that is a published minute position is not called interpolated.
  const published=reportedWidthCaption(manifest,second,{published:true});
  assert.ok(published.includes('Wakimoto and colleagues give a visible funnel diameter of about 800 m for 23:24:54 to 23:25:06 UTC. That passage names no elevation.'));
  assert.ok(published.includes('The circle\'s center is the NWS minute position for this clock, not a place taken from the paper.'));
  assert.equal(published.includes('interpolated'),false);
  assert.ok(published.endsWith(SCALE_NOTE));
  assert.ok(reportedWidthCaption(manifest,first,{inView:false}).endsWith(SCALE_NOTE+' The circle is outside this view.'));
});

test('a record that would let a width leave its source, its size or its period is refused',()=>{
  const statement=(index,old,next)=>value=>{
    assert.ok(value.widths[index].statement.includes(old),old);
    value.widths[index].statement=value.widths[index].statement.replace(old,next);
  };
  const cases=[
    ['another event',/different event or schema/,value=>{value.event='joplin-2011';}],
    ['an unknown top field',/different event or schema/,value=>{value.note='x';}],
    ['a different placement',/stated placement/,value=>{value.placement='surveyed_position';}],
    ['no placement note',/stated placement/,value=>{value.placement_note=' ';}],
    ['a placement note of control characters',/stated placement/,value=>{value.placement_note_published='\u001f\u001f';}],
    ['a placement note outside the basic plane',/stated placement/,value=>{value.placement_note='Placed \u{1F300}';}],
    ['no sources',/bounded source list/,value=>{value.sources=[];}],
    ['an unknown source field',/Unsupported reported width source fields/,value=>{value.sources[0].title='x';}],
    ['a repeated source',/sources need distinct identities/,value=>{value.sources.push(structuredClone(value.sources[0]));}],
    ['a source without a citation',/citation and plain HTTPS addresses/,value=>{value.sources[0].citation='';}],
    ['a plain HTTP source address',/citation and plain HTTPS addresses/,value=>{value.sources[0].url='http://doi.org/10.1175/MWR-D-15-0034.1';}],
    ['a retained copy with credentials',/citation and plain HTTPS addresses/,value=>{value.sources[0].retained_copy='https://user:secret@example.org/paper.pdf';}],
    ['a retained copy with a port',/citation and plain HTTPS addresses/,value=>{value.sources[0].retained_copy='https://example.org:99999/paper.pdf';}],
    ['a retained copy that is already a locator',/citation and plain HTTPS addresses/,value=>{value.sources[0].retained_copy+='#page=1';}],
    ['an address without its slashes',/citation and plain HTTPS addresses/,value=>{value.sources[0].url='https:doi.org/10.1175';}],
    ['a short digest',/digest of its retained copy/,value=>{value.sources[0].sha256='b0d7';}],
    ['no widths',/bounded list/,value=>{value.widths=[];}],
    ['an unknown width field',/Unsupported reported width fields/,value=>{value.widths[0].radius=250;}],
    ['a missing width field',/Unsupported reported width fields/,value=>{delete value.widths[0].limits;}],
    ['a repeated identity',/Reported widths need distinct identities/,value=>{value.widths[1].id=value.widths[0].id;}],
    ['an undeclared source',/does not declare/,value=>{value.widths[0].source_id='someone-else';}],
    ['another quantity',/quantity/,value=>{value.widths[0].quantity='damage_path_width';}],
    ['a fractional width',/whole metres/,value=>{value.widths[0].metres=500.5;}],
    ['a width stated as exact',/approximate mark/,value=>{value.widths[0].approximate=false;}],
    ['a period without seconds',/whole second UTC/,value=>{value.widths[0].start_utc='2013-05-31T23:24Z';}],
    ['a day that does not exist',/whole second UTC/,value=>{value.widths[0].start_utc='2013-05-32T23:24:38Z';}],
    ['a day the month does not have',/whole second UTC/,value=>{value.widths[0].start_utc='2013-02-30T23:24:38Z';}],
    ['a reversed period',/ordered, separate and inside/,value=>{value.widths[0].end_utc='2013-05-31T23:24:30Z';}],
    ['a period before the replay clock',/ordered, separate and inside/,value=>{value.widths[0].start_utc='2013-05-31T23:03:59Z';}],
    ['a period after the replay clock',/ordered, separate and inside/,value=>{value.widths[1].end_utc='2013-05-31T23:42:01Z';}],
    ['periods that touch',/ordered, separate and inside/,value=>{value.widths[1].start_utc='2013-05-31T23:24:50Z';}],
    ['periods out of order',/ordered, separate and inside/,value=>{value.widths.reverse();}],
    ['a statement with another size',/approximate size and its period/,statement(0,'about 500 m','about 600 m')],
    ['a statement with a larger size that ends the same',/approximate size and its period/,statement(0,'about 500 m','about 1500 m')],
    ['a statement in another unit',/approximate size and its period/,statement(0,'about 500 m','about 500 miles')],
    ['a statement that turns the size into a speed',/approximate size and its period/,statement(0,'about 500 m at','about 500 m/s at')],
    ['a statement that moves the period to another zone',/approximate size and its period/,statement(0,'23:24:50 UTC.','23:24:50 UTC+1.')],
    ['a note with a character that does not show',/stated placement/,value=>{value.placement_note='Placed\u200bhere';}],
    ['a note with a control character of the second range',/stated placement/,value=>{value.placement_note='Placed\u0085here';}],
    ['a statement that drops about',/approximate size and its period/,statement(0,'about 500 m','500 m')],
    ['a statement with another period',/approximate size and its period/,statement(0,'23:24:50','23:25:50')],
    ['a statement with its period turned round',/approximate size and its period/,statement(0,'23:24:38 to 23:24:50','23:24:50 to 23:24:38')],
    ['a locator outside the retained copy',/point into its retained source copy/,value=>{value.widths[0].locator_url='https://example.org/paper.pdf#page=12';}],
    ['a locator with no place in the copy',/point into its retained source copy/,value=>{value.widths[0].locator_url=value.sources[0].retained_copy;}],
    ['a locator with an empty place',/point into its retained source copy/,value=>{value.widths[0].locator_url=value.sources[0].retained_copy+'#';}],
    ['an impossible review date',/review date/,value=>{value.widths[0].reviewed_on='2026-02-30';}],
    ['a review month that does not exist',/review date/,value=>{value.widths[0].reviewed_on='2026-13-01';}],
  ];
  // Each case is refused for its own reason, so a missing rule cannot hide behind another.
  for(const [name,reason,change] of cases){
    const value=copy();change(value);
    assert.throws(()=>valid(value),reason,name);
  }
  for(const bad of [null,[],'record'])assert.throws(()=>valid(bad),/different event or schema/);
});

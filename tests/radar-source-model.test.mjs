import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {validateRadarSource,radarSelection,retainedGap} from '../web/radar-source-model.mjs';

const manifest=JSON.parse(await readFile(new URL('../exhibits/el-reno-2013/timeline-media.json',import.meta.url),'utf8'));
const bundleBytes=await readFile(new URL('../web/data.json',import.meta.url));
const bundledManifest=JSON.parse(bundleBytes.toString('utf8')).timeline_media;
const bundleReference=JSON.parse(await readFile(new URL('../web/events/el-reno-2013.json',import.meta.url),'utf8'));
// These identities come from the retained source intake, before this reader.
const retained=[
  [151,'230137','04131221cc0a961e12107b7155dbff638e4ac5e370f4936fcb9d7ac251e00070'],
  [154,'230510','54e73592caa0232558d2b53872ce6926076b36de4f7b02578957fa3899ef459c'],
  [157,'230843','03ba2de5aa4f5e02eb14f0803974d289eeb12ec324f424d5a4fcb78f61c597ee'],
  [160,'231216','8e24900351a543c8743816015faca10985ae24d440286422c4cfb5da1ffe985b'],
  [163,'231549','155a33cf3963126f10d2e794f209030f1ec4301354be5350745f8f92af51d0ab'],
  [166,'231922','c13901e692f71f6f2f19138ae31fb8048da95cd6ffbd8876fd2f471d2ea4ef94'],
  [169,'232256','39da6714f42f9f616b5f7a1faa4dac9af7609f87289dd020a3a1da08c712cb33'],
  [172,'232629','88548ba2a48fba7fb4451181f78e9bf4b2d6ac041f842b176440ea0818b62664'],
  [175,'233002','6fcf88cc04de9081cc4b3ed0fa3161559228c0c9374b2a098eb505f1cd9bfd42'],
  [178,'233335','6b0142e359246cd8b0f4892d3e24f297e75911a1ff3fa98b753711237b2d35d0'],
  [181,'233708','3caf587ba8832f9530e01a06be07ae9329f8ddb5e8cfe80fe4eb03862aa1c8b8'],
  [184,'234051','289307ddda63ded56ecfc55922b414a650c705061f6e7c6c3351eaa9c80743e2'],
];

function freeze(value){
  if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}
  return value;
}

test('the reader preserves all twelve independently retained full source identities',async()=>{
  assert.equal(validateRadarSource(manifest),manifest);
  assert.equal(manifest.schema,1);assert.equal(manifest.event,'el-reno-2013');
  assert.equal(manifest.max_age_seconds,240);assert.equal(manifest.frames.length,12);
  assert.equal(manifest.original_sha256,'2c8ec05523dd1db897c38b67daae0f6770921135c6ddc2e34735bc40dfa93a7a');
  for(const [index,[id,clock,sha]] of retained.entries()){
    const row=manifest.frames[index],file=`assets/el-reno-2013/radar/frame-${id}.png`;
    assert.equal(row.frame_index,id);assert.equal(row.file,file);assert.equal(row.sha256,sha);
    assert.equal(row.source_label,`wseNWRT_Reflectivity_20130531-${clock}_00.51.png`);
    assert.equal(row.utc,`2013-05-31T${clock.slice(0,2)}:${clock.slice(2,4)}:${clock.slice(4)}+00:00`);
    const bytes=await readFile(new URL('../web/'+file,import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'),sha);
    assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
    assert.equal(bytes.readUInt32BE(16),597);assert.equal(bytes.readUInt32BE(20),599);
  }
});

test('validating or selecting a frozen source does not rewrite its evidence',()=>{
  const source=freeze(structuredClone(manifest)),before=JSON.stringify(source);
  assert.equal(validateRadarSource(source),source);
  assert.deepEqual(radarSelection(source,'163'),{index:4,unknown:false});
  assert.equal(retainedGap(source,6),214);
  assert.equal(JSON.stringify(source),before);
});

test('the current verified bundle preserves the same twelve literal radar source records',()=>{
  const byteIdentity=createHash('sha256').update(bundleBytes).digest('hex');
  assert.equal(byteIdentity,bundleReference.bundle_sha256);
  const source=freeze(structuredClone(bundledManifest)),before=JSON.stringify(source);
  assert.equal(validateRadarSource(source),source);
  assert.deepEqual(source.frames,manifest.frames,'Current bundle and raw intake share the same radar records');
  for(const [index,[id,clock,sha]] of retained.entries()){
    const row=source.frames[index];assert.equal(row.frame_index,id);assert.equal(row.sha256,sha);
    assert.equal(row.utc,`2013-05-31T${clock.slice(0,2)}:${clock.slice(2,4)}:${clock.slice(4)}+00:00`);
    assert.deepEqual(radarSelection(source,String(id)),{index,unknown:false});
  }
  assert.deepEqual(source.frames.map((_,index)=>retainedGap(source,index)),[null,213,213,213,213,213,214,213,213,213,213,223]);
  assert.equal(JSON.stringify(source),before);assert.equal(createHash('sha256').update(bundleBytes).digest('hex'),byteIdentity);
});

test('malformed manifests are rejected without repairing or inheriting another observation',()=>{
  const mutations=[
    m=>m.schema=2,m=>m.event='joplin-2011',m=>m.max_age_seconds=241,
    m=>m.max_age_seconds='240',m=>m.frames=null,m=>m.frames.pop(),
    m=>m.frames.push(structuredClone(m.frames.at(-1))),m=>m.frames.reverse(),
    m=>m.frames[1].frame_index=151,m=>m.frames[1].frame_index='154',
    m=>m.frames[1].frame_index=155,m=>m.frames[1].utc='not a time',
    m=>m.frames[1].utc='2013-05-31T23:01:37+00:00',
    m=>m.frames[1].utc='2013-05-31T23:05:11+00:00',
    m=>m.frames[1].utc='2013-02-30T23:05:10+00:00',
    m=>m.frames[1].source_label=m.frames[0].source_label,
    m=>m.frames[1].source_label='wseNWRT_Reflectivity_20130531-236010_00.51.png',
    m=>m.frames[1].file=m.frames[0].file,
    m=>m.frames[1].file='https://example.invalid/frame-154.png',
    m=>m.frames[1].file='assets/el-reno-2013/radar/../frame-154.png',
    m=>m.frames[1].sha256='short',m=>m.frames[1].sha256='g'.repeat(64),
    m=>delete m.frames[1].sha256,
  ];
  for(const [index,mutate] of mutations.entries()){
    const source=structuredClone(manifest);mutate(source);const before=JSON.stringify(source);
    assert.throws(()=>validateRadarSource(source),`Malformed source ${index} is refused`);
    assert.throws(()=>radarSelection(source,'151'),`Selection cannot bypass malformed source ${index}`);
    assert.equal(JSON.stringify(source),before,`Rejected source ${index} remains unchanged`);
  }
  for(const source of [null,undefined,[],{},'manifest'])assert.throws(()=>validateRadarSource(source));
});

test('only canonical retained frame query strings select an observation',()=>{
  for(const [index,[id]] of retained.entries())assert.deepEqual(radarSelection(manifest,String(id)),{index,unknown:false});
  for(const missing of [null,undefined])assert.deepEqual(radarSelection(manifest,missing),{index:0,unknown:false});
  for(const raw of ['', '0151','+151',' 151','151 ','151.0','1.51e2','0x97','151x','152','999',151,0,NaN,[],{},true]){
    assert.deepEqual(radarSelection(manifest,raw),{index:0,unknown:true},`Invalid selection ${String(raw)} falls back explicitly`);
  }
  assert.deepEqual(radarSelection(manifest,'184'),{index:11,unknown:false});
  assert.deepEqual(radarSelection(manifest,'unknown'),{index:0,unknown:true},'An invalid request cannot borrow the previous valid selection');
});

test('retained gaps use irregular printed source times and never the display dwell',()=>{
  const gaps=[null,213,213,213,213,213,214,213,213,213,213,223];
  assert.deepEqual(manifest.frames.map((_,index)=>retainedGap(manifest,index)),gaps);
  assert.equal(gaps.slice(1).reduce((total,gap)=>total+gap,0),2354);
  for(const index of [-1,12,151,1.5,NaN,Infinity,'1',null,undefined]){
    assert.throws(()=>retainedGap(manifest,index),RangeError,'Gap selection uses an array ordinal, not a source frame number');
  }
});

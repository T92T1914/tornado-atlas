import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {comparisonChoices,comparisonEntries,comparisonRoute} from '../web/evidence-comparison.mjs';

const index=JSON.parse(await readFile(new URL('../web/archive/index.json',import.meta.url),'utf8'));
const entry=index.events.find(event=>event.id==='joplin-2011');
const doc=JSON.parse(await readFile(new URL('../web/'+entry.file,import.meta.url),'utf8'));
const history=JSON.parse(await readFile(new URL('../web/'+entry.history_file,import.meta.url),'utf8'));
const revision=history.current_dossier_sha256;
const keys=['media:friskey-joplin-storm','media:nws-joplin-aftermath'];

test('comparison joins exact retained evidence and sources without rewriting clocks or assertions',()=>{
  const before=JSON.stringify(doc),rows=comparisonEntries(doc,keys);
  assert.deepEqual(rows.map(row=>row.key),keys);
  for(const row of rows){
    assert.equal(row.item,doc.media.find(item=>item.id===row.item.id));
    assert.equal(row.source,doc.sources.find(source=>source.id===row.item.source_id));
    assert.equal(row.item.status.temporal,'unregistered');
    assert.equal(row.item.time.alignment,null);
  }
  assert.match(rows[0].item.limits,/inception field says March 21, 2025/);
  assert.match(rows[1].item.time.capture.reported,/unverified clock and time zone/);
  assert.equal(JSON.stringify(doc),before);
});

test('native form blanks are ignored while invalid, duplicate and foreign choices fail closed',()=>{
  assert.equal(comparisonEntries(doc,['',keys[0],'',keys[1]]).length,2);
  assert.equal(comparisonEntries(doc,[keys[0]]).length,1);
  for(const invalid of [[keys[0],keys[0]],['observation:blackwell-clocks'],['source:whatever'],
    ['media:<img src=x>'],['media:../index'],Array(5).fill(''),[null],'media:friskey-joplin-storm']){
    assert.throws(()=>comparisonEntries(doc,invalid));
  }
});

test('comparison routes retain exact revision, typed identity and selection order',()=>{
  const route=new URL(comparisonRoute(doc,revision,keys),'https://example.test/');
  assert.equal(route.pathname,'/dossier.html');
  assert.equal(route.searchParams.get('event'),doc.id);
  assert.equal(route.searchParams.get('revision'),revision);
  assert.deepEqual(route.searchParams.getAll('compare'),keys);
  assert.equal(route.hash,'#evidence-comparison');
  assert.deepEqual(new URL(comparisonRoute(doc,revision),'https://example.test/').searchParams.getAll('compare'),[]);
  for(const invalid of ['',undefined,'0'.repeat(63),'../archive/index.json'])assert.throws(()=>comparisonRoute(doc,invalid,keys));
  assert.throws(()=>comparisonRoute({...doc,id:'../joplin'},revision,keys));
});

test('an absent source cannot borrow a replacement account',()=>{
  const changed=structuredClone(doc),sourceId=changed.media.find(item=>item.id==='friskey-joplin-storm').source_id;
  changed.sources=changed.sources.filter(source=>source.id!==sourceId);
  assert.throws(()=>comparisonEntries(changed,keys),/source.*absent/);
});

test('inspection, availability and candidate dimensions remain separate in comparison',()=>{
  const changed=structuredClone(doc),item=changed.media.find(item=>item.id==='friskey-joplin-storm');
  item.status.intake='candidate';item.status.availability='unavailable';item.status.rights='unknown';
  const selected=comparisonEntries(changed,keys)[0];
  assert.equal(selected.item.status.intake,'candidate');
  assert.equal(selected.item.status.availability,'unavailable');
  assert.equal(selected.item.status.rights,'unknown');
  assert.equal(comparisonChoices(doc).length,doc.observations.length+doc.media.length);
});

test('retained revisions cannot substitute current-only media',async()=>{
  const old=history.versions.find(version=>version.dossier_sha256!==revision);
  const retained=JSON.parse(await readFile(new URL('../web/'+old.file,import.meta.url),'utf8'));
  assert.equal(retained.media.some(item=>item.id==='friskey-joplin-storm'),false);
  assert.throws(()=>comparisonEntries(retained,keys),/not in this dossier version/);
});

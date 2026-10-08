import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {preparePositions} from '../web/playback-model.mjs';
import {replayChapters,chapterAt,adjacentChapter} from '../web/replay-context-model.mjs';
import {issuedAt} from '../web/documentary-model.mjs';

const bundle=JSON.parse(await readFile(new URL('../web/data.json',import.meta.url),'utf8'));
const positions=preparePositions(bundle.geometry.features.filter(feature=>feature.geometry.type==='Point'));
const start=positions[0].stamp,chapters=replayChapters(bundle.history,positions,start);

test('source chapter labels remain distinct from published map seek minutes',()=>{
  assert.deepEqual(chapters.map(chapter=>chapter.mapSeconds),[0,300,900,1200,1380,1860,2280]);
  assert.equal(chapters[0].time,'6:03 PM CDT');
  assert.equal(chapters[0].mapTime,'6:04 PM CDT');
  assert.match(chapters.at(-1).time,/6:42 \/ 6:44/);
  assert.equal(chapterAt(chapters,299).title,chapters[0].title);
  assert.equal(chapterAt(chapters,300).title,'An eastward turn');
  assert.equal(chapterAt(chapters,1199).title,'Crossing Highway 81');
  assert.equal(chapterAt(chapters,1200).title,'Maximum size');
  assert.equal(chapterAt(chapters,2280).title,'The ending remains inconsistent');
  assert.equal(adjacentChapter(chapters,301,-1).mapSeconds,300);
  assert.equal(adjacentChapter(chapters,300,-1).mapSeconds,0);
  assert.equal(adjacentChapter(chapters,300,1).mapSeconds,900);
  assert.equal(adjacentChapter(chapters,2280,1),null);
});

test('a missing or ambiguous published map minute cannot become a chapter seek',()=>{
  const missing=replayChapters(bundle.history,positions.filter(point=>point.properties.source_name!=='6:09'),start);
  assert.equal(missing[1].mapSeconds,null);
  const duplicate=replayChapters(bundle.history,[...positions,structuredClone(positions[0])],start);
  assert.equal(duplicate[0].mapSeconds,null);
  assert.equal(chapterAt(duplicate,0),null);
  assert.deepEqual(replayChapters(null,positions,start),[]);
  assert.throws(()=>chapterAt(chapters,NaN),RangeError);
});

test('latest reviewed bulletin follows issue time, including one millisecond before a transition',()=>{
  const warnings=bundle.documentary.warnings;
  const before=issuedAt(warnings,'2013-05-31T23:07:59.999Z').at(-1);
  const at=issuedAt(warnings,'2013-05-31T23:08:00Z').at(-1);
  assert.equal(before.id,'bulletin-2250');
  assert.equal(at.id,'bulletin-2308');
  assert.equal(issuedAt(warnings,'2013-05-31T23:17:00Z').at(-1).id,'bulletin-2317');
  assert.equal(issuedAt(warnings,'2013-05-31T23:16:59.999Z').at(-1).id,'bulletin-2308');
  assert.equal(issuedAt(warnings,'2013-05-31T23:04:00Z').at(-1).id,'bulletin-2250');
});

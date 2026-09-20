import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {frameAt,localStamp} from '../web/timeline-media-model.mjs';
const manifest=JSON.parse(fs.readFileSync(new URL('../exhibits/el-reno-2013/timeline-media.json',import.meta.url)));
const frames=manifest.frames;
test('selection never shows a future frame and expires across a gap',()=>{
  assert.equal(frameAt(frames,'2013-05-31T23:01:36Z',240),null);
  assert.equal(frameAt(frames,'2013-05-31T23:01:37Z',240).ageSeconds,0);
  assert.equal(frameAt(frames,'2013-05-31T23:44:51Z',240).ageSeconds,240);
  assert.equal(frameAt(frames,'2013-05-31T23:44:52Z',240),null);
  assert.equal(frameAt([frames[0],frames.at(-1)],'2013-05-31T23:20:00Z',240),null);
});
test('all current map positions have preceding radar with explicit age',()=>{
  const geo=JSON.parse(fs.readFileSync(new URL('../exhibits/el-reno-2013/path.geojson',import.meta.url)));
  for(const point of geo.features.filter(f=>f.geometry.type==='Point')) {
    const match=frameAt(frames,point.properties.utc,240);
    assert.ok(match && match.ageSeconds>=0 && match.ageSeconds<=240);
  }
});
test('UTC is displayed as event-local CDT, independent of viewer time zone',()=>{
  assert.equal(localStamp('2013-05-31T23:19:22Z'),'6:19:22 PM CDT');
  assert.throws(()=>frameAt(frames,'invalid',240),RangeError);
  assert.throws(()=>frameAt(frames,'2013-05-31T23:04:00Z',-1),RangeError);
});

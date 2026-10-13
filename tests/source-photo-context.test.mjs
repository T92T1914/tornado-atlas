import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validateAppearanceTimeline,appearanceAt} from '../web/appearance-timeline-model.mjs';

const timeline=JSON.parse(await readFile(new URL('../exhibits/el-reno-2013/appearance-timeline.json',import.meta.url),'utf8'));
const config=JSON.parse(await readFile(new URL('../exhibits/el-reno-2013/replay.json',import.meta.url),'utf8'));
const footage=JSON.parse(await readFile(new URL('../exhibits/el-reno-2013/footage.json',import.meta.url),'utf8'));
const cases=JSON.parse(await readFile(new URL('fixtures/source-photo-context-cases.json',import.meta.url),'utf8'));
function fixture(){return structuredClone({...timeline,windows:[],photo_sequences:[timeline.photo_sequences.find(s=>s.id==='nolte-reported-stills')]});}
const validate=t=>validateAppearanceTimeline(t,t.event,config.clock,footage);

test('source context preserves observed clock reading precision and legacy photo labels',()=>{
 const value=fixture();assert.equal(validate(value),value);const samples=value.photo_sequences[0].samples;
 assert.equal(samples[0].reported_utc,'2013-05-31T23:10:37Z');
 assert.equal(samples[0].source_comparison.printed_utc,'2013-05-31T23:10:37.254Z');
 assert.equal(samples[0].source_comparison.exposure_identity,'unknown');
 assert.equal(samples[1].source_comparison.reading_precision,'whole_second_label_readable');
 assert.equal(samples[1].source_comparison.printed_clock,'23:10:59');
 for(const sample of samples)assert.equal(sample.partial_form,null);
 assert.equal(Object.hasOwn(samples[2],'source_comparison'),false);
 assert.equal(Object.hasOwn(samples[3],'source_comparison'),false);
 const legacy=fixture();for(const s of legacy.photo_sequences[0].samples)delete s.source_comparison;
 assert.equal(validate(legacy),legacy);legacy.schema_version=3;assert.equal(validate(legacy),legacy);
 const old=fixture();old.schema_version=3;assert.throws(()=>validate(old));
});

test('source context rejects unsupported exposure, precision, publication and numerical claims',()=>{
 for(const c of cases.invalid){const value=fixture(),comparison=value.photo_sequences[0].samples[0].source_comparison;
  for(const change of c.changes??[c]){let target=comparison;for(const part of change.path.slice(0,-1))target=target[part];target[change.path.at(-1)]=change.value;}
  assert.throws(()=>validate(value),undefined,c.name);
 }
 for(const replacement of [null,[],false]){const value=fixture();value.photo_sequences[0].samples[0].source_comparison=replacement;assert.throws(()=>validate(value));}
 for(const bad of [NaN,Infinity,-Infinity]){const value=fixture();value.photo_sequences[0].samples[0].source_comparison.callback_seconds=bad;assert.throws(()=>validate(value));}
 const duplicate=fixture();duplicate.photo_sequences[0].samples[1].source_comparison.id=duplicate.photo_sequences[0].samples[0].source_comparison.id;assert.throws(()=>validate(duplicate));
});

test('source context cannot widen photo instants or supply geometry between observations',()=>{
 const value=fixture();validate(value);const seq=value.photo_sequences[0],origin=Date.parse(config.clock.start_utc);
 const seconds=s=>(Date.parse(s.reported_utc)-origin)/1000;
 for(const sample of seq.samples){const at=seconds(sample),state=appearanceAt(value,at,config.clock.start_utc,{kind:'photo',id:seq.id});
  assert.equal(state.state,'photo_observed');assert.equal(state.sample,sample);
  assert.equal(state.shape,null);assert.equal(state.extent,null);assert.equal(state.partialForm,null);
  for(const delta of [-.001,.001,.254]){const gap=appearanceAt(value,at+delta,config.clock.start_utc,{kind:'photo',id:seq.id});
   assert.equal(gap.state,'unknown');assert.equal(gap.shape,null);assert.equal(gap.extent,null);assert.equal(gap.partialForm,null);
  }
 }
 assert.deepEqual(value.windows,[]);
});

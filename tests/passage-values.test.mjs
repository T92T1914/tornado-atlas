import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {samplePassage,MPH,loadAt} from '../web/wind-model.mjs';
import {componentHistory} from '../web/component-model.mjs';
import {passageValueRows,rowCells,renderSampleRows,assumptionText} from '../web/passage-values.mjs';
import {defaultExperiment,replaceBlock,start,end} from '../tools/build_wind_sample_table.mjs';

const html=await readFile(new URL('../web/wind.html',import.meta.url),'utf8');
const experiment=defaultExperiment(html);
function calculated(field,capacity=1000,threshold=50*MPH) {
  const result=samplePassage(field,{threshold});
  return {field,capacity,threshold,result,component:componentHistory(result.samples,{...field,capacity})};
}

test('all 481 public default rows match the current input defaults and existing equations',()=>{
  assert.equal(replaceBlock(html),html);
  const body=html.match(/<tbody id="sampled-values-body">([\s\S]*?)<\/tbody>/)[1];
  const rows=[...body.matchAll(/<tr id="passage-sample-(\d+)"[^>]*>(.*?)<\/tr>/g)];
  assert.equal(rows.length,481);
  for(const [index,row] of rows.entries()) {
    assert.equal(Number(row[1]),index);
    const sample=experiment.result.samples[index],state=experiment.component.states[index];
    const raw=[...row[2].matchAll(/<td data-value="([^"]+)">([^<]+)<\/td>/g)];
    assert.equal(raw.length,6);
    const expected=[sample.time,sample.speed/MPH,sample.speed,
      loadAt(sample.speed,experiment.field).pressure/1000,state.force/1000,state.ratio];
    assert.deepEqual(raw.map(value=>Number(value[1])),expected);
    assert.match(row[2],state.failed?/Failed under this rule/:/Capacity not exceeded so far/);
  }
});

test('numeric readings follow changed area, capacity and travel without changing physics',()=>{
  const a=calculated(experiment.field),b=calculated({...experiment.field,area:2,travel:experiment.field.travel*2},2000);
  const left=passageValueRows(a.result,a.component,a.field),right=passageValueRows(b.result,b.component,b.field);
  for(let index=0;index<481;index++) {
    assert.equal(left[index].values[0],right[index].values[0]*2);
    assert.equal(left[index].values[1],right[index].values[1]);
    assert.equal(left[index].values[4]*2,right[index].values[4]);
    assert.equal(left[index].values[5],right[index].values[5]);
    assert.equal(left[index].failed,right[index].failed);
  }
});

test('nominal spacing follows model time and changed travel with independent expected labels',()=>{
  assert.equal(experiment.result.samples.length,481);
  assert.match(assumptionText(experiment),/Nominal spacing is approximately 0\.284 model seconds between samples/);
  for(const [travel,label]of [[60,'0.142'],[80,'0.107']]) {
    const changed=calculated({...experiment.field,travel:travel*MPH});
    assert.equal(changed.result.samples.length,481);
    assert.ok(assumptionText(changed).includes(`Nominal spacing is approximately ${label} model seconds between samples`));
  }
  assert.match(html,/Nominal spacing is approximately 0\.284 model seconds between samples/);
  assert.match(html,/A brief peak or capacity exceedance can fall between samples/);
});

test('strict equality stays intact while later failure persists and earlier samples rewind',()=>{
  const field={...experiment.field,peak:50,radius:100,travel:10,offset:0,area:1,coefficient:1};
  const preliminary=calculated(field);
  const peak=preliminary.component.peak;
  const equal=calculated(field,peak);
  assert.equal(equal.component.firstFailureIndex,null);
  assert.ok(passageValueRows(equal.result,equal.component,field).every(row=>!row.failed));
  const exceeded=calculated(field,peak*.9);
  const rows=passageValueRows(exceeded.result,exceeded.component,field);
  const first=exceeded.component.firstFailureIndex;
  assert.ok(first>0);
  assert.equal(rows[first-1].failed,false);
  assert.equal(rows[first].failed,true);
  assert.equal(rows.at(-1).failed,true);
});

test('complete default route rejects a missing sample or mismatched component clock',()=>{
  assert.throws(()=>passageValueRows({...experiment.result,samples:experiment.result.samples.slice(1)},experiment.component,experiment.field),RangeError);
  const states=experiment.component.states.map(state=>({...state}));
  states[240].time+=1;
  assert.throws(()=>passageValueRows(experiment.result,{...experiment.component,states},experiment.field),RangeError);
  states[240]={...experiment.component.states[240],ratio:NaN};
  assert.throws(()=>passageValueRows(experiment.result,{...experiment.component,states},experiment.field),RangeError);
});

test('stale default rows and changed controls are detected by the finite generator',()=>{
  const stale=html.replace('data-value="'+experiment.result.samples[240].time+'"','data-value="123456"');
  assert.notEqual(replaceBlock(stale),stale);
  const changed=html.replace('id="travel" type="range" min="5" max="80" step="5" value="30"',
    'id="travel" type="range" min="5" max="80" step="5" value="60"');
  assert.notEqual(changed,html);
  assert.notEqual(replaceBlock(changed),changed);
  assert.throws(()=>replaceBlock(html.replace(start,'')),/One ordered/);
  assert.throws(()=>replaceBlock(html.replace(end,'')),/One ordered/);
  assert.throws(()=>defaultExperiment(html.replace('id="capacity"','id="other-capacity"')),/One default input/);
});

test('rounded displays and complete sample labels preserve unrounded state distinctions',()=>{
  const row={index:480,values:[1.23456,99.999,44.704,1.22457,1.0004,1.0004],failed:true};
  assert.deepEqual(rowCells(row).map(cell=>cell.text),['1.23','100.00','44.70','1.225','1.000','1.000']);
  const markup=renderSampleRows([row]);
  assert.match(markup,/data-value="1.0004">1.000<\/td>/);
  assert.match(markup,/Failed under this rule/);
  assert.match(markup,/<th scope="row">481<\/th>/);
  assert.match(html,/State uses unrounded force/);
  assert.match(html,/Equality does not fail/);
});

test('public assumptions retain units, finite model window and separate playback scope',()=>{
  const text=assumptionText(experiment);
  for(const label of ['100.0 mph','500 ft','30.0 mph','1.225 kg/m³','1.0 kN','481 samples','-6 R to +6 R'])assert.ok(text.includes(label));
  assert.match(html,/zero at closest approach/);
  assert.match(html,/24 display seconds independently/);
  assert.match(html,/The finite window omits winds outside it/);
  assert.match(html,/independent of the historical storms/);
  assert.match(html,/role="region" tabindex="0" aria-label="Complete sampled passage values"/);
});

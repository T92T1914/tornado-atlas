import test from 'node:test';
import assert from 'node:assert/strict';
import {formAt,EXAMPLE_KEYS} from '../web/evolution-model.mjs';
import {PRESETS} from '../web/vortex-model.mjs';
test('key boundaries reproduce the authored forms and extents',()=>{
  for(const key of EXAMPLE_KEYS) {
    const result=formAt(key.at);
    assert.equal(result.extent,key.extent);
    for(const name of ['base','flare','bend']) assert.equal(result.shape[name],PRESETS[key.shape][name]);
  }
});
test('intermediate geometry is bounded and reversible without random drift',()=>{
  const expected=formAt(.48);formAt(.95);assert.deepEqual(formAt(.48),expected);
  for(let i=0;i<=1000;i++) {
    const f=formAt(i/1000);
    assert.ok(f.extent>=.4 && f.extent<=1);
    assert.ok(f.shape.base>=.065 && f.shape.base<=1.35);
    assert.ok(Number.isFinite(f.shape.bend));
  }
});
test('bad sequence keys and positions fail rather than inventing a form',()=>{
  for(const p of [-1,2,NaN]) assert.throws(()=>formAt(p),RangeError);
  assert.throws(()=>formAt(.5,[EXAMPLE_KEYS[1],EXAMPLE_KEYS[3]]),RangeError);
  assert.throws(()=>formAt(.5,[EXAMPLE_KEYS[0],{...EXAMPLE_KEYS[3],shape:'ef5'}]),RangeError);
});

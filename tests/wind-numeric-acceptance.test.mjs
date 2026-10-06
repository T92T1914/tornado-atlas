import test from 'node:test';
import assert from 'node:assert/strict';
import {assertSampledWindNumbers} from './wind-numeric-acceptance.mjs';

const expected=[-68.18181818181819,16.43989873053573,7.349292328498693,
  0.033082409859459476,0.03969889183135137,0.03969889183135137];
const hosted=[-68.18181818181819,16.43989873053573,7.349292328498692,
  0.03308240985945946,0.039698891831351356,0.039698891831351356];
function changed(column,value) {const row=[...expected];row[column]=value;return row;}
function adjacent(value,steps) {
  const view=new DataView(new ArrayBuffer(8));view.setFloat64(0,value,false);
  view.setBigUint64(0,view.getBigUint64(0,false)+BigInt(steps),false);
  return view.getFloat64(0,false);
}

test('the retained hosted one- and two-step numerical differences are accepted',()=>{
  assertSampledWindNumbers(hosted,expected,'Retained hosted row');
  assertSampledWindNumbers(expected,expected);
});

test('each calculated column accepts at most eight adjacent binary64 values',()=>{
  for(let column=1;column<6;column++) {
    for(const steps of [-8,8])assertSampledWindNumbers(changed(column,adjacent(expected[column],steps)),expected);
    for(const steps of [-9,9])assert.throws(()=>assertSampledWindNumbers(changed(column,adjacent(expected[column],steps)),expected),
      {name:'AssertionError',message:/9 binary64 steps exceeds 8/});
  }
});

test('sample time remains exact even when a change is one representable value',()=>{
  assert.throws(()=>assertSampledWindNumbers(changed(0,adjacent(expected[0],1)),expected),
    {name:'AssertionError',message:/model time \(s\): exact value required/});
});

test('a changed load hidden by the same displayed decimals still fails',()=>{
  const altered=expected[4]+1e-12;
  assert.equal(altered.toFixed(3),expected[4].toFixed(3));
  assert.throws(()=>assertSampledWindNumbers(changed(4,altered),expected),
    {name:'AssertionError',message:/drag \(kN\).*binary64 steps exceeds 8/});
});

test('nonfinite numbers and malformed numeric cells fail in every column',()=>{
  for(let column=0;column<6;column++)for(const value of [NaN,Infinity,-Infinity,undefined,'0'])
    assert.throws(()=>assertSampledWindNumbers(changed(column,value),expected),
      {name:'AssertionError',message:/finite numbers required/});
  assert.throws(()=>assertSampledWindNumbers(expected.slice(1),expected),/all six numeric cells required/);
  assert.throws(()=>assertSampledWindNumbers(expected,expected.slice(1)),/all six reference cells required/);
});

test('mph versus m/s and kPa or kN versus base SI units cannot pass',()=>{
  for(const [column,value] of [[1,expected[2]],[2,expected[1]],[3,expected[3]*1000],
    [4,expected[4]*1000],[5,expected[5]/1000]])
    assert.throws(()=>assertSampledWindNumbers(changed(column,value),expected),
      {name:'AssertionError',message:/binary64 steps exceeds 8/});
});

test('negative loads and nonzero replacements for an exact zero fail',()=>{
  for(let column=1;column<6;column++) {
    assert.throws(()=>assertSampledWindNumbers(changed(column,-expected[column]),expected),
      {name:'AssertionError',message:/nonnegative calculated values required/});
    const zero=[...expected];zero[column]=0;
    const tiny=[...zero];tiny[column]=Number.MIN_VALUE;
    assert.throws(()=>assertSampledWindNumbers(tiny,zero),{name:'AssertionError',message:/exact value required/});
  }
});

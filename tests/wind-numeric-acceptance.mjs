import assert from 'node:assert/strict';

// Test-only binary64 allowance for values computed in different JS engines.
// The retained hosted mismatch is one step in wind and two in derived loads.
// Eight adjacent representable values leave a small margin for that arithmetic,
// without decimal rounding, an absolute-error floor or a tolerance on state.
export const MAX_WIND_SAMPLE_ULPS=8n;
const fields=['model time (s)','wind (mph)','wind (m/s)','pressure (kPa)','drag (kN)','load / capacity'];
const bits=new DataView(new ArrayBuffer(8));
function positiveBits(value) {
  bits.setFloat64(0,value,false);
  return bits.getBigUint64(0,false);
}

export function assertSampledWindNumbers(actual,expected,label='Wind sample') {
  assert.ok(Array.isArray(actual)&&Array.isArray(expected),`${label}: numeric arrays required`);
  assert.equal(actual.length,6,`${label}: all six numeric cells required`);
  assert.equal(expected.length,6,`${label}: all six reference cells required`);
  for(const [index,value] of actual.entries()) {
    const reference=expected[index],cell=`${label}, ${fields[index]}`;
    assert.ok(Number.isFinite(value)&&Number.isFinite(reference),`${cell}: finite numbers required`);
    // The sampling clock and exact zero remain identity checks.
    if(index===0||reference===0) {assert.equal(value,reference,`${cell}: exact value required`);continue;}
    assert.ok(value>=0&&reference>=0,`${cell}: nonnegative calculated values required`);
    const left=positiveBits(value),right=positiveBits(reference);
    const distance=left>right?left-right:right-left;
    assert.ok(distance<=MAX_WIND_SAMPLE_ULPS,
      `${cell}: ${distance} binary64 steps exceeds ${MAX_WIND_SAMPLE_ULPS}; actual ${value}, expected ${reference}`);
  }
}

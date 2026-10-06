import assert from 'node:assert/strict';

// Compare a table with the pure model in the same calculation realm.
// Browser calculations use the tested engine. Static fallback rows use their
// Node generator. This is exact consumer agreement, not cross-engine accuracy.
const fields=['model time (s)','wind (mph)','wind (m/s)','pressure (kPa)','drag (kN)','load / capacity'];

export function assertSampledWindNumbers(actual,expected,label='Wind sample') {
  assert.ok(Array.isArray(actual)&&Array.isArray(expected),`${label}: numeric arrays required`);
  assert.equal(actual.length,6,`${label}: all six numeric cells required`);
  assert.equal(expected.length,6,`${label}: all six reference cells required`);
  for(const [index,value] of actual.entries()) {
    const reference=expected[index],cell=`${label}, ${fields[index]}`;
    assert.ok(Number.isFinite(value)&&Number.isFinite(reference),`${cell}: finite numbers required`);
    if(index>0)assert.ok(value>=0&&reference>=0,`${cell}: nonnegative calculated values required`);
    assert.equal(value,reference,`${cell}: exact same-realm value required`);
  }
}

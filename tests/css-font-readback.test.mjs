import test from 'node:test';
import assert from 'node:assert/strict';
import {CSS_FONT_READBACK_PRECISION_PX,isDoubledFontReadback} from './browser/css-font-readback.mjs';

const reading=(overrides={})=>({before:16,requested:32,authored:'32px',inline:'32px',actual:32,...overrides});

test('CSS font readback accepts exact enlargement and observed serialization differences',()=>{
  assert.equal(CSS_FONT_READBACK_PRECISION_PX,0.001);
  for(const value of [
    reading(),
    reading({before:38.400002,requested:76.800004,authored:'76.800004px',inline:'76.8px',actual:76.800003}),
    reading({before:84.48,requested:168.96,authored:'168.96px',inline:'168.96px',actual:168.960001}),
    reading({actual:32.0005,inline:'32.0005px'})
  ])assert.equal(isDoubledFontReadback(value),true,JSON.stringify(value));
});

test('CSS font readback rejects wrong scale, unchanged text and missing authored targets',()=>{
  for(const value of [
    reading({actual:24}),
    reading({actual:16}),
    reading({actual:32.002}),
    reading({requested:31.999,authored:'31.999px',inline:'31.999px',actual:31.999}),
    reading({authored:'24px'}),
    reading({authored:'calc(16px * 2)'}),
    reading({inline:'24px'}),
    reading({inline:''}),
    reading({inline:'32em'}),
    reading({inline:'32px trailing'}),
    reading({before:0.0001,requested:0.0002,authored:'0.0002px',inline:'0.0002px',actual:0.0001})
  ])assert.equal(isDoubledFontReadback(value),false,JSON.stringify(value));
});

test('CSS font readback requires finite positive baseline, target and observation',()=>{
  for(const field of ['before','requested','actual'])for(const value of [NaN,Infinity,-Infinity,0,-1]){
    assert.equal(isDoubledFontReadback(reading({[field]:value})),false,field+': '+String(value));
  }
  assert.equal(isDoubledFontReadback(reading({inline:'NaNpx'})),false);
  assert.equal(isDoubledFontReadback(reading({inline:'Infinitypx'})),false);
  assert.equal(isDoubledFontReadback(null),false);
});

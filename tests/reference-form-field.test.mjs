import test from 'node:test';
import assert from 'node:assert/strict';
import {referenceNoiseAt,referenceNoiseLattice} from '../web/reference-form-model.mjs';

test('reference noise is finite, periodic on all axes and continuous across the retained seam',()=>{
  for(const p of [[0,0,0],[-.001,2.7,31.9],[3.2,-9.1,4.25],[999.1,-232.7,.5]]){
    const v=referenceNoiseAt(...p);assert.ok(v>=0&&v<=1);
    for(let axis=0;axis<3;axis++){const q=[...p];q[axis]+=32;assert.ok(Math.abs(referenceNoiseAt(...q)-v)<1e-12);}
  }
  assert.ok(Math.abs(referenceNoiseAt(-1e-5,2.7,4.2)-referenceNoiseAt(1e-5,2.7,4.2))<1e-8);
  for(const p of [[NaN,0,0],[0,Infinity,0],[0,0,1000001]])assert.throws(()=>referenceNoiseAt(...p),RangeError);
});

test('R8 storage retains all 32768 lattice entries within the analytical quantization bound',()=>{
  const bytes=referenceNoiseLattice();assert.equal(bytes.length,32768);assert.ok(bytes instanceof Uint8Array);
  for(let z=0;z<32;z++)for(let y=0;y<32;y++)for(let x=0;x<32;x++){
    assert.ok(Math.abs(bytes[x+32*(y+32*z)]/255-referenceNoiseAt(x,y,z))<=.5/255+1e-15);
  }
  bytes.fill(0);assert.notDeepEqual(referenceNoiseLattice(),bytes,'One caller cannot mutate a future upload');
});

test('trilinear interpolation of cubic weights preserves the quantization bound off the lattice',()=>{
  const bytes=referenceNoiseLattice(),wrap=x=>((x%32)+32)%32;
  for(const p of [[.25,.5,.75],[-.001,31.5,32.25],[-32.25,-1.3,63.7],[7.72,12.23,29.91]]){
    const c=p.map(Math.floor),weights=p.map((v,i)=>{const f=v-c[i];return f*f*(3-2*f);});let interpolated=0;
    for(let z=0;z<2;z++)for(let y=0;y<2;y++)for(let x=0;x<2;x++){
      const value=bytes[wrap(c[0]+x)+32*(wrap(c[1]+y)+32*wrap(c[2]+z))]/255;
      interpolated+=value*(x?weights[0]:1-weights[0])*(y?weights[1]:1-weights[1])*(z?weights[2]:1-weights[2]);
    }
    assert.ok(Math.abs(interpolated-referenceNoiseAt(...p))<=.5/255+1e-15);
  }
});

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {TUSCALOOSA_REVIEWED_IMAGES,tuscaloosaRequestForbidden} from './browser/tuscaloosa-request-contract.mjs';

const base='http://127.0.0.1:43123';
const reviewed=[
  '/assets/tuscaloosa-birmingham-2011/goes-storm-april27.png',
  '/assets/tuscaloosa-birmingham-2011/eo1-track-may2.jpg',
  '/assets/tuscaloosa-birmingham-2011/birmingham-aftermath-april29.jpg',
  '/assets/tuscaloosa-birmingham-2011/apartment-complex-april29.jpg',
  '/assets/tuscaloosa-birmingham-2011/railway-bridge-april29.jpg',
  '/assets/tuscaloosa-birmingham-2011/train-cars-april29.jpg',
  '/assets/tuscaloosa-birmingham-2011/aerial-context-april29.jpg',
];

test('all seven reviewed Tuscaloosa PNG/JPEG paths are permitted exactly',()=>{
  assert.deepEqual(TUSCALOOSA_REVIEWED_IMAGES,reviewed);
  assert.equal(new Set(TUSCALOOSA_REVIEWED_IMAGES).size,7);
  for(const path of reviewed)assert.equal(tuscaloosaRequestForbidden(base+path,base),false,path);
});

test('the explicit contract matches the article seven raster images and preserves its two GIFs',async()=>{
  const html=await readFile(new URL('../web/tuscaloosa.html',import.meta.url),'utf8');
  const sources=[...html.matchAll(/<img\b[^>]*\bsrc="([^"]+)"/g)].map(match=>'/'+match[1]);
  assert.equal(sources.length,9,'Nine article images have source attributes');
  const raster=sources.filter(path=>/\.(?:png|jpe?g)$/i.test(path));
  assert.equal(raster.length,7);
  assert.deepEqual(raster.sort(),[...reviewed].sort());
  assert.deepEqual(sources.filter(path=>/\.gif$/i.test(path)),[
    '/assets/tuscaloosa-birmingham-2011/kbmx-reflectivity-2238.gif',
    '/assets/tuscaloosa-birmingham-2011/kbmx-storm-relative-velocity-2238.gif',
  ]);
  for(const path of sources)assert.equal(tuscaloosaRequestForbidden(base+path,base),false,path);
});

test('YouTube and catalogue index requests remain forbidden',()=>{
  for(const url of [
    'https://www.youtube.com/watch?v=unreviewed',
    'https://www.youtube.com/embed/unreviewed',
    base+'/catalogue/index.json',
    base+'/catalogue/index.html',
  ])assert.equal(tuscaloosaRequestForbidden(url,base),true,url);
});

test('unreviewed local PNG and JPEG requests remain forbidden',()=>{
  for(const path of [
    '/assets/tuscaloosa-birmingham-2011/unreviewed.png',
    '/assets/tuscaloosa-birmingham-2011/unreviewed.jpg',
    '/assets/tuscaloosa-birmingham-2011/unreviewed.jpeg',
    '/assets/another-event/aftermath.jpg',
    '/assets/tuscaloosa-birmingham-2011/eo1-track-may2.JPG',
    '/assets/tuscaloosa-birmingham-2011/eo1-track-may2.JPEG',
  ])assert.equal(tuscaloosaRequestForbidden(base+path,base),true,path);
});

test('reviewed paths reject foreign origins, queries and case changes',()=>{
  for(const path of reviewed){
    assert.equal(tuscaloosaRequestForbidden('https://example.invalid'+path,base),true,path);
    assert.equal(tuscaloosaRequestForbidden('http://127.0.0.1:43124'+path,base),true,path);
    assert.equal(tuscaloosaRequestForbidden(base+path+'?variant=unreviewed',base),true,path);
    assert.equal(tuscaloosaRequestForbidden(base+path.toUpperCase(),base),true,path);
  }
});

test('GIF and ordinary non-raster requests keep their original treatment',()=>{
  for(const url of [
    base+'/assets/tuscaloosa-birmingham-2011/kbmx-reflectivity-2238.gif',
    base+'/assets/unreviewed.gif',
    'https://example.invalid/radar.gif',
    base+'/appearance.css',
    base+'/tuscaloosa.html',
    base+'/tuscaloosa-radar-view.mjs',
  ])assert.equal(tuscaloosaRequestForbidden(url,base),false,url);
});

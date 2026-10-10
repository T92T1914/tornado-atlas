import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {deflateSync} from 'node:zlib';
import path from 'node:path';
import {fixture,base} from './harness.mjs';

const data=JSON.parse(await readFile(new URL('../../web/events/joplin-2011-chronology.json',import.meta.url),'utf8'));
const doc=JSON.parse(await readFile(new URL('../../web/'+data.radar_context.reference.file,import.meta.url),'utf8'));
const media=doc.media.find(row=>row.id===data.radar_context.media_id),transform=media.transformation;
const original=await readFile(new URL('../../web/'+transform.asset,import.meta.url));
assert.equal(createHash('sha256').update(original).digest('hex'),transform.sha256);
// A flat, valid same-dimension PNG is authored test input, not historical media.
function crc32(bytes){let crc=0xffffffff;for(const b of bytes){crc^=b;for(let n=0;n<8;n++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;}
function chunk(kind,bytes){const type=Buffer.from(kind),size=Buffer.alloc(4),crc=Buffer.alloc(4);size.writeUInt32BE(bytes.length);crc.writeUInt32BE(crc32(Buffer.concat([type,bytes])));return Buffer.concat([size,type,bytes,crc]);}
const header=Buffer.alloc(13);header.writeUInt32BE(transform.width,0);header.writeUInt32BE(transform.height,4);header[8]=8;header[9]=2;
const pixels=Buffer.alloc((transform.width*3+1)*transform.height);
for(let y=0;y<transform.height;y++)for(let x=0;x<transform.width;x++){const start=y*(transform.width*3+1)+1+x*3;pixels[start]=221;pixels[start+2]=221;}
const alternate=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(pixels)),chunk('IEND',Buffer.alloc(0))]);
assert.notEqual(createHash('sha256').update(alternate).digest('hex'),transform.sha256);
const capture=async(page,name)=>{
  if(!process.env.ATLAS_IMAGE_CHECK_CAPTURE_DIR)return;
  await mkdir(process.env.ATLAS_IMAGE_CHECK_CAPTURE_DIR,{recursive:true});
  await page.screenshot({path:path.join(process.env.ATLAS_IMAGE_CHECK_CAPTURE_DIR,name+'.png')});
};

for(const [width,appearance] of [[320,'dark'],[1280,'light']])test(`selected radar rejects a different valid figure then retries exact bytes ${width} ${appearance}`,async t=>{
  const page=await fixture(t,{viewport:{width,height:900},isMobile:width<600,hasTouch:width<600,reducedMotion:'reduce',serviceWorkers:'block'});
  let restored=false,selectedRequests=0;
  await page.route('**/'+transform.asset,route=>{
    if(route.request().resourceType()==='fetch')selectedRequests++;
    return route.fulfill({contentType:'image/png',body:restored?original:alternate});
  });
  await page.goto(base+'/reconstruction.html?event=joplin-2011&t=15180');
  const opener=page.locator('#chronology-radar-open');await opener.waitFor();
  await page.locator('#reading-appearance').selectOption(appearance);
  // The unchecked preview itself proves the alternate decodes at the same dimensions.
  await opener.scrollIntoViewIfNeeded();
  await page.waitForFunction(()=>{const image=document.querySelector('#chronology-radar-open img');return image.complete&&image.naturalWidth===947&&image.naturalHeight===1326;});
  await opener.focus();await page.keyboard.press('Enter');await page.locator('#photo-retry').waitFor();
  assert.equal(await page.locator('#photo-full').isVisible(),false);assert.equal(await page.locator('#photo-full').getAttribute('src'),null);
  assert.match(await page.locator('#photo-status').textContent(),/does not match/);assert.equal(selectedRequests,1);
  assert.equal(await page.locator('#photo-caption').textContent(),media.account+' '+media.limits);
  assert.equal(await page.locator('#photo-original').getAttribute('href'),transform.asset);
  assert.equal(new URL(page.url()).searchParams.get('t'),'15180');
  await capture(page,`checked-image-${width}-${appearance}-rejected`);
  restored=true;await page.locator('#photo-retry').focus();await page.keyboard.press('Enter');
  await page.waitForFunction(()=>{const image=document.querySelector('#photo-full');return !image.hidden&&image.naturalWidth===947&&image.naturalHeight===1326;});
  assert.equal(selectedRequests,2);assert.match(await page.locator('#photo-full').getAttribute('src'),/^blob:/);
  assert.match(await page.locator('#photo-status').textContent(),/bytes match/);
  const displayedDigest=await page.evaluate(async()=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',await(await fetch(document.querySelector('#photo-full').src)).arrayBuffer()))].map(value=>value.toString(16).padStart(2,'0')).join(''));
  assert.equal(displayedDigest,transform.sha256,'Hash the actual displayed Blob, not a replacement asset fetch');
  await page.evaluate(()=>{const nodes=[document.querySelector('#photo-dialog'),...document.querySelectorAll('#photo-dialog *')];const sizes=nodes.map(node=>parseFloat(getComputedStyle(node).fontSize));nodes.forEach((node,i)=>node.style.fontSize=`${sizes[i]*2}px`);});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
  await capture(page,`checked-image-${width}-${appearance}-accepted-enlarged`);
  await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('#photo-dialog').open);
  assert.equal(await page.evaluate(()=>document.activeElement?.id),'chronology-radar-open');
  assert.equal(await page.locator('#photo-full').getAttribute('src'),null);
  assert.equal(new URL(page.url()).searchParams.get('t'),'15180');
  assert.match(await page.locator('#chronology-radar').textContent(),/preview and direct image link remain outside/);
});

test('checking unavailable after dossier resolution fails closed while clock and source links survive',async t=>{
  const page=await fixture(t,{viewport:{width:320,height:900},reducedMotion:'reduce'});
  await page.goto(base+'/reconstruction.html?event=joplin-2011&t=15180');
  const opener=page.locator('#chronology-radar-open');await opener.waitFor();
  await page.evaluate(()=>Object.defineProperty(crypto.subtle,'digest',{value:undefined,configurable:true}));
  await opener.focus();await page.keyboard.press('Enter');await page.locator('#photo-retry').waitFor();
  assert.match(await page.locator('#photo-status').textContent(),/cannot check/);
  assert.equal(await page.locator('#photo-full').getAttribute('src'),null);assert.equal(await page.locator('#photo-full').isVisible(),false);
  assert.equal(await page.locator('#photo-source').getAttribute('href'),doc.sources.find(row=>row.id===media.source_id).url);
  await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('#photo-dialog').open);
  await page.evaluate(()=>{
    const range=document.getElementById('chronology-time');
    const state=()=>({url:location.href,focus:document.activeElement?.id,range:range.value,
      share:document.getElementById('chronology-link')?.href,dialogOpen:document.getElementById('photo-dialog').open});
    const evidence={events:[],state,types:['focusin','keydown','keyup','input','change','cancel','close']};
    evidence.listener=event=>{if(evidence.events.length<32)evidence.events.push({
      type:event.type,key:event.key??null,trusted:event.isTrusted,cancelledAtCapture:event.defaultPrevented,
      target:event.target?.id??null,state:state()});};
    for(const type of evidence.types)document.addEventListener(type,evidence.listener,{capture:true,passive:true});
    window.__atlasChronologyNative=evidence;
  });
  await page.locator('#chronology-time').focus();await page.keyboard.press('End');
  const immediateProtocolUrl=page.url();
  let completionError,collectionError;
  try{
    await page.waitForFunction(()=>document.getElementById('chronology-time').value==='15480'&&
      new URL(location.href).searchParams.get('t')==='15480');
    await page.waitForURL(url=>url.searchParams.get('t')==='15480');
  }catch(error){completionError=error;}
  try{
    const evidence=await page.evaluate(()=>{
      const evidence=window.__atlasChronologyNative;
      for(const type of evidence.types)document.removeEventListener(type,evidence.listener,true);
      const result={events:evidence.events,after:evidence.state()};delete window.__atlasChronologyNative;return result;
    });
    t.diagnostic('CHRONOLOGY_NATIVE_END '+JSON.stringify({immediateProtocolUrl,...evidence}));
  }catch(error){
    collectionError=error;
    t.diagnostic('CHRONOLOGY_NATIVE_COLLECTION_ERROR '+JSON.stringify({name:error.name,message:error.message.slice(0,2000)}));
  }
  if(completionError)throw completionError;
  if(collectionError)throw collectionError;
  assert.equal(new URL(page.url()).searchParams.get('t'),'15480');
});

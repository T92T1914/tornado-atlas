import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fixture,base} from './harness.mjs';

// Independent full-object identities retained from the item-level grant.
// These are documentary observations, not historical geometry or clock tests.
const items=[
  {id:'nolte-231037',file:'231037',seconds:397,bytes:216698,hash:'e9ad30c4fdcb6a28340bbb0e422b80cbc937ef248b497092246c7bff51fd4847',guide:'1241'},
  {id:'nolte-231059',file:'231059',seconds:419,bytes:237567,hash:'10de8e092a55e9f4e87650f6731fb70e0829ba90246335f48c484ce3bca47a8c',guide:'1262'},
  {id:'nolte-231202',file:'231202',seconds:482,bytes:189386,hash:'2232f9f7276c1a59f96464720e5295d8cad6d8a0f1ef3289d9a111a1a1a27e36',guide:'1327'}
];
const asset=item=>'assets/el-reno-2013/nolte-'+item.file+'-full.jpg';
const route=seconds=>base+'/reconstruction.html?event=el-reno-2013&t='+seconds+'&appearance_view=photo&appearance_photo=nolte-reported-stills#replay-appearance';
const sample=(page,id)=>page.locator('[data-photo-sample="'+id+'"]');
async function ready(page){await page.locator('#replay-time:not([disabled])').waitFor();}
async function shown(page,item){
  await page.locator('#replay-documentary-image[data-state="ready"][data-sample-id="'+item.id+'"]').waitFor();
  const image=page.locator('#replay-documentary-photo');
  const state=await image.evaluate(async node=>{
    const bytes=await(await fetch(node.src)).arrayBuffer(),digest=await crypto.subtle.digest('SHA-256',bytes);
    const style=getComputedStyle(node),box=node.getBoundingClientRect();
    return {bytes:bytes.byteLength,hash:[...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join(''),
      width:node.naturalWidth,height:node.naturalHeight,fit:style.objectFit,filter:style.filter,
      contentWidth:box.width-parseFloat(style.borderLeftWidth)-parseFloat(style.borderRightWidth),
      contentHeight:box.height-parseFloat(style.borderTopWidth)-parseFloat(style.borderBottomWidth),src:node.src};
  });
  assert.equal(state.bytes,item.bytes);assert.equal(state.hash,item.hash);assert.equal(state.width,1920);assert.equal(state.height,1080);
  assert.equal(state.fit,'contain');assert.equal(state.filter,'none');assert.match(state.src,/^blob:/);
  assert.ok(state.contentWidth>0&&state.contentHeight>0);
  assert.ok(Math.abs(state.contentHeight-state.contentWidth*9/16)<1,'The full 16:9 image, including its bottom marks, is not cropped');
  assert.equal(await page.locator('#replay-appearance img').count(),1);
  assert.equal(await page.locator('#replay-appearance-canvas').evaluate(node=>node.hidden&&node.getBoundingClientRect().height===0),true);
  assert.equal(await page.locator('#replay-time').inputValue(),String(item.seconds));
  assert.equal(await page.locator('#replay-play').textContent(),'Play timeline');
  assert.match(await page.locator('#replay-documentary-image figcaption').textContent(),/Nick Nolte.*item-specific permission/s);
  assert.equal(await page.locator('#replay-photo-full').getAttribute('href'),asset(item));
  assert.equal(await page.locator('#replay-photo-creator-guide').getAttribute('href'),'https://www.youtube.com/watch?v=jsBDFA6_81M&t='+item.guide+'s');
  assert.equal(await page.locator('#replay-documentary-image figure>a').getAttribute('href'),asset(item));
  return state;
}
async function capture(page,name){
  const directory=process.env.ATLAS_REPLAY_DOCUMENTARY_CAPTURE;if(!directory)return;
  assert.ok(path.isAbsolute(directory));await mkdir(directory,{recursive:true});
  await page.locator('#replay-documentary-image').screenshot({path:path.join(directory,name+'.png')});
}

for(const [width,theme]of [[320,'dark'],[1280,'light']])test('complete documentary photographs replace the empty form area '+width+' '+theme,async t=>{
  const page=await fixture(t,{viewport:{width,height:900},reducedMotion:'reduce',serviceWorkers:'block'});
  await page.addInitScript(value=>localStorage.setItem('tornado-atlas-appearance',value),theme);
  const outside=[];page.on('request',request=>{if(/nnwx\.us|youtube\.com/.test(request.url()))outside.push(request.url());});
  await page.goto(route(397));await ready(page);
  for(const item of items){
    await sample(page,item.id).focus();await page.keyboard.press('Enter');await shown(page,item);
    assert.match(await page.locator('#replay-documentary-image figcaption').textContent(),new RegExp('23:'+item.file.slice(2,4)+'Z'));
    await capture(page,'replay-'+item.file+'-'+width+'-'+theme);
  }
  const opener=page.locator('#replay-documentary-image figure>a');
  await sample(page,'nolte-231255').focus();await page.keyboard.press('Tab');
  assert.equal(await opener.evaluate(node=>node===document.activeElement),true,'A verified image is the next native link after the sample controls');
  await page.keyboard.press('Enter');
  await page.waitForFunction(()=>document.getElementById('photo-dialog').open&&!document.getElementById('photo-full').hidden);
  assert.equal(await page.locator('#photo-source').getAttribute('href'),'https://nnwx.us/wp-content/uploads/2018/02/231202.jpg');
  assert.equal(await page.locator('#photo-title').textContent(),'Nick Nolte / 231202.jpg');
  await page.keyboard.press('Escape');assert.equal(await opener.evaluate(node=>node===document.activeElement),true);
  const playerURL=page.url(),source=page.getByRole('link',{name:'Inspect this full image, source and item permission',exact:true});
  await source.click();await page.locator('#media-nolte-231202-full-documentary').waitFor();
  await page.goBack();await ready(page);await shown(page,items[2]);assert.equal(page.url(),playerURL);
  if(width===320){
    await page.evaluate(()=>{const rows=[...document.querySelectorAll('#replay-appearance,#replay-appearance *')].map(node=>[node,parseFloat(getComputedStyle(node).fontSize)]);for(const[node,size]of rows)node.style.fontSize=size*2+'px';});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
    assert.equal(await page.locator('#replay-photo-full').isVisible(),true);await shown(page,items[2]);
  }
  assert.deepEqual(outside,[],'Permitted local copies do not acquire a movie or creator resource');
});

test('a sibling JPEG is refused and retry displays only the selected full original',async t=>{
  const page=await fixture(t,{viewport:{width:320,height:900}});
  const first=items[0],sibling=await readFile(new URL('../../web/'+asset(items[1]),import.meta.url));
  const original=await readFile(new URL('../../web/'+asset(first),import.meta.url));let correct=false,requests=0;
  await page.route('**/'+asset(first),route=>{requests++;return route.fulfill({contentType:'image/jpeg',body:correct?original:sibling});});
  await page.goto(route(first.seconds));await ready(page);await page.locator('#replay-documentary-retry').waitFor();
  assert.equal(await page.locator('#replay-documentary-image').getAttribute('data-state'),'unavailable');
  assert.match(await page.locator('#replay-documentary-status').textContent(),/does not match the selected record/);
  assert.equal(await page.locator('#replay-documentary-photo').getAttribute('src'),null);
  assert.equal(await page.locator('#replay-documentary-photo').isVisible(),false);assert.equal(requests,1);
  assert.equal(await page.locator('#replay-documentary-image figure>a').getAttribute('href'),null);
  await sample(page,'nolte-231255').focus();await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(()=>document.activeElement.id),'replay-documentary-retry','A refused image contributes no empty link to keyboard order');
  assert.equal(await page.locator('#replay-photo-full').getAttribute('href'),asset(first));
  correct=true;await page.locator('#replay-documentary-retry').click();await shown(page,first);assert.equal(requests,2);
});

test('late decode and changed clock cannot retain another sample image or its owned Blob',async t=>{
  const page=await fixture(t,{viewport:{width:390,height:900}});
  await page.addInitScript(()=>{
    window.documentaryURLs={created:[],revoked:[]};
    window.documentaryRequests=[];
    const fetch=window.fetch;
    window.fetch=function(input,options){
      if(typeof input==='string'&&/nolte-\d+-full\.jpg/.test(input)){
        const record={asset:input,aborted:false};window.documentaryRequests.push(record);
        options.signal.addEventListener('abort',()=>{record.aborted=true;},{once:true});
      }
      return fetch.call(this,input,options);
    };
    const create=URL.createObjectURL,revoke=URL.revokeObjectURL,decode=HTMLImageElement.prototype.decode;
    URL.createObjectURL=function(blob){const value=create.call(this,blob);window.documentaryURLs.created.push(value);return value;};
    URL.revokeObjectURL=function(url){window.documentaryURLs.revoked.push(url);return revoke.call(this,url);};
    let held=false;
    HTMLImageElement.prototype.decode=async function(){
      await decode.call(this);
      if(this.id==='replay-documentary-photo'&&!held){held=true;window.documentaryDecodeReady=true;await new Promise(resolve=>{window.releaseDocumentaryDecode=resolve;});}
    };
  });
  const requested=[];page.on('request',request=>{if(/nolte-\d+-full\.jpg/.test(request.url()))requested.push(new URL(request.url()).pathname);});
  await page.goto(route(397));await ready(page);await page.waitForFunction(()=>window.documentaryDecodeReady===true);
  assert.equal(await page.locator('#replay-documentary-image figure>a').getAttribute('href'),null);
  await sample(page,'nolte-231255').focus();await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(()=>document.activeElement.id),'replay-photo-original','An image waiting for verification and decode contributes no empty link');
  const firstURL=await page.evaluate(()=>window.documentaryURLs.created[0]);
  await sample(page,items[1].id).click();const second=await shown(page,items[1]);
  await page.evaluate(()=>window.releaseDocumentaryDecode());
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  assert.equal(await page.locator('#replay-documentary-photo').getAttribute('src'),second.src);
  assert.equal(await page.evaluate(url=>window.documentaryURLs.revoked.includes(url),firstURL),true);
  assert.equal(await page.evaluate(()=>window.documentaryRequests[0].aborted),true);
  await page.locator('#replay-time').fill('419.000001');
  await page.waitForFunction(()=>document.getElementById('replay-appearance-canvas').dataset.evidenceState==='unknown');
  assert.equal(await page.locator('#replay-documentary-image').isVisible(),false);
  assert.equal(await page.locator('#replay-appearance img').count(),0);
  assert.equal(await page.evaluate(url=>window.documentaryURLs.revoked.includes(url),second.src),true);
  assert.equal(await page.evaluate(()=>window.documentaryRequests[1].aborted),true);
  await sample(page,'nolte-231255').click();
  assert.equal(await page.locator('#replay-appearance img').count(),0);assert.equal(await page.locator('#replay-photo-full').count(),0);
  assert.match(await page.locator('#replay-photo-record').textContent(),/No photograph is loaded or copied/);
  assert.deepEqual(requested,['/'+asset(items[0]),'/'+asset(items[1])]);
});

test('photo history and unavailable graphics preserve images while gaps and unsupported originals stay empty',async t=>{
  const page=await fixture(t,{viewport:{width:320,height:900},reducedMotion:'reduce'});
  await page.addInitScript(()=>{
    const get=HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext=function(type,...args){return type==='webgl2'?null:get.call(this,type,...args);};
  });
  await page.goto(route(397));await ready(page);await shown(page,items[0]);
  assert.match(await page.locator('#replay-appearance-renderer-status').textContent(),/could not start/);
  await sample(page,items[1].id).click();await shown(page,items[1]);
  await page.goBack();await shown(page,items[0]);await page.goForward();await shown(page,items[1]);
  await page.reload();await ready(page);await shown(page,items[1]);
  for(const seconds of ['396.999','419.000001','450','535.000001']){
    await page.locator('#replay-time').fill(seconds);
    await page.waitForFunction(()=>document.getElementById('replay-appearance-canvas').dataset.evidenceState==='unknown');
    assert.equal(await page.locator('#replay-appearance img').count(),0);
    assert.equal(await page.locator('#replay-documentary-image').isVisible(),false);
    assert.equal(await page.locator('#replay-appearance-canvas').evaluate(node=>node.getBoundingClientRect().height),0);
  }
  await page.locator('#replay-appearance-mode').selectOption('photo:wakimoto-visible-margin');
  await sample(page,'wakimoto-232501').click();
  assert.match(await page.locator('#replay-appearance-state').textContent(),/partial condensation/);
  assert.equal(await page.locator('#replay-appearance-canvas').isVisible(),false);
  assert.equal(await page.locator('#replay-photo-original').isVisible(),true);
  assert.equal(await page.locator('#replay-appearance img').count(),0);
});

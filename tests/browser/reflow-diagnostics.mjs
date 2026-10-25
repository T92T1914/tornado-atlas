// Bounded geometry from the isolated browser fixture. No screenshot or style change.
export async function captureReflow(t,page,phase){
 let timer;
 try{
  const value=await Promise.race([page.evaluate(()=>{
   const rounded=n=>Number.isFinite(n)?Math.round(n*1000)/1000:null;
   const box=node=>{const r=node.getBoundingClientRect();return {left:rounded(r.left),right:rounded(r.right),top:rounded(r.top),bottom:rounded(r.bottom),width:rounded(r.width),height:rounded(r.height)};};
   const describe=node=>({tag:node.tagName,id:String(node.id||'').slice(0,96),class:String(node.getAttribute('class')||'').slice(0,128)});
   const all=document.querySelectorAll('*'),offenders=[];let scanned=0,total=0;
   for(const node of all){if(++scanned>2000)break;const r=node.getBoundingClientRect();if(!r.width||!r.height)continue;
    const outside=r.right+scrollX>innerWidth+1||r.left+scrollX< -1,internal=node.scrollWidth>node.clientWidth+1;
    if(!outside&&!internal)continue;total++;if(offenders.length>=6)continue;
    const style=getComputedStyle(node),ancestors=[];let parent=node.parentElement;
    for(let level=0;parent&&level<3;level++,parent=parent.parentElement)ancestors.push({...describe(parent),rect:box(parent)});
    offenders.push({...describe(node),outside_document:outside,internal_overflow:internal,rect:box(node),clientWidth:node.clientWidth,scrollWidth:node.scrollWidth,
     style:{display:style.display,position:style.position,width:style.width,minWidth:style.minWidth,maxWidth:style.maxWidth,boxSizing:style.boxSizing,overflowX:style.overflowX,overflowY:style.overflowY,whiteSpace:style.whiteSpace,wordBreak:style.wordBreak,overflowWrap:style.overflowWrap,appearance:style.appearance,fontSize:style.fontSize},
     text:String(node.textContent||'').trim().slice(0,96),ancestors});
   }
   const targets=['survey-order','survey-map-geography','footage-source','replay-camera-sample','survey-observation','replay-appearance-mode'].map(id=>{
    const node=document.getElementById(id);if(!node)return {id,missing:true};const style=getComputedStyle(node),ancestors=[];let parent=node.parentElement;
    for(let level=0;parent&&level<2;level++,parent=parent.parentElement){const p=getComputedStyle(parent);ancestors.push({...describe(parent),rect:box(parent),minWidth:p.minWidth,overflowX:p.overflowX,display:p.display});}
    return {...describe(node),hidden:node.hidden,disabled:node.disabled??null,value:String(node.value??'').slice(0,96),rect:box(node),clientWidth:node.clientWidth,scrollWidth:node.scrollWidth,
     style:{width:style.width,minWidth:style.minWidth,maxWidth:style.maxWidth,display:style.display,appearance:style.appearance,overflowX:style.overflowX,boxSizing:style.boxSizing},ancestors};
   });
   const root=document.documentElement,body=document.body;
   return {viewport:{width:innerWidth,height:innerHeight,scrollX,scrollY,visualWidth:window.visualViewport?.width??null},
    document:{scrollWidth:root.scrollWidth,clientWidth:root.clientWidth,rect:box(root)},body:body?{scrollWidth:body.scrollWidth,clientWidth:body.clientWidth,rect:box(body)}:null,
    font_status:document.fonts?.status??null,active:document.activeElement?describe(document.activeElement):null,dialog_open:document.getElementById('photo-dialog')?.open??null,
    path:location.pathname,search:location.search,hash:location.hash,scanned:Math.min(scanned,2000),scan_omitted:Math.max(0,all.length-2000),offender_count:total,offenders,targets};
  }),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Width observation exceeded500ms')),500);})]);
  const payload={schema:'atlas-survey-reflow-observation-v1',phase,...value,
   scope:'Passive DOM geometry before opener, during failed modal and after close. Internal scroll areas are not proof of document overflow. Reads may affect timing. Original test assertions remain unchanged. No product correction or physical-device claim.'};
  let encoded=JSON.stringify(payload);
  while(Buffer.byteLength(encoded)>8192&&payload.offenders.length){payload.offenders.pop();payload.sample_omitted=payload.offender_count-payload.offenders.length;encoded=JSON.stringify(payload);}
  if(Buffer.byteLength(encoded)>8192)throw Error('Width observation exceeded8192bytes');
  t.diagnostic('ATLAS_SURVEY_REFLOW '+encoded);
 }catch(error){try{t.diagnostic('ATLAS_SURVEY_REFLOW '+JSON.stringify({phase,diagnostic_error:String(error?.message??error).slice(0,512)}));}catch{}}
 finally{clearTimeout(timer);}
}

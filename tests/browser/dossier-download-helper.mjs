import {readFile} from 'node:fs/promises';

export async function readDossierDownload(page,{scope=page,label='Verify and download dossier metadata (JSON)',diagnostic={}}={}){
  const button=scope.getByRole('button',{name:label,exact:true}),network=[];
  const metadataURL=await button.evaluate(node=>node.closest('.dossier-download')?.querySelector('a')?.href??null);
  const collect=row=>{if(network.length<16)network.push(row);};
  const requested=request=>{if(request.url()===metadataURL)collect({phase:'requested',method:request.method()});};
  const responded=response=>{if(response.url()===metadataURL)collect({phase:'responded',status:response.status()});};
  const finished=request=>{if(request.url()===metadataURL)collect({phase:'finished'});};
  const failed=request=>{if(request.url()===metadataURL)collect({phase:'failed',reason:String(request.failure()?.errorText??'').slice(0,256)});};
  page.on('request',requested);page.on('response',responded);page.on('requestfinished',finished);page.on('requestfailed',failed);
  let captured=false;
  try{
    await button.evaluate(node=>{
    const rows=[],types=['pointerdown','mousedown','pointerup','mouseup','click'];
    const listener=event=>{if(rows.length<30)rows.push({type:event.type,trusted:event.isTrusted,intended: event.composedPath().includes(node),target:{tag:event.target?.tagName??null,id:event.target?.id??null},scrollY});};
    window.__atlasDossierDownloadProbe={rows,types,listener,node};for(const type of types)document.addEventListener(type,listener,true);
  });
    const [download]=await Promise.all([page.waitForEvent('download').then(download=>{captured=true;return download;}),button.click()]);
    const failure=await download.failure();if(failure)throw Error('Checked dossier download failed: '+failure);
    const bytes=await readFile(await download.path());
    return {bytes,dossier:JSON.parse(bytes.toString('utf8')),filename:download.suggestedFilename()};
  }catch(error){
    let state;
    let timer;
    try{state=await Promise.race([page.evaluate(()=>{const probe=window.__atlasDossierDownloadProbe,node=probe?.node;return {url:location.href,ready:document.body.dataset.ready??null,scrollY,scrollBehavior:getComputedStyle(document.documentElement).scrollBehavior,button:node?{connected:node.isConnected,disabled:node.disabled,rect:node.getBoundingClientRect().toJSON()}:null,status:node?.closest('.dossier-download')?.querySelector('[role="status"]')?.textContent?.slice(0,512)??null,events:probe?.rows??[]};}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Failure diagnostic exceeded 500 milliseconds')),500);})]);}
    catch(snapshotError){state={unavailable:String(snapshotError.message).slice(0,256)};}finally{clearTimeout(timer);}
    console.error('DOSSIER_DOWNLOAD_FAILURE_DIAGNOSTIC '+JSON.stringify({diagnostic,label,metadataURL,captured,network,state,error:String(error.message).slice(0,512),scope:'Passive owned-fixture diagnostics; original single native click and download deadline retained.'}));
    throw error;
  }finally{
    page.off('request',requested);page.off('response',responded);page.off('requestfinished',finished);page.off('requestfailed',failed);
    try{await page.evaluate(()=>{const probe=window.__atlasDossierDownloadProbe;if(probe){for(const type of probe.types)document.removeEventListener(type,probe.listener,true);delete window.__atlasDossierDownloadProbe;}});}catch{}
  }
}

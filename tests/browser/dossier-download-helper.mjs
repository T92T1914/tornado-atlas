import {readFile} from 'node:fs/promises';

export async function readDossierDownload(page,{scope=page,label='Verify and download dossier metadata (JSON)'}={}){
  const [download]=await Promise.all([page.waitForEvent('download'),scope.getByRole('button',{name:label,exact:true}).click()]);
  const failure=await download.failure();if(failure)throw Error('Checked dossier download failed: '+failure);
  const bytes=await readFile(await download.path());
  return {bytes,dossier:JSON.parse(bytes.toString('utf8')),filename:download.suggestedFilename()};
}

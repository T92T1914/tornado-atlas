// Search inspected source metadata without joining historical accounts at a shared URL.
export function validateSourceDirectory(directory,index){
  const fail=()=>{throw Error('The source directory does not match this archive publication. No source cards have been substituted.');};
  if(directory?.schema_version!==1||directory?.kind!=='atlas-source-directory'||
    typeof directory.scope!=='string'||!Array.isArray(directory.entries)||
    directory.entries.length!==index.source_directory?.count)fail();
  const seen=new Set();
  for(const row of directory.entries){
    if(!row||typeof row!=='object')fail();
    const event=index.events.find(event=>event.id===row.event_id),source=row.source;
    if(!event||row.event_title!==event.title||!/^[0-9a-f]{64}$/.test(row.dossier_sha256)||
      event.file!==`archive/${event.id}-${row.dossier_sha256.slice(0,20)}.json`||
      !source||!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(source.id)||
      !['title','url','locator','access','revision','rights','agent_processing'].every(key=>typeof source[key]==='string'&&source[key].length>0)||
      !Number.isSafeInteger(row.observations)||row.observations<0||
      !Number.isSafeInteger(row.media)||row.media<0)fail();
    const key=JSON.stringify([row.event_id,source.id]);
    if(seen.has(key))fail();seen.add(key);
  }
  return directory;
}

export function discoverSources(directory,{query='',event=''}={}){
  const needle=query.trim().toLowerCase();
  return directory.entries.filter(row=>(!event||row.event_id===event)&&
    [row.event_title,...Object.values(row.source)].join(' ').toLowerCase().includes(needle));
}

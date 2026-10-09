// Compare records already loaded from one retained dossier. Selection never
// reconciles an account or derives a clock, place, registration or reuse basis.
const tokenPattern=/^(observation|media):([A-Za-z0-9][A-Za-z0-9_-]*)$/;
const human=value=>String(value).replaceAll('_',' ');
const statusLabels={intake:'Publication status',assertion:'Evidence basis',temporal:'Time registration',
  spatial:'Place registration',availability:'Record access',rights:'Reuse status'};
const statusValues={published:'Published record',candidate:'Research lead',source_reported:'Source-reported',
  observed_sample:'Inspected sample recorded',disputed:'Source disagreement',not_researched:'Not researched',
  unregistered:'Unregistered',source_label:'Source time or date label',discrete_anchor:'Discrete time anchor',
  reviewed_available:'Reviewed record linked',unavailable:'Unavailable',documented_no_result:'Documented search without a result',
  not_applicable:'Not applicable',links_only:'Source links only',permitted_hosting:'Hosting permission recorded',
  unknown:'Unknown reuse status',restricted:'Restricted reuse'};

export function comparisonChoices(doc){
  return [...doc.observations.map(item=>({key:'observation:'+item.id,type:'observation',item})),
    ...doc.media.map(item=>({key:'media:'+item.id,type:'media',item}))];
}

export function comparisonEntries(doc,values){
  if(!Array.isArray(values)||values.length>4||values.some(value=>typeof value!=='string'))
    throw Error('Select at most four evidence records from this dossier version.');
  const keys=values.filter(value=>value!=='');
  if(new Set(keys).size!==keys.length)throw Error('Select distinct evidence records. A repeated record is not a second account.');
  const choices=new Map(comparisonChoices(doc).map(row=>[row.key,row]));
  return keys.map(key=>{
    if(!tokenPattern.test(key)||!choices.has(key))throw Error('A selected record is not in this dossier version. No replacement account has been selected.');
    const row=choices.get(key),source=doc.sources.find(source=>source.id===row.item.source_id);
    if(!source)throw Error('The source for a selected record is absent from this dossier version.');
    return {...row,source};
  });
}

export function comparisonRoute(doc,revision,values=[]){
  if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(doc.id)||!/^[a-f0-9]{64}$/.test(revision))
    throw Error('Comparison requires an identified event and retained dossier revision.');
  const rows=comparisonEntries(doc,values),query=new URLSearchParams({event:doc.id,revision});
  for(const row of rows)query.append('compare',row.key);
  return 'dossier.html?'+query+'#evidence-comparison';
}

function node(tag,text,cls){
  const result=document.createElement(tag);
  if(text!==undefined)result.textContent=text;
  if(cls)result.className=cls;
  return result;
}

function recordedValue(value){
  if(value===null||value===undefined)return node('span','Not established in this record.');
  if(Array.isArray(value)){
    const list=node('ul');
    for(const child of value){const item=node('li');item.append(recordedValue(child));list.append(item);}
    return list;
  }
  if(typeof value==='object'){
    const list=node('dl');
    for(const [key,child] of Object.entries(value)){
      const meaning=node('dd');meaning.append(recordedValue(child));
      list.append(node('dt',human(key)),meaning);
    }
    return list;
  }
  return node('span',String(value));
}

function disclosure(title,fields){
  const detail=node('details');detail.append(node('summary',title));
  const list=node('dl');
  for(const [label,value] of fields){const meaning=node('dd');meaning.append(recordedValue(value));list.append(node('dt',label),meaning);}
  detail.append(list);return detail;
}

function itemRoute(doc,revision,row,source=false){
  const key=source?'source':row.type,id=source?row.source.id:row.item.id;
  return 'dossier.html?'+new URLSearchParams({event:doc.id,revision,[key]:id})+'#'+key+'-'+id;
}

export function comparisonSection(doc,revision,values,makeLink,pinned=true){
  const section=node('section',undefined,'archive-comparison');section.id='evidence-comparison';
  section.setAttribute('aria-labelledby','comparison-title');
  const title=node('h2','Compare evidence accounts');title.id='comparison-title';
  section.append(title,node('p','Choose two to four records from this exact dossier version. Their accounts, clocks and inspection limits remain attributed. Comparison does not reconcile times, synchronize images or establish a measured place, cause or historical appearance.'));
  const choices=comparisonChoices(doc),clear=comparisonRoute(doc,revision),form=node('form',undefined,'comparison-tools');
  form.method='get';form.action='dossier.html#evidence-comparison';form.setAttribute('aria-label','Choose evidence to compare');
  for(const [name,value] of [['event',doc.id],['revision',revision]]){const hidden=node('input');hidden.type='hidden';hidden.name=name;hidden.value=value;form.append(hidden);}
  for(let index=0;index<4;index++){
    const field=node('div',undefined,'comparison-choice'),label=node('label','Evidence '+(index+1)),select=node('select');
    select.id='comparison-choice-'+(index+1);label.htmlFor=select.id;
    select.name='compare';select.append(new Option('Choose a record',''));
    for(const [type,text] of [['observation','Observations and attributed claims'],['media','Media records']]){
      const group=node('optgroup');group.label=text;
      for(const row of choices.filter(row=>row.type===type))group.append(new Option(row.item.title,row.key));
      select.append(group);
    }
    if(choices.some(row=>row.key===values[index]))select.value=values[index];
    field.append(label,select);form.append(field);
  }
  const button=node('button','Compare selected evidence');form.append(button,makeLink('Clear comparison',clear));section.append(form);
  let entries;
  try{entries=comparisonEntries(doc,values);}
  catch(error){const alert=node('p',error.message,'comparison-error');alert.setAttribute('role','alert');section.append(alert);return section;}
  if(entries.length<2){
    section.append(node('p',entries.length?'The first record is selected. Choose another record to compare.':'Choose records above, or use Compare this evidence on an evidence card.'));return section;
  }
  if(!pinned)section.append(node('p','This opened the current dossier, whose published version may change. Use the versioned comparison link to retain the records shown here.'));
  section.append(makeLink('Link to this comparison',comparisonRoute(doc,revision,entries.map(row=>row.key))));
  section.append(node('p',`${entries.length} records from the same retained dossier are shown below. Separate cards from one report are not independent reporting streams. Inspection statements are retained records, not a new source review.`));
  const grid=node('div',undefined,'comparison-grid');
  for(const row of entries){
    const item=row.item,source=row.source,card=node('article',undefined,'archive-card comparison-card');card.dataset.compare=row.key;
    card.append(node('h3',item.title),node('p','Attributed source: '+source.title),node('h4','Recorded account'),node('p',item.account),node('h4','Limits of this evidence'),node('p',item.limits));
    const status=node('dl');
    for(const [key,value] of Object.entries(item.status))status.append(node('dt',statusLabels[key]||human(key)),node('dd',statusValues[value]||human(value)));
    card.append(status,disclosure('Time and date roles',[
      ['Event association',item.time.event],['Capture time or date',item.time.capture],
      ['Publication time or date',item.time.publication],['Source retrieval',item.time.retrieval],
      ['Video presentation bounds',item.time.video],['Historical alignment',item.time.alignment]]),
    disclosure('Place and its evidence basis',[['Recorded place',item.place]]),
    disclosure('Inspection scope and reuse',[
      ['Exact item locator',item.locator],['Item inspection record',item.review],
      ['Recorded source revision',source.revision],['Source inspection record',source.access],['Source reuse statement',source.rights]]));
    const routes=node('nav',undefined,'comparison-routes');routes.setAttribute('aria-label','Evidence routes for '+item.title);
    routes.append(makeLink('Open this evidence record',itemRoute(doc,revision,row)),
      makeLink('Inspect its source card',itemRoute(doc,revision,row,true)),makeLink('Read its original source',source.url));
    card.append(routes);grid.append(card);
  }
  section.append(grid);return section;
}

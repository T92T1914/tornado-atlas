// Versioned links retain assumed experiments. Documentary selection never sets model inputs.
export const LAB_EVENTS=Object.freeze([
  Object.freeze({id:'el-reno-2013',title:'El Reno · 2013',story:'index.html',form:'index.html#photos',wind:'index.html#damage',source:'dossier.html?event=el-reno-2013',formAccount:'Compare the permitted photographs and separately interpreted stills. Their reported instants do not supply continuous motion, physical size or a calibrated camera.',windAccount:'Compare recorded survey outcomes with the assumed component. The survey does not supply this experiment’s wind, capacity or failure sequence.'}),
  Object.freeze({id:'joplin-2011',title:'Joplin · 2011',story:'joplin.html',form:'joplin.html#photographs-and-film',wind:'joplin.html#hospital-envelope',source:'dossier.html?event=joplin-2011',formAccount:'Read the storm photograph and rain-obscuration account. A visible form does not determine wind speed or a continuous three-dimensional silhouette.',windAccount:'Read the hospital envelope and structural-system account. The recorded building outcome is distinct from this generic component and assumed load capacity.'}),
  Object.freeze({id:'blackwell-1955',title:'Blackwell · 1955',story:'blackwell.html',form:'blackwell.html#observations',wind:'blackwell.html#pressure-damage',source:'dossier.html?event=blackwell-1955',formAccount:'Compare attributed eyewitness descriptions, with their different locations and unresolved clocks. This form does not reconstruct a witness view or a glowing funnel.',windAccount:'Read the pressure and fallen-tree accounts. Pressure differences and qualitative debris directions do not calibrate this wind field or component rule.'}),
  Object.freeze({id:'tuscaloosa-birmingham-2011',title:'Tuscaloosa and Birmingham · 2011',story:'tuscaloosa.html',form:'tuscaloosa.html#photographs-and-film',wind:'tuscaloosa.html#damage',source:'dossier.html?event=tuscaloosa-birmingham-2011',formAccount:'Compare the published film views and their estimated labels. Their camera context and video locators do not register this authored form to historical time.',windAccount:'Read the different building outcomes and individual survey accounts. An estimated damage footprint or rating does not set this model’s core radius, wind or failure time.'}),
  Object.freeze({id:'moore-2013',title:'Newcastle and Moore · 2013',story:'moore.html',form:'moore.html#survey-photographs',wind:'moore.html#damage-and-buildings',source:'dossier.html?event=moore-2013',formAccount:'Read the source photographs and reported storm progression. Aftermath photographs do not supply a historical funnel, calibrated camera or continuous appearance.',windAccount:'Compare source-reported building outcomes and the revised assessment. Damage ratings and survey dimensions do not set this generic field, component capacity or failure sequence.'}),
  Object.freeze({id:'udall-1955',title:'Udall · 1955',story:'udall.html',form:'udall.html#original-images',wind:'udall.html#damage-and-aftermath',source:'dossier.html?event=udall-1955',formAccount:'Read the original archive leads and their inspection limits. This documentary supplies no calibrated camera, measured funnel or continuous appearance.',windAccount:'Compare the attributed damage account with its distinct county records and reported clocks. F5 and damage width do not set this generic field, core radius, component capacity or failure sequence.'})
]);
const number=(min,max,step=1)=>Object.freeze({type:'number',min,max,step});
const choice=(...values)=>Object.freeze({type:'choice',values:Object.freeze(values)});
const boolean=Object.freeze({type:'boolean'});
export const EXPERIMENT_FIELDS=Object.freeze({
  wind:Object.freeze({peak:number(10,250,5),radius:number(50,2000,50),background:number(0,50,5),'probe-x':number(-2.5,2.5,.1),'probe-y':number(-2.5,2.5,.1),area:number(.1,10,.1),coefficient:number(.1,2,.1),travel:number(5,80,5),offset:number(-3,3,.1),threshold:number(25,200,5),capacity:number(.1,20,.1),sample:number(0,480)}),
  form:Object.freeze({shape:choice('cone','wedge','rope'),condensation:number(35,100),azimuth:number(-180,180),elevation:number(3,60),distance:number(5,12,.1),dust:boolean,quality:choice(3600,7200),sequence:boolean,coverage:choice('continuous','bounded'),rate:choice(1,15),position:number(0,1,.001),phase:number(0,1e9,null)})
});
export const DEFAULT_EXPERIMENTS=Object.freeze({
  wind:Object.freeze({peak:100,radius:500,background:0,'probe-x':1,'probe-y':0,area:1,coefficient:1.2,travel:30,offset:1,threshold:50,capacity:1,sample:0}),
  form:Object.freeze({shape:'cone',condensation:100,azimuth:25,elevation:12,distance:7,dust:true,quality:7200,sequence:false,coverage:'continuous',rate:1,position:0,phase:0})
});
const FORM_SIMULATION_FIELDS=Object.freeze({...EXPERIMENT_FIELDS.form,phase:number(0,86400,null),model:choice('kinematic-v1')});
const FORM_FORMATION_FIELDS=Object.freeze({...FORM_SIMULATION_FIELDS,phase:number(0,30,null),coverage:choice('formation'),model:choice('genesis-v1'),visibility:choice('ordinary','limited'),flow:boolean});
const FORM_LIGHTING_FIELDS=Object.freeze({...FORM_FORMATION_FIELDS,lighting:choice('world-v1')});
const FORM_REFERENCE_FIELDS=Object.freeze({...FORM_FORMATION_FIELDS,coverage:choice('reference'),presentation:choice('reference-v1')});
const FORM_STORM_FIELDS=Object.freeze({...FORM_FORMATION_FIELDS,coverage:choice('storm'),presentation:choice('storm-v1')});
const FORM_STORM_DETAIL_FIELDS=Object.freeze({...FORM_FORMATION_FIELDS,coverage:choice('storm-detail'),presentation:choice('storm-v2')});
const FORM_STORM_INTEGRATED_FIELDS=Object.freeze({...FORM_FORMATION_FIELDS,coverage:choice('storm-integrated'),presentation:choice('storm-v3')});
function fieldsFor(kind,model=null,lighting=undefined,presentation=undefined){const fields=EXPERIMENT_FIELDS[kind];if(!fields)throw new RangeError('Unknown laboratory');return kind==='form'&&model==='genesis-v1'?(presentation==='storm-v3'?FORM_STORM_INTEGRATED_FIELDS:presentation==='storm-v2'?FORM_STORM_DETAIL_FIELDS:presentation==='storm-v1'?FORM_STORM_FIELDS:presentation!==undefined?FORM_REFERENCE_FIELDS:lighting===undefined?FORM_FORMATION_FIELDS:FORM_LIGHTING_FIELDS):kind==='form'&&model==='kinematic-v1'?FORM_SIMULATION_FIELDS:fields;}
function validNumber(value,field){
  if(typeof value!=='number'||!Number.isFinite(value)||value<field.min||value>field.max)return false;
  if(field.step===null)return true;
  const scale=field.step===.001?1000:field.step===.1?10:1;
  // Validate decimal steps in integer units, allowing only floating representation error.
  const scaled=value*scale,integer=Math.round(scaled);
  return Math.abs(scaled-integer)<=Number.EPSILON*Math.max(1,Math.abs(scaled))*4 && (integer-Math.round(field.min*scale))%Math.round(field.step*scale)===0;
}
export function validateExperimentState(kind,state){
  const fields=fieldsFor(kind,state?.model,state?.lighting,state?.presentation),keys=Object.keys(fields);
  if(!state||typeof state!=='object'||Array.isArray(state)||Object.keys(state).sort().join('|')!==[...keys].sort().join('|'))throw new Error('A complete experiment is required');
  for(const key of keys){const field=fields[key],value=state[key];
    if(field.type==='number'?!validNumber(value,field):field.type==='boolean'?typeof value!=='boolean':!field.values.includes(value))throw new Error('Invalid experiment value: '+key);
  }
  if(kind==='form'&&state.sequence&&state.phase!==state.position*30)throw new Error('Authored sequence phase must match its selected step');
  if(kind==='form'&&state.model==='genesis-v1'&&!state.sequence)throw new Error('Formation study requires its authored sequence');
  return state;
}
export function readExperiment(search,kind){
  const baseFields=fieldsFor(kind);
  const refused=message=>({status:'invalid',event:null,state:null,message});
  if(String(search).length>2048)return refused('The experiment link is too large.');
  const params=new URLSearchParams(search),entries=[...params];
  const integrated=kind==='form'&&params.get('experiment')==='form-8',stormDetail=kind==='form'&&params.get('experiment')==='form-7',storm=kind==='form'&&params.get('experiment')==='form-6',reference=kind==='form'&&params.get('experiment')==='form-5',lit=kind==='form'&&params.get('experiment')==='form-4';
  const simulation=kind==='form'&&params.get('experiment')==='form-2',formation=kind==='form'&&params.get('experiment')==='form-3',fields=integrated?FORM_STORM_INTEGRATED_FIELDS:stormDetail?FORM_STORM_DETAIL_FIELDS:storm?FORM_STORM_FIELDS:reference?FORM_REFERENCE_FIELDS:lit?FORM_LIGHTING_FIELDS:formation?FORM_FORMATION_FIELDS:simulation?FORM_SIMULATION_FIELDS:baseFields;
  if(entries.length>Object.keys(fields).length+2)return refused('The experiment link is too large.');
  const allowed=new Set(['event','experiment',...Object.keys(fields)]),seen=new Set();
  for(const [key] of entries){if(!allowed.has(key)||seen.has(key))return refused('The experiment link has an unknown or repeated field.');seen.add(key);}
  const event=params.get('event');
  if(event!==null&&!LAB_EVENTS.some(row=>row.id===event))return refused('The documentary reference is unknown.');
  const version=params.get('experiment'),hasState=Object.keys(fields).some(key=>params.has(key));
  if(version===null){if(hasState)return refused('The experiment link has no supported version.');return {status:event?'reference':'empty',event,state:null,message:''};}
  if(version!==(integrated?'form-8':stormDetail?'form-7':storm?'form-6':reference?'form-5':lit?'form-4':formation?'form-3':simulation?'form-2':kind+'-1'))return refused('The experiment version is not supported in this laboratory.');
  if(Object.keys(fields).some(key=>!params.has(key)))return refused('The experiment link is incomplete.');
  const state={};
  for(const [key,field] of Object.entries(fields)){
    const raw=params.get(key);
    if(field.type==='boolean'){
      if(!['0','1'].includes(raw))return refused('The experiment link has an invalid switch.');state[key]=raw==='1';
    }else if(field.type==='number'||typeof field.values[0]==='number'){
      if(raw.length>32||!/^[-]?(?:0|[1-9]\d*)(?:\.\d+)?(?:e[+-]?\d+)?$/i.test(raw))return refused('The experiment link has an invalid number.');state[key]=Number(raw);
    }else state[key]=raw;
  }
  // Presentations with identical field names still belong to distinct versions.
  if(fieldsFor(kind,state.model,state.lighting,state.presentation)!==fields)return refused('The experiment fields do not match the selected version.');
  try{validateExperimentState(kind,state);}catch{return refused('The experiment link has an out-of-range, off-step or inconsistent value.');}
  return {status:'restored',event,state,message:''};
}
export function experimentURL(href,kind,event,state){
  validateExperimentState(kind,state);
  if(event!==null&&!LAB_EVENTS.some(row=>row.id===event))throw new RangeError('Unknown documentary reference');
  const url=new URL(href);url.search='';url.searchParams.set('experiment',kind==='form'&&state.model==='genesis-v1'?(state.presentation==='storm-v3'?'form-8':state.presentation==='storm-v2'?'form-7':state.presentation==='storm-v1'?'form-6':state.presentation==='reference-v1'?'form-5':state.lighting==='world-v1'?'form-4':'form-3'):kind==='form'&&state.model==='kinematic-v1'?'form-2':kind+'-1');
  if(event!==null)url.searchParams.set('event',event);
  for(const [key,value] of Object.entries(state))url.searchParams.set(key,typeof value==='boolean'?(value?'1':'0'):String(value));
  return url;
}

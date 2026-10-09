import {DOSSIER_FILE_LIMIT} from './dossier-file-model.mjs';

export const LITERAL_DEPTH_LIMIT=32,LITERAL_TOKEN_LIMIT=20000;
const categories=['sources','observations','media','creators','records'];
const fail=message=>{throw Error(message+' No publication comparison has been substituted.');};

// Positions refer to the exact decoded source string, not UTF8 byte offsets.
// The checked dossier remains the schema reader. This scan supplies ranges and
// rejects ambiguous keys throughout the source, including unselected subtrees.
export function indexDossierLiterals(rawText,eventId){
  if(typeof rawText!=='string'||rawText.length>DOSSIER_FILE_LIMIT||
    new TextEncoder().encode(rawText).byteLength>DOSSIER_FILE_LIMIT)fail('The literal source exceeds its byte limit.');
  let position=0,tokens=0,deepest=0;
  const count=()=>{if(++tokens>LITERAL_TOKEN_LIMIT)fail('The literal source exceeds its token limit.');};
  const space=()=>{while(position<rawText.length&&/[ \t\r\n]/.test(rawText[position]))position++;};
  const invalid=()=>fail('The literal source is not complete JSON.');
  function string(){
    const start=position++;
    while(position<rawText.length){
      const char=rawText[position++];
      if(char==='\\'){position++;continue;}
      if(char!=='"')continue;
      let text;
      try{text=JSON.parse(rawText.slice(start,position));}catch{invalid();}
      return {kind:'string',start,end:position,text};
    }
    invalid();
  }
  function value(depth){
    count();if(depth>LITERAL_DEPTH_LIMIT)fail('The literal source exceeds its depth limit.');
    deepest=Math.max(deepest,depth);space();const start=position,char=rawText[position];
    if(char==='"')return string();
    if(char==='{'){
      position++;space();const members=new Map();
      if(rawText[position]!=='}')for(;;){
        if(rawText[position]!=='"')invalid();
        count();const key=string();space();
        if(members.has(key.text))fail('The literal source contains duplicate decoded object keys.');
        if(rawText[position++]!==':')invalid();
        members.set(key.text,value(depth+1));space();
        if(rawText[position]!==',')break;
        position++;space();
      }
      if(rawText[position++]!=='}')invalid();
      return {kind:'object',start,end:position,members};
    }
    if(char==='['){
      position++;space();const values=[];
      if(rawText[position]!==']')for(;;){
        values.push(value(depth+1));space();
        if(rawText[position]!==',')break;
        position++;
      }
      if(rawText[position++]!==']')invalid();
      return {kind:'array',start,end:position,values};
    }
    for(const [literal,kind] of [['true','boolean'],['false','boolean'],['null','null']]){
      if(rawText.startsWith(literal,position)){position+=literal.length;return {kind,start,end:position};}
    }
    const number=/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(rawText.slice(position));
    if(!number)invalid();
    position+=number[0].length;return {kind:'number',start,end:position};
  }
  const root=value(0);space();if(position!==rawText.length)invalid();
  if(root.kind!=='object'||root.members.get('id')?.kind!=='string'||root.members.get('id').text!==eventId)fail('The literal source belongs to another event.');
  const rows=new Map();
  for(const category of categories){
    const array=root.members.get(category);
    if(array?.kind!=='array')fail('The literal source has an incompatible evidence category.');
    const indexed=new Map();rows.set(category,indexed);
    for(const row of array.values){
      const identity=row.members?.get('id');
      if(row.kind!=='object'||identity?.kind!=='string'||!identity.text||indexed.has(identity.text))fail('The literal source contains missing or duplicate row identities.');
      indexed.set(identity.text,row);
    }
  }
  return {rawText,root,rows,eventId,stats:{tokens,depth:deepest}};
}

export function literalValue(index,node,absence='field'){
  if(!node)return {present:false,absence};
  return {present:true,kind:node.kind,raw:index.rawText.slice(node.start,node.end),
    ...(node.kind==='string'?{text:node.text}:{})};
}

// The publisher selects changes. Do not assign a changed label by comparing
// JavaScript values or source spelling here.
export function selectedLiteralChanges(before,after,changes,eventId){
  if(before.eventId!==eventId||after.eventId!==eventId||!Array.isArray(changes))fail('The recorded change list belongs to another event.');
  const rowTargets=new Set(),fieldTargets=new Set(),displayFields=new Set(['title','coverage','summary','routes','reconstruction']);
  const fieldName=name=>typeof name==='string'&&/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(name);
  return changes.map(change=>{
    if(!change||typeof change!=='object'||Array.isArray(change)||Object.keys(change).length!==4||
      !['kind','id','change','fields'].every(key=>Object.hasOwn(change,key))||
      ![...categories,'dossier'].includes(change.kind)||typeof change.id!=='string'||!change.id||
      !['added','removed','updated'].includes(change.change)||!Array.isArray(change.fields)||
      !change.fields.every(fieldName)||new Set(change.fields).size!==change.fields.length)fail('The recorded change descriptor is incompatible.');
    const dossier=change.kind==='dossier',target=change.kind+':'+change.id;
    const earlier=dossier?before.root:before.rows.get(change.kind).get(change.id);
    const later=dossier?after.root:after.rows.get(change.kind).get(change.id);
    if(dossier){
      if(change.id!==eventId||change.change!=='updated'||change.fields.some(field=>!displayFields.has(field)))fail('The recorded dossier target is unsupported.');
    }else{
      if(rowTargets.has(target))fail('The recorded change list repeats a row target.');
      rowTargets.add(target);
    }
    let values;
    if(change.change==='updated'){
      if(!earlier||!later||!change.fields.length)fail('The recorded update has no complete retained target.');
      values=change.fields.map(field=>{
        const key=target+':'+field;
        if(fieldTargets.has(key))fail('The recorded change list overlaps field targets.');
        fieldTargets.add(key);
        const old=earlier.members.get(field),next=later.members.get(field);
        if(!old&&!next)fail('The recorded field is absent at both endpoints.');
        return {field,before:literalValue(before,old),after:literalValue(after,next)};
      });
    }else{
      if(change.fields.length||(change.change==='added'?earlier||!later:!earlier||later))fail('The recorded row presence contradicts the change.');
      values=[{field:null,before:literalValue(before,earlier,'row'),after:literalValue(after,later,'row')}];
    }
    return {...change,values};
  });
}

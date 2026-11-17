// A later spacing edge may put back spaces that text extraction removed.
// True when after equals before with inserted spaces only, at every depth.
export function spacedOnly(before,after){
 if(typeof before==='string'&&typeof after==='string'){
  if(before===after)return true;
  let at=0;
  for(let index=0;index<after.length;index++){if(at<before.length&&after[index]===before[at])at++;else if(after[index]!==' ')return false;}
  return at===before.length;
 }
 if(Array.isArray(before))return Array.isArray(after)&&after.length===before.length&&before.every((value,index)=>spacedOnly(value,after[index]));
 if(before&&typeof before==='object'){
  if(!after||typeof after!=='object'||Array.isArray(after))return false;
  const keys=Object.keys(before);
  return Object.keys(after).length===keys.length&&keys.every(key=>Object.hasOwn(after,key)&&spacedOnly(before[key],after[key]));
 }
 return Object.is(before,after);
}

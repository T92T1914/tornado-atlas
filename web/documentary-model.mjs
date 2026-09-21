export function issuedAt(records,utc) {
  const now=Date.parse(utc);
  if(!Number.isFinite(now)) throw new Error('Invalid evidence time');
  return records.filter(r=>Date.parse(r.issued)<=now).sort((a,b)=>Date.parse(a.issued)-Date.parse(b.issued));
}
export function activeWarnings(records,utc) {
  const latest=new Map();
  for(const record of issuedAt(records,utc)) if(record.event_id) latest.set(record.event_id,record);
  return [...latest.values()].filter(r=>r.polygon && Date.parse(r.expires)>Date.parse(utc));
}
export function splitPercent(value) {
  const n=Number(value);return Number.isFinite(n)?Math.min(100,Math.max(0,n)):50;
}

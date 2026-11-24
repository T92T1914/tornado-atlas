// Widths a source reports for a stated period. A width belongs to its period
// and to its own definition. It is never carried to another clock. Its place
// in the scene is the replay's center position, which this record does not
// take from the width's source, so the record has to say so. The record names
// its own sources and does not depend on what the rest of the package declares.
const idPattern=/^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const utcPattern=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
// Plain addresses only, so the build and the browser read them the same way.
const addressPattern=/^https:\/\/[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?(?:\/[A-Za-z0-9._~%+\/-]*)?$/;
const fragmentPattern=/^[A-Za-z0-9=&._-]+$/;
const TOP_FIELDS=['event','placement','placement_note','placement_note_published','schema','sources','widths'];
const SOURCE_FIELDS=['citation','id','retained_copy','sha256','url'];
const WIDTH_FIELDS=['approximate','end_utc','id','limits','locator','locator_url','metres','quantity','reviewed_on','source_id','start_utc','statement'];
// Readable text: bounded, with a letter in it, no control characters and no
// characters outside the basic plane, which the two validators would count differently.
const text=value=>typeof value==='string'&&value.length>=1&&value.length<=600&&/[A-Za-z]/.test(value)&&
  !/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202f\u2060\ud800-\udfff\ufeff]/.test(value);
const clockLabel=utc=>utc.slice(11,19);
const escaped=value=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const fields=(value,names)=>Boolean(value)&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join('|')===names.join('|');

export function validateReportedWidths(manifest,eventId,clock){
  const fail=message=>{throw new Error(message);};
  if(!fields(manifest,TOP_FIELDS)||manifest.schema!==1||manifest.event!==eventId)fail('Reported widths belong to a different event or schema.');
  if(manifest.placement!=='replay_center_position'||!text(manifest.placement_note)||!text(manifest.placement_note_published))
    fail('Reported widths need a stated placement and its limit.');
  if(!Array.isArray(manifest.sources)||!manifest.sources.length||manifest.sources.length>8)fail('Reported widths need a bounded source list.');
  const sources=new Map();
  for(const source of manifest.sources){
    if(!fields(source,SOURCE_FIELDS))fail('Unsupported reported width source fields.');
    if(typeof source.id!=='string'||!idPattern.test(source.id)||sources.has(source.id))fail('Reported width sources need distinct identities.');
    if(!text(source.citation)||![source.url,source.retained_copy].every(value=>typeof value==='string'&&addressPattern.test(value)))
      fail('A reported width source needs a citation and plain HTTPS addresses.');
    if(typeof source.sha256!=='string'||!/^[a-f0-9]{64}$/.test(source.sha256))fail('A reported width source needs the digest of its retained copy.');
    sources.set(source.id,source);
  }
  if(!Array.isArray(manifest.widths)||!manifest.widths.length||manifest.widths.length>16)fail('Reported widths need a bounded list.');
  const lower=Date.parse(clock.start_utc),upper=Date.parse(clock.end_utc),ids=new Set();
  let previousEnd=-Infinity;
  for(const width of manifest.widths){
    if(!fields(width,WIDTH_FIELDS))fail('Unsupported reported width fields.');
    if(typeof width.id!=='string'||!idPattern.test(width.id)||ids.has(width.id))fail('Reported widths need distinct identities.');
    ids.add(width.id);
    const source=typeof width.source_id==='string'?sources.get(width.source_id):null;
    if(!source)fail('A reported width names a source its record does not declare.');
    if(width.quantity!=='visible_funnel_width')fail('Unsupported reported width quantity.');
    if(!Number.isInteger(width.metres)||width.metres<10||width.metres>10000||width.approximate!==true)
      fail('A reported width needs whole metres and its approximate mark.');
    if(![width.start_utc,width.end_utc].every(value=>typeof value==='string'&&utcPattern.test(value)))fail('Reported width periods need whole second UTC.');
    const start=Date.parse(width.start_utc),end=Date.parse(width.end_utc);
    const real=(stamp,value)=>Number.isFinite(stamp)&&new Date(stamp).toISOString().slice(0,19)+'Z'===value;
    if(!real(start,width.start_utc)||!real(end,width.end_utc))fail('Reported width periods need whole second UTC.');
    if(start>=end||start<lower||end>upper||start<=previousEnd)
      fail('Reported width periods must be ordered, separate and inside the replay clock.');
    previousEnd=end;
    for(const key of ['statement','limits','locator'])if(!text(width[key]))fail('A reported width needs its statement, limits and locator.');
    // The statement is what the visitor reads, so it has to carry the size as an
    // approximate figure and the whole period that the drawing uses, in order.
    const size=new RegExp(`(?:^|[^A-Za-z0-9.])[Aa]bout ${width.metres} m(?=[ ,.]|$)`);
    const period=new RegExp(`(?:^|[^0-9:])${escaped(clockLabel(width.start_utc))} to ${escaped(clockLabel(width.end_utc))} UTC(?=[ ,.]|$)`);
    if(!size.test(width.statement)||!period.test(width.statement))fail('A reported width statement must name its approximate size and its period.');
    // The locator points to a place inside the retained copy whose digest the source carries.
    const place=typeof width.locator_url==='string'&&width.locator_url.startsWith(source.retained_copy+'#')?
      width.locator_url.slice(source.retained_copy.length+1):'';
    if(!fragmentPattern.test(place))fail('A reported width locator must point into its retained source copy.');
    const reviewed=typeof width.reviewed_on==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(width.reviewed_on)?Date.parse(width.reviewed_on+'T00:00:00Z'):NaN;
    if(!Number.isFinite(reviewed)||new Date(reviewed).toISOString().slice(0,10)!==width.reviewed_on)fail('A reported width needs its review date.');
  }
  return manifest;
}

// The width whose reported period holds this clock, or null. The source prints
// its periods to the second and so does the replay clock, so the whole second
// of the clock decides, and both end seconds of a period belong to it.
export function reportedWidthAt(manifest,startUtc,seconds){
  if(!Number.isFinite(seconds))throw new RangeError('Invalid reported width clock');
  if(!manifest)return null;
  const stamp=Date.parse(startUtc)+Math.floor(seconds)*1000;
  return manifest.widths.find(width=>stamp>=Date.parse(width.start_utc)&&stamp<=Date.parse(width.end_utc))??null;
}

// A circle of that diameter on the flat ground around a center, in the
// kilometers of the local stage.
export function groundCircle(center,metres,segments=64){
  if(!Array.isArray(center)||center.length!==3||!center.every(Number.isFinite)||!Number.isFinite(metres)||metres<=0||
    !Number.isInteger(segments)||segments<12||segments>180)throw new RangeError('Invalid ground circle');
  const radius=metres/2000;
  return Array.from({length:segments},(_,i)=>{
    const angle=i/segments*Math.PI*2;
    return [center[0]+radius*Math.cos(angle),center[1]+radius*Math.sin(angle),0];
  });
}

// The short tag that sits inside the scene while a width is drawn.
export function reportedWidthTag(width){
  return `Reported width, about ${width.metres} m. For scale, not a footprint.`;
}

// The full text under the scene: the mark, the source's statement and its
// limit, where the circle was put, and what the circle is not. A center that is
// a published position is not called interpolated.
export const SCALE_NOTE='The circle shows that size at the scale of the scene. It is not a footprint, a damage width or a wind field.';
export function reportedWidthCaption(manifest,width,{published=false,inView=true}={}){
  const placement=published?manifest.placement_note_published:manifest.placement_note;
  return `Dashed circle: ${width.statement} ${width.limits} ${placement} ${SCALE_NOTE}${inView?'':' The circle is outside this view.'}`;
}

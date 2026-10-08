// Chapter prose can describe an interval or a time before the first map point.
// A navigation target exists only when its key matches a published map minute.
export function replayChapters(history,positions,start){
  if(!Array.isArray(history?.chapters))return [];
  const points=new Map();
  for(const position of positions){
    const label=position.properties?.source_name;
    const minute=typeof label==='string'&&/^\d{1,2}:\d{2}$/.test(label)?Number(label.split(':')[1]):null;
    if(minute!==null)points.set(minute,points.has(minute)?null:position);
  }
  return history.chapters.map(chapter=>{
    const point=points.get(chapter.minute);
    return {...chapter,mapSeconds:point?(point.stamp-start)/1000:null,mapTime:point?.properties.display_time??null};
  });
}

export function chapterAt(chapters,seconds){
  if(!Number.isFinite(seconds))throw new RangeError('Invalid replay time');
  return chapters.filter(chapter=>chapter.mapSeconds!==null&&chapter.mapSeconds<=seconds).at(-1)??null;
}

export function adjacentChapter(chapters,seconds,direction){
  if(!Number.isFinite(seconds)||![-1,1].includes(direction))throw new RangeError('Invalid chapter navigation');
  const available=chapters.filter(chapter=>chapter.mapSeconds!==null);
  return direction<0?available.filter(chapter=>chapter.mapSeconds<seconds).at(-1)??null:
    available.find(chapter=>chapter.mapSeconds>seconds)??null;
}

import {PlaybackClock} from './playback-model.mjs';
import {chronologyAt} from './chronology-model.mjs';

export function mountChronology(container,data,event){
  const make=(tag,text,parent=container)=>{const node=document.createElement(tag);if(text)node.textContent=text;parent.append(node);return node;};
  container.hidden=false;
  make('h2',data.title);
  make('p',data.clock.basis);
  const start=Date.parse(data.entries[0].utc),duration=(Date.parse(data.entries.at(-1).utc)-start)/1000;
  const clock=new PlaybackClock(duration),format=new Intl.DateTimeFormat('en-US',{timeZone:data.clock.time_zone,hour:'numeric',minute:'2-digit',timeZoneName:'short'});
  const label=seconds=>format.format(new Date(start+seconds*1000));
  const bar=make('div');bar.className='chronology-controls';
  const play=make('button','Play chronology',bar),previous=make('button','Previous entry',bar),next=make('button','Next entry',bar);
  const rateLabel=make('label','Playback speed ',bar),rate=make('select','',rateLabel);rate.setAttribute('aria-label','Chronology playback speed');
  for(const value of [1,15,60,120]){const option=make('option',`${value}x`,rate);option.value=value;option.selected=value===60;}
  const time=make('p');time.className='chronology-time';time.id='chronology-clock';
  const rangeLabel=make('label','Historical time');rangeLabel.htmlFor='chronology-time';
  const range=make('input');range.type='range';range.id='chronology-time';range.min=0;range.max=duration;range.step=60;range.value=0;
  const pickerLabel=make('label','Documentary entry');pickerLabel.htmlFor='chronology-entry';
  const picker=make('select');picker.id='chronology-entry';
  data.entries.forEach((entry,i)=>{const option=make('option',`${entry.precision==='approximate_minute'?'About ':''}${label((Date.parse(entry.utc)-start)/1000)}: ${entry.title}`,picker);option.value=i;});
  const card=make('article');card.className='chronology-record';
  const status=make('p','',card),title=make('h3','',card),account=make('p','',card),limits=make('p','',card),source=make('a','',card),original=make('p','',card);
  const share=make('a','Link to this moment');share.id='chronology-link';
  make('p','The moving clock selects documentary entries. No registered images, tornado positions or wind estimates are supplied by this chronology.');
  let frame=null,lastEntry=null;
  const url=seconds=>{const value=new URL(location.href);value.searchParams.set('event',event.id);value.searchParams.set('t',Math.floor(seconds/60)*60);return value;};
  function refresh(){
    const match=chronologyAt(data,clock.seconds),entry=match.entry;
    time.textContent=label(clock.seconds);range.value=clock.seconds;range.setAttribute('aria-valuetext',label(clock.seconds));
    status.textContent=match.elapsedSeconds<60?'Selected source minute.':'Latest earlier entry. No new observation is supplied at the selected minute.';
    picker.value=match.index;previous.disabled=clock.seconds<=0;next.disabled=match.index===data.entries.length-1;
    share.href=url(clock.seconds);
    if(lastEntry!==entry.id){
      lastEntry=entry.id;title.textContent=entry.title;account.textContent=entry.account;limits.textContent=entry.limits;
      const record=data.sources.find(row=>row.id===entry.source_id);
      source.href=`${record.url}#page=${entry.page}`;source.textContent=`${record.title}: ${entry.locator}`;
      original.textContent=`Source clock: ${entry.source_time}. ${entry.precision==='approximate_minute'?'Approximate time, with no numerical error bound supplied.':'Reported to the minute. Clock accuracy is not established.'}`;
    }
  }
  function pause(){clock.pause(performance.now());if(frame!==null)cancelAnimationFrame(frame);frame=null;play.textContent='Play chronology';}
  function seek(seconds,{historyMode='push'}={}){pause();clock.seek(seconds);refresh();if(historyMode)history[historyMode==='push'?'pushState':'replaceState'](null,'',url(clock.seconds));}
  function restore(){const value=new URLSearchParams(location.search).get('t');const seconds=value===null?0:Number(value);seek(Number.isFinite(seconds)?seconds:0,{historyMode:null});}
  function animate(now){frame=null;clock.tick(now);refresh();if(clock.playing)frame=requestAnimationFrame(animate);else {play.textContent='Play chronology';history.replaceState(null,'',url(clock.seconds));}}
  play.addEventListener('click',()=>{if(clock.playing){pause();refresh();history.replaceState(null,'',url(clock.seconds));}else{clock.play(performance.now());play.textContent='Pause chronology';frame=requestAnimationFrame(animate);}});
  picker.addEventListener('change',()=>seek((Date.parse(data.entries[Number(picker.value)].utc)-start)/1000));
  previous.addEventListener('click',()=>{const earlier=data.entries.filter(entry=>Date.parse(entry.utc)<start+clock.seconds*1000);seek((Date.parse((earlier.at(-1)||data.entries[0]).utc)-start)/1000);});
  next.addEventListener('click',()=>{const match=chronologyAt(data,clock.seconds);seek((Date.parse(data.entries[Math.min(match.index+1,data.entries.length-1)].utc)-start)/1000);});
  range.addEventListener('input',()=>seek(Number(range.value),{historyMode:'replace'}));
  rate.addEventListener('change',()=>{clock.setRate(Number(rate.value),performance.now());refresh();});
  const hidden=()=>{if(document.hidden){pause();refresh();}},reduce=event=>{if(event.matches){pause();refresh();}};
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  document.addEventListener('visibilitychange',hidden);reduced.addEventListener('change',reduce);window.addEventListener('popstate',restore);
  restore();
  return ()=>{pause();document.removeEventListener('visibilitychange',hidden);reduced.removeEventListener('change',reduce);window.removeEventListener('popstate',restore);};
}

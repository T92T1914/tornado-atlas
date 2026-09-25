import {anchorAt,sourceLink,sourceTime,matchPassages} from './footage-model.mjs';
import {localStamp} from './timeline-media-model.mjs';
const el=(tag,text,cls)=>{const e=document.createElement(tag);if(text)e.textContent=text;if(cls)e.className=cls;return e;};
const external=(text,href)=>{const a=el('a',text);a.href=href;a.target='_blank';a.rel='noopener';return a;};

let api;
function youtubeAPI() {
  if(window.YT?.Player)return Promise.resolve(window.YT);
  if(api)return api;
  api=new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{api=null;reject(new Error('Player connection timed out. Use the original video link.'));},15000);
    window.onYouTubeIframeAPIReady=()=>{clearTimeout(timer);resolve(window.YT);};
    const script=document.createElement('script');script.src='https://www.youtube.com/iframe_api';
    script.onerror=()=>{clearTimeout(timer);api=null;reject(new Error('YouTube could not be loaded. Use the original video link.'));};
    document.head.append(script);
  });
  return api;
}

export function mountFootage(data,start,seek,stop,{headingLevel=3,formatTime=localStamp,clockLabel='Historical clock (CDT)',onMomentSelect=null,restoreInitialMoment=true}={}) {
  if(![2,3].includes(headingLevel))throw new RangeError('Unsupported footage heading level');
  const host=document.getElementById('registered-footage');
  host.append(el('p','ORIGINAL FOOTAGE / CHECKED CLOCK READINGS','eyebrow'),el(`h${headingLevel}`,'See the storm at a recorded moment'),el('p',data.introduction));
  const list=el('div',null,'footage-moments');list.setAttribute('aria-label','Registered video moments');host.append(list);
  const summary=el('p',null,'footage-status');summary.id='footage-status';summary.setAttribute('role','status');host.append(summary);
  const controls=el('div',null,'footage-controls'),load=el('button','Load original YouTube player'),reset=el('button','Return to the checked moment'),unload=el('button','Close player');
  for(const button of [load,reset,unload])button.type='button';
  load.disabled=true;reset.hidden=true;unload.hidden=true;controls.append(load,reset,unload);host.append(controls);
  const frame=el('div',null,'footage-player');frame.hidden=true;host.append(frame);
  const state=el('p',null,'fineprint');state.setAttribute('role','status');host.append(state);
  const caption=el('div',null,'footage-caption');host.append(caption);
  host.append(el('p','The player connects to YouTube only when loaded. Media stays with its creator. Ads, embedding restrictions and playback availability are controlled by YouTube and the uploader.','fineprint'));
  const details=el('details');details.append(el('summary','Clock registration, coverage and source availability'),el('p',data.method),el('p',data.coverage));
  const table=el('table'),thead=el('thead'),tr=el('tr');[clockLabel,'Video position','Evidence'].forEach(t=>tr.append(el('th',t)));thead.append(tr);table.append(thead);
  const tbody=el('tbody');
  for(const anchor of data.anchors){const row=el('tr');row.append(el('td',formatTime(anchor.utc)),el('td',sourceTime(anchor.video_seconds)),el('td','Visible clock; sampled frame'));tbody.append(row);}table.append(tbody);const wrapper=el('div',null,'footage-table');wrapper.append(table);details.append(wrapper);
  for(const check of data.access_checks)details.append(el('p',check.note+' Checked '+data.reviewed+'. '),external(check.label,check.url));
  host.append(details);
  let selected=null,player=null,ready=false,loading=false,generation=0,freezeAfterSeek=false,playerTimer=null;
  function close(){generation++;clearTimeout(playerTimer);loading=false;ready=false;player?.destroy();player=null;frame.replaceChildren();frame.hidden=true;reset.hidden=true;unload.hidden=true;load.hidden=false;load.disabled=!selected;load.textContent='Load original YouTube player';state.textContent='';}
  function cue(){if(!player||!ready||!selected)return;freezeAfterSeek=true;player.pauseVideo();player.seekTo(selected.video_seconds,true);state.textContent='Requested the checked video position. The host may seek to a nearby frame; compare the visible clock. Starting video playback leaves the map paused.';}
  function freeze(){if(selected)seek((Date.parse(selected.utc)-start)/1000);else stop();}
  for(const anchor of data.anchors) {
    const button=el('button',formatTime(anchor.utc));button.type='button';button.dataset.anchor=anchor.id;button.setAttribute('aria-pressed','false');button.title=anchor.note;
    button.addEventListener('click',()=>{
      if(onMomentSelect){onMomentSelect(anchor);return;}
      const url=new URL(location.href);url.searchParams.set('footage',anchor.id);url.hash='registered-footage';history.replaceState(null,'',url);seek((Date.parse(anchor.utc)-start)/1000);
    });list.append(button);
  }
  function update(utc) {
    const next=anchorAt(data.anchors,utc);
    if(next?.id===selected?.id&&summary.textContent)return;
    selected=next;
    for(const button of list.children)button.setAttribute('aria-pressed',String(button.dataset.anchor===selected?.id));
    load.disabled=!selected||loading;reset.disabled=!selected;
    if(!selected){player?.pauseVideo();frame.hidden=true;reset.hidden=true;summary.textContent='No checked video frame at this selected second. Choose one of the recorded moments above.';caption.replaceChildren();state.textContent='Unreviewed intervals are left unassigned. The last camera view is not held as evidence for later times.';return;}
    const source=data.sources.find(s=>s.id===selected.source_id);
    summary.textContent=`${formatTime(selected.utc)} · ${source.creator} · video ${sourceTime(selected.video_seconds)}`;
    caption.replaceChildren(el('p',selected.note),el('p',source.clock_basis,'fineprint'),el('p',source.limits,'fineprint'),external('Watch this moment on the original upload',sourceLink(source,selected)),el('p',source.rights,'fineprint'));
    const momentURL=new URL(location.href);momentURL.searchParams.set('footage',selected.id);momentURL.hash='registered-footage';
    caption.append(external('Link to this moment in the exhibit',momentURL.href));
    if(player&&ready){frame.hidden=false;reset.hidden=false;cue();}else state.textContent='Load the original player, or open the timestamped source link. Camera location and bearing have not been registered for this upload.';
  }
  load.addEventListener('click',async()=>{
    if(!selected||loading)return;freeze();loading=true;load.disabled=true;load.textContent='Loading YouTube…';const token=++generation;
    state.textContent='Connecting to the original video host…';
    try {
      const YT=await youtubeAPI();if(token!==generation)return;
      const source=data.sources[0];const mount=el('div');frame.replaceChildren(mount);frame.hidden=!selected;unload.hidden=false;
      playerTimer=setTimeout(()=>{if(token!==generation||ready)return;close();state.textContent='The video host did not respond. Retry loading or use the timestamped source link below.';},20000);
      player=new YT.Player(mount,{host:'https://www.youtube-nocookie.com',width:'100%',height:'100%',videoId:source.video_id,
        playerVars:{playsinline:1,autoplay:0,rel:0,origin:location.origin,start:Math.floor(selected?.video_seconds||0)},
        events:{onReady:event=>{if(token!==generation)return;clearTimeout(playerTimer);player=event.target;ready=true;loading=false;load.hidden=true;reset.hidden=!selected;player.mute();if(selected)cue();else player.pauseVideo();},
          onStateChange:event=>{if(token!==generation)return;if(event.data===2)freezeAfterSeek=false;if(event.data===1){freeze();if(freezeAfterSeek){freezeAfterSeek=false;event.target.pauseVideo();return;}state.textContent='Source playback is running. The map remains at the checked moment; subsequent frames are not continuously registered. Use Return to the checked moment to compare again.';}},
          onError:()=>{if(token!==generation)return;close();state.textContent='The original host could not play this video here. Use the timestamped source link below.';}}});
    }catch(error){if(token!==generation)return;loading=false;load.disabled=!selected;load.textContent='Retry loading YouTube';state.textContent=error.message;}
  });
  reset.addEventListener('click',()=>{freeze();cue();});unload.addEventListener('click',close);
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&ready)player.pauseVideo();});
  const initial=data.anchors.find(a=>a.id===new URL(location.href).searchParams.get('footage'));
  if(initial&&restoreInitialMoment)requestAnimationFrame(()=>seek((Date.parse(initial.utc)-start)/1000));
  return update;
}

export function mountReadingTools(data) {
  const guide=document.getElementById('reading-footage');
  for(const item of data.guide){const article=el('article');article.id=item.id;article.append(el('h3',item.title),el('p',item.text));item.sources.forEach(source=>article.append(external(source.label,source.url)));guide.append(article);}
  const input=document.getElementById('passage-search'),out=document.getElementById('passage-results'),count=document.getElementById('passage-count');
  const entries=[...document.querySelectorAll('.exhibit-story h2,.exhibit-story h3')].map(heading=>{
    if(!heading.id)heading.id=`passage-${entriesCount++}`;
    const content=[];
    for(let next=heading.nextElementSibling;next&&!next.matches('h2,h3,section,article');next=next.nextElementSibling)content.push(next.textContent);
    return {id:heading.id,title:heading.textContent,text:content.join(' ').replace(/\s+/g,' ').trim()};
  });
  function search(){const results=matchPassages(entries,input.value);out.replaceChildren();count.textContent=!input.value.trim()?'Search the history, warnings, damage notes and research.':results.length?`${results.length} matching sections shown (up to 12).`:'No matching section. Try fewer words.';
    for(const item of results){const li=el('li'),a=el('a',item.title);a.href='#'+item.id;li.append(a);out.append(li);}}
  input.addEventListener('input',search);search();
}
let entriesCount=0;

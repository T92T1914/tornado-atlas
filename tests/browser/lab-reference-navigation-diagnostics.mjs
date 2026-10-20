// Passive, bounded evidence for the three retained rapid-navigation journeys.
// This does not change request arguments/results, navigation or the strict fixture.
const ASSETS=[
  '/assets/moore-2013/IMG_9287-800.jpg',
  '/assets/tuscaloosa-birmingham-2011/tornado-video-frames-oliveira2019.png'
];
const EVENTS=['el-reno-2013','joplin-2011','blackwell-1955','tuscaloosa-birmingham-2011','moore-2013','udall-1955'];
const ROUTES=['/index.html','/joplin.html','/blackwell.html','/tuscaloosa.html','/moore.html','/udall.html','/study.html','/wind.html','/dossier.html'];
const PREFIX='ATLAS_LAB_REFERENCE_NAV_EVENT ';
const OUTPUT_PREFIX='LAB_REFERENCE_NAV_DIAGNOSTICS ';
const MAX_ROWS=64,MAX_ROW_BYTES=11000,MAX_OUTPUT_BYTES=16384;
const MAX_ORDINARY_ROWS=48,MAX_ORDINARY_BYTES=7000;

export async function observeLabReferenceNavigation(t,page,{base,label}){
  const origin=new URL(base).origin,started=Date.now(),requests=new WeakMap();
  const counters={events:0,retained_rows:0,omitted_rows:0,ordinary_retained:0,critical_retained:0,ordinary_omitted:0,critical_omitted:0,ordinary_evicted:0,requests_outside_assets:0,transport_invalid:0};
  const kinds={},pending=[];let retainedBytes=0,ordinaryBytes=0,emittedBytes=0,nextRequest=0,closed=false;
  function route(href){
    try{
      const url=new URL(href,base);
      const result={origin:url.origin===origin?origin:url.origin==='null'?'null':'outside_scope'};
      if(url.origin===origin&&ROUTES.includes(url.pathname)){
        result.path=url.pathname;
        const event=url.searchParams.get('event');result.event=EVENTS.includes(event)?event:null;
        result.fragment=/^#[a-zA-Z0-9_.:-]{0,128}$/.test(url.hash)?url.hash:'';
      }else if(url.origin===origin&&ASSETS.includes(url.pathname))result.asset=url.pathname;
      else result.path='outside_known_routes';
      return result;
    }catch{return {origin:'unavailable',path:'unavailable'};}
  }
  function watched(href){
    try{const url=new URL(href,base);return url.origin===origin&&ASSETS.includes(url.pathname)?url.pathname:null;}
    catch{return null;}
  }
  function message(text){
    const value=String(text),asset=ASSETS.find(path=>value.includes(path));
    if(asset)return {asset,message:value.replaceAll(origin,'[loopback]').replace(/https?:\/\/[^ "'<>\s]+/g,'[scoped URL]').replace(/\/?127\.0\.0\.1:\d+/g,'[loopback]').slice(0,512)};
    if(/WebGL 2 is unavailable|Form study initialization failed|The renderer could not start/.test(value))
      return {message:'Existing Form renderer unavailable diagnosis',raw_text_omitted:true};
    return {message_outside_asset_scope:true};
  }
  function critical(kind,data){
    return ['request','request_failed','browser_fetch_call','browser_fetch_abort','pageerror','browser_error','browser_unhandled_rejection',
      'browser_navigation_navigate','browser_pagehide','main_frame_navigation'].includes(kind)
      ||(kind==='console'&&data.type==='error'&&Boolean(data.asset));
  }
  function omitted(row){
    counters.omitted_rows++;counters[row.critical?'critical_omitted':'ordinary_omitted']++;
  }
  function discard(row){
    counters.retained_rows--;counters[row.critical?'critical_retained':'ordinary_retained']--;
    const size=Buffer.byteLength(JSON.stringify(row),'utf8');retainedBytes-=size;if(!row.critical)ordinaryBytes-=size;
    omitted(row);
  }
  function record(kind,data={}){
    counters.events++;kinds[kind]=(kinds[kind]??0)+1;
    const row={seq:counters.events,received_ms:Date.now()-started,kind,critical:critical(kind,data),...data};
    const size=Buffer.byteLength(JSON.stringify(row),'utf8');
    if(!row.critical&&(counters.ordinary_retained>=MAX_ORDINARY_ROWS||ordinaryBytes+size>MAX_ORDINARY_BYTES)){omitted(row);return;}
    while(row.critical&&(counters.retained_rows>=MAX_ROWS||retainedBytes+size>MAX_ROW_BYTES)){
      const index=pending.findIndex(saved=>!saved.critical);
      if(index<0)break;
      const [evicted]=pending.splice(index,1);discard(evicted);counters.ordinary_evicted++;
    }
    if(counters.retained_rows>=MAX_ROWS||retainedBytes+size>MAX_ROW_BYTES){omitted(row);return;}
    pending.push(row);counters.retained_rows++;counters[row.critical?'critical_retained':'ordinary_retained']++;
    retainedBytes+=size;if(!row.critical)ordinaryBytes+=size;
  }
  function report(stage){
    const rows=pending.splice(0),make=()=>({label,stage,origin,limits:{rows:MAX_ROWS,row_bytes:MAX_ROW_BYTES,ordinary_rows:MAX_ORDINARY_ROWS,ordinary_bytes:MAX_ORDINARY_BYTES,critical_reservation_rows:16,critical_reservation_bytes:4000,output_bytes:MAX_OUTPUT_BYTES},
      counters:{...counters},kinds:{...kinds},rows,
      scope:'Passive scoped event ordering. No response-body or rendered acceptance. Browser/Node transport ordering is not precise native scheduling.'});
    const reserve=stage==='body_finished'?2048:0,available=MAX_OUTPUT_BYTES-emittedBytes-reserve;
    let payload=make(),text=OUTPUT_PREFIX+JSON.stringify(payload),size=Buffer.byteLength(text,'utf8')+1;
    while(size>available&&rows.length){
      let index=rows.findLastIndex(row=>!row.critical);if(index<0)index=rows.length-1;
      const [dropped]=rows.splice(index,1);discard(dropped);payload=make();text=OUTPUT_PREFIX+JSON.stringify(payload);size=Buffer.byteLength(text,'utf8')+1;
    }
    if(size>available)return;
    emittedBytes+=size;t.diagnostic(text);
  }
  function requestFrame(request){
    try{return route(request.frame().url());}catch{return {origin:'unavailable',path:'frame_unavailable'};}
  }
  page.on('request',request=>{
    const asset=watched(request.url());if(!asset){counters.requests_outside_assets++;return;}
    const id=++nextRequest;requests.set(request,{id,asset});
    record('request',{id,asset,method:request.method(),resource_type:request.resourceType(),frame:requestFrame(request)});
  });
  page.on('response',response=>{
    const owned=requests.get(response.request());if(owned)record('response',{...owned,status:response.status()});
  });
  page.on('requestfinished',request=>{
    const owned=requests.get(request);if(owned)record('request_finished',{...owned,frame:requestFrame(request)});
  });
  page.on('requestfailed',request=>{
    const owned=requests.get(request);if(owned)record('request_failed',{...owned,frame:requestFrame(request),failure:String(request.failure()?.errorText??'unavailable').slice(0,256)});
  });
  page.on('framenavigated',frame=>{
    if(frame===page.mainFrame()){
      const current=route(frame.url());if(current.origin===origin)current.origin='loopback';
      if(!current.fragment)delete current.fragment;if(current.event===null)delete current.event;
      record('main_frame_navigation',{route:current});
    }
  });
  page.on('pageerror',error=>{record('pageerror',{name:String(error.name).slice(0,64),...message(error.message)});if(closed)report('error_after_page_close');});
  page.on('console',entry=>{
    const text=entry.text();
    if(text.startsWith(PREFIX)){
      if(text.length>4096){counters.transport_invalid++;return;}
      try{
        const event=JSON.parse(text.slice(PREFIX.length));
        if(!event||typeof event.kind!=='string'||!event.kind.startsWith('browser_')){counters.transport_invalid++;return;}
        if(['browser_navigation_navigate','browser_pagehide'].includes(event.kind)){
          const {kind,...browser}=event;record(kind,{browser});
        }else record(event.kind,{browser:event});
      }catch{counters.transport_invalid++;}
    }else record('console',{type:entry.type(),...message(text)});
  });
  page.once('close',()=>{closed=true;record('page_close');report('page_closed');});

  await page.addInitScript(({origin,assets,events,routes,prefix})=>{
    const debug=console.debug.bind(console);
    const knownRoute=href=>{
      try{
        const url=new URL(href,location.href),record={origin:url.origin===origin?origin:url.origin==='null'?'null':'outside_scope'};
        if(url.origin===origin&&routes.includes(url.pathname)){
          record.path=url.pathname;const selected=url.searchParams.get('event');record.event=events.includes(selected)?selected:null;
          record.fragment=/^#[a-zA-Z0-9_.:-]{0,128}$/.test(url.hash)?url.hash:'';
        }else record.path='outside_known_routes';
        return record;
      }catch{return {origin:'unavailable',path:'unavailable'};}
    };
    const selected=value=>events.includes(value)?value:null;
    const state=()=>{
      const host=document.getElementById('lab-reference-evidence'),lab=document.getElementById('lab-context'),image=document.getElementById('lab-reference-image');
      return {route:knownRoute(location.href),document_time_origin:performance.timeOrigin,now:performance.now(),
        selected_event:selected(document.getElementById('lab-event')?.value),
        experiment_ready:lab?.dataset.experimentReady??null,reference_state:host?.dataset.state??null,
        reference_event:selected(host?.dataset.event),reference_busy:host?.getAttribute('aria-busy')??null,
        image_present:Boolean(image),image_complete:image?.complete??null,
        image_width:image?.naturalWidth??null,image_height:image?.naturalHeight??null,
        image_src_kind:image?.currentSrc?.startsWith('blob:')?'blob':image?.currentSrc?'other':'empty'};
    };
    const emit=(kind,data={})=>{
      const snapshot=state();
      if(kind==='browser_navigation_navigate'||kind==='browser_pagehide'){
        const compact=route=>{
          const value={...route};if(value.origin===origin)value.origin='loopback';
          if(!value.fragment)delete value.fragment;if(value.event===null)delete value.event;return value;
        };
        const {document_time_origin,now,selected_event,experiment_ready,reference_state,reference_event,reference_busy}=snapshot;
        const fields={...data};if(fields.destination)fields.destination=compact(fields.destination);
        debug(prefix+JSON.stringify({kind,...fields,state:{route:compact(snapshot.route),document_time_origin,now,
          selected_event,experiment_ready,reference_state,reference_event,reference_busy}}));
      }else debug(prefix+JSON.stringify({kind,...data,state:snapshot}));
    };
    const scopeMessage=value=>{
      const text=String(value),asset=assets.find(path=>text.includes(path));
      return asset?{asset,message:text.replaceAll(origin,'[loopback]').replace(/https?:\/\/[^ "'<>\s]+/g,'[scoped URL]').replace(/\/?127\.0\.0\.1:\d+/g,'[loopback]').slice(0,512)}:{message_outside_asset_scope:true};
    };
    let nextFetch=0;
    const nativeFetch=window.fetch;
    window.fetch=function(...args){
      const result=Reflect.apply(nativeFetch,this,args);
      const input=args[0],href=typeof input==='string'?input:input instanceof URL?input.href:input?.url;
      let url;try{url=new URL(href,location.href);}catch{return result;}
      if(url.origin===origin&&assets.includes(url.pathname)){
        const id=++nextFetch,signal=args[1]?.signal??input?.signal;
        emit('browser_fetch_call',{id,asset:url.pathname,signal_present:Boolean(signal),signal_aborted:signal?.aborted??null});
        signal?.addEventListener('abort',()=>emit('browser_fetch_abort',{id,asset:url.pathname,signal_aborted:signal.aborted}),{once:true,passive:true});
      }
      return result;
    };
    window.addEventListener('pagehide',event=>emit('browser_pagehide',{persisted:event.persisted}),{passive:true});
    window.addEventListener('pageshow',event=>emit('browser_pageshow',{persisted:event.persisted}),{passive:true});
    window.addEventListener('unhandledrejection',event=>emit('browser_unhandled_rejection',{name:String(event.reason?.name??typeof event.reason).slice(0,64),...scopeMessage(event.reason?.message??event.reason)}),{passive:true});
    window.addEventListener('error',event=>emit('browser_error',{...scopeMessage(event.message)}),{passive:true});
    document.addEventListener('change',event=>{
      if(event.target?.id==='lab-event')emit('browser_reference_change');
    },{passive:true});
    document.addEventListener('click',event=>{
      const anchor=event.target.closest?.('a[href]');if(!anchor)return;
      const destination=knownRoute(anchor.href);
      if(destination.origin===origin&&destination.path!=='outside_known_routes')
        emit('browser_native_link_click',{trusted:event.isTrusted,button:event.button,ctrl:event.ctrlKey,meta:event.metaKey,shift:event.shiftKey,alt:event.altKey,default_prevented_at_capture:event.defaultPrevented,destination});
    },{capture:true,passive:true});
    const nativeNavigation=window.navigation,navigationAvailable=typeof nativeNavigation?.addEventListener==='function';
    if(navigationAvailable){
      nativeNavigation.addEventListener('navigate',event=>emit('browser_navigation_navigate',{
        navigation_type:String(event.navigationType).slice(0,32),can_intercept:event.canIntercept,hash_change:event.hashChange,user_initiated:event.userInitiated,
        destination:typeof event.destination?.url==='string'?knownRoute(event.destination.url):null,
        destination_same_document:event.destination?.sameDocument??null,default_prevented:event.defaultPrevented,
        signal_aborted:event.signal?.aborted??null,download_request_present:event.downloadRequest==null?null:true
      }),{passive:true});
      nativeNavigation.addEventListener('currententrychange',event=>emit('browser_navigation_current_entry_change',{
        navigation_type:String(event.navigationType).slice(0,32),
        current:typeof nativeNavigation.currentEntry?.url==='string'?knownRoute(nativeNavigation.currentEntry.url):null,
        from:typeof event.from?.url==='string'?knownRoute(event.from.url):null
      }),{passive:true});
    }
    emit('browser_observer_installed',{navigation_api_available:navigationAvailable});
  },{origin,assets:ASSETS,events:EVENTS,routes:ROUTES,prefix:PREFIX});
  return {report};
}

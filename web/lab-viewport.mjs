// Keep only a current laboratory interaction stable through synchronous source updates.
export function createLabViewportOwner() {
  let owner=null;
  const route=()=>location.pathname+location.hash;
  const clear=()=>{owner=null;};
  const eligible='#scene,#wind-field,.study-controls input,.study-controls select,.study-controls button,.scene-footer button,.passage input,.passage select,.passage button';
  const choose=event=>{
    if(!event.isTrusted)return;
    const target=event.target.closest?.(eligible);
    if(event.type==='pointerdown'&&(!event.isPrimary||event.button!==0)){clear();return;}
    if(['input','change'].includes(event.type)&&document.activeElement!==target)return;
    const editKey=target&&['INPUT','SELECT'].includes(target.tagName)&&!['Tab','Escape'].includes(event.key)&&!event.ctrlKey&&!event.metaKey;
    if(event.type==='keydown'&&!editKey&&!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Enter',' '].includes(event.key)){clear();return;}
    owner=target?{target,route:route()}:null;
  };
  const hidden=()=>{if(document.hidden)clear();};
  const events=[
    ['pointerdown',choose],['keydown',choose],['focusin',choose],['input',choose],['change',choose],['focusout',clear],['blur',clear],
    ['wheel',clear],['touchmove',clear],['pointercancel',clear],
    ['hashchange',clear],['popstate',clear],['resize',clear],['pagehide',clear],['visibilitychange',hidden],
  ];
  for(const[type,handler]of events)window.addEventListener(type,handler,{capture:true,passive:true});
  return {
    clear,
    update(change) {
      const held=owner;
      const current=()=>held&&owner===held&&held.target.isConnected&&held.route===route();
      const visible=r=>r?.width>0&&r.height>0&&r.bottom>0&&r.top<innerHeight&&r.right>0&&r.left<innerWidth;
      if(!current())return change();
      let style=null,previous=null,before=null,failed=false,setupError=null;
      const restore=()=>{
        if(previous&&style?.getPropertyValue('overflow-anchor')==='none'&&style.getPropertyPriority('overflow-anchor')==='important'){
          if(previous[0])style.setProperty('overflow-anchor',...previous);
          else style.removeProperty('overflow-anchor');
        }
      };
      try{
        style=document.scrollingElement?.style;
        previous=style?[style.getPropertyValue('overflow-anchor'),style.getPropertyPriority('overflow-anchor')]:null;
        // Measure with browser anchoring disabled so it cannot add another correction.
        style?.setProperty('overflow-anchor','none','important');
        before=current()?held.target.getBoundingClientRect():null;
        if(!visible(before)){restore();style=null;}
      }catch(error){setupError=error;}
      try{
        // Optional viewport measurement cannot prevent the source mutation.
        return change();
      }catch(error){failed=true;throw error;}
      finally{
        try{
          if(setupError)throw setupError;
          if(current()&&visible(before)){
            const after=held.target.getBoundingClientRect();
            if(after.width>0&&after.height>0&&after.top!==before.top)
              window.scrollBy({top:after.top-before.top,behavior:'instant'});
          }
        }catch(error){if(!failed){failed=true;throw error;}}
        finally{try{restore();}catch(error){if(!failed)throw error;}}
      }
    },
    retire(){
      clear();
      for(const[type,handler]of events)window.removeEventListener(type,handler,true);
    },
  };
}

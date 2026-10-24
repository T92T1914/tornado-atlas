import test from 'node:test';
import assert from 'node:assert/strict';
import {createLabViewportOwner} from '../web/lab-viewport.mjs';

// These bounded fixtures test explicit ownership, mutation and cleanup calls.
// Their linear document coordinates are authored controls, not native browser
// scrolling, CSS anchoring, event trust or layout measurements.
function fixture(t,{anchor='',priority='',scrollingElement=true}={}){
  const names=['window','document','location','innerWidth','innerHeight'];
  const saved=new Map(names.map(name=>[name,Object.getOwnPropertyDescriptor(globalThis,name)]));
  const listeners=new Map(),scrolls=[],styleCalls=[];
  const style={
    value:anchor,priority,writeError:null,
    getPropertyValue(name){assert.equal(name,'overflow-anchor');return this.value;},
    getPropertyPriority(name){assert.equal(name,'overflow-anchor');return this.priority;},
    setProperty(name,value,importance=''){
      assert.equal(name,'overflow-anchor');styleCalls.push({action:'set',value,priority:importance});
      if(this.writeError?.(value,importance))throw this.error;
      this.value=value;this.priority=importance;
    },
    removeProperty(name){assert.equal(name,'overflow-anchor');styleCalls.push({action:'remove'});const old=this.value;this.value='';this.priority='';return old;},
  };
  const win={scrollY:0,scrollError:null,
    addEventListener(type,callback,options){
      if(!listeners.has(type))listeners.set(type,new Map());
      listeners.get(type).set(callback,options);
    },
    removeEventListener(type,callback,capture){
      const options=listeners.get(type)?.get(callback);
      if(options)assert.equal(capture,Boolean(options.capture));
      listeners.get(type)?.delete(callback);
    },
    scrollBy(options){
      scrolls.push({...options});
      if(this.scrollError)throw this.scrollError;
      this.scrollY+=options.top??0;
    },
  };
  const doc={hidden:false,activeElement:null,scrollingElement:scrollingElement?{style}:null};
  const locationValue={pathname:'/study.html',hash:'',search:'?event=el-reno-2013'};
  for(const[name,value]of Object.entries({window:win,document:doc,location:locationValue,innerWidth:1280,innerHeight:900}))
    Object.defineProperty(globalThis,name,{configurable:true,writable:true,value});
  const node=({tag='select',id='',classes=[],parent=null,top=200,left=40,width=180,height=40,connected=true}={})=>{
    const element={tagName:tag.toUpperCase(),id,classes:new Set(classes),parentElement:parent,
      documentTop:top,left,width,height,isConnected:connected,reads:0,readError:null,
      getBoundingClientRect(){
        this.reads++;if(this.readError)throw this.readError;
        const y=this.documentTop-win.scrollY;
        return {top:y,bottom:y+this.height,left:this.left,right:this.left+this.width,width:this.width,height:this.height};
      },
      closest(selector){
        // A small independent descendant-selector matcher for authored fixture
        // nodes. No expected eligibility list is generated from the helper.
        const simple=(item,part)=>part.startsWith('#')?item.id===part.slice(1)
          :part.startsWith('.')?item.classes.has(part.slice(1)):item.tagName.toLowerCase()===part.toLowerCase();
        for(let candidate=this,depth=0;candidate&&depth<8;candidate=candidate.parentElement,depth++){
          for(const branch of selector.split(',')){
            const parts=branch.trim().split(/\s+/);if(!simple(candidate,parts.at(-1)))continue;
            let ancestor=candidate.parentElement,matched=true;
            for(let index=parts.length-2;index>=0;index--){
              let count=0;while(ancestor&&!simple(ancestor,parts[index])&&count++<8)ancestor=ancestor.parentElement;
              if(!ancestor){matched=false;break;}ancestor=ancestor.parentElement;
            }
            if(matched)return candidate;
          }
        }
        return null;
      },
    };
    return element;
  };
  const panel=node({tag:'div',classes:['study-controls']}),control=node({parent:panel});
  const outside=node({tag:'a',top:50}),other=node({tag:'button',parent:panel,top:300});
  const owner=createLabViewportOwner();
  t.after(()=>{
    owner.retire();
    for(const[name,descriptor]of saved){if(descriptor)Object.defineProperty(globalThis,name,descriptor);else delete globalThis[name];}
  });
  const emit=(type,target=control,fields={})=>{
    const event={type,target,isTrusted:true,isPrimary:true,button:0,key:'Enter',...fields};
    if(type==='focusin')doc.activeElement=target;
    if(type==='focusout'&&doc.activeElement===target)doc.activeElement=null;
    for(const callback of [...(listeners.get(type)?.keys()??[])])callback(event);
  };
  return {owner,win,doc,location:locationValue,node,control,other,outside,panel,style,styleCalls,scrolls,listeners,emit};
}

test('an unowned update mutates exactly once and returns the original object',t=>{
  const f=fixture(t),result={published:'current'},calls=[];
  assert.equal(f.owner.update(()=>{calls.push('source');return result;}),result);
  assert.deepEqual(calls,['source']);assert.deepEqual(f.scrolls,[]);assert.deepEqual(f.styleCalls,[]);
});

test('a visible owned control restores only the current synchronous vertical displacement',t=>{
  const f=fixture(t);f.emit('pointerdown');
  // This displacement happened before update. It must not be added again.
  f.control.documentTop=260;
  const value=Symbol('source return');let calls=0;
  assert.equal(f.owner.update(()=>{calls++;f.control.documentTop+=125;f.control.left+=70;return value;}),value);
  assert.equal(calls,1);assert.deepEqual(f.scrolls,[{top:125,behavior:'instant'}]);
  assert.equal(f.control.getBoundingClientRect().top,260);
});

test('negative vertical movement keeps its sign without a horizontal correction',t=>{
  const f=fixture(t);f.emit('focusin');
  f.owner.update(()=>{f.control.documentTop-=65;f.control.left-=15;});
  assert.deepEqual(f.scrolls,[{top:-65,behavior:'instant'}]);
});

test('horizontal or size changes alone do not request a scroll',t=>{
  const f=fixture(t);f.emit('keydown');
  f.owner.update(()=>{f.control.left+=300;f.control.width=250;f.control.height=60;});
  assert.deepEqual(f.scrolls,[]);
});

test('literal scene, Wind, study, footer and passage interactions can own an update',async t=>{
  const cases=[
    ['form scene',{tag:'canvas',id:'scene'},null],
    ['wind field',{tag:'canvas',id:'wind-field'},null],
    ['study input',{tag:'input'},'study-controls'],
    ['study select',{tag:'select'},'study-controls'],
    ['study button child',{tag:'button'},'study-controls'],
    ['scene footer button',{tag:'button'},'scene-footer'],
    ['passage input',{tag:'input'},'passage'],
    ['passage select',{tag:'select'},'passage'],
    ['passage button',{tag:'button'},'passage'],
  ];
  for(const[label,attributes,parentClass]of cases)await t.test(label,child=>{
    const f=fixture(child),parent=parentClass?f.node({tag:'div',classes:[parentClass]}):null;
    const target=f.node({...attributes,parent});
    const hit=label==='study button child'?f.node({tag:'span',parent:target}):target;
    f.emit('pointerdown',hit);f.owner.update(()=>{target.documentTop+=50;});
    assert.deepEqual(f.scrolls,[{top:50,behavior:'instant'}]);
  });
});

test('an untrusted synthetic event cannot acquire viewport ownership',t=>{
  const f=fixture(t);f.emit('pointerdown',f.control,{isTrusted:false});
  f.owner.update(()=>{f.control.documentTop+=100;});assert.deepEqual(f.scrolls,[]);
});

test('secondary pointer and noninteraction keyboard intent retire the old owner',async t=>{
  for(const[type,fields]of [['pointerdown',{button:2}],['pointerdown',{isPrimary:false}],['keydown',{key:'Tab'}],['keydown',{key:'Escape'}]])
    await t.test(type+' '+JSON.stringify(fields),child=>{
      const f=fixture(child);f.emit('focusin');f.emit(type,f.control,fields);
      f.owner.update(()=>{f.control.documentTop+=100;});assert.deepEqual(f.scrolls,[]);
    });
});

test('focused native input or change can reacquire ownership after scrolling stopped it',async t=>{
  for(const type of ['input','change'])await t.test(type,child=>{
    const f=fixture(child);f.emit('focusin');f.emit('wheel');f.emit(type);
    f.owner.update(()=>{f.control.documentTop+=25;});
    assert.deepEqual(f.scrolls,[{top:25,behavior:'instant'}]);
  });
});

test('input and change from an unfocused old control cannot steal the current owner',async t=>{
  for(const type of ['input','change'])await t.test(type,child=>{
    const f=fixture(child);f.emit('focusin',f.other);f.emit(type,f.control);
    f.owner.update(()=>{f.control.documentTop+=100;f.other.documentTop+=30;});
    assert.deepEqual(f.scrolls,[{top:30,behavior:'instant'}]);
  });
});

test('untrusted input and change cannot reacquire a cleared owner',async t=>{
  for(const type of ['input','change'])await t.test(type,child=>{
    const f=fixture(child);f.emit('focusin');f.owner.clear();f.emit(type,f.control,{isTrusted:false});
    f.owner.update(()=>{f.control.documentTop+=100;});assert.deepEqual(f.scrolls,[]);
  });
});

test('Home End and ordinary editing keys retain an input or select interaction',async t=>{
  for(const tag of ['input','select'])for(const key of ['Home','End','7','Backspace','Delete'])await t.test(tag+' '+key,child=>{
    const f=fixture(child),control=f.node({tag,parent:f.panel});f.emit('focusin',control);f.emit('keydown',control,{key});
    f.owner.update(()=>{control.documentTop+=15;});assert.deepEqual(f.scrolls,[{top:15,behavior:'instant'}]);
  });
});

test('a nonediting navigation key on a scene retires its viewport claim',t=>{
  const f=fixture(t),scene=f.node({tag:'canvas',id:'scene'});f.emit('focusin',scene);f.emit('keydown',scene,{key:'PageDown'});
  f.owner.update(()=>{scene.documentTop+=100;});assert.deepEqual(f.scrolls,[]);
});

test('wheel, touch, cancellation, focus loss and navigation signals retire ownership',async t=>{
  for(const type of ['wheel','touchmove','pointercancel','focusout','blur','hashchange','popstate','resize','pagehide'])
    await t.test(type,child=>{
      const f=fixture(child);f.emit('pointerdown');f.emit(type);
      let calls=0;f.owner.update(()=>{calls++;f.control.documentTop+=90;});
      assert.equal(calls,1);assert.deepEqual(f.scrolls,[]);
    });
});

test('moving focus outside model controls relinquishes the old interaction',t=>{
  const f=fixture(t);f.emit('focusin');f.emit('focusin',f.outside);
  f.owner.update(()=>{f.control.documentTop+=90;});assert.deepEqual(f.scrolls,[]);
});

test('a new focused control replaces the owner without restoring the previous target',t=>{
  const f=fixture(t);f.emit('focusin');
  f.owner.update(()=>{f.control.documentTop+=90;f.emit('focusin',f.other);});
  assert.deepEqual(f.scrolls,[]);
  f.owner.update(()=>{f.other.documentTop+=35;});assert.deepEqual(f.scrolls,[{top:35,behavior:'instant'}]);
});

test('reference clearing and hiding the document retire an existing owner',async t=>{
  for(const reason of ['reference clear','hidden document'])await t.test(reason,child=>{
    const f=fixture(child);f.emit('pointerdown');
    if(reason==='reference clear')f.owner.clear();else{f.doc.hidden=true;f.emit('visibilitychange');}
    f.owner.update(()=>{f.control.documentTop+=90;});assert.deepEqual(f.scrolls,[]);
  });
});

test('ownership lost inside the mutation cannot issue a late restoration',async t=>{
  for(const reason of ['wheel','touchmove','focusout','blur','reference clear','hidden document','retire'])await t.test(reason,child=>{
    const f=fixture(child);f.emit('pointerdown');
    f.owner.update(()=>{
      f.control.documentTop+=110;
      if(reason==='reference clear')f.owner.clear();
      else if(reason==='hidden document'){f.doc.hidden=true;f.emit('visibilitychange');}
      else if(reason==='retire')f.owner.retire();else f.emit(reason);
    });
    assert.deepEqual(f.scrolls,[]);assert.equal(f.style.value,'');assert.equal(f.style.priority,'');
  });
});

test('a changed path or fragment invalidates ownership even before its event arrives',async t=>{
  for(const route of ['path','fragment'])await t.test(route,child=>{
    const f=fixture(child);f.emit('pointerdown');
    f.owner.update(()=>{f.control.documentTop+=110;if(route==='path')f.location.pathname='/wind.html';else f.location.hash='#sources';});
    assert.deepEqual(f.scrolls,[]);
  });
});

test('ordinary experiment query serialization does not discard the current control',t=>{
  const f=fixture(t);f.emit('pointerdown');
  f.owner.update(()=>{f.location.search='?event=el-reno-2013&shape=rope';f.control.documentTop+=15;});
  assert.deepEqual(f.scrolls,[{top:15,behavior:'instant'}]);
});

test('a detached target is never restored before or during the mutation',async t=>{
  for(const stage of ['before','during'])await t.test(stage,child=>{
    const f=fixture(child);f.emit('pointerdown');if(stage==='before')f.control.isConnected=false;
    let calls=0;f.owner.update(()=>{calls++;f.control.documentTop+=60;if(stage==='during')f.control.isConnected=false;});
    assert.equal(calls,1);assert.deepEqual(f.scrolls,[]);
  });
});

test('an originally offscreen or empty rectangle has no viewport claim',async t=>{
  const rectangles=[{top:900},{top:-40},{left:1280},{left:-180},{width:0},{height:0}];
  for(const box of rectangles)await t.test(JSON.stringify(box),child=>{
    const f=fixture(child);Object.assign(f.control,{documentTop:box.top??200,left:box.left??40,width:box.width??180,height:box.height??40});
    f.emit('pointerdown');let calls=0;
    f.owner.update(()=>{calls++;f.control.documentTop=250;f.control.left=40;f.control.width=180;f.control.height=40;});
    assert.equal(calls,1);assert.deepEqual(f.scrolls,[]);
  });
});

test('a currently visible control displaced offscreen by source arrival is restored',t=>{
  const f=fixture(t);f.emit('pointerdown');f.owner.update(()=>{f.control.documentTop+=1200;});
  assert.deepEqual(f.scrolls,[{top:1200,behavior:'instant'}]);
  assert.equal(f.control.getBoundingClientRect().top,200);
});

test('prior native anchor value and priority are restored after successful changes',async t=>{
  for(const[anchor,priority]of [['',''],['auto',''],['auto','important'],['none','']])await t.test(JSON.stringify([anchor,priority]),child=>{
    const f=fixture(child,{anchor,priority});f.emit('pointerdown');
    f.owner.update(()=>{
      assert.equal(f.style.value,'none');assert.equal(f.style.priority,'important');f.control.documentTop+=20;
    });
    assert.equal(f.style.value,anchor);assert.equal(f.style.priority,priority);
    assert.equal(f.styleCalls[0].action,'set');
  });
});

test('an external anchor-style change is not overwritten by an older restoration',t=>{
  const f=fixture(t,{anchor:'auto'});f.emit('pointerdown');
  f.owner.update(()=>{f.style.setProperty('overflow-anchor','auto','important');f.control.documentTop+=10;});
  assert.equal(f.style.value,'auto');assert.equal(f.style.priority,'important');
});

test('mutation failure remains the original error with exactly one invocation and anchor restoration',t=>{
  const f=fixture(t,{anchor:'auto',priority:'important'}),original=Error('original source mutation failure');
  f.emit('pointerdown');let calls=0;
  assert.throws(()=>f.owner.update(()=>{calls++;f.control.documentTop+=30;throw original;}),error=>error===original);
  assert.equal(calls,1);assert.equal(f.style.value,'auto');assert.equal(f.style.priority,'important');
});

test('a scroll correction error preserves the completed mutation and restores the anchor',t=>{
  const f=fixture(t,{anchor:'auto'}),correction=Error('controlled scroll failure');f.emit('pointerdown');f.win.scrollError=correction;
  let calls=0;assert.throws(()=>f.owner.update(()=>{calls++;f.control.documentTop+=30;}),error=>error===correction);
  assert.equal(calls,1);assert.equal(f.style.value,'auto');assert.equal(f.style.priority,'');
});

test('a failed initial measurement cannot prevent the once-only mutation',t=>{
  const f=fixture(t,{anchor:'auto',priority:'important'}),setup=Error('initial measurement failure');f.emit('pointerdown');
  f.control.readError=setup;let calls=0;
  assert.throws(()=>f.owner.update(()=>{calls++;return 'source completed';}),error=>error===setup);
  assert.equal(calls,1);assert.equal(f.style.value,'auto');assert.equal(f.style.priority,'important');
  assert.deepEqual(f.scrolls,[]);
});

test('a mutation error wins over an earlier setup failure',t=>{
  const f=fixture(t,{anchor:'auto'}),setup=Error('initial measurement failure'),original=Error('source mutation failure');f.emit('pointerdown');
  f.control.readError=setup;let calls=0;
  assert.throws(()=>f.owner.update(()=>{calls++;throw original;}),error=>error===original);
  assert.equal(calls,1);assert.equal(f.style.value,'auto');assert.equal(f.style.priority,'');
});

test('failed anchor setup still invokes the mutator once and retains its setup error',t=>{
  const f=fixture(t,{anchor:'auto',priority:'important'}),setup=Error('anchor setup failure');f.emit('pointerdown');
  f.style.error=setup;f.style.writeError=(value,priority)=>value==='none'&&priority==='important';let calls=0;
  assert.throws(()=>f.owner.update(()=>{calls++;return 41;}),error=>error===setup);
  assert.equal(calls,1);assert.equal(f.style.value,'auto');assert.equal(f.style.priority,'important');
});

test('failure to read prior anchor state does not suppress the actual source mutation',t=>{
  const f=fixture(t,{anchor:'auto'}),setup=Error('anchor read failure');f.emit('pointerdown');
  f.style.getPropertyValue=()=>{throw setup;};let calls=0;
  assert.throws(()=>f.owner.update(()=>{calls++;}),error=>error===setup);
  assert.equal(calls,1);assert.deepEqual(f.scrolls,[]);
});

test('a failed after measurement is reported after mutation and restores prior anchoring',t=>{
  const f=fixture(t,{anchor:'auto',priority:'important'}),correction=Error('after measurement failure');f.emit('pointerdown');let calls=0;
  assert.throws(()=>f.owner.update(()=>{calls++;f.control.readError=correction;}),error=>error===correction);
  assert.equal(calls,1);assert.equal(f.style.value,'auto');assert.equal(f.style.priority,'important');
});

test('mutation error wins when the correction also throws',t=>{
  const f=fixture(t,{anchor:'none'}),original=Error('original mutation'),secondary=Error('secondary correction');
  f.emit('pointerdown');f.win.scrollError=secondary;let calls=0;
  assert.throws(()=>f.owner.update(()=>{calls++;f.control.documentTop+=45;throw original;}),error=>error===original);
  assert.equal(calls,1);assert.equal(f.style.value,'none');assert.equal(f.style.priority,'');
});

test('a failed second measurement retains the mutation error and anchor state',t=>{
  const f=fixture(t,{anchor:'auto',priority:'important'}),original=Error('original mutation'),measurement=Error('after measurement failure');
  f.emit('pointerdown');
  assert.throws(()=>f.owner.update(()=>{f.control.readError=measurement;throw original;}),error=>error===original);
  assert.equal(f.style.value,'auto');assert.equal(f.style.priority,'important');
});

test('a restoration failure cannot replace an earlier mutation error',t=>{
  const f=fixture(t,{anchor:'auto'}),original=Error('original mutation'),restoration=Error('restoration failure');f.emit('pointerdown');
  f.style.error=restoration;f.style.writeError=value=>value==='auto';
  assert.throws(()=>f.owner.update(()=>{throw original;}),error=>error===original);
  assert.deepEqual(f.styleCalls.at(-1),{action:'set',value:'auto',priority:''});
  // The failing fake setter cannot restore its value. This asserts the retained
  // attempt and original error, not a fabricated successful style cleanup.
});

test('missing scrolling style does not prevent the once-only source mutation',t=>{
  const f=fixture(t,{scrollingElement:false});f.emit('pointerdown');let calls=0;
  const result=f.owner.update(()=>{calls++;f.control.documentTop+=25;return 19;});
  assert.equal(result,19);assert.equal(calls,1);assert.deepEqual(f.scrolls,[{top:25,behavior:'instant'}]);
});

test('retirement removes all listeners and prevents later ownership reacquisition',t=>{
  const f=fixture(t);f.emit('pointerdown');f.owner.retire();f.owner.retire();
  assert.equal([...f.listeners.values()].reduce((total,set)=>total+set.size,0),0);
  f.emit('focusin');f.owner.update(()=>{f.control.documentTop+=30;});assert.deepEqual(f.scrolls,[]);
});

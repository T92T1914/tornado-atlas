import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import vm from 'node:vm';

// Offline ordering fixture, not browser/layout acceptance. Execute the actual
// reader bytes; only DOM, event dispatch, viewport, tasks and frames are modeled.
const sourceURL = new URL('../web/tuscaloosa-survey-reader.mjs', import.meta.url);
const sourceBytes = readFileSync(sourceURL);
console.log('Actual reader SHA256: ' + createHash('sha256').update(sourceBytes).digest('hex'));
const script = new vm.Script(sourceBytes.toString('utf8'), {filename: 'web/tuscaloosa-survey-reader.mjs'});
const stopIds = ['path-greene', 'path-tuscaloosa', 'path-holt',
  'path-concord', 'path-birmingham', 'path-end'];

function readerFixture(initial = 'path-birmingham',
  {animateAuto = false, settleInitial = true, initialPhoto = null, viewerOpen = Boolean(initialPhoto)} = {}) {
  const effects = [], tasks = new Map(), frames = new Map(), microtasks = [], animations = [];
  let nextTask = 0, nextFrame = 0, scrollY = 0;
  const document = {activeElement: null, body: {dataset: {}}};
  class Element {
    constructor(id = '', top = 0) {
      this.id = id; this.top = top; this.children = []; this.listeners = new Map();
      this.classes = new Set();
      this.classList = {toggle: (name, active) => active ? this.classes.add(name) : this.classes.delete(name)};
    }
    addEventListener(name, callback, {capture = false} = {}) {
      if (!this.listeners.has(name)) this.listeners.set(name, []);
      this.listeners.get(name).push({callback,capture});
    }
    dispatch(name, options = {}) {
      const event = {button:0,ctrlKey:false,metaKey:false,shiftKey:false,altKey:false,
        defaultPrevented:false,detail:1,preventDefault() {this.defaultPrevented = true;},...options};
      // Model target capture before target bubbling, without reimplementing the reader.
      for (const {callback} of [...this.listeners.get(name) || []].sort((a,b) => Number(b.capture)-Number(a.capture))) {
        callback(event);
      }
      return event;
    }
    append(child) {this.children.push(child);}
    add(option) {this.children.push(option);}
    scrollIntoView({behavior = 'auto'} = {}) {
      effects.push(['scroll', this.id, behavior]);
      // CSSOM View starts a new scroll by aborting the previous motion.
      animations.length = 0;
      if (animateAuto && behavior !== 'instant') animations.push(this);
      else scrollY = this.top;
    }
    focus() {document.activeElement = this; effects.push(['focus', this.id]);}
  }
  const nodes = new Map();
  const add = (id, top) => {const node = new Element(id, top); nodes.set(id, node); return node;};
  const reader = add('survey-reader', 100);
  const select = add('survey-place', 110);
  const photoLink = add('photo-opener', 2750);
  photoLink.dataset = {photoId:'eo1-tuscaloosa-track'};
  const photoDialog = add('photo-dialog');
  photoDialog.open = viewerOpen;
  if (photoDialog.open) document.activeElement = {id:'photo-close'};
  add('survey-previous', 140); add('survey-next', 140); add('survey-status', 160);
  const stops = stopIds.map((id, index) => {
    const stop = add(id, 400 + index * 400), div = new Element();
    stop.querySelector = selector => {
      if (selector === ':scope > span') return {textContent: id};
      if (selector === 'div') return div;
      throw new Error('Unexpected stop selector: ' + selector);
    };
    stop.returnLink = () => div.children[0];
    return stop;
  });
  document.getElementById = id => nodes.get(id);
  document.querySelector = selector => {
    assert.equal(selector, '#path .documentary-timeline'); return {children: stops};
  };
  document.querySelectorAll = selector => {
    assert.equal(selector, 'a[data-photo-id]'); return [photoLink];
  };
  document.createElement = tag => {assert.equal(tag, 'a'); return new Element();};
  const initialURL = new URL('https://example.test/tuscaloosa.html#path');
  if (initial !== null) initialURL.searchParams.set('stop',initial);
  if (initialPhoto) initialURL.searchParams.set('photo',initialPhoto);
  const window = new Element(), location = {href:initialURL.href};
  const history = {scrollRestoration: 'auto', pushState(_state, _unused, url) {location.href = String(url);}};
  const scheduleTask = callback => {const id = ++nextTask; tasks.set(id, callback); return id;};
  window.setTimeout = scheduleTask; window.clearTimeout = id => tasks.delete(id);
  const scheduleFrame = callback => {const id = ++nextFrame; frames.set(id, callback); return id;};
  window.requestAnimationFrame = scheduleFrame; window.cancelAnimationFrame = id => frames.delete(id);
  const context = vm.createContext({document, window, location, history, URL,
    Option: class {constructor(label, value) {this.textContent = label; this.value = value;}},
    setTimeout: scheduleTask, clearTimeout: window.clearTimeout,
    requestAnimationFrame: scheduleFrame, cancelAnimationFrame: window.cancelAnimationFrame,
    queueMicrotask(callback) {microtasks.push(callback);},
  });
  script.runInContext(context, {timeout: 1000});
  assert.equal(document.body.dataset.surveyReader, 'ready');
  let photoEntries = 0;
  // The real photo adapter uses this target gate, pushState and showFromLocation.
  // It does not dispatch popstate while opening a viewer-owned photo entry.
  photoLink.addEventListener('click', event => {
    if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey ||
      event.shiftKey || event.altKey) return;
    event.preventDefault();
    const url = new URL(location.href); url.searchParams.set('photo',photoLink.dataset.photoId);
    history.pushState(null,'',url); photoEntries++;
    photoDialog.open = true;
    document.activeElement = {id:'photo-close'};
  });
  const flushFrames = () => {
    let count = 0;
    while (frames.size) {
      assert.ok(++count <= 12, 'Reader frames must be bounded');
      const [id, callback] = frames.entries().next().value;
      frames.delete(id); callback();
    }
  };
  const flushTasks = ({render = true} = {}) => {
    let count = 0;
    while (tasks.size) {
      assert.ok(++count <= 12, 'Reader tasks must be bounded');
      const [id, callback] = tasks.entries().next().value;
      tasks.delete(id); callback();
    }
    if (render) flushFrames();
  };
  // Existing history cases begin after the actual initial lifecycle has settled.
  // Reload cases retain its stages and explicitly model the native overwrite.
  if (settleInitial) {
    window.dispatch('pageshow',{persisted:false}); flushTasks();
    while (animations.length) scrollY = animations.shift().top;
  }
  effects.length = 0;
  function nativeBack(id, restoredY = reader.top, photo = null) {
    const url = new URL(location.href); url.searchParams.set('stop', id);
    if (photo) url.searchParams.set('photo', photo); else url.searchParams.delete('photo');
    location.href = url.href; window.dispatch('popstate');
    while (microtasks.length) microtasks.shift()();
    // Explicit adverse model: persisted viewport is restored after popstate.
    scrollY = restoredY; effects.push(['native-restoration', restoredY]);
  }
  const choose = id => {select.value = id; select.dispatch('change');};
  const restorePersistedViewport = y => {
    scrollY = y; document.activeElement = null; effects.push(['native-restoration', y]);
  };
  const expectViewport = id => {
    const target = nodes.get(id);
    assert.equal(select.value, id, 'Restored selector must name the intended stop');
    assert.equal(target.classes.has('survey-selected'), true, 'Intended stop must be selected');
    assert.equal(scrollY, target.top, 'Selected stop must win over older native restored viewport');
    assert.equal(document.activeElement?.id, id, 'Focus must belong to the selected stop');
    assert.equal(history.scrollRestoration, 'auto', 'Native restoration must remain enabled');
  };
  return {nativeBack, flushTasks, flushFrames, choose, expectViewport, effects, nodes, document,
    history, pageshow: persisted => window.dispatch('pageshow',{persisted}),
    returnToReader: () => nodes.get(select.value).returnLink().dispatch('click'),
    queueNativeAnimation: y => animations.push({top:y}),
    openPhoto: options => photoLink.dispatch('click',options), photoEntries: () => photoEntries,
    closePhotoBack: id => {
      photoDialog.open = false;
      nativeBack(id,2750);
      // Model the adapter restoring its opener, then let pending reader work run.
      document.activeElement = photoLink;
    },
    restorePersistedViewport, pagehide: () => window.dispatch('pagehide'),
    viewport: () => scrollY, queued: () => tasks.size, queuedFrames: () => frames.size,
    pendingAnimations: () => animations.length,
    flushAnimations: () => {while (animations.length) scrollY = animations.shift().top;}};
}

test('changed-stop Back places the selected stop after native persisted-scroll restoration', () => {
  const page = readerFixture();
  page.nativeBack('path-concord'); page.flushTasks(); page.expectViewport('path-concord');
});

test('rapid changed-stop traversals never apply the superseded Concord callback', () => {
  const page = readerFixture();
  page.nativeBack('path-concord'); page.nativeBack('path-holt');
  page.effects.length = 0; page.flushTasks(); page.expectViewport('path-holt');
  assert.equal(page.effects.some(([kind, id]) => ['scroll', 'focus'].includes(kind) && id === 'path-concord'), false);
});

test('a direct newer choice cancels an older queued history destination', () => {
  const page = readerFixture();
  page.nativeBack('path-concord'); page.choose('path-end');
  page.effects.length = 0; page.flushTasks(); page.expectViewport('path-end');
  assert.equal(page.effects.some(([kind, id]) => ['scroll', 'focus'].includes(kind) && id !== 'path-end'), false);
});

test('photo-only traversal preserves external focus and its native viewport', () => {
  const page = readerFixture('path-holt');
  const photoOpener = {id: 'photo-opener'}; page.document.activeElement = photoOpener;
  page.nativeBack('path-holt', 2750, 'eo1-tuscaloosa-track');
  page.effects.length = 0; page.flushTasks();
  assert.equal(page.queued(), 0); assert.equal(page.document.activeElement, photoOpener);
  assert.equal(page.viewport(), 2750); assert.deepEqual(page.effects, []);
});

test('photo history that interrupts a pending stop change cannot revive its old focus callback', () => {
  const page = readerFixture();
  page.nativeBack('path-concord');
  const photoOpener = {id: 'photo-opener'}; page.document.activeElement = photoOpener;
  page.nativeBack('path-concord', 2750, 'eo1-tuscaloosa-track');
  // Return to the captured URL before tasks run. URL equality alone must not
  // revive the stop callback superseded by these photo-only traversals.
  page.nativeBack('path-concord', 2750);
  page.effects.length = 0; page.flushTasks();
  assert.equal(page.queued(), 0); assert.equal(page.document.activeElement, photoOpener);
  assert.equal(page.viewport(), 2750); assert.deepEqual(page.effects, []);
});


test('changed-stop history places the intended account immediately when auto scrolling is animated', () => {
  // Adverse visual model, not a reproduction of the hosted WebKit ordering.
  const page = readerFixture('path-birmingham', {animateAuto: true});
  page.nativeBack('path-concord'); page.flushTasks();
  page.expectViewport('path-concord');
  assert.equal(page.pendingAnimations(), 0, 'History placement must not leave an auto-scroll animation pending');
  assert.deepEqual(page.effects.filter(([kind]) => kind === 'scroll'), [['scroll', 'path-concord', 'instant']]);
});

test('ordinary named-place choice retains auto scrolling and its intended focus', () => {
  const page = readerFixture('path-birmingham', {animateAuto: true});
  page.choose('path-end');
  assert.equal(page.document.activeElement.id, 'path-end');
  assert.equal(page.pendingAnimations(), 1, 'Ordinary navigation keeps its existing CSS-derived motion');
  assert.deepEqual(page.effects.filter(([kind]) => kind === 'scroll'), [['scroll', 'path-end', 'auto']]);
  page.flushAnimations(); page.expectViewport('path-end');
});


test('changed-stop history aborts an earlier ordinary smooth scroll instead of reviving its destination', () => {
  const page = readerFixture('path-birmingham', {animateAuto: true});
  page.choose('path-end');
  assert.equal(page.pendingAnimations(), 1);
  page.nativeBack('path-concord'); page.flushTasks(); page.expectViewport('path-concord');
  assert.equal(page.pendingAnimations(), 0, 'Instant history placement aborts the earlier animated choice');
  page.flushAnimations(); page.expectViewport('path-concord');
  assert.deepEqual(page.effects.filter(([kind]) => kind === 'scroll'),
    [['scroll', 'path-end', 'auto'], ['scroll', 'path-concord', 'instant']]);
});

test('a restored viewport after the queued task cannot replace the selected history account', () => {
  // Adverse order, not a recorded WebKit trace: restore after the first task,
  // before the next rendering update. The actual reader must retain ownership.
  const page = readerFixture();
  page.nativeBack('path-concord'); page.flushTasks({render: false});
  page.restorePersistedViewport(100); page.flushFrames();
  page.expectViewport('path-concord');
});

test('a newer choice between the task and rendering frame cancels the old placement', () => {
  const page = readerFixture();
  page.nativeBack('path-concord'); page.flushTasks({render: false});
  page.choose('path-end'); page.effects.length = 0; page.flushFrames();
  page.expectViewport('path-end'); assert.equal(page.queuedFrames(), 0);
  assert.deepEqual(page.effects, []);
});

test('photo-only interruption cannot revive a queued rendering frame through URL equality', () => {
  const page = readerFixture();
  page.nativeBack('path-concord'); page.flushTasks({render: false});
  const opener = {id: 'photo-opener'}; page.document.activeElement = opener;
  page.nativeBack('path-concord', 2750, 'eo1-tuscaloosa-track');
  page.nativeBack('path-concord', 2750); page.effects.length = 0; page.flushFrames();
  assert.equal(page.queuedFrames(), 0); assert.equal(page.document.activeElement, opener);
  assert.equal(page.viewport(), 2750); assert.deepEqual(page.effects, []);
});

test('page departure cancels pending task and rendering-frame placement', () => {
  for (const afterTask of [false, true]) {
    const page = readerFixture(); page.nativeBack('path-concord');
    if (afterTask) page.flushTasks({render: false});
    page.pagehide(); page.effects.length = 0; page.flushTasks();
    assert.equal(page.queued(), 0); assert.equal(page.queuedFrames(), 0);
    assert.deepEqual(page.effects, []);
  }
});

test('an unchanged duplicate popstate cannot cancel the pending changed-stop task', () => {
  // An explicit event-lifetime model, not an observed hosted WebKit sequence.
  const page = readerFixture();
  page.nativeBack('path-concord'); page.nativeBack('path-concord');
  page.flushTasks(); page.expectViewport('path-concord');
  assert.equal(page.effects.filter(([kind]) => kind === 'scroll').length, 1);
});

test('an unchanged duplicate popstate cannot cancel the pending placement frame', () => {
  const page = readerFixture();
  page.nativeBack('path-concord'); page.flushTasks({render: false});
  page.nativeBack('path-concord'); page.flushFrames();
  page.expectViewport('path-concord');
  assert.equal(page.effects.filter(([kind]) => kind === 'scroll').length, 1);
});

for (const [label, afterTask, detail] of [
  ['task',false,1],['frame',true,1],['keyboard button-zero activation',true,0]
]) {
  test(`an eligible photo opening supersedes pending reader ${label} before pushState and owned Back`, () => {
    const page = readerFixture();
    page.nativeBack('path-concord');
    if (afterTask) page.flushTasks({render:false});
    page.openPhoto({detail});
    assert.equal(page.photoEntries(),1,'The modeled real target adapter opened its owned entry');
    page.closePhotoBack('path-concord'); page.effects.length = 0; page.flushTasks();
    assert.equal(page.document.activeElement.id,'photo-opener','Pending reader placement must not steal photo-opener focus');
    assert.equal(page.viewport(),2750,'Pending reader placement must not overwrite the photo return viewport');
    assert.deepEqual(page.effects,[],'Photo return must not revive stale reader placement');
  });
}

test('nonprimary, modified and already-prevented photo clicks preserve pending reader ownership', () => {
  for (const options of [{button:1},{button:2},{ctrlKey:true},{metaKey:true},
    {shiftKey:true},{altKey:true},{defaultPrevented:true}]) {
    const page = readerFixture();
    page.nativeBack('path-concord'); page.flushTasks({render:false});
    page.openPhoto(options); assert.equal(page.photoEntries(),0);
    page.flushFrames(); page.expectViewport('path-concord');
  }
});

test('one initial valid-stop placement wins over modeled reload scroll without taking focus', () => {
  // Adverse lifecycle ordering, not a simulation of WebKit's internal algorithm.
  // The old reader scrolls early; native fragment/restoration then replaces it.
  const page = readerFixture('path-birmingham',{settleInitial:false,animateAuto:true});
  page.restorePersistedViewport(100); page.queueNativeAnimation(100);
  const focus = {id:'preserved-focus'}; page.document.activeElement = focus;
  page.pageshow(false); page.flushTasks({render:false});
  page.restorePersistedViewport(100); page.document.activeElement = focus;
  page.flushFrames();
  assert.equal(page.viewport(),page.nodes.get('path-birmingham').top);
  assert.equal(page.nodes.get('path-birmingham').classes.has('survey-selected'),true);
  assert.equal(page.document.activeElement,focus,'Initial placement must not claim focus');
  assert.equal(page.pendingAnimations(),0,'Instant initial placement must abort older motion');
  assert.equal(page.history.scrollRestoration,'auto');
  assert.deepEqual(page.effects.filter(([kind]) => kind === 'scroll'),[['scroll','path-birmingham','instant']]);
  page.flushAnimations();
  assert.equal(page.viewport(),page.nodes.get('path-birmingham').top);
  page.effects.length = 0; page.restorePersistedViewport(140); page.effects.length = 0;
  page.pageshow(false); page.pageshow(true); page.flushTasks();
  assert.equal(page.viewport(),140,'Consumed initial placement must not restart');
  assert.deepEqual(page.effects,[]);
});

test('absent or unknown initial stop retains native fragment and viewport restoration', () => {
  for (const initial of [null,'unknown']) {
    const page = readerFixture(initial,{settleInitial:false});
    page.restorePersistedViewport(140); page.effects.length = 0;
    page.pageshow(false); page.flushTasks();
    assert.equal(page.viewport(),140); assert.deepEqual(page.effects,[]);
    assert.equal(page.history.scrollRestoration,'auto');
    assert.equal(page.queued(),0); assert.equal(page.queuedFrames(),0);
  }
});

test('initial photo URL intent or an already open viewer keeps its viewport and focus', () => {
  for (const options of [{initialPhoto:'eo1-tuscaloosa-track',viewerOpen:false},{viewerOpen:true}]) {
    const page = readerFixture('path-birmingham',{settleInitial:false,...options});
    page.restorePersistedViewport(2750);
    const focus = {id:'photo-close'}; page.document.activeElement = focus; page.effects.length = 0;
    page.pageshow(false); page.flushTasks();
    assert.equal(page.viewport(),2750); assert.equal(page.document.activeElement,focus);
    assert.deepEqual(page.effects,[]); assert.equal(page.queued(),0); assert.equal(page.queuedFrames(),0);
  }
});

const initialStages = ['before-pageshow','pending-task','pending-frame'];
function pendingInitial(stage) {
  const page = readerFixture('path-birmingham',{settleInitial:false,animateAuto:true});
  page.restorePersistedViewport(100);
  if (stage !== 'before-pageshow') page.pageshow(false);
  if (stage === 'pending-frame') page.flushTasks({render:false});
  return page;
}

test('a newer choice invalidates initial placement before scheduling or during either stage', () => {
  for (const stage of initialStages) {
    const page = pendingInitial(stage); page.choose('path-end'); page.effects.length = 0;
    page.pageshow(false); page.flushTasks(); page.flushAnimations(); page.expectViewport('path-end');
    assert.deepEqual(page.effects,[]); assert.equal(page.queued(),0); assert.equal(page.queuedFrames(),0);
  }
});

test('the real return link owns focus and scroll over not-yet-scheduled or queued initial placement', () => {
  for (const stage of initialStages) {
    const page = pendingInitial(stage); page.returnToReader(); page.effects.length = 0;
    page.pageshow(false); page.flushTasks(); page.flushAnimations();
    assert.equal(page.viewport(),100); assert.equal(page.document.activeElement.id,'survey-place');
    assert.deepEqual(page.effects,[]); assert.equal(page.queued(),0); assert.equal(page.queuedFrames(),0);
  }
});

test('eligible gallery opening and its owned Back cannot revive initial placement through URL equality', () => {
  for (const stage of initialStages) {
    const page = pendingInitial(stage); page.openPhoto();
    assert.equal(page.photoEntries(),1); page.closePhotoBack('path-birmingham'); page.effects.length = 0;
    page.pageshow(false); page.flushTasks();
    assert.equal(page.viewport(),2750); assert.equal(page.document.activeElement.id,'photo-opener');
    assert.deepEqual(page.effects,[]); assert.equal(page.queued(),0); assert.equal(page.queuedFrames(),0);
  }
});

test('page departure invalidates initial placement before pageshow and at both queued stages', () => {
  for (const stage of initialStages) {
    const page = pendingInitial(stage); page.pagehide(); page.effects.length = 0;
    page.pageshow(false); page.flushTasks();
    assert.equal(page.viewport(),100); assert.deepEqual(page.effects,[]);
    assert.equal(page.queued(),0); assert.equal(page.queuedFrames(),0);
  }
});

test('persisted pageshow does not initialize a restored document', () => {
  const page = readerFixture('path-birmingham',{settleInitial:false});
  page.restorePersistedViewport(140); page.effects.length = 0;
  page.pageshow(true); page.flushTasks();
  assert.equal(page.viewport(),140); assert.deepEqual(page.effects,[]);
  assert.equal(page.history.scrollRestoration,'auto');
  assert.equal(page.queued(),0); assert.equal(page.queuedFrames(),0);
});

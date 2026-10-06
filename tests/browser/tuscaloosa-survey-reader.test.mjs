import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {fixture, base} from './harness.mjs';
import {waitForDossier} from './dossier-readiness.mjs';

const ready = page => page.waitForFunction(() =>
  location.pathname.endsWith('/tuscaloosa.html') && document.body?.dataset.surveyReader === 'ready');
const selected = (page, id) => page.waitForFunction(id =>
  document.querySelector('#path .survey-selected')?.id === id &&
  document.getElementById('survey-place').value === id, id);
const readerPageErrors = new WeakMap();
// Test-only observations installed before navigation and recreated on reload.
// They describe public state, not private callbacks or proof of a failure's cause.
async function observeHistoryEvents(page) {
  await page.addInitScript(() => {
    if (!location.pathname.endsWith('/tuscaloosa.html')) return;
    const limits = {popstate:8,pageshow:4,pagehide:4,'reader-ready':1,
      DOMContentLoaded:1,load:1,scroll:8,resize:4};
    const rows = [], counts = Object.fromEntries(Object.keys(limits).map(event => [event,0]));
    const tasks = new Set(), frames = new Set();
    let omitted = 0, phaseGroups = 0, stopped = false;
    const rect = node => {
      if (!node?.isConnected) return null;
      const value = node.getBoundingClientRect();
      return {top:value.top,bottom:value.bottom,left:value.left,right:value.right,
        width:value.width,height:value.height,documentTop:value.top + scrollY};
    };
    const capture = (event, phase, ordinal, persisted) => {
      if (stopped) return;
      if (rows.length >= 64) {omitted++; return;}
      const target = document.querySelector('#path .survey-selected');
      const root = document.documentElement;
      const images = [...document.querySelectorAll('#satellite-context img')].slice(0,2).map(image => ({
        figure:image.closest('figure')?.id||null,src:image.getAttribute('src')?.slice(0,256)||null,
        width:image.getAttribute('width'),height:image.getAttribute('height'),complete:image.complete,
        naturalWidth:image.naturalWidth,naturalHeight:image.naturalHeight,rect:rect(image)}));
      rows.push({event,phase,ordinal,persisted,time:performance.now(),url:location.href.slice(0,512),
        navigation:performance.getEntriesByType('navigation')[0]?.type||null,
        readyState:document.readyState,readerReady:document.body?.dataset.surveyReader||null,
        readerHidden:document.getElementById('survey-reader')?.hidden??null,
        selected:target?.id||null,active:document.activeElement?.id||null,scrollX,scrollY,
        viewport:{width:innerWidth,height:innerHeight},target:rect(target),path:rect(document.getElementById('path')),
        documentWidth:root?.scrollWidth??null,documentHeight:root?.scrollHeight??null,
        scrollBehavior:root?getComputedStyle(root).scrollBehavior:null,scrollRestoration:history.scrollRestoration,
        fontsStatus:document.fonts?.status||null,font:target?getComputedStyle(target).font.slice(0,256):null,images});
    };
    const observe = (event, value = {}) => {
      if (stopped) return;
      const ordinal = ++counts[event], persisted = Boolean(value.persisted);
      if (ordinal > limits[event]) {omitted++; return;}
      capture(event,'event',ordinal,persisted);
      // Scroll/resize are immediate-only. At most twelve other event groups
      // schedule a microtask, a zero-delay observation and one rendering frame.
      if (event === 'scroll' || event === 'resize') return;
      if (phaseGroups >= 12) {omitted += 3; return;}
      phaseGroups++;
      queueMicrotask(() => capture(event,'microtask',ordinal,persisted));
      const task = setTimeout(() => {
        tasks.delete(task); capture(event,'task',ordinal,persisted);
      },0);
      tasks.add(task);
      const frame = requestAnimationFrame(() => {
        frames.delete(frame); capture(event,'frame',ordinal,persisted);
      });
      frames.add(frame);
    };
    const listeners = Object.keys(counts).filter(event => event !== 'reader-ready').map(event => {
      const target = event === 'DOMContentLoaded' ? document : window;
      const listener = value => observe(event,value);
      target.addEventListener(event,listener,{passive:true}); return [target,event,listener];
    });
    const readyObserver = new MutationObserver(() => {
      if (document.body?.dataset.surveyReader !== 'ready') return;
      readyObserver.disconnect(); observe('reader-ready');
    });
    readyObserver.observe(document,{subtree:true,attributes:true,attributeFilter:['data-survey-reader']});
    capture('observer','installed',0,false);
    window.__atlasSurveyHistoryTrace = {
      snapshot: () => ({counts:{...counts},rows:[...rows],omitted,phaseGroups,
        limits:{rows:64,phaseGroups:12,events:{...limits}}}),
      stop: () => {
        stopped = true;
        readyObserver.disconnect();
        for (const [target,event,listener] of listeners) target.removeEventListener(event,listener);
        for (const task of tasks) clearTimeout(task);
        for (const frame of frames) cancelAnimationFrame(frame);
        tasks.clear(); frames.clear();
      }
    };
  });
}
async function stopHistoryEvents(page) {
  if (page.isClosed()) return; // The owned context already destroys its observers.
  let timer;
  const stopped = page.evaluate(() => window.__atlasSurveyHistoryTrace?.stop());
  stopped.catch(() => {});
  try {
    await Promise.race([stopped,new Promise((_,reject) => {
      timer = setTimeout(() => reject(Error('History observation cleanup exceeded 500 ms')),500);
    })]);
  } finally {clearTimeout(timer);}
}
// Bounded snapshots retain the original assertions/errors and 10s waits.
async function failureObservation(page, id = null) {
  let timer;
  try {
    const snapshot = page.evaluate(id => {
      const rect = node => {
        if (!node?.isConnected) return null;
        const r = node.getBoundingClientRect();
        return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};
      };
      const target = id ? document.getElementById(id) : null;
      const rows = [], nodes = id ? [] : [...document.querySelectorAll('body *')];
      let offenders = 0;
      for (const node of nodes.slice(0, 1200)) {
        const r = rect(node), style = getComputedStyle(node);
        if (!r?.width || !r.height || style.display === 'none' || style.visibility === 'hidden') continue;
        if (r.right <= innerWidth + 1 && r.left >= -1 && node.scrollWidth <= node.clientWidth + 1) continue;
        offenders++;
        if (rows.length < 20) rows.push({tag:node.tagName,id:node.id.slice(0,80),
          class:String(node.className).slice(0,80),rect:r,clientWidth:node.clientWidth,scrollWidth:node.scrollWidth,
          font:style.font.slice(0,256),whiteSpace:style.whiteSpace,overflowWrap:style.overflowWrap});
      }
      return {path:location.pathname,stop:new URL(location.href).searchParams.get('stop'),
        active:document.activeElement?.id||null,bodyPresent:Boolean(document.body),
        selected:document.querySelector('#path .survey-selected')?.id||null,target:rect(target),
        scrollX,scrollY,viewport:{width:innerWidth,height:innerHeight},documentWidth:document.documentElement.scrollWidth,
        scrollBehavior:getComputedStyle(document.documentElement).scrollBehavior,
        scrollRestoration:history.scrollRestoration,offenders,offendersOmitted:Math.max(0,offenders-rows.length),
        nodesOmitted:Math.max(0,nodes.length-1200),rows,
        historyEvents:window.__atlasSurveyHistoryTrace?.snapshot()||null};
    }, id);
    snapshot.catch(() => {});
    const observed = await Promise.race([snapshot,new Promise((_,reject) => {
      timer=setTimeout(() => reject(Error('Failure snapshot exceeded 500 ms')),500);
    })]);
    return {...observed,pageErrors:readerPageErrors.get(page) || {rows:[],omitted:0}};
  } catch(error) {return {collectionError:{name:String(error.name).slice(0,80),message:String(error.message).slice(0,512)}};}
  finally {clearTimeout(timer);}
}

const selectedInView = async (page, id) => {
  try {
    await page.waitForFunction(id => {
      const target = document.getElementById(id);
      const rect = target.getBoundingClientRect();
      return target.classList.contains('survey-selected') && rect.top >= -1 &&
        rect.top < innerHeight && rect.left < innerWidth && rect.right > 0;
    }, id);
  } catch(error) {
    console.error('TUSCALOOSA_READER_VISIBILITY_DIAGNOSTIC ' + JSON.stringify(await failureObservation(page,id)));
    throw error;
  }
};

async function assertPageFits(page) {
  const fits = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
  assert.ok(fits, fits ? undefined : 'Tuscaloosa page exceeded its viewport: ' +
    JSON.stringify(await failureObservation(page)));
}

for (const [width, appearance] of [[320, 'dark'], [1280, 'light']]) {
  test(`Tuscaloosa survey reader: ${width}px ${appearance}, named places and reversible history`, async t => {
    const page = await fixture(t, {viewport: {width, height: 844}, hasTouch: width < 600, isMobile: width < 600});
    const errors = {rows:[],omitted:0}; readerPageErrors.set(page, errors);
    const recordError = error => {
      if (errors.rows.length < 8) errors.rows.push({name:String(error.name).slice(0,80),message:String(error.message).slice(0,512)});
      else errors.omitted++;
    };
    page.on('pageerror', recordError); t.after(() => page.off('pageerror', recordError));
    const requests = []; page.on('request', request => requests.push(request.url()));
    await observeHistoryEvents(page);
    t.after(() => stopHistoryEvents(page));
    await page.goto(base + '/tuscaloosa.html?context=survey#path'); await ready(page);
    await page.locator('#reading-appearance').selectOption(appearance);
    await page.locator('#survey-place').selectOption('path-concord'); await selected(page, 'path-concord');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'path-concord');
    assert.match(await page.locator('#survey-status').textContent(), /Place 4 of 6/);
    await page.locator('#path-concord a').click();
    assert.equal(await page.evaluate(() => document.activeElement.id), 'survey-place');
    if (width < 600) await page.locator('#survey-next').tap();
    else {await page.locator('#survey-next').focus(); await page.keyboard.press('Enter');}
    await selected(page, 'path-birmingham');
    await page.goBack(); await selected(page, 'path-concord');
    await selectedInView(page, 'path-concord');
    await page.goForward(); await selected(page, 'path-birmingham');
    await selectedInView(page, 'path-birmingham');
    await page.reload(); await ready(page); await selected(page, 'path-birmingham');
    await selectedInView(page, 'path-birmingham');
    // A diagnostic pass is observable too. It does not establish a repair.
    console.log('TUSCALOOSA_READER_RELOAD_OBSERVATION ' + JSON.stringify(await failureObservation(page,'path-birmingham')));
    const url = new URL(page.url());
    assert.equal(url.searchParams.get('context'), 'survey'); assert.equal(url.hash, '#path');
    assert.equal(await page.locator('#path .documentary-timeline > li:visible').count(), 6);
    await assertPageFits(page);
    assert.equal(requests.some(url => !url.startsWith(base + '/')), false);
    if (process.env.ATLAS_SCREENSHOT_DIR) await page.screenshot({path: path.join(process.env.ATLAS_SCREENSHOT_DIR, `survey-reader-${width}-${appearance}.png`)});
  });
}

test('survey endpoints, unknown selection and original source reading remain bounded', async t => {
  const page = await fixture(t);
  await page.goto(base + '/tuscaloosa.html?stop=path-end'); await ready(page); await selected(page, 'path-end');
  assert.equal(await page.locator('#survey-next').isDisabled(), true);
  await page.locator('#survey-place').selectOption('path-greene'); await selected(page, 'path-greene');
  assert.equal(await page.locator('#survey-previous').isDisabled(), true);
  await page.goto(base + '/tuscaloosa.html?stop=unknown&context=keep#path'); await ready(page);
  assert.match(await page.locator('#survey-status').textContent(), /not in this account/);
  assert.equal(new URL(page.url()).searchParams.get('context'), 'keep');
  assert.equal(await page.locator('#path .documentary-timeline > li:visible').count(), 6);
  assert.match(await page.locator('#field-survey').textContent(), /not a measured continuous tornado width/);
  assert.match(await page.locator('#field-survey').textContent(), /aftermath collection clocks/);
  assert.match(await page.locator('#field-survey a').first().getAttribute('href'), /tuscaloosa-tornado-report-final\.pdf#page=6$/);
  const sourceLink = page.locator('#field-survey a').last();
  const destination = {href:await sourceLink.evaluate(link => link.href),
    elementId:'observation-field-study-boundary-and-clocks'};
  await sourceLink.click(); await waitForDossier(page,destination);
  assert.match(await page.locator('#observation-field-study-boundary-and-clocks').textContent(), /not a measured continuous tornado width/);
  assert.match(await page.locator('#source-tuscaloosa-field-survey-method').textContent(), /David O\. Prevatt/);
});

test('photo history does not steal the selected survey stop or move its focus', async t => {
  const page = await fixture(t);
  await page.goto(base + '/tuscaloosa.html?stop=path-holt&context=photo#path'); await ready(page);
  const opener = page.locator('[data-photo-id="eo1-tuscaloosa-track"]');
  await opener.click();
  await page.waitForFunction(() => document.getElementById('photo-dialog').open);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.getElementById('photo-dialog').open &&
    document.activeElement?.dataset.photoId === 'eo1-tuscaloosa-track' && !new URL(location.href).searchParams.has('photo'));
  await selected(page, 'path-holt');
  assert.equal(new URL(page.url()).searchParams.get('context'), 'photo');
});

test('the complete damage progression and study limits work without scripts and at enlarged text', async t => {
  const page = await fixture(t, {javaScriptEnabled: false, viewport: {width: 320, height: 844}});
  await page.goto(base + '/tuscaloosa.html#path');
  assert.equal(await page.locator('#survey-reader').isVisible(), false);
  assert.equal(await page.locator('#path .documentary-timeline > li:visible').count(), 6);
  assert.match(await page.locator('#field-survey').textContent(), /not acquired the original GPS tracks/);
  await page.locator('p,li,h2,h3,a,span').evaluateAll(nodes => {
    // Read every baseline before modifying parents, so nested text doubles once.
    const sizes = nodes.map(node => parseFloat(getComputedStyle(node).fontSize));
    nodes.forEach((node, index) => node.style.setProperty('font-size', `${sizes[index] * 2}px`, 'important'));
    if (!nodes.every((node, index) => Math.abs(parseFloat(getComputedStyle(node).fontSize) - sizes[index] * 2) < 0.1)) {
      throw new Error('Selected text did not reach twice its computed baseline');
    }
  });
  const noteListsFit = await page.locator('.documentary-note li').evaluateAll(nodes =>
    nodes.length > 0 && nodes.every(node => node.scrollWidth <= node.clientWidth + 1));
  assert.ok(noteListsFit, noteListsFit ? undefined : 'Tuscaloosa note-list text exceeded its local box: ' +
    JSON.stringify(await failureObservation(page)));
  await assertPageFits(page);
});

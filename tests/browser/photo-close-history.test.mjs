import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture, base} from './harness.mjs';

const galleries = [
  {name: 'Joplin', page: 'joplin.html', anchor: 'hospital-envelope',
    id: 'nist-west-tower', file: 'nist-west-tower.jpg', width: 901, height: 541},
  {name: 'Tuscaloosa', page: 'tuscaloosa.html', anchor: 'aerial-context',
    id: 'aerial-context-aftermath', file: 'aerial-context-april29.jpg', width: 800, height: 600},
];

async function shown(page, item) {
  await page.waitForFunction(({id, file, width, height}) => {
    const image = document.getElementById('photo-full');
    return new URL(location.href).searchParams.get('photo') === id &&
      document.getElementById('photo-dialog').open && image &&
      new URL(image.currentSrc || image.src).pathname.endsWith('/' + file) &&
      image.complete && image.naturalWidth === width && image.naturalHeight === height;
  }, item);
  await page.locator('#photo-full').evaluate(image => image.decode());
}

async function returned(page, url, id) {
  await page.waitForFunction(({url, id}) => location.href === url &&
    !document.getElementById('photo-dialog').open &&
    !new URL(location.href).searchParams.has('photo') &&
    document.activeElement === document.querySelector(`a[data-photo-id="${id}"]`), {url, id});
}

// Only the first Back traversal is held. The checked-in gallery, shared viewer,
// native dialog close callback, image loading and animation frames stay real.
// A later synthetic close is an adverse control, not a hosted-ordering reproduction.
async function holdBack(page) {
  await page.evaluate(() => {
    const back = history.back;
    const replaceState = history.replaceState;
    const state = {backCalls: 0, replaceCalls: 0, nativeCloses: 0,
      syntheticCloses: 0, pendingBacks: 0, holdingBack: true};
    history.back = function () {
      state.backCalls++;
      if (state.holdingBack) state.pendingBacks++;
      else back.call(history);
    };
    history.replaceState = function (...args) {
      state.replaceCalls++;
      return replaceState.apply(history, args);
    };
    document.getElementById('photo-dialog').addEventListener('close', event => {
      if (event.isTrusted) state.nativeCloses++;
      else state.syntheticCloses++;
    });
    window.closeHistoryControl = {
      snapshot: () => ({...state}),
      duplicate: () => document.getElementById('photo-dialog').dispatchEvent(new Event('close')),
      release: () => {
        if (state.pendingBacks !== 1) throw new Error('Exactly one held Back is required');
        state.pendingBacks = 0;
        state.holdingBack = false;
        back.call(history);
      },
    };
  });
}

for (const item of galleries) {
  test(`${item.name}: synthetic duplicate close while Back is pending consumes one traversal`, async t => {
    const page = await fixture(t);
    const preceding = new URL(base + '/' + item.page);
    preceding.search = '?context=close-history&retained=one%20two';
    preceding.hash = item.anchor;
    await page.goto(preceding.href);
    await page.waitForFunction(() => document.body.dataset.photoViewer === 'ready');
    const opener = page.locator(`a[data-photo-id="${item.id}"]`);
    await opener.focus();
    await opener.press('Enter');
    await shown(page, item);
    const selected = page.url();
    await holdBack(page);

    await page.locator('#photo-close').click();
    // This observer runs after the real gallery and shared-viewer close handlers.
    await page.waitForFunction(() => window.closeHistoryControl.snapshot().nativeCloses === 1);
    assert.equal(await page.locator('#photo-dialog').evaluate(dialog => dialog.open), false);
    assert.equal(page.url(), selected, 'Back is still held at the selected viewer URL');
    assert.equal((await page.evaluate(() => window.closeHistoryControl.snapshot())).backCalls, 1);
    await page.evaluate(() => window.closeHistoryControl.duplicate());
    const pending = await page.evaluate(() => window.closeHistoryControl.snapshot());
    assert.equal(pending.syntheticCloses, 1, 'The duplicate is explicitly synthetic');
    assert.equal(pending.backCalls, 1, 'A duplicate close must not request a second Back');
    assert.equal(pending.pendingBacks, 1);
    assert.equal(pending.replaceCalls, 0, 'An owned viewer entry closes through Back');
    assert.equal(page.url(), selected);

    await page.evaluate(() => window.closeHistoryControl.release());
    await returned(page, preceding.href, item.id);
    await page.goForward();
    await shown(page, item);
    assert.equal(page.url(), selected, 'Forward restores the exact selected URL');
    await page.locator('#photo-close').press('Escape');
    await page.waitForFunction(() => window.closeHistoryControl.snapshot().nativeCloses === 2);
    await returned(page, preceding.href, item.id);
    const reopened = await page.evaluate(() => window.closeHistoryControl.snapshot());
    assert.equal(reopened.backCalls, 2, 'Forward keeps the viewer-owned predecessor for Escape');
    assert.equal(reopened.replaceCalls, 0, 'Forward-close must not become a direct-link replacement');
  });
}

test('Direct Joplin and Tuscaloosa viewer URLs replace only the photo selection without Back', async t => {
  for (const item of galleries) {
    const page = await fixture(t);
    const selected = new URL(base + '/' + item.page);
    selected.search = '?context=direct-close&retained=one%20two';
    selected.searchParams.set('photo', item.id);
    selected.hash = item.anchor;
    const preceding = new URL(selected);
    preceding.searchParams.delete('photo');
    await page.goto(selected.href);
    await page.waitForFunction(() => document.body.dataset.photoViewer === 'ready');
    await shown(page, item);
    await holdBack(page);
    await page.locator('#photo-close').click();
    await page.waitForFunction(() => window.closeHistoryControl.snapshot().nativeCloses === 1);
    await returned(page, preceding.href, item.id);
    await page.evaluate(() => window.closeHistoryControl.duplicate());
    const closed = await page.evaluate(() => window.closeHistoryControl.snapshot());
    assert.equal(closed.backCalls, 0, `${item.name} direct-link close has no owned predecessor`);
    assert.equal(closed.replaceCalls, 1, `${item.name} replaces the photo query exactly once`);
    assert.equal(closed.syntheticCloses, 1);
    assert.equal(page.url(), preceding.href, `${item.name} retains the other query and hash`);
  }
});

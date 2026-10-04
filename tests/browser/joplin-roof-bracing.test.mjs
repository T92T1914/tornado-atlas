import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fixture, base} from './harness.mjs';

const id = 'nist-home-depot-roof';
const figureLink = 'Open the complete NIST Home Depot photograph and annotation';
const recordLink = 'Inspect the roof-loss photograph and its limits';
const source = 'https://www.govinfo.gov/content/pkg/GOVPUB-C13-a0ac8adb5269166f1b1e230423cf79ec/pdf/GOVPUB-C13-a0ac8adb5269166f1b1e230423cf79ec.pdf';
async function ready(page) {
  await page.waitForFunction(() => document.body?.dataset.ready === 'true');
}
async function viewed(page) {
  await page.waitForFunction(id => document.getElementById('photo-dialog').open &&
    new URL(location.href).searchParams.get('photo') === id &&
    document.getElementById('photo-full').naturalWidth === 943, id);
}
async function closed(page, link) {
  await page.waitForFunction(() => !document.getElementById('photo-dialog').open &&
    !new URL(location.href).searchParams.has('photo'));
  await link.evaluate(link => new Promise(resolve => requestAnimationFrame(() => resolve())));
  assert.equal(await link.evaluate(link => link === document.activeElement), true);
}
async function fits(page) {
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
}

for (const [viewport, appearance] of [
  [{width: 390, height: 844}, 'dark'],
  [{width: 844, height: 390}, 'light'],
  [{width: 1280, height: 900}, 'light'],
]) {
  test(`roof bracing source and figure journey ${viewport.width} ${appearance}`, async t => {
    const page = await fixture(t, {viewport});
    await page.goto(base + '/joplin.html?context=roof#roof-bracing');
    await page.waitForFunction(() => document.body.dataset.photoViewer === 'ready');
    await page.locator('#reading-appearance').selectOption(appearance);
    const note = page.locator('#roof-bracing');
    assert.match(await note.textContent(), /Possible Failure Sequence/);
    assert.match(await note.textContent(), /cannot show which connection failed first/);
    assert.match(await note.textContent(), /not a measured wind speed/);
    const image = note.locator('img');
    await image.scrollIntoViewIfNeeded();
    await image.evaluate(image => image.decode());
    assert.deepEqual(await image.evaluate(image => [image.naturalWidth, image.naturalHeight]), [943, 435]);
    assert.match(await image.getAttribute('alt'), /red NIST arrow/);
    await fits(page);
    const link = note.getByRole('link', {name: figureLink, exact: true});
    await link.focus();
    await link.press('Enter');
    await viewed(page);
    assert.match(await page.locator('#photo-credit').textContent(), /PNG derivative/);
    assert.match(await page.locator('#photo-caption').textContent(), /red annotation/);
    assert.match(await page.locator('#photo-location').textContent(), /unregistered/);
    assert.equal(await page.locator('#photo-original').textContent(), 'Open the complete photograph and NIST annotation');
    assert.equal(await page.locator('#photo-source').getAttribute('href'), source + '#page=201');
    assert.equal(await page.locator('#photo-license').getAttribute('href'), source + '#page=4');
    await page.goBack();
    await closed(page, link);
    assert.equal(new URL(page.url()).searchParams.get('context'), 'roof');
    await page.goForward();
    await viewed(page);
    await page.locator('#photo-close').press('Escape');
    await closed(page, link);
    await note.getByRole('link', {name: recordLink, exact: true}).click();
    await ready(page);
    const media = page.locator('#media-' + id);
    assert.match(await media.textContent(), /possible failure sequence/);
    assert.match(await media.textContent(), /permitted hosting/);
    assert.match(await media.textContent(), /unregistered/);
    await media.getByRole('link', {name: 'Inspect the source card', exact: true}).click();
    await ready(page);
    const sourceCard = page.locator('#source-' + id);
    assert.match(await sourceCard.textContent(), /GeoEye Figure 3-42/);
    assert.match(await sourceCard.textContent(), /Homer TLC/);
    assert.match(await sourceCard.textContent(), /Not a full report/);
    assert.equal(await sourceCard.getByRole('link', {name: 'Read original source', exact: true}).getAttribute('href'), source + '#page=201');
    await page.getByRole('link', {name: 'How roof loss removed wall support', exact: true}).click();
    await note.waitFor();
    const scaled = await note.evaluate(note => [...note.querySelectorAll('h3,p,figcaption')].map(node => {
      const before = parseFloat(getComputedStyle(node).fontSize);
      node.style.fontSize = (before * 2) + 'px';
      return [before, parseFloat(getComputedStyle(node).fontSize)];
    }));
    for (const [before, after] of scaled) assert.equal(after, before * 2);
    await image.scrollIntoViewIfNeeded();
    await image.evaluate(image => image.decode());
    await fits(page);
    if (process.env.ATLAS_SCREENSHOT_DIR) {
      await mkdir(process.env.ATLAS_SCREENSHOT_DIR, {recursive: true});
      await note.screenshot({path: path.join(process.env.ATLAS_SCREENSHOT_DIR,
        `roof-${viewport.width}x${viewport.height}-${appearance}.png`)});
    }
  });
}

test('roof figure failure and direct entry retain description, source and local closure', async t => {
  const page = await fixture(t, {viewport: {width: 320, height: 740}});
  let fail = true;
  await page.route('**/assets/joplin-2011/nist-home-depot-roof.png', route => fail ? route.abort() : route.continue());
  await page.goto(base + '/joplin.html?photo=' + id + '&context=retained#roof-bracing');
  await page.waitForFunction(() => document.getElementById('photo-dialog').open &&
    !document.getElementById('photo-failure').hidden && !document.getElementById('photo-retry').hidden);
  assert.match(await page.locator('#photo-full').getAttribute('alt'), /red NIST arrow/);
  assert.match(await page.locator('#photo-caption').textContent(), /Capture time and camera position are unregistered/);
  assert.equal(await page.locator('#photo-source').getAttribute('href'), source + '#page=201');
  assert.equal(await page.locator('#photo-license').getAttribute('href'), source + '#page=4');
  fail = false;
  await page.locator('#photo-retry').click();
  await viewed(page);
  await page.locator('#photo-close').click();
  const link = page.locator('#roof-bracing').getByRole('link', {name: figureLink, exact: true});
  await closed(page, link);
  const url = new URL(page.url());
  assert.equal(url.pathname, '/joplin.html');
  assert.equal(url.searchParams.get('context'), 'retained');
  assert.equal(url.hash, '#roof-bracing');
  await fits(page);
});

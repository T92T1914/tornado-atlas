import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fixture, base} from './harness.mjs';

const photos = [
  {id: 'nist-west-tower', file: 'nist-west-tower.jpg', width: 901, height: 541,
    link: 'Open the complete embedded NIST West Tower photograph',
    record: 'Inspect the photograph, attribution and limits'},
  {id: 'nist-west-tower-south-windows', file: 'nist-west-tower-south-windows.jpg', width: 936, height: 585,
    link: 'Open the complete embedded NIST south-side window photograph',
    record: 'Inspect the window comparison and its limits'},
];
async function ready(page) {
  await page.waitForFunction(() => document.body?.dataset.ready === 'true');
}
async function fits(page) {
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
}
async function decoded(image) {
  await image.scrollIntoViewIfNeeded();
  // Scrolling requests a lazy image, but does not establish that its current
  // request is available. Require actual load success before asking to decode.
  await image.page().waitForFunction(selector => {
    const image = document.querySelector(selector);
    return image?.complete && image.naturalWidth > 0;
  }, '#hospital-envelope img[src="' + await image.getAttribute('src') + '"]');
  await image.evaluate(image => image.decode());
}
async function viewer(page, id, width) {
  await page.waitForFunction(({id, width}) => {
    const dialog = document.getElementById('photo-dialog');
    const image = document.getElementById('photo-full');
    return new URL(location.href).searchParams.get('photo') === id &&
      dialog.open && image.naturalWidth === width;
  }, {id, width});
}
async function closed(page, enlargement) {
  await page.waitForFunction(() => !document.getElementById('photo-dialog').open &&
    !new URL(location.href).searchParams.has('photo'));
  const id = await enlargement.getAttribute('data-photo-id');
  await page.waitForFunction(id => document.activeElement ===
    document.querySelector(`a[data-photo-id="${id}"]`), id, {timeout: 5000}).catch(async error => {
    const actual = await page.evaluate(() => ({active: document.activeElement?.outerHTML.slice(0, 500),
      dialogOpen: document.getElementById('photo-dialog').open, photo: new URL(location.href).searchParams.get('photo')}));
    assert.fail('Focus did not return within five seconds: ' + JSON.stringify(actual) + '; ' + error.message);
  });
  assert.equal(await enlargement.evaluate(link => link === document.activeElement), true,
    'Returning from enlargement restores focus to the exact photograph link');
}

for (const viewport of [{width: 320, height: 740}, {width: 390, height: 844},
  {width: 844, height: 390}, {width: 1280, height: 900}]) {
  for (const appearance of ['dark', 'light']) {
    test(`hospital source and photograph journey ${viewport.width}x${viewport.height} ${appearance}`, async t => {
      const page = await fixture(t, {viewport});
      await page.goto(base + '/joplin.html#hospital-envelope');
      await page.waitForFunction(() => document.body.dataset.photoViewer === 'ready');
      await page.locator('#reading-appearance').selectOption(appearance);
      const account = page.locator('#hospital-envelope');
      assert.match(await account.textContent(), /standing frame did not mean a working hospital/);
      assert.match(await account.textContent(), /likely combination/);
      assert.match(await account.textContent(), /not a controlled experiment/);
      await fits(page);
      for (const photo of photos) {
        const image = account.locator(`img[src$="${photo.file}"]`);
        await decoded(image);
        assert.deepEqual(await image.evaluate(image => [image.naturalWidth, image.naturalHeight]),
          [photo.width, photo.height]);
        assert.ok((await image.getAttribute('alt')).length > 60);
        assert.equal(await image.evaluate(image => image.getBoundingClientRect().width <= innerWidth), true);
        const enlargement = account.getByRole('link', {name: photo.link, exact: true});
        await enlargement.focus();
        assert.equal(await enlargement.evaluate(link => link === document.activeElement), true);
        assert.equal(await enlargement.getAttribute('href'), 'assets/joplin-2011/' + photo.file);
        await enlargement.press('Enter');
        await viewer(page, photo.id, photo.width);
        assert.equal(await page.locator('#photo-original').getAttribute('href'),
          base + '/assets/joplin-2011/' + photo.file);
        assert.match(await page.locator('#photo-credit').textContent(), /National Institute of Standards and Technology/);
        assert.match(await page.locator('#photo-location').textContent(), /unregistered/);
        await page.goBack();
        await account.waitFor();
        await closed(page, enlargement);
        assert.equal(await enlargement.evaluate(link => link === document.activeElement), true,
          'Browser Back returns keyboard focus to the photograph enlargement link');
        if (viewport.width === 390 && appearance === 'dark') {
          await page.goForward();
          await viewer(page, photo.id, photo.width);
          await page.locator('#photo-close').press('Escape');
          await closed(page, enlargement);
        }
        assert.match(await account.getByRole('link', {name: photo.record, exact: true}).getAttribute('href'),
          new RegExp('media=' + photo.id + '#media-' + photo.id + '$'));
      }
      // The same two source records are used at each size. Exercise one actual
      // source route in every viewport, and the second with history traversal
      // in the narrow portrait scenario, rather than repeating every transition.
      const inspected = viewport.width === 390 && appearance === 'dark' ? photos : photos.slice(0, 1);
      for (const photo of inspected) {
        await account.getByRole('link', {name: photo.record, exact: true}).click();
        await ready(page);
        const media = page.locator('#media-' + photo.id);
        assert.match(await media.textContent(), /unregistered/);
        assert.match(await media.textContent(), /permitted hosting/);
        assert.match(await media.textContent(), /Not established in this record/);
        await media.getByText('Clock roles and registration', {exact: true}).click();
        assert.match(await media.locator('details').filter({hasText: 'Clock roles and registration'}).textContent(), /"alignment": null/);
        await media.getByRole('link', {name: 'Inspect the source card', exact: true}).click();
        await ready(page);
        const source = page.locator('#source-nist-hospital-envelope');
        assert.match(await source.textContent(), /PDF page 4/);
        assert.match(await source.textContent(), /Curtis Lynn Geise/);
        assert.match(await source.textContent(), /Not a full report/);
        assert.equal(await source.getByRole('link', {name: 'Read original source', exact: true}).getAttribute('target'), '_blank');
        await fits(page);
        if (viewport.width === 390 && appearance === 'dark') {
          await page.goBack();
          await ready(page);
          await media.waitFor();
          await page.goForward();
          await ready(page);
          await source.waitFor();
        }
        await page.getByRole('link', {name: 'Hospital frame, windows and loss of function', exact: true}).click();
        await account.waitFor();
        assert.equal(new URL(page.url()).hash, '#hospital-envelope');
      }
      const scaled = await account.evaluate(account => {
        const values = [...account.querySelectorAll('h3,p,figcaption')].map(node =>
          ({node, before: parseFloat(getComputedStyle(node).fontSize)}));
        for (const value of values) value.node.style.fontSize = (value.before * 2) + 'px';
        return values.map(value => [value.before, parseFloat(getComputedStyle(value.node).fontSize)]);
      });
      for (const [before, after] of scaled) assert.equal(after, before * 2);
      await fits(page);
      assert.match(await account.textContent(), /even without the electrical outage/);
      if (process.env.ATLAS_SCREENSHOT_DIR) {
        await mkdir(process.env.ATLAS_SCREENSHOT_DIR, {recursive: true});
        // Only the owned fixture region is captured. This is not a desktop capture.
        await account.screenshot({path: path.join(process.env.ATLAS_SCREENSHOT_DIR,
          `hospital-${viewport.width}x${viewport.height}-${appearance}.png`)});
      }
    });
  }
}

test('failed local photograph retains its account, alt description and exact source route', async t => {
  const page = await fixture(t, {viewport: {width: 320, height: 740}});
  let fail = true;
  await page.route('**/assets/joplin-2011/nist-west-tower.jpg', route => fail ? route.abort() : route.continue());
  await page.goto(base + '/joplin.html#hospital-envelope');
  await page.waitForFunction(() => document.body.dataset.photoViewer === 'ready');
  const account = page.locator('#hospital-envelope');
  const image = account.locator('img[src$="nist-west-tower.jpg"]');
  await image.scrollIntoViewIfNeeded();
  await page.waitForFunction(() => {
    const image = document.querySelector('#hospital-envelope img');
    return image.complete && image.naturalWidth === 0;
  });
  assert.match(await image.getAttribute('alt'), /damaged windows/);
  assert.match(await account.textContent(), /original color/);
  assert.ok(await account.getByRole('link', {name: 'complete source figure', exact: true}).first().getAttribute('href'));
  const enlargement = account.getByRole('link', {name: photos[0].link, exact: true});
  await enlargement.focus();
  await enlargement.press('Enter');
  await page.waitForFunction(() => document.getElementById('photo-dialog').open &&
    !document.getElementById('photo-failure').hidden && !document.getElementById('photo-retry').hidden);
  assert.match(await page.locator('#photo-caption').textContent(), /without a registered camera time or position/);
  assert.ok((await page.locator('#photo-source').getAttribute('href')).endsWith('#page=160'));
  assert.ok((await page.locator('#photo-license').getAttribute('href')).endsWith('#page=4'));
  fail = false;
  await page.locator('#photo-retry').click();
  await viewer(page, photos[0].id, photos[0].width);
  await page.locator('#photo-close').press('Escape');
  await closed(page, enlargement);
  await account.getByRole('link', {name: photos[0].record, exact: true}).click();
  await ready(page);
  assert.match(await page.locator('#media-nist-west-tower').textContent(), /not the order of failures/);
  await fits(page);
});

test('a deferred hospital photograph is loaded before decode acceptance', {timeout:15000}, async t => {
  const page = await fixture(t, {viewport: {width: 320, height: 740}});
  let release, requested;
  const held = new Promise(resolve => {release = resolve;});
  const seen = new Promise(resolve => {requested = resolve;});
  t.after(() => release());
  await page.route('**/assets/joplin-2011/nist-west-tower.jpg', async route => {
    requested();
    await held;
    await route.continue();
  });
  const image = page.locator('#hospital-envelope img[src$="nist-west-tower.jpg"]');
  let requestDeadline;
  try {
    await page.goto(base + '/joplin.html#hospital-envelope');
    await page.waitForFunction(() => document.body.dataset.photoViewer === 'ready');
    await image.scrollIntoViewIfNeeded();
    await Promise.race([seen, new Promise((resolve, reject) => {
      requestDeadline = setTimeout(() => reject(new Error('The visible lazy photograph was not requested')), 10000);
    })]);
    assert.equal(await image.evaluate(image => image.complete && image.naturalWidth > 0), false,
      'A request that is still held is not photograph acceptance');
  } finally {
    clearTimeout(requestDeadline);
    release();
  }
  await decoded(image);
  assert.deepEqual(await image.evaluate(image => [image.naturalWidth, image.naturalHeight]), [901, 541]);
  await fits(page);
});

test('a direct photograph view closes locally without inventing a previous page', async t => {
  const page = await fixture(t, {viewport: {width: 390, height: 844}});
  await page.goto(base + '/joplin.html?photo=nist-west-tower-south-windows&context=retained#hospital-envelope');
  await viewer(page, photos[1].id, photos[1].width);
  await page.locator('#photo-close').click();
  const enlargement = page.locator('#hospital-envelope').getByRole('link', {name: photos[1].link, exact: true});
  await closed(page, enlargement);
  const url = new URL(page.url());
  assert.equal(url.pathname, '/joplin.html');
  assert.equal(url.searchParams.get('context'), 'retained');
  assert.equal(url.hash, '#hospital-envelope');
  await fits(page);
});

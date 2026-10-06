import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {fixture, base} from './harness.mjs';

const ready = page => page.waitForFunction(() => document.body.dataset.surveyReader === 'ready');
const selected = (page, id) => page.waitForFunction(id =>
  document.querySelector('#path .survey-selected')?.id === id &&
  document.getElementById('survey-place').value === id, id);
const selectedInView = (page, id) => page.waitForFunction(id => {
  const target = document.getElementById(id);
  const rect = target.getBoundingClientRect();
  return target.classList.contains('survey-selected') && rect.top >= -1 &&
    rect.top < innerHeight && rect.left < innerWidth && rect.right > 0;
}, id);

for (const [width, appearance] of [[320, 'dark'], [1280, 'light']]) {
  test(`Tuscaloosa survey reader: ${width}px ${appearance}, named places and reversible history`, async t => {
    const page = await fixture(t, {viewport: {width, height: 844}, hasTouch: width < 600, isMobile: width < 600});
    const requests = []; page.on('request', request => requests.push(request.url()));
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
    const url = new URL(page.url());
    assert.equal(url.searchParams.get('context'), 'survey'); assert.equal(url.hash, '#path');
    assert.equal(await page.locator('#path .documentary-timeline > li:visible').count(), 6);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
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
  await page.locator('#field-survey a').last().click();
  await page.waitForFunction(() => document.body.dataset.ready === 'true');
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
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
});

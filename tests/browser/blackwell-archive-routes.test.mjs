import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {fixture, base} from './harness.mjs';
import {waitForDossier} from './dossier-readiness.mjs';

const gallery = 'https://legacy-westhist.libraries.ou.edu/locations/docs/westhist/flora/tornado.html';

for (const [width, appearance] of [[320, 'dark'], [1280, 'light']]) {
  test(`Blackwell archive routes: ${width}px ${appearance}, caption identity and keyboard source navigation`, async t => {
    const page = await fixture(t, {viewport: {width, height: 844}, hasTouch: width < 600, isMobile: width < 600});
    const requests = []; page.on('request', request => requests.push(request.url()));
    await page.goto(base + '/blackwell.html#archive-prints');
    await page.locator('#reading-appearance').selectOption(appearance);
    assert.equal(await page.locator('#archive-prints img, #archive-prints iframe').count(), 0);
    assert.match(await page.locator('#archive-prints').textContent(), /collector, not the photographer/);
    assert.match(await page.locator('#archive-prints').textContent(), /not visually inspected/);
    for (const [number, id] of [['62', 'ou-flora62-railroad-yard'], ['67', 'ou-flora67-fire-response']]) {
      const item = page.locator('#archive-flora' + number);
      assert.equal(await item.locator('.archive-original').getAttribute('href'), gallery);
      const evidence = item.locator('a[href*="observation="]');
      const evidenceTarget = {href: await evidence.evaluate(link => link.href), elementId: 'observation-' + id + '-caption'};
      await evidence.focus();
      await page.keyboard.press('Enter');
      await waitForDossier(page, evidenceTarget);
      assert.equal(new URL(page.url()).searchParams.get('observation'), id + '-caption');
      assert.match(await page.locator('#observation-' + id + '-caption').textContent(), /not an independent visual description/);
      const source = page.locator('#observation-' + id + '-caption a').first();
      const sourceTarget = {href: await source.evaluate(link => link.href), elementId: 'source-' + id};
      await source.click(); await waitForDossier(page, sourceTarget);
      assert.equal(new URL(page.url()).searchParams.get('source'), id);
      assert.match(await page.locator('#source-' + id).textContent(), /Photographer and copyright holder unknown/);
      assert.match(await page.locator('#source-' + id).textContent(), /Complete image pixels were not visually inspected/);
      assert.equal(await page.locator('#source-' + id + ' a').first().getAttribute('href'), gallery);
      await page.locator(`a[href="${base}/blackwell.html#archive-prints"]`).click();
      await page.locator('#archive-prints').waitFor({state: 'visible'});
    }
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    assert.equal(requests.some(url => !url.startsWith(base + '/')), false);
    if (process.env.ATLAS_SCREENSHOT_DIR) await page.screenshot({path: path.join(process.env.ATLAS_SCREENSHOT_DIR, `blackwell-archive-${width}-${appearance}.png`)});
  });
}

test('Blackwell original archive context remains useful without scripts at enlarged text', async t => {
  const page = await fixture(t, {javaScriptEnabled: false, viewport: {width: 568, height: 320}});
  await page.goto(base + '/blackwell.html#archive-prints');
  assert.equal(await page.locator('#archive-prints li').count(), 2);
  assert.equal(await page.locator('#archive-prints .archive-original').count(), 2);
  assert.match(await page.locator('#archive-prints').textContent(), /FLORA58 captions are excluded/);
  assert.match(await page.locator('#archive-prints').textContent(), /does not establish the fire/);
  assert.equal(await page.locator('#archive-prints img, #archive-prints iframe').count(), 0);
  await page.locator('p,li,h2,h3,a').evaluateAll(nodes => {
    const sizes = nodes.map(node => parseFloat(getComputedStyle(node).fontSize));
    nodes.forEach((node, index) => node.style.setProperty('font-size', `${sizes[index] * 2}px`, 'important'));
    if (!nodes.every((node, index) => Math.abs(parseFloat(getComputedStyle(node).fontSize) - sizes[index] * 2) < 0.1)) {
      throw new Error('Selected text did not reach twice its computed baseline');
    }
  });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  if (process.env.ATLAS_SCREENSHOT_DIR) await page.screenshot({path: path.join(process.env.ATLAS_SCREENSHOT_DIR, 'blackwell-archive-enlarged-no-script.png')});
});

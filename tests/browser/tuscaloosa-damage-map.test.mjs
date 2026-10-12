import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {fixture, base} from './harness.mjs';

const item = '0deae8ed1989461faf99b315bb0e3126';
const account = fid => `${item}:TCLBHM_Points_1947:${fid}`;
const url = fid => `${base}/tuscaloosa.html?account=${encodeURIComponent(account(fid))}#survey-account-${fid}`;
const ready = page => page.waitForFunction(() => document.body.dataset.surveyReader === 'ready');
async function capture(page, label) {
  if (process.env.ATLAS_TUSCA_CAPTURE_DIR) await page.screenshot({
    path: path.join(process.env.ATLAS_TUSCA_CAPTURE_DIR, label + '.png'), fullPage: false});
}
const selected = (page, fid) => page.waitForFunction(({id, fid}) => {
  const card = document.getElementById(`survey-account-${fid}`);
  return card?.open && card.classList.contains('damage-selected') &&
    document.getElementById('damage-account').value === id;
}, {id: account(fid), fid});

for (const [width, theme] of [[320, 'dark'], [1280, 'light']]) {
  test(`Tuscaloosa survey identity, duplicate coordinates and history ${width} ${theme}`, async t => {
    const page = await fixture(t, {viewport: {width, height: 900}});
    await page.goto(url(168));await ready(page);await selected(page, 168);
    await page.locator('#reading-appearance').selectOption(theme);
    assert.equal(await page.locator('[data-account-row]').count(), 198);
    await page.locator('#damage-account').selectOption(account(169));await selected(page, 169);
    assert.equal(new URL(page.url()).searchParams.get('account'), account(169));
    assert.match(await page.locator('#survey-account-169 .damage-raw pre').textContent(), /"FID": 169/);
    const shared = page.url();await page.reload();await ready(page);await selected(page, 169);
    await page.goBack();await ready(page);await selected(page, 168);
    await page.goForward();await ready(page);await selected(page, 169);
    const other = await fixture(t, {viewport: {width, height: 900}});
    await other.goto(shared);await ready(other);await selected(other, 169);
    await page.locator('#survey-place').selectOption('path-end');
    assert.equal(new URL(page.url()).searchParams.has('account'), false);
    assert.equal(new URL(page.url()).hash, '#path-end');
    await page.waitForFunction(() => document.getElementById('path-end').classList.contains('survey-selected'));
    await page.reload();await ready(page);
    assert.equal(await page.locator('#survey-place').inputValue(), 'path-end');
    assert.equal(await page.locator('.damage-selected').count(), 0);
    assert.equal(await page.evaluate(() => document.getElementById('photo-dialog')?.open || false), false);
  });

  test(`Tuscaloosa estimated map, outside account and empty filter ${width} ${theme}`, async t => {
    const page = await fixture(t, {viewport: {width, height: 900}});
    const external = [];page.on('request', req => {if(!req.url().startsWith(base))external.push(req.url());});
    await page.goto(`${base}/tuscaloosa.html#damage-map`);await ready(page);
    await page.locator('#reading-appearance').selectOption(theme);
    await page.locator('#damage-map-load').click();
    try {await page.waitForFunction(() => document.body.dataset.damageMap === 'ready');}
    catch (error) {
      console.error('TUSCALOOSA_DAMAGE_MAP_FAILURE ' + JSON.stringify(await page.evaluate(() => ({
        status: document.getElementById('damage-map-status').textContent,
        leaflet: Boolean(window.L), mapReady: document.body.dataset.damageMap || null,
        reference: {...document.getElementById('damage-map').dataset},
        hostHidden: document.getElementById('damage-interactive-map').hidden,
        pathCount: document.querySelectorAll('#damage-interactive-map path').length,
      }))));throw error;
    }
    assert.equal(await page.locator('#damage-interactive-map .survey-estimated-overall').count(), 1);
    assert.equal(await page.locator('#damage-interactive-map .survey-estimated-local').count(), 7);
    await page.locator('#damage-interactive-map').scrollIntoViewIfNeeded();
    await capture(page, `map-${width}-${theme}`);
    await page.locator('#damage-rating').selectOption('EF4');
    assert.match(await page.locator('#damage-account-status').textContent(), /42 of 198/);
    await page.locator('#damage-account').selectOption(account(11));await selected(page, 11);
    assert.match(await page.locator('#survey-account-11').textContent(), /Outside all seven local estimated EF4 areas/);
    await page.locator('#damage-reset').click();
    await page.locator('#damage-account').selectOption(account(16));await selected(page, 16);
    assert.match(await page.locator('#survey-account-16').textContent(), /Outside the estimated overall footprint/);
    await capture(page, `outside-account-${width}-${theme}`);
    await page.locator('#damage-search').fill('no_such_preserved_account_');
    assert.match(await page.locator('#damage-account-status').textContent(), /0 of 198/);
    assert.match(await page.locator('#damage-account-status').textContent(), /selected account remains visible outside/);
    assert.equal(await page.locator('#survey-account-16').isVisible(), true);
    await page.locator('#damage-reset').click();
    assert.match(await page.locator('#damage-account-status').textContent(), /198 of 198/);
    assert.deepEqual(external, []);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
  });
}

for (const width of [320, 1081]) {
  test(`Tuscaloosa original accounts remain readable without scripts ${width}`, async t => {
    const page = await fixture(t, {javaScriptEnabled: false, viewport: {width, height: 900}});
    await page.goto(url(196));
    const list = page.locator('#survey-accounts');
    if ((await list.getAttribute('open')) === null) await list.locator(':scope > summary').click();
    const card = page.locator('#survey-account-196');
    if ((await card.getAttribute('open')) === null) {
      try {await card.locator(':scope > summary').click();}
      catch (error) {
        console.error('TUSCALOOSA_NATIVE_ACCOUNT_FAILURE ' + JSON.stringify(await page.evaluate(() => {
          const card = document.getElementById('survey-account-196'), summary = card.querySelector('summary');
          const rect = summary.getBoundingClientRect();
          return {parentOpen: document.getElementById('survey-accounts').open, cardOpen: card.open,
            active: document.activeElement?.id, scrollY, height: innerHeight,
            rect: {top:rect.top,bottom:rect.bottom,left:rect.left,right:rect.right},
            scrollBehavior: getComputedStyle(document.documentElement).scrollBehavior,
            documentHeight: document.documentElement.scrollHeight};
        })));throw error;
      }
    }
    assert.match(await card.textContent(), /Null/);
    await card.locator('.damage-raw > summary').click();
    assert.match(await card.locator('pre').textContent(), /"damage_txt": "Null"/);
    assert.equal(await page.locator('[data-account-row]').count(), 198);
    assert.equal(await page.locator('#damage-map-load').isVisible(), false);
    assert.equal(await page.locator('a[href="#path"]').count() > 0, true);
    assert.equal(await page.locator('#survey-account-165 time').getAttribute('datetime'), '2011-07-12');
    assert.equal(await page.locator('#survey-account-165 time').textContent(), 'July 12, 2011');
    await capture(page, `native-account-${width}`);
  });
}

test('Tuscaloosa unknown account does not substitute another source identity', async t => {
  const page = await fixture(t);
  await page.goto(`${base}/tuscaloosa.html?stop=path-end&account=${encodeURIComponent(account(999))}`);await ready(page);
  assert.equal(await page.locator('.damage-selected').count(), 0);
  assert.equal(await page.locator('#damage-account').inputValue(), '');
  assert.match(await page.locator('#damage-account-status').textContent(), /not in this preserved survey/);
  assert.equal(await page.locator('#survey-place').inputValue(), 'path-end');
  assert.equal(await page.locator('[data-account-row]').count(), 198);
});

for (const failure of ['survey bytes', 'map controls']) {
  test(`Tuscaloosa ${failure} failure preserves the original native account`, async t => {
    const page = await fixture(t, {viewport: {width: 320, height: 900}});
    if (failure === 'survey bytes') await page.route('**/events/tuscaloosa-birmingham-2011-survey-*.json', route =>
      route.fulfill({contentType: 'application/json', body: '{}'}));
    else await page.route('**/vendor/leaflet/leaflet.js', route => route.abort());
    await page.goto(url(16));await ready(page);await selected(page, 16);
    await page.locator('#damage-map-load').click();
    await page.waitForFunction(() => document.getElementById('damage-map-status').textContent.includes('You can retry'));
    assert.equal(await page.locator('#damage-map-load').isDisabled(), false);
    assert.match(await page.locator('#survey-account-16').textContent(), /Outside the estimated overall footprint/);
    assert.match(await page.locator('#survey-account-16').textContent(), /missing text has not been supplied/);
    assert.equal(new URL(page.url()).searchParams.get('account'), account(16));
    assert.equal(await page.locator('#survey-account-16 a').filter({hasText: 'Original NWS map'}).count(), 1);
    await page.unroute(failure === 'survey bytes' ? '**/events/tuscaloosa-birmingham-2011-survey-*.json' : '**/vendor/leaflet/leaflet.js');
    await page.locator('#damage-map-load').click();
    await page.waitForFunction(() => document.body.dataset.damageMap === 'ready');await selected(page, 16);
  });
}

test('Tuscaloosa same-account activation restores its native fragment after a chapter link', async t => {
  const page = await fixture(t, {viewport: {width: 320, height: 900}});
  await page.goto(url(169));await ready(page);await selected(page, 169);
  await page.locator('.damage-map-method > summary').click();
  await page.locator('.damage-map-method a[href="#path"]').click();
  assert.equal(new URL(page.url()).hash, '#path');
  await page.locator('#survey-account-169 [data-damage-account]').click();
  await selected(page, 169);assert.equal(new URL(page.url()).hash, '#survey-account-169');
});

test('Tuscaloosa map group chooses a real member without merging its account identity', async t => {
  const page = await fixture(t, {viewport: {width: 390, height: 900}});
  await page.goto(`${base}/tuscaloosa.html#damage-map`);await ready(page);
  await page.locator('#damage-map-load').click();await page.waitForFunction(() => document.body.dataset.damageMap === 'ready');
  await page.locator('#damage-interactive-map .catalogue-cluster').first().click();
  const links = page.locator('#damage-map-group a[data-damage-account]');
  assert.ok(await links.count() > 1);
  const first = await links.first().getAttribute('data-damage-account');
  await links.first().click();await selected(page, Number(first.split(':').at(-1)));
  assert.equal(new URL(page.url()).searchParams.get('account'), first);
  assert.equal(await page.locator('#damage-interactive-map .map-selected').count(), 1);
  const second = await links.nth(1).getAttribute('data-damage-account');
  assert.notEqual(first, second);await links.nth(1).click();await selected(page, Number(second.split(':').at(-1)));
  assert.equal(new URL(page.url()).searchParams.get('account'), second);
});

test('Tuscaloosa account and existing photograph retain independent history', async t => {
  const page = await fixture(t, {viewport: {width: 390, height: 900}});
  await page.goto(url(16));await ready(page);await selected(page, 16);
  await page.locator('a[data-photo-id="birmingham-aftermath-april29"]').click();
  await page.locator('#photo-dialog[open]').waitFor();
  assert.equal(new URL(page.url()).searchParams.get('account'), account(16));
  assert.equal(new URL(page.url()).searchParams.get('photo'), 'birmingham-aftermath-april29');
  await page.reload();await ready(page);await page.locator('#photo-dialog[open]').waitFor();
  assert.equal(await page.evaluate(() => Boolean(document.activeElement?.closest('#photo-dialog'))), true);
  await page.goBack();await page.locator('#photo-dialog[open]').waitFor({state: 'hidden'});await selected(page, 16);
  await page.goForward();await page.locator('#photo-dialog[open]').waitFor();
  assert.equal(await page.evaluate(() => Boolean(document.activeElement?.closest('#photo-dialog'))), true);
  await page.locator('#photo-close').click();await page.locator('#photo-dialog[open]').waitFor({state: 'hidden'});
  assert.equal(new URL(page.url()).searchParams.get('account'), account(16));
  await selected(page, 16);
});

test('Tuscaloosa optional map module failure leaves account and written-stop controls working', async t => {
  const page = await fixture(t, {viewport: {width: 320, height: 900}});
  let attempts = 0;
  await page.route('**/tuscaloosa-damage-map.mjs', route => {attempts++;return route.abort();});
  await page.goto(url(16));await ready(page);await selected(page, 16);
  assert.equal(attempts, 0);
  await page.locator('#damage-map-load').click();
  await page.waitForFunction(() => document.getElementById('damage-map-status').textContent.includes('You can retry'));
  assert.equal(attempts, 1);
  await page.locator('#damage-account').selectOption(account(196));await selected(page, 196);
  await page.locator('#survey-place').selectOption('path-end');
  assert.equal(new URL(page.url()).hash, '#path-end');
  assert.equal(await page.locator('#survey-place').inputValue(), 'path-end');
});

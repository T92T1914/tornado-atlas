// Follow the existing written survey without inventing coordinates or clocks.
const reader = document.getElementById('survey-reader');
const list = document.querySelector('#path .documentary-timeline');
const stops = [...list.children];
const select = document.getElementById('survey-place');
const previous = document.getElementById('survey-previous');
const next = document.getElementById('survey-next');
const status = document.getElementById('survey-status');
let currentStopParameter;
let currentAccountParameter;
const damageSection = document.getElementById('damage-map');
const accountRows = [...document.querySelectorAll('[data-account-row]')];
const accountCards = new Map(accountRows.map(row => [row.dataset.accountRow, row.querySelector('.damage-account')]));
const accountSelect = document.getElementById('damage-account');
const damageRating = document.getElementById('damage-rating');
const damageSearch = document.getElementById('damage-search');
const accountStatus = document.getElementById('damage-account-status');
const accountPrevious = document.getElementById('damage-previous');
const accountNext = document.getElementById('damage-next');
let damageMap;
let visibleAccounts = [];
let pendingHistorySelection;
let pendingHistoryFrame;
let pendingHistoryDestination;
let initialSelectionEligible = false;
let initialPlacementDestination, initialPlacementDeadline, initialPlacementExpiry;
const initialInputs = ['wheel', 'touchstart', 'pointerdown', 'keydown'];

function retireInitialPlacement() {
  clearTimeout(initialPlacementExpiry);
  initialPlacementExpiry = undefined;
  initialPlacementDestination = initialPlacementDeadline = undefined;
  window.removeEventListener('scroll', recoverInitialPlacement);
  window.removeEventListener('click', initialNavigationIntent, true);
  document.removeEventListener('visibilitychange', initialVisibilityChange);
  for (const type of initialInputs) window.removeEventListener(type, cancelHistorySelection, true);
}

function initialVisibilityChange() {
  if (document.visibilityState === 'hidden') cancelHistorySelection();
}

function initialNavigationIntent(event) {
  if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey ||
    event.shiftKey || event.altKey || !event.target?.closest?.('a[href]')) return;
  cancelHistorySelection();
}

function recoverInitialPlacement() {
  if (initialPlacementDeadline === undefined) return; // The first placement is still pending.
  const url = new URL(location.href);
  if (performance.now() >= initialPlacementDeadline || location.href !== initialPlacementDestination ||
    document.visibilityState === 'hidden' || url.searchParams.has('photo') ||
    document.getElementById('photo-dialog')?.open) {
    retireInitialPlacement();
    return;
  }
  const target = url.searchParams.has('account') ? accountCards.get(url.searchParams.get('account')) :
    stops.find(stop => stop.id === url.searchParams.get('stop'));
  if (!target) {retireInitialPlacement(); return;}
  const rect = target.getBoundingClientRect();
  if (rect.top >= -1 && rect.top < innerHeight) return;
  // A late initial-load scroll can replace the first correct placement.
  // Consume this short-lived ownership before one recovery, without taking focus.
  retireInitialPlacement();
  showSelection({behavior: 'instant'});
}

function claimInitialPlacement() {
  initialPlacementDestination = location.href;
  window.addEventListener('scroll', recoverInitialPlacement, {passive: true});
  window.addEventListener('click', initialNavigationIntent, {capture: true});
  document.addEventListener('visibilitychange', initialVisibilityChange);
  for (const type of initialInputs) window.addEventListener(type, cancelHistorySelection, {capture: true, passive: true});
}

function cancelHistorySelection() {
  initialSelectionEligible = false;
  retireInitialPlacement();
  clearTimeout(pendingHistorySelection);
  cancelAnimationFrame(pendingHistoryFrame);
  pendingHistoryDestination = undefined;
}

for (const stop of stops) {
  const label = stop.querySelector(':scope > span').textContent;
  select.add(new Option(label, stop.id));
  stop.tabIndex = -1;
  const returnLink = document.createElement('a');
  returnLink.href = '#survey-reader';
  returnLink.textContent = 'Choose another place in the account';
  stop.querySelector('div').append(returnLink);
  returnLink.addEventListener('click', event => {
    event.preventDefault();
    cancelHistorySelection();
    reader.scrollIntoView({block: 'start'});
    select.focus({preventScroll: true});
  });
}

function showSelection({focus = false, scroll = true, behavior = 'auto'} = {}) {
  const parameters = new URL(location.href).searchParams;
  const requested = parameters.get('stop');
  currentStopParameter = requested;
  currentAccountParameter = parameters.get('account');
  const account = accountCards.get(currentAccountParameter);
  const index = stops.findIndex(stop => stop.id === requested);
  const selected = index >= 0 ? index : 0;
  for (const [position, stop] of stops.entries()) {
    stop.classList.toggle('survey-selected', position === selected);
  }
  select.value = stops[selected].id;
  previous.disabled = selected === 0;
  next.disabled = selected === stops.length - 1;
  status.textContent = requested && index < 0 ?
    'That place is not in this account. The complete written progression remains below.' :
    `Place ${selected + 1} of ${stops.length}. Written survey order, without assigned arrival times.`;
  showAccounts();
  if (account) {
    document.getElementById('survey-accounts').open = true;account.open = true;
    if (scroll) {account.scrollIntoView({block: 'start', behavior});if (focus) account.focus({preventScroll: true});}
  } else if (currentAccountParameter !== null) {
    // An unknown account never selects another account or a different written stop.
    accountStatus.textContent = 'That account is not in this preserved survey. All 198 original accounts remain below.';
  } else if (scroll && (focus || index >= 0)) {
    stops[selected].scrollIntoView({block: 'start', behavior});
    if (focus) stops[selected].focus({preventScroll: true});
  }
}

function queuePlacement(focus) {
  const destination = location.href;
  pendingHistoryDestination = destination;
  pendingHistorySelection = setTimeout(() => {
    if (location.href !== destination) {
      if (initialPlacementDestination === destination) retireInitialPlacement();
      if (pendingHistoryDestination === destination) pendingHistoryDestination = undefined;
      return;
    }
    pendingHistoryFrame = requestAnimationFrame(() => {
      if (location.href === destination && (focus ||
        (!new URL(location.href).searchParams.has('photo') && !document.getElementById('photo-dialog')?.open))) {
        showSelection({focus, behavior: 'instant'});
        if (!focus && initialPlacementDestination === destination) {
          initialPlacementDeadline = performance.now() + 500;
          // Expiry only retires the passive guard. It never schedules a scroll.
          initialPlacementExpiry = setTimeout(retireInitialPlacement, 500);
        }
      } else if (initialPlacementDestination === destination) retireInitialPlacement();
      if (pendingHistoryDestination === destination) pendingHistoryDestination = undefined;
    });
  }, 0);
}

function choose(id) {
  if (!stops.some(stop => stop.id === id)) return;
  cancelHistorySelection();
  const url = new URL(location.href);
  const leavingAccount = url.searchParams.has('account') || /^#survey-account-\d+$/.test(url.hash);
  url.searchParams.delete('account');
  if (leavingAccount) url.hash = id;
  if (url.href !== location.href || url.searchParams.get('stop') !== id) {
    url.searchParams.set('stop', id);
    history.pushState(null, '', url);
  }
  showSelection({focus: true});
}

function chooseAccount(id) {
  if (!accountCards.has(id)) return;
  cancelHistorySelection();
  const url = new URL(location.href);
  url.searchParams.set('account', id);url.hash = accountCards.get(id).id;
  if (url.href !== location.href) history.pushState(null, '', url);
  showSelection({focus: true, behavior: 'instant'});
}

function showAccounts() {
  if (!accountSelect) return;
  const needle = damageSearch.value.trim().toLocaleLowerCase('en');
  visibleAccounts = accountRows.filter(row => (!damageRating.value || row.dataset.rating === damageRating.value) &&
    (!needle || row.textContent.toLocaleLowerCase('en').includes(needle))).map(row => row.dataset.accountRow);
  for (const row of accountRows) {
    const selected = row.dataset.accountRow === currentAccountParameter;
    row.hidden = !selected && !visibleAccounts.includes(row.dataset.accountRow);
    row.querySelector('.damage-account').classList.toggle('damage-selected', selected);
  }
  accountSelect.replaceChildren(new Option('Choose an account', ''));
  const selectedOutside = accountCards.has(currentAccountParameter) && !visibleAccounts.includes(currentAccountParameter);
  const choices = selectedOutside ? [currentAccountParameter, ...visibleAccounts] : visibleAccounts;
  for (const id of choices) {
    const option = new Option(accountCards.get(id).querySelector('summary').textContent, id);
    if (selectedOutside && id === currentAccountParameter) option.textContent += ' (outside filters)';
    accountSelect.add(option);
  }
  accountSelect.value = accountCards.has(currentAccountParameter) ? currentAccountParameter : '';
  const index = visibleAccounts.indexOf(currentAccountParameter);
  accountPrevious.disabled = index <= 0;
  accountNext.disabled = index < 0 || index >= visibleAccounts.length - 1;
  accountStatus.textContent = `${visibleAccounts.length} of 198 source accounts match. Source order does not give impact times.` +
    (selectedOutside ? ' The selected account remains visible outside these filters.' : '');
  if (damageMap) {
    damageMap.map.setRecords(damageMap.records.filter(record => visibleAccounts.includes(record.id)));
    damageMap.map.select(damageMap.records.find(record => record.id === currentAccountParameter) || null);
  }
}

if (damageSection && accountSelect) {
  document.getElementById('damage-account-controls').hidden = false;
  document.getElementById('damage-map-enhancement').hidden = false;
  accountSelect.addEventListener('change', () => chooseAccount(accountSelect.value));
  damageRating.addEventListener('change', showAccounts);damageSearch.addEventListener('input', showAccounts);
  document.getElementById('damage-reset').addEventListener('click', () => {damageRating.value = '';damageSearch.value = '';showAccounts();});
  accountPrevious.addEventListener('click', () => chooseAccount(visibleAccounts[visibleAccounts.indexOf(currentAccountParameter) - 1]));
  accountNext.addEventListener('click', () => chooseAccount(visibleAccounts[visibleAccounts.indexOf(currentAccountParameter) + 1]));
  document.addEventListener('click', event => {
    const link = event.target.closest?.('a[data-damage-account]');
    if (!link || event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
    event.preventDefault();chooseAccount(link.dataset.damageAccount);
  });
  const load = document.getElementById('damage-map-load'), mapStatus = document.getElementById('damage-map-status');
  load.addEventListener('click', async () => {
    if (load.disabled || damageMap) return;
    cancelHistorySelection();load.disabled = true;mapStatus.textContent = 'Loading the preserved survey and local map controls...';
    try {
      let moduleDeadline;
      let mapModule;
      try {
        mapModule = await Promise.race([import('./tuscaloosa-damage-map.mjs'), new Promise((_, reject) => {
          moduleDeadline = setTimeout(() => reject(Error('The optional map controls could not load.')), 5000);
        })]);
      } finally {clearTimeout(moduleDeadline);}
      const {mountTuscaloosaDamageMap} = mapModule;
      damageMap = await mountTuscaloosaDamageMap(damageSection, {
        onSelect: record => {chooseAccount(record.id);damageMap.map.center(record);},
        onGroup: records => {
          const group = document.getElementById('damage-map-group');group.replaceChildren();group.hidden = false;
          const label = document.createElement('p');label.textContent = `${records.length} separate accounts in this map group. Choose one to inspect its original fields.`;group.append(label);
          for (const record of records) {
            const link = document.createElement('a'), url = new URL(location.href);
            url.searchParams.set('account', record.id);url.hash = accountCards.get(record.id).id;
            link.href = url.href;link.dataset.damageAccount = record.id;link.textContent = record.title;group.append(link);
          }
          group.scrollIntoView({block: 'nearest'});
        },
        onStatus: message => {mapStatus.textContent = message;},
      });
      load.hidden = true;showAccounts();document.body.dataset.damageMap = 'ready';
    } catch (error) {
      document.body.dataset.damageMapFailure = error.name;
      mapStatus.textContent = 'The interactive map could not load. The complete native accounts and original sources remain below. You can retry the map.';
    } finally {load.disabled = false;}
  });
}

select.addEventListener('change', () => choose(select.value));
previous.addEventListener('click', () => {
  const index = stops.findIndex(stop => stop.id === select.value);
  if (index > 0) choose(stops[index - 1].id);
});
next.addEventListener('click', () => {
  const index = stops.findIndex(stop => stop.id === select.value);
  if (index + 1 < stops.length) choose(stops[index + 1].id);
});
// An eligible gallery opening owns focus before its target handler pushes
// a photo entry without popstate. Later handlers can still cancel that opening.
for (const link of document.querySelectorAll('a[data-photo-id]')) {
  link.addEventListener('click', event => {
    if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey ||
      event.shiftKey || event.altKey) return;
    cancelHistorySelection();
  }, {capture: true});
}
window.addEventListener('popstate', () => {
  const destination = location.href;
  // A repeated event for the same destination does not supersede its placement.
  if (destination === pendingHistoryDestination) return;
  cancelHistorySelection();
  const parameters = new URL(location.href).searchParams;
  if (parameters.get('stop') !== currentStopParameter || parameters.get('account') !== currentAccountParameter) {
    showSelection({scroll: false});
    // Apply this reader's changed-stop placement in the next rendering update
    // after the history task, without starting another smooth scroll.
    // A newer choice, photo traversal or page departure cancels both stages.
    queuePlacement(true);
  }
});
window.addEventListener('pageshow', event => {
  if (event.persisted) {cancelHistorySelection(); return;}
  if (!initialSelectionEligible) return;
  initialSelectionEligible = false;
  const url = new URL(location.href);
  if (url.searchParams.get('stop') !== currentStopParameter || url.searchParams.get('account') !== currentAccountParameter || url.searchParams.has('photo') ||
    document.getElementById('photo-dialog')?.open) {retireInitialPlacement(); return;}
  // Place one valid explicit initial stop after native load/fragment placement.
  // A newer reader/gallery action owns the viewport; initial placement never
  // takes focus or disables native restoration for other navigation.
  queuePlacement(false);
});
window.addEventListener('pagehide', cancelHistorySelection);
reader.hidden = false;
showSelection({scroll: false});
initialSelectionEligible = currentAccountParameter !== null ? accountCards.has(currentAccountParameter) :
  stops.some(stop => stop.id === currentStopParameter);
if (initialSelectionEligible && !new URL(location.href).searchParams.has('photo') &&
  !document.getElementById('photo-dialog')?.open) claimInitialPlacement();
document.body.dataset.surveyReader = 'ready';

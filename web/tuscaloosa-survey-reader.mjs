// Follow the existing written survey without inventing coordinates or clocks.
const reader = document.getElementById('survey-reader');
const list = document.querySelector('#path .documentary-timeline');
const stops = [...list.children];
const select = document.getElementById('survey-place');
const previous = document.getElementById('survey-previous');
const next = document.getElementById('survey-next');
const status = document.getElementById('survey-status');
let currentStopParameter;
let pendingHistorySelection;
let pendingHistoryFrame;

function cancelHistorySelection() {
  clearTimeout(pendingHistorySelection);
  cancelAnimationFrame(pendingHistoryFrame);
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
    reader.scrollIntoView({block: 'start'});
    select.focus({preventScroll: true});
  });
}

function showSelection({focus = false, scroll = true, behavior = 'auto'} = {}) {
  const requested = new URL(location.href).searchParams.get('stop');
  currentStopParameter = requested;
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
  if (scroll && (focus || index >= 0)) {
    stops[selected].scrollIntoView({block: 'start', behavior});
    if (focus) stops[selected].focus({preventScroll: true});
  }
}

function choose(id) {
  if (!stops.some(stop => stop.id === id)) return;
  cancelHistorySelection();
  const url = new URL(location.href);
  if (url.searchParams.get('stop') !== id) {
    url.searchParams.set('stop', id);
    history.pushState(null, '', url);
  }
  showSelection({focus: true});
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
window.addEventListener('popstate', () => {
  cancelHistorySelection();
  if (new URL(location.href).searchParams.get('stop') !== currentStopParameter) {
    showSelection({scroll: false});
    const destination = location.href;
    // Apply this reader's changed-stop placement in the next rendering update
    // after the history task, without starting another smooth scroll.
    // A newer choice, photo traversal or page departure cancels both stages.
    pendingHistorySelection = setTimeout(() => {
      if (location.href !== destination) return;
      pendingHistoryFrame = requestAnimationFrame(() => {
        if (location.href === destination) showSelection({focus: true, behavior: 'instant'});
      });
    }, 0);
  }
});
window.addEventListener('pagehide', cancelHistorySelection);
reader.hidden = false;
showSelection();
document.body.dataset.surveyReader = 'ready';

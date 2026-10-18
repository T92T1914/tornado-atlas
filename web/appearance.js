// Apply the saved reading choice before the page paints. Storage is optional.
(() => {
  const root = document.documentElement;
  const valid = new Set(['system', 'light', 'dark']);
  let choice = 'dark';
  try {
    const saved = localStorage.getItem('tornado-atlas-appearance');
    if (valid.has(saved)) choice = saved;
  } catch { /* The exhibit also works when storage is blocked. */ }
  const apply = value => {
    if (value === 'system') root.removeAttribute('data-appearance');
    else root.dataset.appearance = value;
  };
  apply(choice);
  document.addEventListener('DOMContentLoaded', () => {
    // Keep the whole focused contents label visible in its sticky reading rail.
    const revealContentsLink = link => {
      const rail = link.closest('.documentary-contents');
      if (!link.isConnected || document.activeElement !== link || !rail ||
        getComputedStyle(rail).position !== 'sticky') return;
      link.scrollIntoView({behavior: 'instant', block: 'nearest', inline: 'nearest'});
    };
    document.addEventListener('focusin', event => {
      const link = event.target.closest?.('.documentary-layout > .documentary-contents a');
      if (!link) return;
      revealContentsLink(link);
      requestAnimationFrame(() => revealContentsLink(link));
    });
    // The bounded rail starts only after its native focus reveal is owned.
    for (const rail of document.querySelectorAll('.documentary-layout > .documentary-contents')) {
      rail.dataset.focusReveal = 'ready';
      rail.parentElement.dataset.focusReveal = 'ready';
    }
    // Native contents stay open without enhancement; narrow reading starts compact.
    const readingWidth = matchMedia('(max-width:1080px)');
    const adaptContents = () => {
      const open = !readingWidth.matches;
      for (const rail of document.querySelectorAll('details.documentary-contents')) {
        const summary = rail.querySelector(':scope > summary');
        const active = document.activeElement;
        const hidesFocus = !open && rail.open && summary &&
          rail.contains(active) && !summary.contains(active);
        rail.open = open;
        // Keep the keyboard reading position when compact contents hide a link.
        if (hidesFocus) summary.focus();
      }
    };
    adaptContents();
    readingWidth.addEventListener('change', adaptContents);
    const current = document.activeElement?.closest?.('.documentary-layout > .documentary-contents a');
    if (current) {
      revealContentsLink(current);
      requestAnimationFrame(() => revealContentsLink(current));
    }
    const select = document.getElementById('reading-appearance');
    if (!select) return;
    select.value = choice;
    select.addEventListener('change', () => {
      choice = valid.has(select.value) ? select.value : 'system';
      apply(choice);
      try { localStorage.setItem('tornado-atlas-appearance', choice); } catch { /* Optional preference. */ }
    });
    select.disabled = false;
    const help = document.getElementById('reading-appearance-help');
    if (help) help.hidden = true;
  });
})();

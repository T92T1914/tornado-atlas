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
    for (const navigation of document.querySelectorAll('.museum-nav')) {
      const groups = [...navigation.querySelectorAll(':scope > details')];
      const close = except => {
        for (const group of groups) if (group !== except) group.open = false;
      };
      // Native named disclosures also work without scripts. Keep ordinary
      // summary activation exclusive where that grouping is unavailable.
      navigation.addEventListener('click', event => {
        const summary = event.target.closest?.('summary');
        const group = summary?.parentElement;
        if (!event.defaultPrevented && event.button === 0 && groups.includes(group) && !group.open) close(group);
      });
      navigation.addEventListener('keydown', event => {
        if (event.key !== 'Escape' || event.defaultPrevented) return;
        const open = groups.find(group => group.open);
        if (!open) return;
        const returnFocus = open.contains(document.activeElement);
        close();
        if (returnFocus) open.querySelector(':scope > summary')?.focus({preventScroll: true});
        event.preventDefault();
        event.stopPropagation();
      });
      // On narrow pages closing a disclosure moves the document. Wait until
      // the outside click has its target, rather than moving it before pointerup.
      let outsidePointer = false;
      document.addEventListener('pointerdown', event => { outsidePointer = !navigation.contains(event.target); }, true);
      const releasePointer = () => { outsidePointer = false; };
      document.addEventListener('pointercancel', releasePointer, true);
      document.addEventListener('keydown', releasePointer, true);
      document.addEventListener('click', event => { outsidePointer = false; if (!navigation.contains(event.target)) close(); }, true);
      document.addEventListener('focusin', event => { if (!outsidePointer && !navigation.contains(event.target)) close(); }, true);
    }
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

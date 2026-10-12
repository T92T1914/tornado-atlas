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
    }
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

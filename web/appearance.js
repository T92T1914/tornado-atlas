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
    const select = document.getElementById('reading-appearance');
    if (!select) return;
    select.value = choice;
    select.addEventListener('change', () => {
      choice = valid.has(select.value) ? select.value : 'system';
      apply(choice);
      try { localStorage.setItem('tornado-atlas-appearance', choice); } catch { /* Optional preference. */ }
    });
  });
})();

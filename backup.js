/* Резервная копия и поиск */

const BACKUP_KEYS = [
  'nashe_chudo_settings',
  'nashe_chudo_choices',
  'nashe_chudo_shop_custom',
  'nashe_chudo_shop_links',
  'nashe_chudo_wishlist',
  'nashe_chudo_shop_items',
  'nashe_chudo_shop_migrated_v2',
  'nashe_chudo_checklists',
  'nashe_chudo_growth',
  'nashe_chudo_savings',
  'nashe_chudo_child_wishes',
  'nashe_chudo_ultrasound',
  'nashe_chudo_diary',
  'nashe_chudo_milestones',
  'nashe_chudo_story_photos',
  'nashe_chudo_names',
  'nashe_chudo_calendar_custom',
  'nashe_chudo_calendar_done',
  'nashe_chudo_baby_log',
  'nashe_chudo_vaccines_done',
  'nashe_chudo_product_previews'
];

function exportBackup() {
  const data = { version: 1, exported: new Date().toISOString(), keys: {} };
  BACKUP_KEYS.forEach(key => {
    const val = localStorage.getItem(key);
    if (val != null) data.keys[key] = val;
  });
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `nashe-chudo-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  showToast('Резервная копия скачана');
}

function importBackup(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!data.keys) throw new Error('bad format');
      Object.entries(data.keys).forEach(([key, val]) => {
        if (BACKUP_KEYS.includes(key)) localStorage.setItem(key, val);
      });
      showToast('Данные восстановлены — перезагрузка...');
      setTimeout(() => location.reload(), 1200);
    } catch {
      showToast('Не удалось прочитать файл');
    }
  };
  reader.readAsText(file);
}

function initBackup() {
  document.getElementById('backupExportBtn')?.addEventListener('click', exportBackup);
  document.getElementById('backupImportInput')?.addEventListener('change', e => {
    const file = e.target.files?.[0];
    if (file) importBackup(file);
    e.target.value = '';
  });
  document.getElementById('exportShoppingBtn')?.addEventListener('click', () => {
    if (typeof exportShoppingList === 'function') exportShoppingList();
  });
}

const SEARCH_INDEX = [];

function buildSearchIndex() {
  SEARCH_INDEX.length = 0;
  const add = (title, text, href) => SEARCH_INDEX.push({ title, text: (text || '').toLowerCase(), href });

  add('На этой неделе', 'актуально неделя', '#this-week');
  add('Календарь', 'узи анализы декрет пдр', '#calendar');
  add('История', 'любовь история', '#story');
  add('Месяцы беременности', 'путеводитель анализы', '#journey');
  add('К родам', 'покупки коляска кроватка wildberries ozon хотелки', '#shopping');
  add('Чек-листы', 'готовность роддом', '#checklists');
  add('Первый год', 'прививки педиатр', '#first-year');
  add('Рост и вес', 'график педиатр', '#growth');
  add('Экономика', 'накопления фонд', '#economy');
  add('Выплаты', 'пособие декрет томск', '#benefits');
  add('Альбом', 'узи дневник фото', '#memories');
  add('Помощники', 'шевеления схватки роддом малыш прививки кормление', '#tools');
  add('Имена', 'имя малыша', '#names');
  add('Настройки', 'пдр реквизиты backup', '#settings');

  if (typeof PREGNANCY_MONTHS !== 'undefined') {
    PREGNANCY_MONTHS.forEach(m => add(m.title, m.baby + ' ' + m.mom + ' ' + m.tips, '#journey'));
  }
  if (typeof SHOPPING_CATEGORIES !== 'undefined') {
    SHOPPING_CATEGORIES.forEach(c => {
      add(c.title, c.quantity, '#shopping');
    });
  }
  if (typeof CHECKLISTS !== 'undefined') {
    CHECKLISTS.forEach(cl => {
      add(cl.title, cl.items.join(' '), '#checklists');
      cl.items.forEach(it => add(it, cl.title, '#checklists'));
    });
  }
}

function initSearch() {
  buildSearchIndex();
  const btn = document.getElementById('searchToggle');
  const modal = document.getElementById('searchModal');
  const input = document.getElementById('searchInput');
  const results = document.getElementById('searchResults');
  if (!btn || !modal || !input || !results) return;

  const open = () => { modal.hidden = false; input.value = ''; input.focus(); renderSearch(''); };
  const close = () => { modal.hidden = true; };

  btn.addEventListener('click', open);
  modal.querySelector('.search-close')?.addEventListener('click', close);
  modal.querySelector('.search-backdrop')?.addEventListener('click', close);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') close();
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); open(); }
  });

  input.addEventListener('input', () => renderSearch(input.value.trim().toLowerCase()));

  function renderSearch(q) {
    if (!q) {
      results.innerHTML = '<p class="search-hint">Введите: коляска, МФЦ, прививка, роддом...</p>';
      return;
    }
    const hits = SEARCH_INDEX.filter(item => item.title.toLowerCase().includes(q) || item.text.includes(q)).slice(0, 12);
    results.innerHTML = hits.length
      ? hits.map(h => `<a href="${h.href}" class="search-hit"><strong>${escapeHtml(h.title)}</strong><span>${escapeHtml(h.text.slice(0, 80))}...</span></a>`).join('')
      : '<p class="search-hint">Ничего не найдено</p>';
    results.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', () => close());
    });
  }
}

function setupNavScrollSpy() {
  const links = document.querySelectorAll('.nav-link[href^="#"]');
  const sections = [...links].map(l => document.getElementById(l.getAttribute('href').slice(1))).filter(Boolean);
  if (!sections.length) return;

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const id = entry.target.id;
      links.forEach(l => l.classList.toggle('active', l.getAttribute('href') === '#' + id));
    });
  }, { rootMargin: '-40% 0px -50% 0px', threshold: 0 });

  sections.forEach(s => observer.observe(s));
}

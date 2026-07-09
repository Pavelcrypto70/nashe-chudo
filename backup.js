/* Резервная копия и поиск */

const BACKUP_KEYS = [
  'nashe_chudo_settings',
  'nashe_chudo_choices',
  'nashe_chudo_shop_custom',
  'nashe_chudo_shop_links',
  'nashe_chudo_wishlist',
  'nashe_chudo_shop_items',
  'nashe_chudo_gifts_wishlist',
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

const CLOUD_BACKUP_PATH = 'family/backup/latest';
const CLOUD_BACKUP_HISTORY_PREFIX = 'family/backup/history/';
const CLOUD_BACKUP_AT_KEY = 'nashe_chudo_cloud_backup_at';
const CLOUD_BACKUP_HISTORY_DAY_KEY = 'nashe_chudo_cloud_backup_history_day';
const CLOUD_BACKUP_DEBOUNCE_MS = 2500;

let cloudBackupTimer = null;
let applyingBackup = false;
let cloudBackupStatus = 'unknown';

const ALBUM_BACKUP_KEYS = ['nashe_chudo_ultrasound', 'nashe_chudo_story_photos'];

function buildBackupPayload() {
  const keys = {};
  BACKUP_KEYS.forEach(key => {
    const val = localStorage.getItem(key);
    if (val != null) keys[key] = val;
  });
  if (typeof leanAlbumForSync === 'function') {
    ALBUM_BACKUP_KEYS.forEach(key => {
      if (keys[key]) keys[key] = leanAlbumForSync(keys[key]);
    });
  }
  return {
    version: 2,
    type: 'nashe-chudo-backup',
    exportedAt: new Date().toISOString(),
    appVersion: typeof APP_VERSION !== 'undefined' ? APP_VERSION : '',
    device: typeof getDeviceLabel === 'function' ? getDeviceLabel() : 'unknown',
    deviceId: typeof getDeviceId === 'function' ? getDeviceId() : '',
    keys
  };
}

function backupPayloadScore(payload) {
  if (!payload?.keys) return 0;
  let score = 0;
  Object.values(payload.keys).forEach(v => {
    if (v && typeof v === 'string') score += v.length;
  });
  return score;
}

function applyBackupPayload(data, { reload = true } = {}) {
  if (!data?.keys) throw new Error('bad format');
  applyingBackup = true;
  const set = typeof origSetItem === 'function' ? origSetItem : localStorage.setItem.bind(localStorage);
  Object.entries(data.keys).forEach(([key, val]) => {
    if (BACKUP_KEYS.includes(key) && val != null) {
      try { set(key, val); } catch (err) {
        console.warn('Backup restore skip key:', key, err);
      }
    }
  });
  applyingBackup = false;
  if (reload) {
    showToast('Данные восстановлены — перезагрузка...');
    setTimeout(() => location.reload(), 1200);
  }
}

function cloudBackupUrls() {
  return [
    'backup-latest.json?t=' + Date.now(),
    'https://raw.githubusercontent.com/Pavelcrypto70/nashe-chudo/main/backup-latest.json?t=' + Date.now()
  ];
}

async function fetchCloudBackupFromUrls(urls) {
  for (const url of urls) {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) continue;
      const data = await res.json();
      if (data?.keys && backupPayloadScore(data) > 0) return data;
    } catch { /* try next */ }
  }
  return null;
}

async function pullCloudBackup() {
  if (typeof isSyncConfigured === 'function' && isSyncConfigured() && typeof syncRequestUrl === 'function') {
    try {
      const res = await syncRequestUrl(syncBlobUrl(CLOUD_BACKUP_PATH), 'GET', null, { silent: true, allowProxy: true });
      if (res.ok) {
        const data = await res.json();
        if (data?.keys && backupPayloadScore(data) > 0) return data;
        if (data?.value) {
          const parsed = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
          if (parsed?.keys) return parsed;
        }
      }
    } catch { /* fallback */ }
  }
  return fetchCloudBackupFromUrls(cloudBackupUrls());
}

async function pushCloudBackup({ silent = true } = {}) {
  if (typeof isSyncConfigured !== 'function' || !isSyncConfigured()) return false;
  if (typeof syncRequestUrl !== 'function' || typeof syncBlobUrl !== 'function') return false;

  const payload = buildBackupPayload();
  if (backupPayloadScore(payload) < 10) return false;

  const body = {
    updatedAt: Date.now(),
    exportedAt: payload.exportedAt,
    device: payload.device,
    deviceId: payload.deviceId,
    appVersion: payload.appVersion,
    keys: payload.keys
  };

  try {
    const res = await syncRequestUrl(syncBlobUrl(CLOUD_BACKUP_PATH), 'POST', body, { silent: true, allowProxy: true });
    if (!res.ok) throw new Error('backup push failed');

    const today = new Date().toISOString().slice(0, 10);
    const lastHistoryDay = localStorage.getItem(CLOUD_BACKUP_HISTORY_DAY_KEY);
    if (lastHistoryDay !== today) {
      const historyPath = CLOUD_BACKUP_HISTORY_PREFIX + today;
      await syncRequestUrl(syncBlobUrl(historyPath), 'POST', body, { silent: true, allowProxy: true });
      localStorage.setItem(CLOUD_BACKUP_HISTORY_DAY_KEY, today);
    }

    localStorage.setItem(CLOUD_BACKUP_AT_KEY, body.exportedAt);
    cloudBackupStatus = 'live';
    updateCloudBackupStatusUI();
    if (!silent) showToast('Облачный бэкап сохранён');
    return true;
  } catch (err) {
    console.warn('Cloud backup failed:', err);
    cloudBackupStatus = 'error';
    updateCloudBackupStatusUI();
    return false;
  }
}

function scheduleCloudBackup() {
  if (applyingBackup || applyingRemote) return;
  clearTimeout(cloudBackupTimer);
  cloudBackupTimer = setTimeout(() => pushCloudBackup({ silent: true }), CLOUD_BACKUP_DEBOUNCE_MS);
}

async function restoreFromCloudBackup() {
  if (!confirm('Восстановить все данные из облачного бэкапа? Текущие несохранённые изменения на этом устройстве будут заменены.')) {
    return;
  }

  const btn = document.getElementById('cloudBackupRestoreBtn');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Загружаем...';
  }

  try {
    const data = await pullCloudBackup();
    if (!data?.keys) {
      showToast('Бэкап в облаке не найден');
      return;
    }
    applyBackupPayload(data, { reload: true });
  } catch {
    showToast('Не удалось восстановить из облака');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-undo"></i> Восстановить из облака';
    }
  }
}

function formatBackupTime(iso) {
  if (!iso) return 'ещё не сохранялся';
  try {
    return new Date(iso).toLocaleString('ru-RU', {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
    });
  } catch {
    return iso;
  }
}

function updateCloudBackupStatusUI() {
  const el = document.getElementById('cloudBackupStatus');
  if (!el) return;

  const savedAt = localStorage.getItem(CLOUD_BACKUP_AT_KEY);
  const meta = {
    unknown: { icon: 'fa-cloud', text: 'Проверяем облачный бэкап...' },
    live: { icon: 'fa-shield-heart', text: `Последний бэкап: ${formatBackupTime(savedAt)}` },
    error: { icon: 'fa-cloud', text: 'Бэкап в фоне — данные на этом устройстве сохранены' }
  }[cloudBackupStatus] || { icon: 'fa-cloud', text: '' };

  el.className = 'cloud-backup-status cloud-backup-status--' + cloudBackupStatus;
  el.innerHTML = `<i class="fas ${meta.icon}"></i><span>${meta.text}</span>`;
}

async function initCloudBackup() {
  updateCloudBackupStatusUI();

  const remote = await pullCloudBackup();
  if (remote?.exportedAt) {
    const localAt = localStorage.getItem(CLOUD_BACKUP_AT_KEY);
    if (!localAt || remote.exportedAt > localAt) {
      localStorage.setItem(CLOUD_BACKUP_AT_KEY, remote.exportedAt);
    }
    cloudBackupStatus = 'live';
  } else if (cloudBackupStatus === 'unknown') {
    cloudBackupStatus = 'error';
  }
  updateCloudBackupStatusUI();

  if (backupPayloadScore(buildBackupPayload()) > 10) {
    scheduleCloudBackup();
  }
}

function exportBackup() {
  const data = buildBackupPayload();
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
      applyBackupPayload(data, { reload: true });
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
  initCloudBackup();
}

window.scheduleCloudBackup = scheduleCloudBackup;
window.pushCloudBackup = pushCloudBackup;
window.restoreFromCloudBackup = restoreFromCloudBackup;
window.updateCloudBackupStatus = updateCloudBackupStatusUI;

const SEARCH_INDEX = [];

function buildSearchIndex() {
  SEARCH_INDEX.length = 0;
  const add = (title, text, href) => SEARCH_INDEX.push({ title, text: (text || '').toLowerCase(), href });

  add('На этой неделе', 'актуально неделя', '#this-week');
  add('Календарь', 'узи анализы декрет пдр', '#calendar');
  add('История', 'любовь история', '#story');
  add('Месяцы беременности', 'путеводитель анализы', '#journey');
  add('К родам', 'покупки коляска кроватка wildberries ozon хотелки', '#shopping');
  add('Вишлист подарков', 'подарки родным wildberries ozon', '#gifts');
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

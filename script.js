/* ═══════════════════════════════════════════
   НАСТРОЙКИ — меняйте здесь
   ═══════════════════════════════════════════ */
const CONFIG = {
  husbandName: 'Павел',
  wifeName: 'Ира',
  lmpDate: '2026-03-04', // первый день последней менструации (ПМ)
  dueDate: null,
  sync: {
    familyId: 'nashe_chudo_ira_pavel',
    firebase: {
      apiKey: 'YOUR_API_KEY',
      authDomain: 'YOUR_PROJECT.firebaseapp.com',
      databaseURL: 'https://YOUR_PROJECT-default-rtdb.firebaseio.com',
      projectId: 'YOUR_PROJECT',
      appId: 'YOUR_APP_ID'
    }
  }
};

document.addEventListener('DOMContentLoaded', async () => {
  if (typeof initSync === 'function') await initSync();
  init();
});

function init() {
  const state = getPregnancyState();
  activeMonth = state.month;

  initSettings();
  updateCountdown(state);
  renderThisWeek(state);
  initCalendar();
  renderMonthTabs(state);
  renderMonthPanel(activeMonth);
  initMemories();
  initWishlist();
  renderShopping();
  if (typeof loadAllShopPreviews === 'function') loadAllShopPreviews();
  initChecklists();
  initFirstYear();
  initRegion();
  initGrowth();
  initEconomy();
  initTools();
  initNames();
  renderGiftCard();
  initBackup();
  initSearch();
  setupNav();
  setupNavScrollSpy();
}

function refreshAllData() {
  const state = getPregnancyState();
  activeMonth = state.month;

  if (typeof applyPersonalization === 'function') applyPersonalization();
  updateCountdown(state);
  renderThisWeek(state);
  if (typeof renderCalendar === 'function') renderCalendar();
  renderMonthTabs(state);
  renderMonthPanel(activeMonth);

  if (typeof renderStoryGallery === 'function') renderStoryGallery();
  if (typeof renderMemoriesTabs === 'function') renderMemoriesTabs();
  if (typeof renderMemoriesPanel === 'function') renderMemoriesPanel();

  if (typeof refreshWishlistUI === 'function') refreshWishlistUI();
  renderShopping();
  if (typeof loadAllShopPreviews === 'function') loadAllShopPreviews();

  if (typeof renderChecklistsSection === 'function') renderChecklistsSection();
  if (typeof renderBenefitChecklists === 'function') renderBenefitChecklists();

  if (typeof renderFirstYearTabs === 'function') renderFirstYearTabs();
  if (typeof renderFirstYearPanel === 'function') renderFirstYearPanel(activeBabyMonth);
  if (typeof updateFirstYearOverall === 'function') updateFirstYearOverall();

  if (typeof renderRegionSection === 'function') renderRegionSection();
  if (typeof refreshGrowth === 'function') refreshGrowth();
  if (typeof renderEconomySection === 'function') renderEconomySection();

  if (typeof renderToolsTabs === 'function') renderToolsTabs();
  if (typeof renderToolsPanel === 'function') renderToolsPanel();

  if (typeof renderNames === 'function') renderNames();
  if (typeof renderGiftCard === 'function') renderGiftCard();
  if (typeof renderSettingsPanel === 'function') renderSettingsPanel();
  if (typeof updateSyncStatus === 'function') updateSyncStatus();
}

/* ─── Расчёт срока (акушерские недели от ПМ) ─── */
function getLMP() {
  return parseDate(CONFIG.lmpDate);
}

function getPregnancyState() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = daysBetween(getLMP(), today);
  // Как в приложениях: «18 недель 1 день» = 18 полных недель + 1 день (не +1 к номеру недели)
  const week = Math.max(0, Math.min(41, Math.floor(days / 7)));
  const month = Math.min(9, Math.max(1, Math.ceil(Math.max(week, 1) / 4)));
  const dayInWeek = days % 7;
  return { week, month, days, dayInWeek };
}

/* ─── Даты и счётчик ─── */
function parseDate(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function getDueDate() {
  if (typeof getEffectiveDueDate === 'function') return getEffectiveDueDate();
  if (CONFIG.dueDate) return parseDate(CONFIG.dueDate);
  const lmp = getLMP();
  const due = new Date(lmp);
  due.setDate(due.getDate() + 280);
  return due;
}

function daysBetween(a, b) {
  const ms = 24 * 60 * 60 * 1000;
  return Math.round((b - a) / ms);
}

function updateCountdown(state) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const due = getDueDate();
  const pregnancy = state || getPregnancyState();

  const weeksEl = document.getElementById('weeksCount');
  const daysEl = document.getElementById('daysLeft');
  const dueText = document.getElementById('dueDateText');
  const fill = document.getElementById('progressFill');
  const progText = document.getElementById('progressText');
  const weekSub = document.getElementById('weekSub');
  const daysLabel = document.querySelector('.countdown-item:last-child .countdown-label');

  if (typeof isBabyBorn === 'function' && isBabyBorn()) {
    const ageDays = getBabyAgeDays();
    const s = getSettings();
    if (weeksEl) weeksEl.textContent = s.babyName || '👶';
    if (weekSub) weekSub.textContent = s.babyName ? 'наш малыш' : 'малыш с нами';
    if (daysEl) daysEl.textContent = ageDays;
    if (daysLabel) daysLabel.textContent = 'дней с рождения';
    if (dueText) dueText.textContent = 'Родился: ' + formatDateRu(getBirthDateStr());
    if (fill) fill.style.width = '100%';
    if (progText) progText.textContent = 'Мы родители!';
    return;
  }

  const daysLeft = Math.max(0, daysBetween(today, due));
  const totalDays = daysBetween(getLMP(), due);
  const daysElapsed = daysBetween(getLMP(), today);
  const progress = Math.min(100, Math.round((daysElapsed / totalDays) * 100));

  if (weeksEl) weeksEl.textContent = pregnancy.week;
  const dayPart = pregnancy.dayInWeek > 0 ? ` · ${pregnancy.dayInWeek} ${pregnancy.dayInWeek === 1 ? 'день' : pregnancy.dayInWeek < 5 ? 'дня' : 'дней'}` : '';
  if (weekSub) weekSub.textContent = `${pregnancy.month}-й месяц${dayPart}`;
  if (daysEl) daysEl.textContent = daysLeft;
  if (daysLabel) daysLabel.textContent = 'дней до встречи';
  if (dueText) {
    const opts = { day: 'numeric', month: 'long', year: 'numeric' };
    const s = getSettings();
    const label = s.dueDate ? 'ПДР' : 'ПДР (ориентир)';
    dueText.textContent = label + ': ' + due.toLocaleDateString('ru-RU', opts);
  }
  if (fill) fill.style.width = progress + '%';
  if (progText) progText.textContent = progress + '% пути пройдено';
}

/* ─── Блок «На этой неделе» ─── */
function renderThisWeek(state) {
  const el = document.getElementById('thisWeekPanel');
  if (!el) return;

  const monthData = PREGNANCY_MONTHS.find(m => m.month === state.month);
  if (!monthData) return;

  const benefitHint = state.week >= 28
    ? 'Оформить декрет и документы на выплаты'
    : state.week >= 18
      ? 'Узнать пол на УЗИ, начать список покупок'
      : 'Держать ритм витаминов и плановых визитов';

  const buyHint = state.week >= 24
    ? 'Доукомплектовать сумку в роддом и дом'
    : state.week >= 16
      ? 'Выбрать коляску и автокресло'
      : 'Пока рано к крупным покупкам — наблюдаем и копим силы';

  el.innerHTML = `
    <div class="this-week-badge">Сейчас · ${state.week} неделя</div>
    <div class="this-week-grid">
      <div class="this-week-card">
        <h4><i class="fas fa-seedling"></i> Малыш</h4>
        <p><strong>${monthData.size}</strong> — ${monthData.sizeDetail}</p>
        <p class="this-week-muted">${monthData.baby}</p>
      </div>
      <div class="this-week-card">
        <h4><i class="fas fa-vial"></i> На этой неделе</h4>
        <ul>${monthData.tests.slice(0, 3).map(t => `<li>${t}</li>`).join('')}</ul>
      </div>
      <div class="this-week-card">
        <h4><i class="fas fa-lightbulb"></i> Совет</h4>
        <p>${monthData.tips}</p>
      </div>
      <div class="this-week-card this-week-action">
        <h4><i class="fas fa-list-check"></i> Действия</h4>
        <p><i class="fas fa-wallet"></i> ${benefitHint}</p>
        <p><i class="fas fa-cart-shopping"></i> ${buyHint}</p>
        <a href="#checklists" class="this-week-link">Открыть чек-листы →</a>
      </div>
    </div>
  `;
}

/* ─── Месяцы беременности ─── */
let activeMonth = 1;

function renderMonthTabs(state) {
  const container = document.getElementById('monthTabs');
  if (!container) return;
  const currentMonth = state?.month || getPregnancyState().month;
  container.classList.add('month-tabs-scroll');

  container.innerHTML = PREGNANCY_MONTHS.map(m => {
    const isActive = m.month === activeMonth;
    const isCurrent = m.month === currentMonth;
    return `<button class="month-tab${isActive ? ' active' : ''}${isCurrent ? ' current' : ''}" data-month="${m.month}">
      <span class="month-num">${m.month}</span>
      <span class="month-label">${m.title.replace(' месяц', '')}</span>
      ${isCurrent ? '<span class="month-badge">сейчас</span>' : ''}
    </button>`;
  }).join('');

  container.querySelectorAll('.month-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      activeMonth = Number(btn.dataset.month);
      renderMonthTabs(getPregnancyState());
      renderMonthPanel(activeMonth);
    });
  });
}

function renderMonthPanel(month) {
  const data = PREGNANCY_MONTHS.find(m => m.month === month);
  const panel = document.getElementById('monthPanel');
  if (!data || !panel) return;

  panel.innerHTML = `
    <div class="panel-header">
      <div>
        <h3>${data.title} <span class="panel-weeks">${data.weeks} недели</span></h3>
        <p class="panel-size"><i class="fas fa-seedling"></i> Размер малыша: <strong>${data.size}</strong> (${data.sizeDetail})</p>
      </div>
    </div>
    <div class="panel-grid">
      <div class="panel-block">
        <h4><i class="fas fa-baby"></i> Малыш</h4>
        <p>${data.baby}</p>
      </div>
      <div class="panel-block">
        <h4><i class="fas fa-heart"></i> Твоё тело</h4>
        <p>${data.mom}</p>
      </div>
      <div class="panel-block">
        <h4><i class="fas fa-vial"></i> Анализы и визиты</h4>
        <ul>${data.tests.map(t => `<li>${t}</li>`).join('')}</ul>
      </div>
      <div class="panel-block">
        <h4><i class="fas fa-pills"></i> Витамины и добавки</h4>
        <ul>${data.vitamins.map(v => `<li>${v}</li>`).join('')}</ul>
      </div>
      <div class="panel-block panel-block-wide">
        <h4><i class="fas fa-venus-mars"></i> Пол ребёнка</h4>
        <p>${data.gender}</p>
      </div>
      <div class="panel-block panel-block-wide panel-tip">
        <h4><i class="fas fa-lightbulb"></i> Совет</h4>
        <p>${data.tips}</p>
      </div>
    </div>
  `;
}

/* ─── Покупки ─── */
const STORAGE_KEY = 'nashe_chudo_choices';
const CUSTOM_OPTIONS_KEY = 'nashe_chudo_shop_custom';
const SHOP_LINKS_KEY = 'nashe_chudo_shop_links';

function normalizeShopUrl(raw) {
  let url = (raw || '').trim();
  if (!url) return '';
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  try {
    new URL(url);
    return url;
  } catch {
    return '';
  }
}

function detectMarketplace(url) {
  const u = (url || '').toLowerCase();
  if (u.includes('wildberries') || u.includes('wb.ru')) return { name: 'Wildberries', icon: 'fa-bag-shopping' };
  if (u.includes('ozon')) return { name: 'Ozon', icon: 'fa-box' };
  if (u.includes('market.yandex') || u.includes('yandex.ru/market')) return { name: 'Яндекс Маркет', icon: 'fa-store' };
  if (u.includes('dns-shop') || u.includes('dns.ru')) return { name: 'DNS', icon: 'fa-laptop' };
  if (u.includes('detmir')) return { name: 'Детский мир', icon: 'fa-child' };
  if (u.includes('lamoda')) return { name: 'Lamoda', icon: 'fa-shirt' };
  return { name: 'Магазин', icon: 'fa-external-link-alt' };
}

function getShopLinksMap() {
  try {
    return JSON.parse(localStorage.getItem(SHOP_LINKS_KEY)) || {};
  } catch {
    return {};
  }
}

function saveShopLinksMap(map) {
  localStorage.setItem(SHOP_LINKS_KEY, JSON.stringify(map));
}

function getSavedLinkForOption(categoryId, optionId) {
  const entry = getShopLinksMap()[categoryId];
  if (entry && entry.optionId === optionId && entry.url) return entry.url;
  return '';
}

function setSavedLink(categoryId, optionId, rawUrl) {
  const map = getShopLinksMap();
  const url = normalizeShopUrl(rawUrl);
  if (!url) {
    if (map[categoryId]?.optionId === optionId) delete map[categoryId];
  } else {
    const prev = map[categoryId]?.preview;
    map[categoryId] = { optionId, url, preview: prev?.url === url ? prev : undefined };
  }
  saveShopLinksMap(map);
  return url;
}

async function setSavedLinkWithPreview(categoryId, optionId, rawUrl) {
  const url = setSavedLink(categoryId, optionId, rawUrl);
  if (url && typeof refreshShopLinkPreview === 'function') {
    await refreshShopLinkPreview(categoryId, optionId, url);
  }
}

function resolveOptionUrl(cat, opt) {
  if (!cat || !opt) return '';
  const saved = getSavedLinkForOption(cat.id, opt.id);
  if (saved) return saved;
  if (opt.url) return opt.url;
  return '';
}

function getChoices() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

function getCustomOptionsMap() {
  try {
    return JSON.parse(localStorage.getItem(CUSTOM_OPTIONS_KEY)) || {};
  } catch {
    return {};
  }
}

function getCustomOptionsForCategory(categoryId) {
  return getCustomOptionsMap()[categoryId] || [];
}

function saveCustomOptionsMap(map) {
  localStorage.setItem(CUSTOM_OPTIONS_KEY, JSON.stringify(map));
}

function addCustomOption(categoryId, { name, price, note, url }) {
  const trimmed = (name || '').trim();
  if (!trimmed) return null;

  const map = getCustomOptionsMap();
  const list = map[categoryId] || [];
  const normalizedUrl = normalizeShopUrl(url);
  const option = {
    id: 'custom_' + Date.now(),
    name: trimmed,
    price: (price || '').trim() || '—',
    note: (note || '').trim() || 'Свой вариант',
    custom: true
  };
  if (normalizedUrl) option.url = normalizedUrl;
  list.push(option);
  map[categoryId] = list;
  saveCustomOptionsMap(map);
  return option;
}

function removeCustomOption(categoryId, optionId) {
  const map = getCustomOptionsMap();
  const list = (map[categoryId] || []).filter(o => o.id !== optionId);
  if (list.length) map[categoryId] = list;
  else delete map[categoryId];
  saveCustomOptionsMap(map);

  const choices = getChoices();
  if (choices[categoryId] === optionId) {
    delete choices[categoryId];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(choices));
  }
}

function getAllOptionsForCategory(cat) {
  return [...cat.options, ...getCustomOptionsForCategory(cat.id)];
}

function findOption(cat, optionId) {
  return getAllOptionsForCategory(cat).find(o => o.id === optionId) || null;
}

function renderShopOption(cat, opt, selected) {
  const customClass = opt.custom ? ' shop-option-custom' : '';
  const priceHtml = opt.price && opt.price !== '—'
    ? `<span class="shop-opt-price">${opt.price}</span>`
    : '';
  const productUrl = resolveOptionUrl(cat, opt);
  const mp = productUrl ? detectMarketplace(productUrl) : null;
  const preview = productUrl && typeof getCachedPreview === 'function' ? getCachedPreview(productUrl) : null;
  const linkHtml = productUrl
    ? `<a class="shop-opt-link" href="${productUrl}" target="_blank" rel="noopener noreferrer" title="Открыть на ${mp.name}"><i class="fas ${mp.icon}"></i> ${mp.name}</a>`
    : '';
  const thumbHtml = preview?.image
    ? `<span class="shop-opt-thumb"><img src="${escapeHtml(preview.image)}" alt="" loading="lazy"></span>`
    : '';
  return `<button type="button" class="shop-option${selected ? ' selected' : ''}${customClass}" data-category="${cat.id}" data-option="${opt.id}">
    ${opt.custom ? '<span class="shop-opt-badge">свой</span>' : ''}
    ${thumbHtml}
    <span class="shop-opt-name">${opt.name}</span>
    ${priceHtml}
    <span class="shop-opt-note">${opt.note}</span>
    ${linkHtml}
    ${opt.custom ? `<span class="shop-opt-remove" data-remove-custom="${cat.id}" data-option="${opt.id}" title="Удалить"><i class="fas fa-times"></i></span>` : ''}
    ${selected ? '<span class="shop-opt-check"><i class="fas fa-check"></i></span>' : ''}
  </button>`;
}

function renderShopLinkBlock(cat, choices) {
  const selectedId = choices[cat.id];
  if (!selectedId) {
    return `<div class="shop-link-block shop-link-block--idle">
      <p class="shop-link-idle"><i class="fas fa-link"></i> Выберите вариант — затем можно вставить ссылку с Ozon, Wildberries и др.</p>
    </div>`;
  }

  const opt = findOption(cat, selectedId);
  const displayUrl = resolveOptionUrl(cat, opt);
  const mp = displayUrl ? detectMarketplace(displayUrl) : null;
  const inputValue = (getSavedLinkForOption(cat.id, selectedId) || opt?.url || '').replace(/"/g, '&quot;');
  const entry = getShopLinksMap()[cat.id];
  const preview = entry?.preview || (displayUrl && typeof getCachedPreview === 'function' ? getCachedPreview(displayUrl) : null);
  const previewHtml = displayUrl && typeof renderProductPreviewCard === 'function'
    ? renderProductPreviewCard(preview, displayUrl, false)
    : '';
  const loadingHtml = displayUrl && !preview?.image
    ? `<p class="shop-preview-loading"><i class="fas fa-spinner fa-spin"></i> Загружаем превью с ${mp?.name || 'магазина'}…</p>`
    : '';

  return `<div class="shop-link-block" data-link-cat="${cat.id}">
    <div class="shop-link-head">
      <i class="fas fa-link"></i>
      <div>
        <strong>Ссылка на товар</strong>
        <span class="shop-link-hint">Ozon, Wildberries, Яндекс Маркет, Детский мир…</span>
      </div>
    </div>
    <div class="shop-link-row">
      <input type="url" class="shop-link-input" data-cat="${cat.id}" data-option="${selectedId}"
        value="${inputValue}"
        placeholder="https://www.wildberries.ru/catalog/..." maxlength="500" inputmode="url">
      <button type="button" class="btn-wish btn-wish-outline btn-sm shop-link-save" data-cat="${cat.id}" data-option="${selectedId}">
        <i class="fas fa-check"></i><span class="shop-link-save-text">Сохранить</span>
      </button>
    </div>
    ${loadingHtml}
    ${previewHtml}
    ${displayUrl && !previewHtml ? `<a class="shop-link-open" href="${displayUrl}" target="_blank" rel="noopener noreferrer"><i class="fas ${mp.icon}"></i> Открыть на ${mp.name}</a>` : ''}
    ${previewHtml ? `<a class="shop-link-open shop-link-open--sub" href="${displayUrl}" target="_blank" rel="noopener noreferrer"><i class="fas fa-external-link-alt"></i> Открыть в магазине</a>` : ''}
  </div>`;
}

function saveChoice(categoryId, optionId) {
  const choices = getChoices();
  choices[categoryId] = optionId;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(choices));
  renderShopping();
}

function renderShopping() {
  const grid = document.getElementById('shoppingGrid');
  if (!grid) return;
  const choices = getChoices();

  grid.innerHTML = SHOPPING_CATEGORIES.map(cat => {
    const allOptions = getAllOptionsForCategory(cat);
    return `
    <div class="shop-category" data-shop-cat="${cat.id}">
      <div class="shop-cat-head">
        <i class="fas ${cat.icon}"></i>
        <div>
          <h3>${cat.title}</h3>
          <p class="shop-qty">${cat.quantity}</p>
        </div>
      </div>
      <div class="shop-options">
        ${allOptions.map(opt => renderShopOption(cat, opt, choices[cat.id] === opt.id)).join('')}
      </div>
      ${renderShopLinkBlock(cat, choices)}
      <div class="shop-custom">
        <button type="button" class="btn-wish btn-wish-ghost shop-custom-toggle" data-cat="${cat.id}">
          <i class="fas fa-plus"></i> Свой бренд / модель
        </button>
        <form class="shop-custom-form" data-cat="${cat.id}" hidden>
          <input type="text" name="name" placeholder="Бренд и модель, напр. Bugaboo Fox 5" required maxlength="80">
          <input type="text" name="price" placeholder="Цена (необязательно)" maxlength="40">
          <input type="url" name="url" placeholder="Ссылка Ozon / Wildberries (необязательно)" maxlength="500" inputmode="url">
          <input type="text" name="note" placeholder="Заметка (необязательно)" maxlength="120">
          <div class="shop-custom-actions">
            <button type="submit" class="btn-wish btn-wish-primary btn-sm">Добавить</button>
            <button type="button" class="btn-wish btn-wish-ghost btn-sm shop-custom-cancel">Отмена</button>
          </div>
        </form>
      </div>
      ${typeof renderWishlistInCategory === 'function' ? renderWishlistInCategory(cat.id) : ''}
    </div>
  `;
  }).join('');

  grid.querySelectorAll('.shop-option').forEach(btn => {
    btn.addEventListener('click', e => {
      if (e.target.closest('.shop-opt-remove') || e.target.closest('.shop-opt-link')) return;
      saveChoice(btn.dataset.category, btn.dataset.option);
    });
  });

  grid.querySelectorAll('.shop-opt-link').forEach(link => {
    link.addEventListener('click', e => e.stopPropagation());
  });

  grid.querySelectorAll('.shop-link-save').forEach(btn => {
    btn.addEventListener('click', async () => {
      const catId = btn.dataset.cat;
      const optionId = btn.dataset.option;
      const block = btn.closest('.shop-link-block');
      const input = block?.querySelector('.shop-link-input');
      if (!input) return;
      btn.disabled = true;
      await setSavedLinkWithPreview(catId, optionId, input.value);
      btn.disabled = false;
      renderShopping();
      showToast('Ссылка сохранена');
    });
  });

  grid.querySelectorAll('.shop-link-input').forEach(input => {
    input.addEventListener('keydown', async e => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      const btn = input.closest('.shop-link-block')?.querySelector('.shop-link-save');
      if (btn) btn.click();
    });
    let debounce;
    input.addEventListener('input', () => {
      clearTimeout(debounce);
      debounce = setTimeout(async () => {
        const url = normalizeShopUrl(input.value);
        if (!url || !url.match(/wildberries|ozon|wb\.ru/i)) return;
        const block = input.closest('.shop-link-block');
        if (block?.querySelector('.product-preview')) return;
        const preview = await fetchProductPreview(url);
        if (preview && block) {
          const wrap = document.createElement('div');
          wrap.innerHTML = renderProductPreviewCard(preview, url, false);
          const card = wrap.firstElementChild;
          if (card) {
            block.querySelector('.shop-preview-loading')?.remove();
            block.insertBefore(card, block.querySelector('.shop-link-open'));
          }
        }
      }, 800);
    });
  });

  grid.querySelectorAll('.shop-opt-remove').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      removeCustomOption(btn.dataset.removeCustom, btn.dataset.option);
      renderShopping();
    });
  });

  grid.querySelectorAll('.shop-custom-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const form = btn.parentElement.querySelector('.shop-custom-form');
      if (!form) return;
      const open = !form.hidden;
      grid.querySelectorAll('.shop-custom-form').forEach(f => { f.hidden = true; });
      grid.querySelectorAll('.shop-custom-toggle').forEach(b => { b.hidden = false; });
      if (!open) {
        form.hidden = false;
        btn.hidden = true;
        const input = form.querySelector('[name="name"]');
        if (input) input.focus();
      }
    });
  });

  grid.querySelectorAll('.shop-custom-cancel').forEach(btn => {
    btn.addEventListener('click', () => {
      const wrap = btn.closest('.shop-custom');
      const form = wrap.querySelector('.shop-custom-form');
      const toggle = wrap.querySelector('.shop-custom-toggle');
      form.reset();
      form.hidden = true;
      toggle.hidden = false;
    });
  });

  grid.querySelectorAll('.shop-custom-form').forEach(form => {
    form.addEventListener('submit', e => {
      e.preventDefault();
      const catId = form.dataset.cat;
      const fd = new FormData(form);
      const option = addCustomOption(catId, {
        name: fd.get('name'),
        price: fd.get('price'),
        note: fd.get('note'),
        url: fd.get('url')
      });
      if (!option) return;
      saveChoice(catId, option.id);
      form.reset();
      form.hidden = true;
      const toggle = form.parentElement.querySelector('.shop-custom-toggle');
      if (toggle) toggle.hidden = false;
      renderShopping();
    });
  });

  updateSummary();
}

function updateSummary() {
  const list = document.getElementById('selectedList');
  const empty = document.getElementById('summaryEmpty');
  if (!list) return;

  const choices = getChoices();
  const items = [];

  SHOPPING_CATEGORIES.forEach(cat => {
    const optId = choices[cat.id];
    if (!optId) return;
    const opt = findOption(cat, optId);
    if (opt) items.push({ cat: cat.title, opt });
  });

  list.innerHTML = items.map(i => {
    const catObj = SHOPPING_CATEGORIES.find(c => c.title === i.cat);
    const linkUrl = catObj ? resolveOptionUrl(catObj, i.opt) : '';
    const linkHtml = linkUrl
      ? ` <a class="summary-link" href="${linkUrl}" target="_blank" rel="noopener noreferrer" title="Открыть товар"><i class="fas fa-external-link-alt"></i></a>`
      : '';
    return `<li><strong>${i.cat}:</strong> ${i.opt.name}${i.opt.custom ? ' <em>(свой)</em>' : ''}${linkHtml}</li>`;
  }).join('');
  if (empty) empty.style.display = items.length ? 'none' : 'block';

  const exportBtn = document.getElementById('exportShoppingBtn');
  if (exportBtn) exportBtn.style.display = items.length ? 'inline-flex' : 'none';
}

/* renderBenefits перенесён в checklists.js */

/* ─── Навигация ─── */
function setupNav() {
  const toggle = document.getElementById('navToggle');
  const nav = document.getElementById('mainNav');

  if (toggle && nav) {
    toggle.addEventListener('click', () => {
      const isOpen = nav.classList.toggle('open');
      toggle.classList.toggle('open');
      document.body.classList.toggle('nav-open', isOpen);
    });
    nav.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', () => {
        nav.classList.remove('open');
        toggle.classList.remove('open');
        document.body.classList.remove('nav-open');
      });
    });
  }

  document.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener('click', e => {
      const id = link.getAttribute('href').slice(1);
      const target = document.getElementById(id);
      if (!target) return;
      e.preventDefault();
      const header = document.querySelector('.header');
      const offset = (header ? header.offsetHeight : 0) + 16;
      const y = target.getBoundingClientRect().top + window.pageYOffset - offset;
      window.scrollTo({ top: y, behavior: 'smooth' });
    });
  });
}

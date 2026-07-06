/* ═══════════════════════════════════════════
   НАСТРОЙКИ — меняйте здесь
   ═══════════════════════════════════════════ */
const CONFIG = {
  husbandName: 'Павел',
  wifeName: 'Ира',
  conceptionDate: '2026-03-03',
  dueDate: null
};

document.addEventListener('DOMContentLoaded', init);

function init() {
  const state = getPregnancyState();
  activeMonth = state.month;

  updateCountdown(state);
  renderThisWeek(state);
  renderMonthTabs(state);
  renderMonthPanel(activeMonth);
  initWishlist();
  renderShopping();
  initChecklists();
  initFirstYear();
  initEconomy();
  setupNav();
}

/* ─── Расчёт срока (акушерские недели) ─── */
function getLMP() {
  const c = parseDate(CONFIG.conceptionDate);
  const lmp = new Date(c);
  lmp.setDate(lmp.getDate() - 14);
  return lmp;
}

function getPregnancyState() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = daysBetween(getLMP(), today);
  const week = Math.max(1, Math.min(42, Math.floor(days / 7) + 1));
  const month = Math.min(9, Math.max(1, Math.ceil(week / 4)));
  const dayInWeek = days % 7 + 1;
  return { week, month, days, dayInWeek };
}

/* ─── Даты и счётчик ─── */
function parseDate(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function getDueDate() {
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

  const conception = parseDate(CONFIG.conceptionDate);
  const due = getDueDate();
  const pregnancy = state || getPregnancyState();

  const daysLeft = Math.max(0, daysBetween(today, due));
  const totalDays = daysBetween(getLMP(), due);
  const daysElapsed = daysBetween(getLMP(), today);
  const progress = Math.min(100, Math.round((daysElapsed / totalDays) * 100));

  const weeksEl = document.getElementById('weeksCount');
  const daysEl = document.getElementById('daysLeft');
  const dueText = document.getElementById('dueDateText');
  const fill = document.getElementById('progressFill');
  const progText = document.getElementById('progressText');
  const weekSub = document.getElementById('weekSub');

  if (weeksEl) weeksEl.textContent = pregnancy.week;
  if (weekSub) weekSub.textContent = `${pregnancy.month}-й месяц · ${pregnancy.dayInWeek} дн. недели`;
  if (daysEl) daysEl.textContent = daysLeft;
  if (dueText) {
    const opts = { day: 'numeric', month: 'long', year: 'numeric' };
    dueText.textContent = 'ПДР (ориентир): ' + due.toLocaleDateString('ru-RU', opts);
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

function getChoices() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

function saveChoice(categoryId, optionId) {
  const choices = getChoices();
  choices[categoryId] = optionId;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(choices));
  updateSummary();
  document.querySelectorAll(`[data-category="${categoryId}"]`).forEach(card => {
    card.classList.toggle('selected', card.dataset.option === optionId);
  });
}

function renderShopping() {
  const grid = document.getElementById('shoppingGrid');
  if (!grid) return;
  const choices = getChoices();

  grid.innerHTML = SHOPPING_CATEGORIES.map(cat => `
    <div class="shop-category">
      <div class="shop-cat-head">
        <i class="fas ${cat.icon}"></i>
        <div>
          <h3>${cat.title}</h3>
          <p class="shop-qty">${cat.quantity}</p>
        </div>
      </div>
      <div class="shop-options">
        ${cat.options.map(opt => {
          const sel = choices[cat.id] === opt.id;
          return `<button class="shop-option${sel ? ' selected' : ''}" data-category="${cat.id}" data-option="${opt.id}">
            <span class="shop-opt-name">${opt.name}</span>
            <span class="shop-opt-price">${opt.price}</span>
            <span class="shop-opt-note">${opt.note}</span>
            ${sel ? '<span class="shop-opt-check"><i class="fas fa-check"></i></span>' : ''}
          </button>`;
        }).join('')}
      </div>
      ${typeof renderWishlistInCategory === 'function' ? renderWishlistInCategory(cat.id) : ''}
    </div>
  `).join('');

  grid.querySelectorAll('.shop-option').forEach(btn => {
    btn.addEventListener('click', () => {
      saveChoice(btn.dataset.category, btn.dataset.option);
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
    const opt = cat.options.find(o => o.id === optId);
    if (opt) items.push({ cat: cat.title, opt });
  });

  list.innerHTML = items.map(i => `<li><strong>${i.cat}:</strong> ${i.opt.name}</li>`).join('');
  if (empty) empty.style.display = items.length ? 'none' : 'block';
}

/* renderBenefits перенесён в checklists.js */

/* ─── Навигация ─── */
function setupNav() {
  const toggle = document.getElementById('navToggle');
  const nav = document.getElementById('mainNav');

  if (toggle && nav) {
    toggle.addEventListener('click', () => {
      nav.classList.toggle('open');
      toggle.classList.toggle('open');
    });
    nav.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', () => {
        nav.classList.remove('open');
        toggle.classList.remove('open');
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

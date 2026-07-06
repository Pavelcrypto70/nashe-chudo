/* ═══════════════════════════════════════════
   НАСТРОЙКИ — меняйте здесь
   ═══════════════════════════════════════════ */
const CONFIG = {
  husbandName: 'Павел',
  wifeName: 'Ира',
  // Примерная дата зачатия: 1–5 марта → берём середину
  conceptionDate: '2026-03-03',
  // Точную ПДР укажете позже — пока считается автоматически (+266 дней)
  dueDate: null,
  // Текущий месяц для подсветки (4-й)
  highlightMonth: 4
};

document.addEventListener('DOMContentLoaded', init);

function init() {
  updateCountdown();
  renderMonthTabs();
  renderMonthPanel(CONFIG.highlightMonth);
  initWishlist();
  renderShopping();
  renderBenefits();
  setupNav();
}

/* ─── Даты и счётчик ─── */
function parseDate(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function getDueDate() {
  if (CONFIG.dueDate) return parseDate(CONFIG.dueDate);
  const conception = parseDate(CONFIG.conceptionDate);
  const due = new Date(conception);
  due.setDate(due.getDate() + 266);
  return due;
}

function daysBetween(a, b) {
  const ms = 24 * 60 * 60 * 1000;
  return Math.round((b - a) / ms);
}

function updateCountdown() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const conception = parseDate(CONFIG.conceptionDate);
  const due = getDueDate();

  const daysFromConception = daysBetween(conception, today);
  const weeks = Math.floor(daysFromConception / 7);
  const daysLeft = Math.max(0, daysBetween(today, due));
  const totalDays = daysBetween(conception, due);
  const progress = Math.min(100, Math.round((daysFromConception / totalDays) * 100));

  const weeksEl = document.getElementById('weeksCount');
  const daysEl = document.getElementById('daysLeft');
  const dueText = document.getElementById('dueDateText');
  const fill = document.getElementById('progressFill');
  const progText = document.getElementById('progressText');

  if (weeksEl) weeksEl.textContent = weeks;
  if (daysEl) daysEl.textContent = daysLeft;
  if (dueText) {
    const opts = { day: 'numeric', month: 'long', year: 'numeric' };
    dueText.textContent = 'ПДР (ориентир): ' + due.toLocaleDateString('ru-RU', opts);
  }
  if (fill) fill.style.width = progress + '%';
  if (progText) progText.textContent = progress + '% пути пройдено';
}

/* ─── Месяцы беременности ─── */
let activeMonth = CONFIG.highlightMonth;

function renderMonthTabs() {
  const container = document.getElementById('monthTabs');
  if (!container) return;

  container.innerHTML = PREGNANCY_MONTHS.map(m => {
    const isActive = m.month === activeMonth;
    const isCurrent = m.month === CONFIG.highlightMonth;
    return `<button class="month-tab${isActive ? ' active' : ''}${isCurrent ? ' current' : ''}" data-month="${m.month}">
      <span class="month-num">${m.month}</span>
      <span class="month-label">${m.title.replace(' месяц', '')}</span>
      ${isCurrent ? '<span class="month-badge">сейчас</span>' : ''}
    </button>`;
  }).join('');

  container.querySelectorAll('.month-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      activeMonth = Number(btn.dataset.month);
      renderMonthTabs();
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

/* ─── Выплаты ─── */
function renderBenefits() {
  const container = document.getElementById('benefitsTimeline');
  if (!container) return;

  container.innerHTML = BENEFITS_RF.map((b, i) => `
    <div class="benefit-card status-${b.status}">
      <div class="benefit-num">${i + 1}</div>
      <div class="benefit-body">
        <h3>${b.title}</h3>
        <div class="benefit-amount">${b.amount}</div>
        <div class="benefit-details">
          <p><i class="fas fa-calendar"></i> <strong>Когда:</strong> ${b.when}</p>
          <p><i class="fas fa-building"></i> <strong>Куда:</strong> ${b.where}</p>
          <p><i class="fas fa-file-alt"></i> <strong>Документы:</strong> ${b.docs}</p>
        </div>
      </div>
    </div>
  `).join('');
}

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

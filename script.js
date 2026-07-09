/* ═══════════════════════════════════════════
   НАСТРОЙКИ — меняйте здесь
   ═══════════════════════════════════════════ */
const CONFIG = {
  husbandName: 'Павел',
  wifeName: 'Ира',
  lmpDate: '2026-03-04', // первый день последней менструации (ПМ)
  dueDate: null,
  sync: {
    namespace: 'nashe-chudo-ira-pavel-k7m2',
    path: 'family/sync',
    key: 'e2f80e6ed00f2ae08874f4b0dd521b5b3f81f8c9b3ccfe0024b2e10a727e6205'
  }
};

document.addEventListener('DOMContentLoaded', async () => {
  if (typeof initSync === 'function') {
    try {
      await initSync();
    } catch (err) {
      console.error('Sync failed:', err);
    }
  }
  init();
});

function init() {
  try {
    runInit();
  } catch (err) {
    console.error('Init failed:', err);
    const panel = document.getElementById('thisWeekPanel');
    if (panel) {
      panel.innerHTML = '<p class="mem-empty">Не удалось загрузить данные. Обновите страницу или очистите кэш браузера.</p>';
    }
  }
}

function runInit() {
  const state = getPregnancyState();
  activeMonth = state.month;

  initSettings();
  updateCountdown(state);
  renderThisWeek(state);
  initCalendar();
  renderMonthTabs(state);
  renderMonthPanel(activeMonth);
  initMemories();
  initShopping();
  initGiftsWishlist();
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

  if (typeof renderShopping === 'function') renderShopping();
  if (typeof renderGiftsWishlist === 'function') renderGiftsWishlist();

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

function getPregnancyMonthData(state) {
  const byMonth = PREGNANCY_MONTHS.find(m => m.month === state.month);
  if (byMonth) return byMonth;
  const w = Math.max(1, state.week || 1);
  return PREGNANCY_MONTHS.find(m => {
    const parts = m.weeks.split(/[–-]/).map(Number);
    return parts.length === 2 && w >= parts[0] && w <= parts[1];
  }) || PREGNANCY_MONTHS[0];
}

/* ─── Блок «На этой неделе» ─── */
function renderThisWeek(state) {
  const el = document.getElementById('thisWeekPanel');
  if (!el) return;

  const monthData = getPregnancyMonthData(state);
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

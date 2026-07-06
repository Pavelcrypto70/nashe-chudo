/* Помощники: шевеления, схватки, роддом */

const KICKS_KEY = 'nashe_chudo_kicks_session';

let toolsTab = 'kicks';
let kickCount = 0;
let kickStart = null;
let kickTimer = null;
let contractions = [];
let contractionActive = null;

function initTools() {
  renderToolsTabs();
  renderToolsPanel();
  renderHospitalCard();
}

function renderToolsTabs() {
  const el = document.getElementById('toolsTabs');
  if (!el) return;
  const tabs = [
    { id: 'kicks', label: 'Шевеления', icon: 'fa-shoe-prints' },
    { id: 'contractions', label: 'Схватки', icon: 'fa-stopwatch' },
    { id: 'hospital', label: 'Роддом', icon: 'fa-hospital' },
    { id: 'baby', label: 'Малыш', icon: 'fa-baby' }
  ];
  el.innerHTML = tabs.map(t => `
    <button type="button" class="mem-tab${toolsTab === t.id ? ' active' : ''}" data-tab="${t.id}">
      <i class="fas ${t.icon}"></i> ${t.label}
    </button>`).join('');
  el.querySelectorAll('.mem-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      toolsTab = btn.dataset.tab;
      renderToolsTabs();
      renderToolsPanel();
    });
  });
}

function renderToolsPanel() {
  const panel = document.getElementById('toolsPanel');
  if (!panel) return;

  if (toolsTab === 'kicks') {
    panel.innerHTML = `
      <div class="tool-card tool-kicks">
        <p class="tool-lead">С 28 недели: 10 шевелений за 2 часа — норма. Нажимайте при каждом пинке.</p>
        <div class="kick-display">
          <span class="kick-num" id="kickNum">0</span>
          <span class="kick-target">/ 10</span>
        </div>
        <p class="kick-timer" id="kickTimerText">Нажмите «Начать»</p>
        <div class="tool-actions">
          <button type="button" class="btn-wish btn-wish-primary" id="kickBtn"><i class="fas fa-plus"></i> Пнули!</button>
          <button type="button" class="btn-wish btn-wish-outline" id="kickStartBtn">Начать сессию</button>
          <button type="button" class="btn-wish btn-wish-ghost" id="kickResetBtn">Сбросить</button>
        </div>
      </div>`;
    bindKicks();
    return;
  }

  if (toolsTab === 'contractions') {
    const rows = contractions.slice().reverse();
    panel.innerHTML = `
      <div class="tool-card tool-contractions">
        <p class="tool-lead">Нажмите при начале схватки, ещё раз — при окончании. Интервал между началами — главный ориентир.</p>
        <div class="contr-actions">
          <button type="button" class="btn-wish btn-wish-primary btn-contr-lg" id="contrBtn">
            <i class="fas fa-circle"></i> <span id="contrBtnText">Схватка началась</span>
          </button>
          <button type="button" class="btn-wish btn-wish-ghost" id="contrClearBtn">Очистить</button>
        </div>
        <div class="contr-list-wrap">
          <table class="contr-table">
            <thead><tr><th>#</th><th>Начало</th><th>Длит.</th><th>Интервал</th></tr></thead>
            <tbody>${rows.length ? rows.map((c, i) => contrRow(c, contractions.length - i)).join('') : '<tr><td colspan="4" class="contr-empty">Пока нет записей</td></tr>'}</tbody>
          </table>
        </div>
        <p class="tool-disclaimer">При регулярных схватках каждые 5 мин — звоните в роддом. Это не замена врачу.</p>
      </div>`;
    bindContractions();
    return;
  }

  if (toolsTab === 'hospital') {
    panel.innerHTML = `<div id="hospitalCardWrap"></div>`;
    renderHospitalCard('hospitalCardWrap');
    return;
  }

  if (toolsTab === 'baby') {
    panel.innerHTML = `<div id="babyLifeWrap"></div>`;
    renderBabyLifePanel(document.getElementById('babyLifeWrap'));
  }
}

function bindKicks() {
  const saved = JSON.parse(sessionStorage.getItem(KICKS_KEY) || 'null');
  if (saved) {
    kickCount = saved.count || 0;
    kickStart = saved.start ? new Date(saved.start) : null;
    if (kickStart) startKickClock();
  }
  updateKickUI();

  document.getElementById('kickStartBtn')?.addEventListener('click', () => {
    kickCount = 0;
    kickStart = new Date();
    saveKickSession();
    startKickClock();
    updateKickUI();
  });

  document.getElementById('kickBtn')?.addEventListener('click', () => {
    if (!kickStart) {
      kickStart = new Date();
      startKickClock();
    }
    kickCount = Math.min(10, kickCount + 1);
    saveKickSession();
    updateKickUI();
    if (kickCount >= 10) showToast('10 шевелений — отлично!');
  });

  document.getElementById('kickResetBtn')?.addEventListener('click', () => {
    kickCount = 0;
    kickStart = null;
    clearInterval(kickTimer);
    sessionStorage.removeItem(KICKS_KEY);
    updateKickUI();
  });
}

function saveKickSession() {
  sessionStorage.setItem(KICKS_KEY, JSON.stringify({ count: kickCount, start: kickStart?.toISOString() }));
}

function startKickClock() {
  clearInterval(kickTimer);
  kickTimer = setInterval(updateKickUI, 1000);
}

function updateKickUI() {
  const num = document.getElementById('kickNum');
  const txt = document.getElementById('kickTimerText');
  if (num) num.textContent = kickCount;
  if (!txt) return;
  if (!kickStart) {
    txt.textContent = 'Нажмите «Начать»';
    return;
  }
  const elapsed = Math.floor((Date.now() - kickStart) / 1000);
  const m = Math.floor(elapsed / 60);
  const s = elapsed % 60;
  txt.textContent = `Время: ${m}:${String(s).padStart(2, '0')}${kickCount >= 10 ? ' · Готово!' : ''}`;
}

function bindContractions() {
  document.getElementById('contrBtn')?.addEventListener('click', () => {
    const now = new Date();
    if (!contractionActive) {
      contractionActive = { start: now, end: null };
      document.getElementById('contrBtnText').textContent = 'Схватка закончилась';
      document.getElementById('contrBtn')?.classList.add('active');
    } else {
      contractionActive.end = now;
      const prev = contractions[contractions.length - 1];
      if (prev?.start) {
        contractionActive.interval = Math.round((contractionActive.start - prev.start) / 1000);
      }
      contractionActive.duration = Math.round((contractionActive.end - contractionActive.start) / 1000);
      contractions.push(contractionActive);
      contractionActive = null;
      document.getElementById('contrBtnText').textContent = 'Схватка началась';
      document.getElementById('contrBtn')?.classList.remove('active');
      renderToolsPanel();
    }
  });

  document.getElementById('contrClearBtn')?.addEventListener('click', () => {
    contractions = [];
    contractionActive = null;
    renderToolsPanel();
  });
}

function contrRow(c, num) {
  const fmt = d => d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const dur = c.duration != null ? `${c.duration} сек` : '—';
  const int = c.interval != null ? `${Math.floor(c.interval / 60)}:${String(c.interval % 60).padStart(2, '0')}` : '—';
  return `<tr><td>${num}</td><td>${fmt(c.start)}</td><td>${dur}</td><td>${int}</td></tr>`;
}

function renderHospitalCard(containerId) {
  const wrapId = containerId || 'hospitalCard';
  const el = document.getElementById(wrapId);
  if (!el) return;
  const s = getSettings();
  const mapUrl = `https://yandex.ru/maps/?text=${encodeURIComponent(s.hospitalAddress || 'Томск роддом')}`;
  el.innerHTML = `
    <div class="hospital-card">
      <h3><i class="fas fa-hospital"></i> ${escapeHtml(s.hospitalName)}</h3>
      <p><i class="fas fa-location-dot"></i> ${escapeHtml(s.hospitalAddress)}</p>
      ${s.hospitalPhone ? `<p><i class="fas fa-phone"></i> <a href="tel:${s.hospitalPhone.replace(/\s/g, '')}">${escapeHtml(s.hospitalPhone)}</a></p>` : ''}
      <p class="hospital-notes">${escapeHtml(s.hospitalNotes)}</p>
      <div class="hospital-actions">
        <a href="${mapUrl}" class="btn-wish btn-wish-primary" target="_blank" rel="noopener"><i class="fas fa-map"></i> Маршрут</a>
        ${s.hospitalPhone ? `<a href="tel:${s.hospitalPhone.replace(/\s/g, '')}" class="btn-wish btn-wish-outline"><i class="fas fa-phone"></i> Позвонить</a>` : ''}
        <a href="#checklists" class="btn-wish btn-wish-ghost"><i class="fas fa-suitcase"></i> Сумка в роддом</a>
      </div>
    </div>`;
}

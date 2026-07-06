/* После родов: лог кормления/сна и календарь прививок */

const BABY_LOG_KEY = 'nashe_chudo_baby_log';
const VACCINE_DONE_KEY = 'nashe_chudo_vaccines_done';

let babySubTab = 'log';

const LOG_TYPES = [
  { id: 'feed_l', label: 'Грудь Л', icon: 'fa-baby' },
  { id: 'feed_r', label: 'Грудь П', icon: 'fa-baby' },
  { id: 'formula', label: 'Смесь', icon: 'fa-bottle-droplet' },
  { id: 'sleep', label: 'Сон', icon: 'fa-moon' },
  { id: 'diaper', label: 'Подгузник', icon: 'fa-baby' },
  { id: 'other', label: 'Другое', icon: 'fa-note-sticky' }
];

function getBabyLog() {
  try {
    return JSON.parse(localStorage.getItem(BABY_LOG_KEY)) || [];
  } catch {
    return [];
  }
}

function saveBabyLog(entries) {
  localStorage.setItem(BABY_LOG_KEY, JSON.stringify(entries));
}

function getVaccinesDone() {
  try {
    return JSON.parse(localStorage.getItem(VACCINE_DONE_KEY)) || {};
  } catch {
    return {};
  }
}

function saveVaccinesDone(state) {
  localStorage.setItem(VACCINE_DONE_KEY, JSON.stringify(state));
}

function renderBabyLifePanel(container) {
  if (!container) return;

  if (!isBabyBorn()) {
    container.innerHTML = `
      <div class="baby-not-born">
        <i class="fas fa-baby-carriage"></i>
        <p>После родов впишите <strong>дату рождения</strong> в настройках внизу страницы — откроются лог кормления и календарь прививок.</p>
        <a href="#settings" class="btn-wish btn-wish-outline">Перейти в настройки</a>
      </div>`;
    return;
  }

  container.innerHTML = `
    <div class="baby-subtabs">
      <button type="button" class="baby-subtab${babySubTab === 'log' ? ' active' : ''}" data-sub="log"><i class="fas fa-list"></i> Лог</button>
      <button type="button" class="baby-subtab${babySubTab === 'vaccines' ? ' active' : ''}" data-sub="vaccines"><i class="fas fa-syringe"></i> Прививки</button>
    </div>
    <div id="babySubPanel"></div>
  `;

  container.querySelectorAll('.baby-subtab').forEach(btn => {
    btn.addEventListener('click', () => {
      babySubTab = btn.dataset.sub;
      renderBabyLifePanel(container);
    });
  });

  const sub = container.querySelector('#babySubPanel');
  if (babySubTab === 'log') renderBabyLog(sub);
  else renderVaccineCalendar(sub);
}

function renderBabyLog(el) {
  const entries = getBabyLog().sort((a, b) => new Date(b.time) - new Date(a.time));
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayEntries = entries.filter(e => e.time.startsWith(todayStr));

  el.innerHTML = `
    <p class="tool-lead">Быстрые отметки — удобно ночью, когда всё в тумане.</p>
    <div class="baby-quick-log">
      ${LOG_TYPES.map(t => `
        <button type="button" class="baby-log-btn" data-log-type="${t.id}">
          <i class="fas ${t.icon}"></i><span>${t.label}</span>
        </button>`).join('')}
    </div>
    <form class="baby-log-form" id="babyLogForm">
      <label class="mem-field"><span>Тип</span>
        <select name="type">${LOG_TYPES.map(t => `<option value="${t.id}">${t.label}</option>`).join('')}</select>
      </label>
      <label class="mem-field"><span>Время</span><input type="datetime-local" name="time" required></label>
      <label class="mem-field"><span>Заметка</span><input type="text" name="note" placeholder="мл, длительность..." maxlength="80"></label>
      <button type="submit" class="btn-wish btn-wish-primary btn-sm">Добавить</button>
    </form>
    <h4 class="baby-log-today">Сегодня (${todayEntries.length})</h4>
    <ul class="baby-log-list">
      ${todayEntries.length ? todayEntries.map(e => babyLogItem(e)).join('') : '<li class="mem-empty">Пока пусто — нажмите кнопку выше</li>'}
    </ul>
    ${entries.length > todayEntries.length ? `<details class="baby-log-older"><summary>Ранее (${entries.length - todayEntries.length})</summary><ul class="baby-log-list">${entries.filter(e => !e.time.startsWith(todayStr)).slice(0, 20).map(e => babyLogItem(e)).join('')}</ul></details>` : ''}
  `;

  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  el.querySelector('[name="time"]').value = now.toISOString().slice(0, 16);

  el.querySelectorAll('.baby-log-btn').forEach(btn => {
    btn.addEventListener('click', () => addBabyLogEntry(btn.dataset.logType));
  });

  el.querySelector('#babyLogForm')?.addEventListener('submit', e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    addBabyLogEntry(fd.get('type'), fd.get('time'), fd.get('note'));
    renderBabyLog(el);
  });

  el.querySelectorAll('[data-del-log]').forEach(btn => {
    btn.addEventListener('click', () => {
      saveBabyLog(getBabyLog().filter(e => e.id !== btn.dataset.delLog));
      renderBabyLog(el);
    });
  });
}

function addBabyLogEntry(type, time, note) {
  const entries = getBabyLog();
  const t = time || new Date().toISOString();
  entries.unshift({
    id: 'log_' + Date.now(),
    type,
    time: t.includes('T') ? new Date(t).toISOString() : t,
    note: (note || '').trim()
  });
  saveBabyLog(entries);
  showToast('Записано');
  const panel = document.getElementById('babySubPanel');
  if (panel) renderBabyLog(panel);
}

function babyLogItem(e) {
  const meta = LOG_TYPES.find(t => t.id === e.type) || LOG_TYPES[5];
  const d = new Date(e.time);
  const timeStr = d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  return `<li class="baby-log-item">
    <span class="baby-log-icon"><i class="fas ${meta.icon}"></i></span>
    <div><strong>${meta.label}</strong> <time>${timeStr}</time>${e.note ? `<p>${escapeHtml(e.note)}</p>` : ''}</div>
    <button type="button" class="mem-del" data-del-log="${e.id}"><i class="fas fa-times"></i></button>
  </li>`;
}

function renderVaccineCalendar(el) {
  const birth = getBirthDateStr();
  const done = getVaccinesDone();
  const schedule = typeof VACCINATION_SCHEDULE !== 'undefined' ? VACCINATION_SCHEDULE : [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  el.innerHTML = `
    <p class="tool-lead">Национальный календарь — ориентир. Решения только с педиатром.</p>
    <ul class="vaccine-list">
      ${schedule.map(v => {
        const dueDate = new Date(parseDate(birth));
        dueDate.setDate(dueDate.getDate() + v.ageDays);
        const dateStr = toDateStrCal(dueDate);
        const isPast = dueDate <= today;
        const checked = Boolean(done[v.id]);
        const status = checked ? 'done' : isPast ? 'due' : 'future';
        return `<li class="vaccine-item vaccine-item--${status}">
          <label class="vaccine-check">
            <input type="checkbox" data-vaccine="${v.id}"${checked ? ' checked' : ''}>
            <span class="check-box"><i class="fas fa-check"></i></span>
          </label>
          <div class="vaccine-body">
            <strong>${escapeHtml(v.title)}</strong>
            <span class="vaccine-age">${escapeHtml(v.ageLabel)}</span>
            <time>${formatDateRu(dateStr)}</time>
            <p>${escapeHtml(v.note)}</p>
          </div>
        </li>`;
      }).join('')}
    </ul>
    <p class="tool-disclaimer">Сроки могут сдвигаться — следуйте графику вашей поликлиники.</p>
  `;

  el.querySelectorAll('[data-vaccine]').forEach(cb => {
    cb.addEventListener('change', () => {
      const state = getVaccinesDone();
      state[cb.dataset.vaccine] = cb.checked;
      saveVaccinesDone(state);
      renderVaccineCalendar(el);
    });
  });
}

function toDateStrCal(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

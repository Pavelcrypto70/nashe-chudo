/* Календарь важных дел — отмечаем вручную, как в чек-листах */

const CALENDAR_CUSTOM_KEY = 'nashe_chudo_calendar_custom';
const CALENDAR_DONE_KEY = 'nashe_chudo_calendar_done';

function getCustomCalendarEvents() {
  try {
    return JSON.parse(localStorage.getItem(CALENDAR_CUSTOM_KEY)) || [];
  } catch {
    return [];
  }
}

function saveCustomCalendarEvents(events) {
  localStorage.setItem(CALENDAR_CUSTOM_KEY, JSON.stringify(events));
}

function getCalendarDoneState() {
  try {
    return JSON.parse(localStorage.getItem(CALENDAR_DONE_KEY)) || {};
  } catch {
    return {};
  }
}

function saveCalendarDoneState(state) {
  localStorage.setItem(CALENDAR_DONE_KEY, JSON.stringify(state));
}

function isCalendarDone(id) {
  return Boolean(getCalendarDoneState()[id]);
}

function toggleCalendarDone(id, checked) {
  const state = getCalendarDoneState();
  if (checked) state[id] = true;
  else delete state[id];
  saveCalendarDoneState(state);
}

function calendarItemId(ev, index) {
  if (ev.id) return ev.id;
  if (ev.week) return 'cal_' + ev.week + '_' + (ev.title || index);
  return 'cal_custom_' + index;
}

function getBuiltInCalendarItems() {
  const list = (typeof PREGNANCY_CALENDAR !== 'undefined' ? PREGNANCY_CALENDAR : []).map(ev => ({
    id: 'cal_' + ev.week + '_' + ev.title.replace(/\s+/g, '_'),
    title: ev.title,
    note: ev.note,
    icon: ev.icon || 'fa-calendar',
    type: ev.type || 'default',
    week: ev.week,
    builtin: true
  }));

  const due = getDueDate();
  list.push({
    id: 'cal_due',
    title: 'Предполагаемая дата родов (ПДР)',
    note: 'Ориентир — уточняйте на УЗИ',
    dueLabel: formatDateRu(toDateStr(due)),
    icon: 'fa-baby',
    type: 'birth',
    builtin: true
  });

  return list;
}

function getAllCalendarItems() {
  const builtin = getBuiltInCalendarItems();
  const custom = getCustomCalendarEvents().map((e, i) => ({
    ...e,
    id: e.id || 'custom_' + i,
    icon: e.icon || 'fa-star',
    type: e.type || 'custom',
    builtin: false
  }));

  return [...builtin, ...custom].sort((a, b) => {
    const wa = a.week ?? 999;
    const wb = b.week ?? 999;
    if (wa !== wb) return wa - wb;
    if (a.builtin !== b.builtin) return a.builtin ? -1 : 1;
    return (a.title || '').localeCompare(b.title || '', 'ru');
  });
}

function getCalendarProgress() {
  const items = getAllCalendarItems();
  const done = items.filter(i => isCalendarDone(i.id)).length;
  return { done, total: items.length, pct: items.length ? Math.round((done / items.length) * 100) : 0 };
}

function toDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function initCalendar() {
  renderCalendar();
  document.getElementById('calendarForm')?.addEventListener('submit', e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const title = (fd.get('title') || '').trim();
    if (!title) return;
    const events = getCustomCalendarEvents();
    const date = fd.get('date');
    events.push({
      id: 'custom_' + Date.now(),
      title,
      note: (fd.get('note') || '').trim(),
      date: date || null,
      icon: 'fa-star',
      type: 'custom'
    });
    saveCustomCalendarEvents(events);
    e.target.reset();
    renderCalendar();
    showToast('Событие добавлено');
  });
}

function renderCalendar() {
  const el = document.getElementById('calendarList');
  const summary = document.getElementById('calendarSummary');
  if (!el) return;

  const items = getAllCalendarItems();
  const { done, total, pct } = getCalendarProgress();
  const next = items.find(i => !isCalendarDone(i.id));

  if (summary) {
    summary.innerHTML = next
      ? `Дальше: <strong>${escapeHtml(next.title)}</strong>${next.week ? ` · ориентир ~${next.week} нед.` : ''}`
      : done === total && total > 0
        ? 'Все этапы отмечены — вы молодцы!'
        : 'Отмечайте галочкой то, что уже прошли — у всех свои даты.';
  }

  el.innerHTML = `
    <div class="cal-checklist-card">
      <div class="cal-checklist-head">
        <span class="cal-checklist-progress-text">${done} из ${total}</span>
        <span class="cal-checklist-progress-pct">${pct}%</span>
      </div>
      <div class="checklist-progress-bar"><div class="checklist-progress-fill" style="width:${pct}%"></div></div>
      <ul class="checklist-items cal-checklist-items">
        ${items.map(ev => calendarCheckItem(ev)).join('')}
      </ul>
    </div>
  `;

  el.querySelectorAll('.cal-check-item input[type="checkbox"]').forEach(cb => {
    cb.addEventListener('change', () => {
      toggleCalendarDone(cb.dataset.calId, cb.checked);
      cb.closest('.cal-check-item').classList.toggle('checked', cb.checked);
      renderCalendar();
    });
  });

  el.querySelectorAll('[data-del-cal]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
      const id = btn.dataset.delCal;
      saveCustomCalendarEvents(getCustomCalendarEvents().filter(ev => ev.id !== id));
      const state = getCalendarDoneState();
      delete state[id];
      saveCalendarDoneState(state);
      renderCalendar();
    });
  });
}

function calendarCheckItem(ev) {
  const checked = isCalendarDone(ev.id);
  const typeClass = ev.type ? ` cal-check-item--${ev.type}` : '';
  const weekBadge = ev.week ? `<span class="cal-week">~${ev.week} нед.</span>` : '';
  const dueLine = ev.dueLabel ? `<span class="cal-check-date">ПДР: ${escapeHtml(ev.dueLabel)}</span>` : '';
  const dateLine = ev.date ? `<span class="cal-check-date">${formatDateRu(ev.date)}</span>` : '';
  const noteLine = ev.note ? `<p class="cal-check-note">${escapeHtml(ev.note)}</p>` : '';

  return `<li class="checklist-item cal-check-item${checked ? ' checked' : ''}${typeClass}">
    <label>
      <input type="checkbox" data-cal-id="${escapeAttr(ev.id)}"${checked ? ' checked' : ''}>
      <span class="check-box"><i class="fas fa-check"></i></span>
      <div class="cal-check-body">
        <div class="cal-check-head">
          <span class="cal-check-icon"><i class="fas ${ev.icon || 'fa-calendar'}"></i></span>
          <strong class="check-label">${escapeHtml(ev.title)}</strong>
          ${weekBadge}
        </div>
        ${noteLine}
        ${dueLine}
        ${dateLine}
      </div>
    </label>
    ${!ev.builtin ? `<button type="button" class="mem-del cal-check-del" data-del-cal="${escapeAttr(ev.id)}" title="Удалить"><i class="fas fa-times"></i></button>` : ''}
  </li>`;
}

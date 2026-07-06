/* Календарь важных дат */

const CALENDAR_CUSTOM_KEY = 'nashe_chudo_calendar_custom';

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

function dateFromLMPWeek(week) {
  const lmp = getLMP();
  const d = new Date(lmp);
  d.setDate(d.getDate() + (week - 1) * 7);
  return d;
}

function toDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function buildAutoCalendarEvents() {
  const events = [];
  const list = typeof PREGNANCY_CALENDAR !== 'undefined' ? PREGNANCY_CALENDAR : [];

  list.forEach(ev => {
    const date = dateFromLMPWeek(ev.week);
    events.push({
      id: 'auto_' + ev.week + '_' + ev.title,
      date: toDateStr(date),
      title: ev.title,
      note: ev.note,
      icon: ev.icon || 'fa-calendar',
      type: ev.type || 'default',
      auto: true,
      week: ev.week
    });
  });

  const due = getDueDate();
  events.push({
    id: 'auto_due',
    date: toDateStr(due),
    title: 'Предполагаемая дата родов (ПДР)',
    note: 'Ориентир — уточняйте на УЗИ',
    icon: 'fa-baby',
    type: 'birth',
    auto: true
  });

  return events;
}

function getAllCalendarEvents() {
  const auto = buildAutoCalendarEvents();
  const custom = getCustomCalendarEvents().map((e, i) => ({
    ...e,
    id: e.id || 'custom_' + i,
    auto: false
  }));
  const merged = [...auto, ...custom];
  const today = toDateStr(new Date());
  return merged.sort((a, b) => {
    if (a.date === b.date) return (a.auto ? 1 : 0) - (b.auto ? 1 : 0);
    return a.date.localeCompare(b.date);
  }).map(e => ({
    ...e,
    status: e.date < today ? 'past' : e.date === today ? 'today' : 'upcoming',
    daysUntil: daysBetween(new Date(), parseDate(e.date))
  }));
}

function initCalendar() {
  renderCalendar();
  document.getElementById('calendarForm')?.addEventListener('submit', e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const title = (fd.get('title') || '').trim();
    if (!title) return;
    const events = getCustomCalendarEvents();
    events.push({
      id: 'custom_' + Date.now(),
      date: fd.get('date'),
      title,
      note: (fd.get('note') || '').trim(),
      icon: 'fa-star',
      type: 'custom'
    });
    saveCustomCalendarEvents(events);
    e.target.reset();
    renderCalendar();
    showToast('Дата добавлена');
  });
}

function renderCalendar() {
  const el = document.getElementById('calendarList');
  const summary = document.getElementById('calendarSummary');
  if (!el) return;

  const events = getAllCalendarEvents();
  const today = toDateStr(new Date());
  const upcoming = events.filter(e => e.date >= today);
  const next = upcoming[0];

  if (summary) {
    summary.innerHTML = next
      ? `Ближайшее: <strong>${escapeHtml(next.title)}</strong> — ${formatDateRu(next.date)}${next.date === today ? ' (сегодня!)' : next.daysUntil > 0 ? ` (через ${next.daysUntil} дн.)` : ''}`
      : 'Все важные даты прошли — малыш скоро с вами!';
  }

  const groups = [
    { key: 'today', label: 'Сегодня', items: events.filter(e => e.status === 'today') },
    { key: 'upcoming', label: 'Скоро', items: events.filter(e => e.status === 'upcoming').slice(0, 12) },
    { key: 'past', label: 'Прошло', items: events.filter(e => e.status === 'past').slice(-6) }
  ];

  el.innerHTML = groups.filter(g => g.items.length).map(g => `
    <div class="cal-group">
      <h3 class="cal-group-title">${g.label}</h3>
      <div class="cal-items">
        ${g.items.map(ev => calendarEventCard(ev)).join('')}
      </div>
    </div>
  `).join('') || '<p class="mem-empty">Добавьте свои даты — анализы, УЗИ, визиты.</p>';

  el.querySelectorAll('[data-del-cal]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.delCal;
      saveCustomCalendarEvents(getCustomCalendarEvents().filter(e => e.id !== id));
      renderCalendar();
    });
  });
}

function calendarEventCard(ev) {
  const typeClass = ev.type ? ` cal-event--${ev.type}` : '';
  const weekBadge = ev.week ? `<span class="cal-week">${ev.week} нед.</span>` : '';
  return `<article class="cal-event${typeClass} cal-event--${ev.status}">
    <div class="cal-event-icon"><i class="fas ${ev.icon || 'fa-calendar'}"></i></div>
    <div class="cal-event-body">
      <div class="cal-event-head">
        <strong>${escapeHtml(ev.title)}</strong>
        ${weekBadge}
      </div>
      <time>${formatDateRu(ev.date)}</time>
      ${ev.note ? `<p>${escapeHtml(ev.note)}</p>` : ''}
    </div>
    ${!ev.auto ? `<button type="button" class="mem-del" data-del-cal="${ev.id}" title="Удалить"><i class="fas fa-times"></i></button>` : ''}
  </article>`;
}

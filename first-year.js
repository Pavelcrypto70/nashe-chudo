/* Первый год жизни — помесячный гид */

let activeBabyMonth = 0;

function getFirstYearListId(month) {
  return 'first_year_' + month;
}

function renderFirstYearTabs() {
  const container = document.getElementById('firstYearTabs');
  if (!container) return;

  container.innerHTML = FIRST_YEAR.map(m => {
    const isActive = m.month === activeBabyMonth;
    const label = m.month === 0 ? '0' : String(m.month);
    return `<button type="button" class="fy-tab${isActive ? ' active' : ''}" data-month="${m.month}">
      <span class="fy-tab-num">${label}</span>
      <span class="fy-tab-label">${m.month === 0 ? 'Роддом' : 'мес'}</span>
    </button>`;
  }).join('');

  container.querySelectorAll('.fy-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      activeBabyMonth = Number(btn.dataset.month);
      renderFirstYearTabs();
      renderFirstYearPanel(activeBabyMonth);
    });
  });
}

function renderTaskList(month, tasks) {
  const listId = getFirstYearListId(month);
  return `<ul class="fy-tasks">
    ${tasks.map((t, i) => {
      const checked = isItemChecked(listId, i);
      return `<li class="checklist-item${checked ? ' checked' : ''}">
        <label>
          <input type="checkbox" data-list="${listId}" data-index="${i}"${checked ? ' checked' : ''}>
          <span class="check-box"><i class="fas fa-check"></i></span>
          <span class="check-label">${t}</span>
        </label>
      </li>`;
    }).join('')}
  </ul>`;
}

function renderBulletList(items, icon) {
  if (!items || !items.length) return '<p class="fy-empty">—</p>';
  return `<ul class="fy-list">${items.map(x => `<li><i class="fas ${icon}"></i>${x}</li>`).join('')}</ul>`;
}

function renderFirstYearPanel(month) {
  const data = FIRST_YEAR.find(m => m.month === month);
  const panel = document.getElementById('firstYearPanel');
  if (!data || !panel) return;

  const listId = getFirstYearListId(month);
  const done = data.tasks.filter((_, i) => isItemChecked(listId, i)).length;
  const pct = data.tasks.length ? Math.round((done / data.tasks.length) * 100) : 0;

  panel.innerHTML = `
    <div class="fy-panel-head">
      <div>
        <h3>${data.title} <span class="fy-age">${data.age}</span></h3>
        <p class="fy-progress-label">Чек-лист месяца: ${done} из ${data.tasks.length} (${pct}%)</p>
      </div>
    </div>
    <div class="fy-progress-bar"><div class="fy-progress-fill" style="width:${pct}%"></div></div>
    <div class="fy-panel-grid">
      <div class="fy-block">
        <h4><i class="fas fa-eye"></i> За чем следить</h4>
        ${renderBulletList(data.watch, 'fa-circle')}
      </div>
      <div class="fy-block">
        <h4><i class="fas fa-hand-holding-heart"></i> Что делать</h4>
        ${renderBulletList(data.do, 'fa-circle')}
      </div>
      <div class="fy-block">
        <h4><i class="fas fa-stethoscope"></i> Врачи и осмотры</h4>
        ${renderBulletList(data.doctor, 'fa-circle')}
      </div>
      <div class="fy-block fy-block-vaccine">
        <h4><i class="fas fa-syringe"></i> Прививки</h4>
        ${renderBulletList(data.vaccines, 'fa-circle')}
        <p class="fy-note">Календарь прививок уточняйте у педиатра — схема может отличаться по региону.</p>
      </div>
      ${data.mom && data.mom.length ? `
      <div class="fy-block">
        <h4><i class="fas fa-heart"></i> Для мамы</h4>
        ${renderBulletList(data.mom, 'fa-circle')}
      </div>` : ''}
      <div class="fy-block fy-block-wide fy-block-tasks">
        <h4><i class="fas fa-list-check"></i> Чек-лист — отметить выполненное</h4>
        ${renderTaskList(month, data.tasks)}
      </div>
    </div>
  `;

  panel.querySelectorAll('.fy-tasks input[type="checkbox"]').forEach(cb => {
    cb.addEventListener('change', () => {
      toggleCheckItem(cb.dataset.list, Number(cb.dataset.index), cb.checked);
      cb.closest('.checklist-item').classList.toggle('checked', cb.checked);
      renderFirstYearPanel(activeBabyMonth);
      updateFirstYearOverall();
    });
  });
}

function updateFirstYearOverall() {
  const el = document.getElementById('firstYearOverall');
  if (!el) return;
  let total = 0;
  let done = 0;
  FIRST_YEAR.forEach(m => {
    const listId = getFirstYearListId(m.month);
    total += m.tasks.length;
    done += m.tasks.filter((_, i) => isItemChecked(listId, i)).length;
  });
  el.textContent = total
    ? `За первый год: выполнено ${done} из ${total} пунктов (${Math.round((done / total) * 100)}%)`
    : '';
}

function initFirstYear() {
  renderFirstYearTabs();
  renderFirstYearPanel(activeBabyMonth);
  updateFirstYearOverall();
}

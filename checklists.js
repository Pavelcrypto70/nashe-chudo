/* Чек-листы с сохранением в localStorage */

const CHECKLIST_STORAGE = 'nashe_chudo_checklists';

function getChecklistState() {
  try {
    return JSON.parse(localStorage.getItem(CHECKLIST_STORAGE)) || {};
  } catch {
    return {};
  }
}

function saveChecklistState(state) {
  localStorage.setItem(CHECKLIST_STORAGE, JSON.stringify(state));
}

function toggleCheckItem(listId, itemIndex, checked) {
  const state = getChecklistState();
  if (!state[listId]) state[listId] = {};
  state[listId][itemIndex] = checked;
  saveChecklistState(state);
  updateChecklistProgress(listId);
}

function isItemChecked(listId, itemIndex) {
  const state = getChecklistState();
  return Boolean(state[listId]?.[itemIndex]);
}

function getChecklistProgress(listId) {
  const list = CHECKLISTS.find(c => c.id === listId);
  if (!list) return { done: 0, total: 0, pct: 0 };
  const done = list.items.filter((_, i) => isItemChecked(listId, i)).length;
  return { done, total: list.items.length, pct: list.items.length ? Math.round((done / list.items.length) * 100) : 0 };
}

function updateChecklistProgress(listId) {
  const card = document.querySelector(`.checklist-card[data-id="${listId}"]`);
  if (!card) return;
  const { done, total, pct } = getChecklistProgress(listId);
  const bar = card.querySelector('.checklist-progress-fill');
  const text = card.querySelector('.checklist-progress-text');
  if (bar) bar.style.width = pct + '%';
  if (text) text.textContent = `${done} из ${total}`;
}

function renderChecklistCard(list) {
  const { done, total, pct } = getChecklistProgress(list.id);
  return `
    <div class="checklist-card" data-id="${list.id}">
      <div class="checklist-head" data-toggle="${list.id}">
        <div class="checklist-head-left">
          <span class="checklist-icon"><i class="fas ${list.icon}"></i></span>
          <div>
            <h3>${list.title}</h3>
            <p class="checklist-desc">${list.desc}</p>
          </div>
        </div>
        <div class="checklist-head-right">
          <span class="checklist-progress-text">${done} из ${total}</span>
          <i class="fas fa-chevron-down checklist-chevron"></i>
        </div>
      </div>
      <div class="checklist-progress-bar"><div class="checklist-progress-fill" style="width:${pct}%"></div></div>
      <div class="checklist-body" id="checklist-body-${list.id}">
        <ul class="checklist-items">
          ${list.items.map((item, i) => {
            const checked = isItemChecked(list.id, i);
            return `<li class="checklist-item${checked ? ' checked' : ''}">
              <label>
                <input type="checkbox" data-list="${list.id}" data-index="${i}"${checked ? ' checked' : ''}>
                <span class="check-box"><i class="fas fa-check"></i></span>
                <span class="check-label">${item}</span>
              </label>
            </li>`;
          }).join('')}
        </ul>
      </div>
    </div>
  `;
}

function renderChecklistsSection() {
  const container = document.getElementById('checklistsContainer');
  if (!container) return;
  container.innerHTML = CHECKLISTS.map(renderChecklistCard).join('');

  container.querySelectorAll('.checklist-head').forEach(head => {
    head.addEventListener('click', () => {
      const id = head.dataset.toggle;
      const card = head.closest('.checklist-card');
      card.classList.toggle('open');
    });
  });

  container.querySelectorAll('.checklist-item input[type="checkbox"]').forEach(cb => {
    cb.addEventListener('change', () => {
      toggleCheckItem(cb.dataset.list, Number(cb.dataset.index), cb.checked);
      cb.closest('.checklist-item').classList.toggle('checked', cb.checked);
    });
  });

  const totalAll = CHECKLISTS.reduce((s, l) => s + l.items.length, 0);
  const doneAll = CHECKLISTS.reduce((s, l) => s + getChecklistProgress(l.id).done, 0);
  const overall = document.getElementById('checklistsOverall');
  if (overall) {
    overall.textContent = totalAll ? `Всего готово: ${doneAll} из ${totalAll} (${Math.round((doneAll / totalAll) * 100)}%)` : '';
  }
}

function renderBenefitChecklists() {
  const container = document.getElementById('benefitsTimeline');
  if (!container) return;

  container.innerHTML = BENEFITS_RF.map((b, i) => {
    const listId = 'benefit_' + i;
    const checked = isItemChecked(listId, 0);
    return `
      <div class="benefit-card status-${b.status}${checked ? ' benefit-done' : ''}" data-benefit="${i}">
        <label class="benefit-check">
          <input type="checkbox" data-list="${listId}" data-index="0"${checked ? ' checked' : ''}>
          <span class="check-box"><i class="fas fa-check"></i></span>
        </label>
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
    `;
  }).join('');

  container.querySelectorAll('.benefit-check input').forEach(cb => {
    cb.addEventListener('change', e => {
      e.stopPropagation();
      toggleCheckItem(cb.dataset.list, Number(cb.dataset.index), cb.checked);
      cb.closest('.benefit-card').classList.toggle('benefit-done', cb.checked);
    });
    cb.addEventListener('click', e => e.stopPropagation());
  });
}

function initChecklists() {
  renderChecklistsSection();
  renderBenefitChecklists();
  const openId = getPregnancyState().week >= 32 ? 'hospital_mom' : 'home_prep';
  document.querySelector(`.checklist-card[data-id="${openId}"]`)?.classList.add('open');
}

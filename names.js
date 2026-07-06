/* Голосование за имена */

const NAMES_KEY = 'nashe_chudo_names';

function getNamesState() {
  try { return JSON.parse(localStorage.getItem(NAMES_KEY)) || {}; } catch { return {}; }
}
function saveNamesState(s) { localStorage.setItem(NAMES_KEY, JSON.stringify(s)); }

function initNames() {
  renderNames();
  document.getElementById('nameAddForm')?.addEventListener('submit', e => {
    e.preventDefault();
    const input = document.getElementById('nameAddInput');
    const name = (input?.value || '').trim();
    if (!name) return;
    const state = getNamesState();
    const key = name.toLowerCase();
    if (!state[key]) state[key] = { name, vote: null };
    saveNamesState(state);
    input.value = '';
    renderNames();
    showToast('Имя добавлено');
  });
}

function renderNames() {
  const grid = document.getElementById('namesGrid');
  if (!grid) return;

  const state = getNamesState();
  const defaults = typeof DEFAULT_BABY_NAMES !== 'undefined' ? DEFAULT_BABY_NAMES : [];
  defaults.forEach(n => {
    const key = n.toLowerCase();
    if (!state[key]) state[key] = { name: n, vote: null };
  });

  const list = Object.values(state).sort((a, b) => {
    const score = v => (v.vote === 'yes' ? 2 : v.vote === 'maybe' ? 1 : 0);
    return score(b) - score(a) || a.name.localeCompare(b.name, 'ru');
  });

  const yes = list.filter(n => n.vote === 'yes');
  grid.innerHTML = `
    ${yes.length ? `<div class="names-favorites"><h4><i class="fas fa-heart"></i> Нравится</h4><p>${yes.map(n => escapeHtml(n.name)).join(' · ')}</p></div>` : ''}
    <div class="names-list">${list.map(n => nameCard(n)).join('')}</div>`;

  grid.querySelectorAll('[data-vote]').forEach(btn => {
    btn.addEventListener('click', () => {
      const state = getNamesState();
      const key = btn.dataset.nameKey;
      const vote = btn.dataset.vote;
      if (!state[key]) return;
      state[key].vote = state[key].vote === vote ? null : vote;
      saveNamesState(state);
      renderNames();
    });
  });

  grid.querySelectorAll('[data-del-name]').forEach(btn => {
    btn.addEventListener('click', () => {
      const state = getNamesState();
      delete state[btn.dataset.delName];
      saveNamesState(state);
      renderNames();
    });
  });
}

function nameCard(n) {
  const key = n.name.toLowerCase();
  return `<div class="name-card${n.vote ? ' voted-' + n.vote : ''}">
    <span class="name-text">${escapeHtml(n.name)}</span>
    <div class="name-votes">
      <button type="button" class="name-vote yes${n.vote === 'yes' ? ' active' : ''}" data-vote="yes" data-name-key="${key}" title="Нравится"><i class="fas fa-heart"></i></button>
      <button type="button" class="name-vote maybe${n.vote === 'maybe' ? ' active' : ''}" data-vote="maybe" data-name-key="${key}" title="Может быть"><i class="fas fa-question"></i></button>
      <button type="button" class="name-vote no${n.vote === 'no' ? ' active' : ''}" data-vote="no" data-name-key="${key}" title="Нет"><i class="fas fa-times"></i></button>
      <button type="button" class="name-del" data-del-name="${key}"><i class="fas fa-trash"></i></button>
    </div>
  </div>`;
}

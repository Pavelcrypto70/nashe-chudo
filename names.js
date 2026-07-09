/* Голосование за имена — мужские / женские */

const NAMES_KEY = 'nashe_chudo_names';
let nameAddGender = 'male';

function getBoyNamesSet() {
  const list = typeof DEFAULT_BOY_NAMES !== 'undefined' ? DEFAULT_BOY_NAMES : [];
  return new Set(list.map(n => n.toLowerCase()));
}

function getGirlNamesSet() {
  const list = typeof DEFAULT_GIRL_NAMES !== 'undefined' ? DEFAULT_GIRL_NAMES : [];
  return new Set(list.map(n => n.toLowerCase()));
}

function inferNameGender(name) {
  const key = (name || '').toLowerCase();
  if (getGirlNamesSet().has(key)) return 'female';
  if (getBoyNamesSet().has(key)) return 'male';
  if (/[ая]$/.test(key) && !/^(никита|илья|кузьма|фома|савва|лука)$/i.test(key)) return 'female';
  return 'male';
}

function getNamesState() {
  try { return JSON.parse(localStorage.getItem(NAMES_KEY)) || {}; } catch { return {}; }
}
function saveNamesState(s) { localStorage.setItem(NAMES_KEY, JSON.stringify(s)); }

function ensureNamesState() {
  const state = getNamesState();
  const boys = typeof DEFAULT_BOY_NAMES !== 'undefined' ? DEFAULT_BOY_NAMES : [];
  const girls = typeof DEFAULT_GIRL_NAMES !== 'undefined' ? DEFAULT_GIRL_NAMES : [];
  let changed = false;

  boys.forEach(n => {
    const key = n.toLowerCase();
    if (!state[key]) {
      state[key] = { name: n, vote: null, gender: 'male' };
      changed = true;
    }
  });
  girls.forEach(n => {
    const key = n.toLowerCase();
    if (!state[key]) {
      state[key] = { name: n, vote: null, gender: 'female' };
      changed = true;
    }
  });

  Object.values(state).forEach(entry => {
    if (!entry.gender) {
      entry.gender = inferNameGender(entry.name);
      changed = true;
    }
  });

  if (changed) saveNamesState(state);
  return getNamesState();
}

function sortNames(list) {
  return list.sort((a, b) => {
    const score = v => (v.vote === 'yes' ? 2 : v.vote === 'maybe' ? 1 : 0);
    return score(b) - score(a) || a.name.localeCompare(b.name, 'ru');
  });
}

function initNames() {
  const grid = document.getElementById('namesGrid');
  if (grid && !grid.dataset.bound) {
    grid.dataset.bound = '1';
    grid.addEventListener('click', e => {
      const voteBtn = e.target.closest('[data-vote]');
      if (voteBtn) {
        const state = getNamesState();
        const key = voteBtn.dataset.nameKey;
        const vote = voteBtn.dataset.vote;
        if (!state[key]) return;
        state[key].vote = state[key].vote === vote ? null : vote;
        saveNamesState(state);
        renderNames();
        return;
      }
      const delBtn = e.target.closest('[data-del-name]');
      if (delBtn) {
        const state = getNamesState();
        delete state[delBtn.dataset.delName];
        saveNamesState(state);
        renderNames();
      }
    });
  }

  document.querySelectorAll('.name-gender-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      nameAddGender = btn.dataset.gender;
      document.querySelectorAll('.name-gender-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.gender === nameAddGender);
      });
    });
  });

  renderNames();
  document.getElementById('nameAddForm')?.addEventListener('submit', e => {
    e.preventDefault();
    const input = document.getElementById('nameAddInput');
    const name = (input?.value || '').trim();
    if (!name) return;
    const state = getNamesState();
    const key = name.toLowerCase();
    if (!state[key]) {
      state[key] = { name, vote: null, gender: nameAddGender };
    } else {
      state[key].gender = nameAddGender;
    }
    saveNamesState(state);
    input.value = '';
    renderNames();
    showToast('Имя добавлено');
  });
}

function renderNames() {
  const grid = document.getElementById('namesGrid');
  if (!grid) return;

  ensureNamesState();
  const state = getNamesState();
  const list = Object.values(state);
  const boys = sortNames(list.filter(n => n.gender === 'male'));
  const girls = sortNames(list.filter(n => n.gender !== 'male'));

  const yesBoys = boys.filter(n => n.vote === 'yes');
  const yesGirls = girls.filter(n => n.vote === 'yes');

  grid.innerHTML = `
    ${(yesBoys.length || yesGirls.length) ? `
      <div class="names-favorites">
        <h4><i class="fas fa-heart"></i> Нравится</h4>
        <div class="names-favorites-cols">
          ${yesBoys.length ? `<p><span class="names-fav-label">М:</span> ${yesBoys.map(n => escapeHtml(n.name)).join(' · ')}</p>` : ''}
          ${yesGirls.length ? `<p><span class="names-fav-label">Ж:</span> ${yesGirls.map(n => escapeHtml(n.name)).join(' · ')}</p>` : ''}
        </div>
      </div>` : ''}
    <div class="names-columns">
      <div class="names-column">
        <h3 class="names-column-title"><i class="fas fa-mars"></i> Мужские</h3>
        <div class="names-list">${boys.length ? boys.map(nameCard).join('') : '<p class="names-empty">Пока нет — добавьте своё.</p>'}</div>
      </div>
      <div class="names-column">
        <h3 class="names-column-title"><i class="fas fa-venus"></i> Женские</h3>
        <div class="names-list">${girls.length ? girls.map(nameCard).join('') : '<p class="names-empty">Пока нет — добавьте своё.</p>'}</div>
      </div>
    </div>`;
}

function nameCard(n) {
  const key = n.name.toLowerCase();
  return `<div class="name-card${n.vote ? ' voted-' + n.vote : ''}">
    <span class="name-text">${escapeHtml(n.name)}</span>
    <div class="name-votes">
      <button type="button" class="name-vote yes${n.vote === 'yes' ? ' active' : ''}" data-vote="yes" data-name-key="${escapeHtml(key)}" title="Нравится"><i class="fas fa-heart"></i></button>
      <button type="button" class="name-vote maybe${n.vote === 'maybe' ? ' active' : ''}" data-vote="maybe" data-name-key="${escapeHtml(key)}" title="Может быть"><i class="fas fa-question"></i></button>
      <button type="button" class="name-vote no${n.vote === 'no' ? ' active' : ''}" data-vote="no" data-name-key="${escapeHtml(key)}" title="Нет"><i class="fas fa-times"></i></button>
      <button type="button" class="name-del" data-del-name="${escapeHtml(key)}"><i class="fas fa-trash"></i></button>
    </div>
  </div>`;
}

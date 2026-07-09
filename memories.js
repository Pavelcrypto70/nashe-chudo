/* Альбом: фото истории, УЗИ, дневник, вехи */

const ULTRASOUND_KEY = 'nashe_chudo_ultrasound';
const DIARY_KEY = 'nashe_chudo_diary';
const MILESTONES_KEY = 'nashe_chudo_milestones';
const STORY_PHOTOS_KEY = 'nashe_chudo_story_photos';

let memoriesTab = 'ultrasound';

function initMemories() {
  renderStoryGallery();
  renderMemoriesTabs();
  renderMemoriesPanel();
  bindMemoriesForms();
}

function getUltrasound() {
  try { return JSON.parse(localStorage.getItem(ULTRASOUND_KEY)) || []; } catch { return []; }
}
function saveUltrasound(items) {
  localStorage.setItem(ULTRASOUND_KEY, JSON.stringify(items));
  notifyDataChanged?.();
}

function getDiary() {
  try {
    return (JSON.parse(localStorage.getItem(DIARY_KEY)) || []).sort((a, b) => new Date(b.date) - new Date(a.date));
  } catch { return []; }
}
function saveDiary(items) { localStorage.setItem(DIARY_KEY, JSON.stringify(items)); }

function getMilestones() {
  try { return JSON.parse(localStorage.getItem(MILESTONES_KEY)) || {}; } catch { return {}; }
}
function saveMilestones(m) { localStorage.setItem(MILESTONES_KEY, JSON.stringify(m)); }

function getStoryPhotos() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORY_PHOTOS_KEY));
    if (saved?.length) return saved;
  } catch { /* */ }
  return typeof STORY_PHOTOS !== 'undefined' ? STORY_PHOTOS : [];
}
function saveStoryPhotos(p) {
  localStorage.setItem(STORY_PHOTOS_KEY, JSON.stringify(p));
  notifyDataChanged?.();
}

function readImageFile(file, maxSize = 480) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) {
      reject(new Error('not an image'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxSize || height > maxSize) {
          if (width > height) {
            height = Math.round(height * maxSize / width);
            width = maxSize;
          } else {
            width = Math.round(width * maxSize / height);
            height = maxSize;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.55));
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function renderStoryGallery() {
  const grid = document.getElementById('storyGallery');
  if (!grid) return;
  const photos = getStoryPhotos().filter(p => p.url);

  grid.innerHTML = photos.length
    ? photos.map((p, i) => `
      <figure class="story-photo">
        <img src="${escapeHtml(p.url)}" alt="${escapeHtml(p.caption || '')}" loading="lazy">
        ${p.caption ? `<figcaption>${escapeHtml(p.caption)}</figcaption>` : ''}
      </figure>`).join('')
    : `<p class="story-gallery-empty">Фото появятся здесь — добавьте ссылки в альбоме ниже или в настройках Павел подставит ваши снимки.</p>`;

  if (typeof LOVE_STORY !== 'undefined') {
    const storyEl = document.getElementById('loveStory');
    if (storyEl) {
      storyEl.innerHTML = LOVE_STORY.map(p => `<p>${p}</p>`).join('');
    }
  }
}

function renderMemoriesTabs() {
  const el = document.getElementById('memoriesTabs');
  if (!el) return;
  const tabs = [
    { id: 'ultrasound', label: 'УЗИ', icon: 'fa-image' },
    { id: 'diary', label: 'Дневник', icon: 'fa-book' },
    { id: 'milestones', label: 'Вехи', icon: 'fa-star' },
    { id: 'photos', label: 'Наши фото', icon: 'fa-camera' }
  ];
  el.innerHTML = tabs.map(t => `
    <button type="button" class="mem-tab${memoriesTab === t.id ? ' active' : ''}" data-tab="${t.id}">
      <i class="fas ${t.icon}"></i> ${t.label}
    </button>`).join('');

  el.querySelectorAll('.mem-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      memoriesTab = btn.dataset.tab;
      renderMemoriesTabs();
      renderMemoriesPanel();
    });
  });
}

function renderMemoriesPanel() {
  const panel = document.getElementById('memoriesPanel');
  if (!panel) return;

  if (memoriesTab === 'ultrasound') {
    const items = getUltrasound();
    panel.innerHTML = `
      <form class="mem-form" id="ultrasoundForm">
        <div class="mem-form-row">
          <label class="mem-field"><span>Неделя / срок</span><input type="text" name="week" placeholder="12 недель" maxlength="40" required></label>
          <label class="mem-field"><span>Дата</span><input type="date" name="date" required></label>
        </div>
        <label class="mem-field"><span>Ссылка на фото УЗИ</span><input type="url" name="url" placeholder="Ссылка на фото или облако"></label>
        <label class="mem-field mem-field-file">
          <span>Или загрузите с телефона / компьютера</span>
          <input type="file" name="file" accept="image/*" capture="environment">
        </label>
        <label class="mem-field"><span>Подпись</span><input type="text" name="caption" placeholder="Первое сердцебиение..." maxlength="120"></label>
        <button type="submit" class="btn-wish btn-wish-primary"><i class="fas fa-plus"></i> Добавить снимок</button>
      </form>
      <div class="mem-grid">${items.length ? items.map((u, i) => memUltrasoundCard(u, i)).join('') : '<p class="mem-empty">Пока нет снимков УЗИ — добавьте первый.</p>'}</div>`;
    document.getElementById('ultrasoundForm')?.addEventListener('submit', onUltrasoundSubmit);
    panel.querySelectorAll('[data-del-us]').forEach(btn => btn.addEventListener('click', () => {
      const items = getUltrasound();
      items.splice(Number(btn.dataset.delUs), 1);
      saveUltrasound(items);
      renderMemoriesPanel();
      showToast('Удалено');
    }));
    return;
  }

  if (memoriesTab === 'diary') {
    const items = getDiary();
    panel.innerHTML = `
      <form class="mem-form" id="diaryForm">
        <label class="mem-field"><span>Дата</span><input type="date" name="date" required></label>
        <label class="mem-field"><span>Настроение</span>
          <select name="mood">
            <option value="happy">😊 Счастлива</option>
            <option value="calm">😌 Спокойно</option>
            <option value="tired">😴 Устала</option>
            <option value="anxious">💭 Волнительно</option>
            <option value="love">🥰 Любовь</option>
          </select>
        </label>
        <label class="mem-field"><span>Запись</span><textarea name="text" rows="3" placeholder="Сегодня малыш..."></textarea></label>
        <button type="submit" class="btn-wish btn-wish-primary"><i class="fas fa-plus"></i> Сохранить запись</button>
      </form>
      <div class="diary-list">${items.length ? items.map((d, i) => diaryCard(d, i)).join('') : '<p class="mem-empty">Дневник пуст — первая запись ждёт.</p>'}</div>`;
    document.getElementById('diaryForm')?.addEventListener('submit', onDiarySubmit);
    panel.querySelectorAll('[data-del-diary]').forEach(btn => btn.addEventListener('click', () => {
      const items = getDiary();
      items.splice(Number(btn.dataset.delDiary), 1);
      saveDiary(items);
      renderMemoriesPanel();
    }));
    return;
  }

  if (memoriesTab === 'milestones') {
    const m = getMilestones();
    const defs = typeof MILESTONE_DEFS !== 'undefined' ? MILESTONE_DEFS : [];
    panel.innerHTML = `
      <p class="mem-hint">Отмечайте важные моменты — дата сохранится.</p>
      <div class="milestones-list">${defs.map(def => `
        <div class="milestone-item${m[def.id] ? ' done' : ''}">
          <div class="milestone-icon"><i class="fas ${def.icon}"></i></div>
          <div class="milestone-body">
            <strong>${def.title}</strong>
            <p>${def.desc}</p>
            ${m[def.id] ? `<span class="milestone-date">${formatDateRu(m[def.id])}</span>` : ''}
          </div>
          <label class="milestone-date-field">
            <input type="date" data-milestone="${def.id}" value="${m[def.id] || ''}">
          </label>
        </div>`).join('')}</div>`;
    panel.querySelectorAll('[data-milestone]').forEach(input => {
      input.addEventListener('change', () => {
        const ms = getMilestones();
        if (input.value) ms[input.dataset.milestone] = input.value;
        else delete ms[input.dataset.milestone];
        saveMilestones(ms);
        renderMemoriesPanel();
      });
    });
    return;
  }

  if (memoriesTab === 'photos') {
    const photos = getStoryPhotos();
    panel.innerHTML = `
      <form class="mem-form" id="storyPhotoForm">
        <label class="mem-field"><span>Ссылка на фото</span><input type="url" name="url" placeholder="Google Photos, iCloud, Telegram..."></label>
        <label class="mem-field mem-field-file">
          <span>Или загрузите с устройства</span>
          <input type="file" name="file" accept="image/*" capture="environment">
        </label>
        <label class="mem-field"><span>Подпись</span><input type="text" name="caption" placeholder="Наше фото..." maxlength="80"></label>
        <button type="submit" class="btn-wish btn-wish-primary"><i class="fas fa-plus"></i> Добавить в историю</button>
      </form>
      <div class="mem-grid mem-grid-small">${photos.filter(p => p.url).map((p, i) => `
        <figure class="story-photo story-photo-sm">
          <img src="${escapeHtml(p.url)}" alt="" loading="lazy">
          <figcaption>${escapeHtml(p.caption || '')}</figcaption>
          <button type="button" class="mem-del" data-del-photo="${i}"><i class="fas fa-times"></i></button>
        </figure>`).join('') || '<p class="mem-empty">Добавьте ссылки на ваши фотографии.</p>'}</div>`;
    document.getElementById('storyPhotoForm')?.addEventListener('submit', onStoryPhotoSubmit);
    panel.querySelectorAll('[data-del-photo]').forEach(btn => btn.addEventListener('click', () => {
      const photos = getStoryPhotos();
      const withUrl = photos.filter(p => p.url);
      withUrl.splice(Number(btn.dataset.delPhoto), 1);
      saveStoryPhotos(withUrl);
      renderStoryGallery();
      renderMemoriesPanel();
    }));
  }
}

function memUltrasoundCard(u, i) {
  return `<figure class="mem-card">
    <a href="${escapeHtml(u.url)}" target="_blank" rel="noopener" class="mem-card-img"><img src="${escapeHtml(u.url)}" alt="" loading="lazy" onerror="this.parentElement.classList.add('broken')"></a>
    <div class="mem-card-body">
      <strong>${escapeHtml(u.week)}</strong>
      <span>${formatDateRu(u.date)}</span>
      ${u.caption ? `<p>${escapeHtml(u.caption)}</p>` : ''}
      <button type="button" class="mem-del" data-del-us="${i}"><i class="fas fa-trash"></i></button>
    </div>
  </figure>`;
}

function diaryCard(d, i) {
  const moods = { happy: '😊', calm: '😌', tired: '😴', anxious: '💭', love: '🥰' };
  return `<article class="diary-entry">
    <div class="diary-meta"><span>${moods[d.mood] || '·'}</span> <time>${formatDateRu(d.date)}</time>
      <button type="button" class="mem-del" data-del-diary="${i}"><i class="fas fa-times"></i></button>
    </div>
    <p>${escapeHtml(d.text)}</p>
  </article>`;
}

function onUltrasoundSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const fd = new FormData(form);
  const file = fd.get('file');
  const urlInput = (fd.get('url') || '').trim();
  const btn = form.querySelector('[type="submit"]');

  const save = url => {
    const items = getUltrasound();
    items.push({
      id: 'us_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      week: fd.get('week'),
      date: fd.get('date'),
      url,
      caption: fd.get('caption'),
      updatedAt: new Date().toISOString()
    });
    saveUltrasound(items.sort((a, b) => new Date(a.date) - new Date(b.date)));
    form.reset();
    renderMemoriesPanel();
    showToast('Снимок добавлен');
  };

  if (file && file.size > 0) {
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Загружаем…'; }
    readImageFile(file)
      .then(save)
      .catch(() => showToast('Не удалось загрузить фото'))
      .finally(() => {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-plus"></i> Добавить снимок'; }
      });
    return;
  }
  if (!urlInput) {
    showToast('Добавьте ссылку или выберите файл');
    return;
  }
  save(urlInput);
}

function onDiarySubmit(e) {
  e.preventDefault();
  const fd = new FormData(e.target);
  const text = (fd.get('text') || '').trim();
  if (!text) return;
  const items = getDiary();
  items.unshift({ date: fd.get('date'), mood: fd.get('mood'), text });
  saveDiary(items);
  e.target.reset();
  renderMemoriesPanel();
  showToast('Запись сохранена');
}

function onStoryPhotoSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const fd = new FormData(form);
  const file = fd.get('file');
  const urlInput = (fd.get('url') || '').trim();
  const btn = form.querySelector('[type="submit"]');

  const save = url => {
    const photos = getStoryPhotos();
    photos.push({
      id: 'ph_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      url,
      caption: fd.get('caption'),
      updatedAt: new Date().toISOString()
    });
    saveStoryPhotos(photos);
    form.reset();
    renderStoryGallery();
    renderMemoriesPanel();
    showToast('Фото добавлено');
  };

  if (file && file.size > 0) {
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Загружаем…'; }
    readImageFile(file)
      .then(save)
      .catch(() => showToast('Не удалось загрузить фото'))
      .finally(() => {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-plus"></i> Добавить в историю'; }
      });
    return;
  }
  if (!urlInput) {
    showToast('Добавьте ссылку или выберите файл');
    return;
  }
  save(urlInput);
}

function bindMemoriesForms() { /* bound in renderMemoriesPanel */ }

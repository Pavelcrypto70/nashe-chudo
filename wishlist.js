/* Раздел «Хотелки» — рилсы и ссылки на видео */

const WISHLIST_STORAGE = 'nashe_chudo_wishlist';
const WISHLIST_FILTER = 'all';

const WISHLIST_EXTRA_CATEGORIES = [
  { id: 'room', title: 'Детская комната', icon: 'fa-couch' },
  { id: 'toys', title: 'Игрушки', icon: 'fa-puzzle-piece' },
  { id: 'mom', title: 'Для мамы', icon: 'fa-spa' },
  { id: 'other', title: 'Другое', icon: 'fa-star' }
];

function getWishlistCategories() {
  const fromShop = SHOPPING_CATEGORIES.map(c => ({ id: c.id, title: c.title, icon: c.icon }));
  const ids = new Set(fromShop.map(c => c.id));
  WISHLIST_EXTRA_CATEGORIES.forEach(c => {
    if (!ids.has(c.id)) fromShop.push(c);
  });
  return fromShop;
}

function getCategoryMeta(id) {
  return getWishlistCategories().find(c => c.id === id) || { id: 'other', title: 'Другое', icon: 'fa-star' };
}

function getWishlist() {
  try {
    return JSON.parse(localStorage.getItem(WISHLIST_STORAGE)) || [];
  } catch {
    return [];
  }
}

function saveWishlist(items) {
  localStorage.setItem(WISHLIST_STORAGE, JSON.stringify(items));
}

function generateId() {
  return 'wl_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
}

function parseVideoUrl(raw) {
  const url = (raw || '').trim();
  if (!url) return { platform: 'link', normalized: url };

  let normalized = url;
  if (!/^https?:\/\//i.test(url)) normalized = 'https://' + url;

  const ig = normalized.match(/instagram\.com\/(?:reel|reels|p|tv)\/([A-Za-z0-9_-]+)/i);
  if (ig) {
    return { platform: 'instagram', id: ig[1], normalized, embedUrl: `https://www.instagram.com/reel/${ig[1]}/embed` };
  }

  const tt = normalized.match(/tiktok\.com\/@[\w.]+\/video\/(\d+)/i)
    || normalized.match(/tiktok\.com\/.*\/video\/(\d+)/i)
    || normalized.match(/vm\.tiktok\.com\/([A-Za-z0-9]+)/i);
  if (tt) {
    return { platform: 'tiktok', id: tt[1], normalized };
  }

  const yt = normalized.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([A-Za-z0-9_-]{6,})/i);
  if (yt) {
    return { platform: 'youtube', id: yt[1], normalized, embedUrl: `https://www.youtube.com/embed/${yt[1]}` };
  }

  const vk = normalized.match(/vk\.com\/video(-?\d+_\d+)/i);
  if (vk) {
    const [oid, vid] = vk[1].split('_');
    return {
      platform: 'vk',
      id: vk[1],
      normalized,
      embedUrl: `https://vk.com/video_ext.php?oid=${oid}&id=${vid}&hd=2`
    };
  }

  const rutube = normalized.match(/rutube\.ru\/video\/([a-f0-9]+)/i);
  if (rutube) {
    return {
      platform: 'rutube',
      id: rutube[1],
      normalized,
      embedUrl: `https://rutube.ru/play/embed/${rutube[1]}`
    };
  }

  return { platform: 'link', normalized };
}

/* Платформы, заблокированные в РФ — показываем заставку + ссылку в приложение */
function isBlockedEmbedPlatform(platform) {
  return platform === 'instagram' || platform === 'tiktok';
}

function getInstagramAppUrl(reelId, webUrl) {
  const ua = navigator.userAgent || '';
  if (/iPhone|iPad|iPod/i.test(ua)) {
    return `instagram://reel/${reelId}`;
  }
  if (/Android/i.test(ua)) {
    return `intent://www.instagram.com/reel/${reelId}/#Intent;package=com.instagram.android;scheme=https;S.browser_fallback_url=${encodeURIComponent(webUrl)};end`;
  }
  return webUrl;
}

function getTikTokAppUrl(webUrl) {
  const ua = navigator.userAgent || '';
  if (/iPhone|iPad|iPod/i.test(ua)) {
    return webUrl.replace(/^https?:\/\//, 'snssdk1233://');
  }
  if (/Android/i.test(ua)) {
    return `intent://${webUrl.replace(/^https?:\/\//, '')}#Intent;package=com.zhiliaoapp.musically;scheme=https;S.browser_fallback_url=${encodeURIComponent(webUrl)};end`;
  }
  return webUrl;
}

function getOpenUrl(item) {
  if (item.platform === 'instagram' && item.videoId) {
    return getInstagramAppUrl(item.videoId, item.url);
  }
  if (item.platform === 'tiktok') {
    return getTikTokAppUrl(item.url);
  }
  return item.url;
}

async function fetchThumbnail(url) {
  try {
    const api = `https://api.microlink.io/?url=${encodeURIComponent(url)}&palette=false&audio=false&video=false`;
    const res = await fetch(api, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const json = await res.json();
    return json.data?.image?.url || null;
  } catch {
    return null;
  }
}

async function ensureItemThumbnail(item) {
  if (item.thumbnail) return item.thumbnail;
  if (!item.url || item.platform === 'link') return null;
  const thumb = await fetchThumbnail(item.url);
  if (thumb) {
    item.thumbnail = thumb;
    const list = getWishlist();
    const idx = list.findIndex(w => w.id === item.id);
    if (idx >= 0) {
      list[idx].thumbnail = thumb;
      saveWishlist(list);
    }
  }
  return thumb;
}

function platformLabel(platform) {
  const map = {
    instagram: 'Instagram',
    tiktok: 'TikTok',
    youtube: 'YouTube',
    vk: 'VK Видео',
    rutube: 'Rutube',
    link: 'Ссылка'
  };
  return map[platform] || 'Видео';
}

function platformIcon(platform) {
  const map = {
    instagram: 'fa-brands fa-instagram',
    tiktok: 'fa-brands fa-tiktok',
    youtube: 'fa-brands fa-youtube',
    vk: 'fa-brands fa-vk',
    rutube: 'fa-solid fa-play',
    link: 'fa-link'
  };
  return map[platform] || 'fa-video';
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

function getWishesByCategory(categoryId) {
  return getWishlist().filter(w => w.category === categoryId);
}

function renderWishThumb(item, compact) {
  const openUrl = getOpenUrl(item);
  const appLabel = item.platform === 'instagram' ? 'Открыть в Instagram' :
    item.platform === 'tiktok' ? 'Открыть в TikTok' : 'Смотреть видео';

  if (item.thumbnail) {
    return `<a href="${escapeHtml(openUrl)}" class="wish-thumb wish-thumb-link${compact ? ' wish-thumb-compact' : ''}" target="_blank" rel="noopener">
      <img src="${escapeHtml(item.thumbnail)}" alt="${escapeHtml(item.title)}" class="wish-thumb-img" loading="lazy">
      <span class="wish-thumb-overlay">
        <span class="wish-thumb-play"><i class="fas fa-play"></i></span>
        <span class="wish-thumb-label">${appLabel}</span>
      </span>
    </a>`;
  }

  const grad = item.platform === 'instagram'
    ? 'linear-gradient(135deg, #833AB4, #FD1D1D, #FCB045)'
    : item.platform === 'tiktok'
      ? 'linear-gradient(135deg, #010101, #25F4EE, #FE2C55)'
      : 'linear-gradient(135deg, var(--charcoal), #4a4540)';

  return `<a href="${escapeHtml(openUrl)}" class="wish-thumb wish-thumb-placeholder${compact ? ' wish-thumb-compact' : ''}" style="background:${grad}" target="_blank" rel="noopener">
    <i class="${platformIcon(item.platform)}"></i>
    <span class="wish-thumb-label">${appLabel}</span>
    ${!compact ? '<small>Заставка подгружается…</small>' : ''}
  </a>`;
}

function renderWishEmbed(item) {
  if (isBlockedEmbedPlatform(item.platform)) {
    return renderWishThumb(item, false);
  }

  if (item.platform === 'youtube' && item.embedUrl) {
    return `<div class="wish-embed wish-embed-yt">
      <iframe src="${escapeHtml(item.embedUrl)}" title="${escapeHtml(item.title)}" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
    </div>`;
  }

  if ((item.platform === 'vk' || item.platform === 'rutube') && item.embedUrl) {
    return `<div class="wish-embed wish-embed-rf">
      <iframe src="${escapeHtml(item.embedUrl)}" title="${escapeHtml(item.title)}" loading="lazy" allowfullscreen></iframe>
    </div>`;
  }

  return renderWishThumb(item, false);
}

function renderWishCard(item, compact) {
  const cat = getCategoryMeta(item.category);
  const priceHtml = item.price ? `<span class="wish-price">${escapeHtml(item.price)}</span>` : '';

  if (compact) {
    const openUrl = getOpenUrl(item);
    const thumbHtml = item.thumbnail
      ? `<img src="${escapeHtml(item.thumbnail)}" alt="" class="wish-compact-img" loading="lazy">`
      : `<span class="wish-compact-icon"><i class="${platformIcon(item.platform)}"></i></span>`;

    return `<article class="wish-card wish-card-compact" data-id="${item.id}">
      <a href="${escapeHtml(openUrl)}" class="wish-compact-media" target="_blank" rel="noopener">${thumbHtml}</a>
      <div class="wish-card-body">
        <span class="wish-cat-tag"><i class="fas ${cat.icon}"></i> ${escapeHtml(cat.title)}</span>
        <h4 class="wish-title">${escapeHtml(item.title)}</h4>
        ${item.description ? `<p class="wish-desc">${escapeHtml(item.description)}</p>` : ''}
        ${priceHtml}
        <a href="${escapeHtml(openUrl)}" target="_blank" rel="noopener" class="wish-link"><i class="${platformIcon(item.platform)}"></i> Открыть в приложении</a>
      </div>
    </article>`;
  }

  const openUrl = getOpenUrl(item);
  const openLabel = item.platform === 'instagram' ? 'Instagram' :
    item.platform === 'tiktok' ? 'TikTok' : 'видео';

  return `<article class="wish-card" data-id="${item.id}">
    ${renderWishEmbed(item)}
    <div class="wish-card-body">
      <div class="wish-card-top">
        <span class="wish-cat-tag"><i class="fas ${cat.icon}"></i> ${escapeHtml(cat.title)}</span>
        <span class="wish-platform"><i class="${platformIcon(item.platform)}"></i> ${platformLabel(item.platform)}</span>
      </div>
      <h3 class="wish-title">${escapeHtml(item.title)}</h3>
      ${item.description ? `<p class="wish-desc">${escapeHtml(item.description)}</p>` : ''}
      ${priceHtml}
      <div class="wish-card-actions">
        <a href="${escapeHtml(openUrl)}" target="_blank" rel="noopener" class="btn-wish btn-wish-outline"><i class="${platformIcon(item.platform)}"></i> Открыть в ${openLabel}</a>
        <button type="button" class="btn-wish btn-wish-ghost wish-refresh-thumb" data-id="${item.id}" title="Обновить заставку"><i class="fas fa-image"></i></button>
        <button type="button" class="btn-wish btn-wish-ghost wish-edit" data-id="${item.id}"><i class="fas fa-pen"></i></button>
        <button type="button" class="btn-wish btn-wish-ghost wish-delete" data-id="${item.id}"><i class="fas fa-trash-alt"></i></button>
      </div>
    </div>
  </article>`;
}

function renderWishlistInCategory(categoryId) {
  const items = getWishesByCategory(categoryId);
  if (!items.length) return '';

  return `<div class="wishlist-inline">
    <h4 class="wishlist-inline-title"><i class="fas fa-heart"></i> Хотелки Иры</h4>
    <div class="wishlist-inline-grid">
      ${items.map(w => renderWishCard(w, true)).join('')}
    </div>
  </div>`;
}

function renderWishlistSection() {
  const grid = document.getElementById('wishlistGrid');
  const filters = document.getElementById('wishlistFilters');
  if (!grid || !filters) return;

  const categories = getWishlistCategories();
  const all = getWishlist();
  const activeFilter = grid.dataset.filter || 'all';

  filters.innerHTML = `
    <button type="button" class="wish-filter${activeFilter === 'all' ? ' active' : ''}" data-filter="all">Все (${all.length})</button>
    ${categories.map(c => {
      const count = all.filter(w => w.category === c.id).length;
      if (!count && activeFilter !== c.id) return '';
      return `<button type="button" class="wish-filter${activeFilter === c.id ? ' active' : ''}" data-filter="${c.id}">
        <i class="fas ${c.icon}"></i> ${c.title} (${count})
      </button>`;
    }).join('')}
  `;

  const filtered = activeFilter === 'all' ? all : all.filter(w => w.category === activeFilter);
  filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  if (!filtered.length) {
    grid.innerHTML = `<div class="wishlist-empty">
      <i class="fas fa-bookmark"></i>
      <p>Пока пусто. Вставь ссылку на рилс из Instagram — появится карточка с заставкой.</p>
    </div>`;
  } else {
    grid.innerHTML = filtered.map(w => renderWishCard(w, false)).join('');
    loadMissingThumbnails(filtered);
  }

  filters.querySelectorAll('.wish-filter').forEach(btn => {
    btn.addEventListener('click', () => {
      grid.dataset.filter = btn.dataset.filter;
      renderWishlistSection();
    });
  });

  grid.querySelectorAll('.wish-delete').forEach(btn => {
    btn.addEventListener('click', () => deleteWish(btn.dataset.id));
  });

  grid.querySelectorAll('.wish-edit').forEach(btn => {
    btn.addEventListener('click', () => startEditWish(btn.dataset.id));
  });

  grid.querySelectorAll('.wish-refresh-thumb').forEach(btn => {
    btn.addEventListener('click', () => refreshThumbnail(btn.dataset.id));
  });
}

async function loadMissingThumbnails(items) {
  const needThumb = items.filter(i => !i.thumbnail && i.url);
  for (const item of needThumb) {
    await ensureItemThumbnail(item);
    const card = document.querySelector(`.wish-card[data-id="${item.id}"]`);
    if (card && item.thumbnail) {
      const media = card.querySelector('.wish-thumb-placeholder, .wish-thumb-link');
      if (media) {
        media.outerHTML = renderWishThumb(item, false).trim();
      }
    }
  }
}

async function refreshThumbnail(id) {
  const list = getWishlist();
  const item = list.find(w => w.id === id);
  if (!item) return;

  item.thumbnail = null;
  const thumb = await fetchThumbnail(item.url);
  if (thumb) {
    item.thumbnail = thumb;
    saveWishlist(list);
    refreshWishlistUI();
  } else {
    alert('Не удалось загрузить заставку. Можно вставить ссылку на картинку вручную при редактировании.');
  }
}

function populateCategorySelect(select) {
  if (!select) return;
  select.innerHTML = getWishlistCategories()
    .map(c => `<option value="${c.id}">${c.title}</option>`)
    .join('');
}

function addWish(data) {
  const parsed = parseVideoUrl(data.url);
  const item = {
    id: data.id || generateId(),
    url: parsed.normalized || data.url.trim(),
    title: data.title.trim() || 'Новая хотелка',
    description: (data.description || '').trim(),
    price: (data.price || '').trim(),
    category: data.category || 'other',
    platform: parsed.platform,
    embedUrl: parsed.embedUrl || null,
    videoId: parsed.id || null,
    thumbnail: (data.thumbnail || '').trim() || null,
    createdAt: data.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const list = getWishlist();
  const idx = list.findIndex(w => w.id === item.id);
  if (idx >= 0) list[idx] = item;
  else list.push(item);

  saveWishlist(list);
  return item;
}

async function addWishWithThumbnail(data) {
  const item = addWish(data);
  if (!item.thumbnail && item.url) {
    const thumb = await fetchThumbnail(item.url);
    if (thumb) {
      item.thumbnail = thumb;
      const list = getWishlist();
      const idx = list.findIndex(w => w.id === item.id);
      if (idx >= 0) {
        list[idx].thumbnail = thumb;
        saveWishlist(list);
      }
    }
  }
  refreshWishlistUI();
  return item;
}

function deleteWish(id) {
  if (!confirm('Удалить эту хотелку?')) return;
  saveWishlist(getWishlist().filter(w => w.id !== id));
  resetWishForm();
  refreshWishlistUI();
}

function startEditWish(id) {
  const item = getWishlist().find(w => w.id === id);
  if (!item) return;

  const form = document.getElementById('wishForm');
  if (!form) return;

  document.getElementById('wishUrl').value = item.url;
  document.getElementById('wishTitle').value = item.title;
  document.getElementById('wishDesc').value = item.description || '';
  document.getElementById('wishPrice').value = item.price || '';
  document.getElementById('wishThumb').value = item.thumbnail || '';
  document.getElementById('wishCategory').value = item.category;
  document.getElementById('wishEditId').value = item.id;

  const submitBtn = form.querySelector('[type="submit"]');
  if (submitBtn) submitBtn.innerHTML = '<i class="fas fa-check"></i> Сохранить изменения';

  const cancelBtn = document.getElementById('wishCancelEdit');
  if (cancelBtn) cancelBtn.hidden = false;

  form.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function resetWishForm() {
  const form = document.getElementById('wishForm');
  if (!form) return;
  form.reset();
  document.getElementById('wishEditId').value = '';
  const submitBtn = form.querySelector('[type="submit"]');
  if (submitBtn) submitBtn.innerHTML = '<i class="fas fa-plus"></i> Добавить хотелку';
  const cancelBtn = document.getElementById('wishCancelEdit');
  if (cancelBtn) cancelBtn.hidden = true;
}

function setupWishlistForm() {
  const form = document.getElementById('wishForm');
  populateCategorySelect(document.getElementById('wishCategory'));
  if (!form) return;

  const urlInput = document.getElementById('wishUrl');
  urlInput.addEventListener('paste', () => {
    setTimeout(() => tryAutofillFromUrl(urlInput.value), 50);
  });
  urlInput.addEventListener('blur', () => tryAutofillFromUrl(urlInput.value));

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const url = document.getElementById('wishUrl').value.trim();
    if (!url) {
      alert('Вставь ссылку на рилс');
      return;
    }

    const submitBtn = document.getElementById('wishSubmitBtn');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Сохраняем…';
    }

    try {
      await addWishWithThumbnail({
        id: document.getElementById('wishEditId').value || undefined,
        url,
        title: document.getElementById('wishTitle').value,
        description: document.getElementById('wishDesc').value,
        price: document.getElementById('wishPrice').value,
        thumbnail: document.getElementById('wishThumb').value,
        category: document.getElementById('wishCategory').value,
        createdAt: document.getElementById('wishEditId').value
          ? getWishlist().find(w => w.id === document.getElementById('wishEditId').value)?.createdAt
          : undefined
      });
      resetWishForm();
      urlInput.focus();
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = document.getElementById('wishEditId').value
          ? '<i class="fas fa-check"></i> Сохранить изменения'
          : '<i class="fas fa-plus"></i> Добавить хотелку';
      }
    }
  });

  const cancelBtn = document.getElementById('wishCancelEdit');
  if (cancelBtn) cancelBtn.addEventListener('click', resetWishForm);
}

function tryAutofillFromUrl(url) {
  const titleInput = document.getElementById('wishTitle');
  if (!titleInput || titleInput.value.trim()) return;

  const parsed = parseVideoUrl(url);
  if (parsed.platform === 'instagram') {
    titleInput.placeholder = 'Например: Коляска Inglesina из рилса';
  }
}

function refreshWishlistUI() {
  renderWishlistSection();
  if (typeof renderShopping === 'function') renderShopping();
}

function initWishlist() {
  setupWishlistForm();
  renderWishlistSection();
}

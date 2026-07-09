/* Вишлист подарков — для родных (к родам, ребёнку, маме) */

const GIFTS_KEY = 'nashe_chudo_gifts_wishlist';

const GIFT_CATEGORIES = [
  { id: 'birth', title: 'К родам', icon: 'fa-suitcase-medical' },
  { id: 'baby', title: 'Ребёнку', icon: 'fa-baby' },
  { id: 'mom', title: 'Маме', icon: 'fa-heart' },
  { id: 'other', title: 'Другое', icon: 'fa-gift' }
];

let giftsFilter = 'all';
let giftsAddMode = 'marketplace';

function getGiftItems() {
  try {
    return JSON.parse(localStorage.getItem(GIFTS_KEY)) || [];
  } catch {
    return [];
  }
}

function saveGiftItems(items) {
  localStorage.setItem(GIFTS_KEY, JSON.stringify(items));
}

function generateGiftId() {
  return 'gift_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
}

function getGiftCategoryMeta(id) {
  return GIFT_CATEGORIES.find(c => c.id === id) || { id: 'other', title: 'Другое', icon: 'fa-gift' };
}

function updateGiftItem(id, patch) {
  const items = getGiftItems();
  const idx = items.findIndex(i => i.id === id);
  if (idx < 0) return null;
  items[idx] = { ...items[idx], ...patch, updatedAt: new Date().toISOString() };
  saveGiftItems(items);
  return items[idx];
}

function deleteGiftItem(id) {
  saveGiftItems(getGiftItems().filter(i => i.id !== id));
}

async function addGiftMarketplaceItem(categoryId, rawInput) {
  const parsed = parseMarketplaceInput(rawInput);
  if (!parsed?.url) {
    showToast?.('Вставьте ссылку WB/Ozon или артикул');
    return null;
  }

  const preview = await fetchProductPreview(parsed.url);
  const mp = detectMarketplace(parsed.url);
  const item = {
    id: generateGiftId(),
    categoryId,
    source: 'marketplace',
    title: preview?.title || `Подарок ${mp.name}`,
    price: preview?.price || '',
    article: parsed.article || preview?.article || '',
    url: parsed.url,
    image: preview?.image || '',
    note: '',
    platform: parsed.marketplace || mp.id,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const items = getGiftItems();
  items.push(item);
  saveGiftItems(items);
  return item;
}

function addGiftCustomItem(categoryId, data) {
  const title = (data.title || '').trim();
  if (!title) return null;

  const url = normalizeShopUrl(data.url);
  const item = {
    id: generateGiftId(),
    categoryId,
    source: 'custom',
    title,
    price: (data.price || '').trim(),
    article: (data.article || '').trim(),
    url,
    image: (data.image || '').trim(),
    note: (data.note || '').trim(),
    platform: url ? detectMarketplace(url).id : 'other',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const items = getGiftItems();
  items.push(item);
  saveGiftItems(items);
  return item;
}

function renderGiftItemCard(item) {
  const mp = item.url ? detectMarketplace(item.url) : { name: 'Сайт', icon: 'fa-link' };
  const imgHtml = item.image
    ? `<img src="${escapeHtml(item.image)}" alt="" class="shop-item-img" loading="lazy">`
    : `<div class="shop-item-img shop-item-img--placeholder"><i class="fas ${mp.icon}"></i></div>`;

  const articleHtml = item.article ? `<span class="shop-item-article">Арт. ${escapeHtml(item.article)}</span>` : '';
  const priceHtml = item.price ? `<span class="shop-item-price">${escapeHtml(item.price)}</span>` : '';
  const noteHtml = item.note ? `<p class="shop-item-note">${escapeHtml(item.note)}</p>` : '';
  const sourceLabel = item.source === 'marketplace' ? mp.name : 'Вручную';

  const openBtn = item.url
    ? `<a href="${escapeHtml(item.url)}" class="btn-wish btn-wish-outline btn-sm shop-item-open" target="_blank" rel="noopener noreferrer"><i class="fas fa-external-link-alt"></i> На сайт</a>`
    : '';

  return `<article class="shop-item-card" data-id="${escapeHtml(item.id)}">
    <div class="shop-item-media">${imgHtml}</div>
    <div class="shop-item-body">
      <div class="shop-item-top">
        <span class="shop-item-source"><i class="fas ${mp.icon}"></i> ${escapeHtml(sourceLabel)}</span>
      </div>
      <h4 class="shop-item-title">${escapeHtml(item.title)}</h4>
      ${articleHtml}
      ${priceHtml}
      ${noteHtml}
      <div class="shop-item-actions">
        ${openBtn}
        <button type="button" class="btn-wish btn-wish-ghost btn-sm shop-item-delete" data-gift-del="${escapeHtml(item.id)}" title="Удалить"><i class="fas fa-trash-alt"></i></button>
      </div>
    </div>
  </article>`;
}

function renderGiftAddForm(categoryId) {
  return `<div class="shop-add-panel" data-gift-add-cat="${categoryId}">
    <div class="shop-add-tabs">
      <button type="button" class="shop-add-tab${giftsAddMode === 'marketplace' ? ' active' : ''}" data-gift-mode="marketplace" data-cat="${categoryId}"><i class="fas fa-bag-shopping"></i> WB / Ozon</button>
      <button type="button" class="shop-add-tab${giftsAddMode === 'custom' ? ' active' : ''}" data-gift-mode="custom" data-cat="${categoryId}"><i class="fas fa-pen"></i> Вручную</button>
    </div>
    ${giftsAddMode === 'marketplace' ? `
      <form class="shop-add-form shop-add-form--gift-mp" data-cat="${categoryId}">
        <label class="shop-add-field shop-add-field-grow">
          <span>Ссылка или артикул Wildberries / Ozon</span>
          <input type="text" name="input" placeholder="https://www.wildberries.ru/... или 123456789" required>
        </label>
        <button type="submit" class="btn-wish btn-wish-primary"><i class="fas fa-plus"></i> Добавить</button>
      </form>
      <p class="shop-add-hint">Подтянем фото, название, артикул и цену автоматически.</p>
    ` : `
      <form class="shop-add-form shop-add-form--gift-custom" data-cat="${categoryId}">
        <div class="shop-add-grid">
          <label class="shop-add-field shop-add-field-grow"><span>Название</span><input type="text" name="title" placeholder="Что хотелось бы в подарок" required maxlength="120"></label>
          <label class="shop-add-field"><span>Примерная стоимость</span><input type="text" name="price" placeholder="~3 000 ₽" maxlength="40"></label>
          <label class="shop-add-field"><span>Артикул</span><input type="text" name="article" placeholder="Если есть" maxlength="30"></label>
          <label class="shop-add-field shop-add-field-grow"><span>Ссылка</span><input type="url" name="url" placeholder="https://..." maxlength="500"></label>
          <label class="shop-add-field shop-add-field-grow"><span>Фото — ссылка</span><input type="url" name="image" placeholder="https://...jpg" maxlength="500"></label>
          <label class="shop-add-field shop-add-field-full"><span>Заметка для родных</span><input type="text" name="note" placeholder="Цвет, размер..." maxlength="200"></label>
        </div>
        <button type="submit" class="btn-wish btn-wish-primary"><i class="fas fa-plus"></i> Добавить</button>
      </form>
    `}
  </div>`;
}

function renderGiftsWishlist() {
  const grid = document.getElementById('giftsGrid');
  const filters = document.getElementById('giftsFilters');
  if (!grid) return;

  const allItems = getGiftItems();

  if (filters) {
    filters.innerHTML = `
      <button type="button" class="shop-filter${giftsFilter === 'all' ? ' active' : ''}" data-gift-filter="all">Все (${allItems.length})</button>
      ${GIFT_CATEGORIES.map(c => {
        const count = allItems.filter(i => i.categoryId === c.id).length;
        if (!count && giftsFilter !== c.id) return '';
        return `<button type="button" class="shop-filter${giftsFilter === c.id ? ' active' : ''}" data-gift-filter="${c.id}">
          <i class="fas ${c.icon}"></i> ${c.title} (${count})
        </button>`;
      }).join('')}`;
    filters.querySelectorAll('[data-gift-filter]').forEach(btn => {
      btn.addEventListener('click', () => {
        giftsFilter = btn.dataset.giftFilter;
        renderGiftsWishlist();
      });
    });
  }

  const categories = giftsFilter === 'all'
    ? GIFT_CATEGORIES
    : GIFT_CATEGORIES.filter(c => c.id === giftsFilter);

  grid.innerHTML = categories.map(cat => {
    const items = allItems.filter(i => i.categoryId === cat.id);
    return `
      <div class="shop-category" data-gift-cat="${cat.id}">
        <div class="shop-cat-head">
          <i class="fas ${cat.icon}"></i>
          <div><h3>${cat.title}</h3></div>
        </div>
        <div class="shop-items-grid">
          ${items.length
            ? items.map(renderGiftItemCard).join('')
            : '<p class="shop-items-empty">Пока пусто — добавьте идею подарка.</p>'}
        </div>
        ${renderGiftAddForm(cat.id)}
      </div>`;
  }).join('');

  grid.querySelectorAll('[data-gift-mode]').forEach(btn => {
    btn.addEventListener('click', () => {
      giftsAddMode = btn.dataset.giftMode;
      renderGiftsWishlist();
    });
  });

  grid.querySelectorAll('.shop-add-form--gift-mp').forEach(form => {
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const catId = form.dataset.cat;
      const input = form.querySelector('[name="input"]');
      const btn = form.querySelector('[type="submit"]');
      if (!input?.value.trim()) return;
      if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Загружаем…';
      }
      await addGiftMarketplaceItem(catId, input.value);
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-plus"></i> Добавить';
      }
      form.reset();
      renderGiftsWishlist();
      showToast?.('Подарок добавлен');
    });
  });

  grid.querySelectorAll('.shop-add-form--gift-custom').forEach(form => {
    form.addEventListener('submit', e => {
      e.preventDefault();
      const catId = form.dataset.cat;
      const fd = new FormData(form);
      addGiftCustomItem(catId, {
        title: fd.get('title'),
        price: fd.get('price'),
        article: fd.get('article'),
        url: fd.get('url'),
        image: fd.get('image'),
        note: fd.get('note')
      });
      form.reset();
      renderGiftsWishlist();
      showToast?.('Подарок добавлен');
    });
  });

  grid.querySelectorAll('[data-gift-del]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!confirm('Удалить из вишлиста?')) return;
      deleteGiftItem(btn.dataset.giftDel);
      renderGiftsWishlist();
    });
  });

  updateGiftsSummary();
}

function updateGiftsSummary() {
  const list = document.getElementById('giftsList');
  const empty = document.getElementById('giftsEmpty');
  if (!list) return;

  const items = getGiftItems();
  list.innerHTML = items.map(item => {
    const cat = getGiftCategoryMeta(item.categoryId);
    const linkHtml = item.url
      ? ` <a class="summary-link" href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer"><i class="fas fa-external-link-alt"></i></a>`
      : '';
    const pricePart = item.price ? ` — ${escapeHtml(item.price)}` : '';
    const artPart = item.article ? ` (арт. ${escapeHtml(item.article)})` : '';
    return `<li><strong>${escapeHtml(cat.title)}:</strong> ${escapeHtml(item.title)}${artPart}${pricePart}${linkHtml}</li>`;
  }).join('');

  if (empty) empty.style.display = items.length ? 'none' : 'block';
}

function exportGiftsList() {
  const items = getGiftItems();
  const lines = ['🎁 Вишлист подарков\n'];
  items.forEach(item => {
    const cat = getGiftCategoryMeta(item.categoryId);
    lines.push(`• ${cat.title}: ${item.title}${item.article ? ' (арт. ' + item.article + ')' : ''}${item.price ? ' — ' + item.price : ''}${item.url ? '\n  ' + item.url : ''}`);
  });
  copyToClipboard?.(lines.join('\n'));
}

function loadAllGiftPreviews() {
  getGiftItems().forEach(item => {
    if (item.url && item.source === 'marketplace' && !item.image) {
      fetchProductPreview(item.url).then(preview => {
        if (!preview) return;
        updateGiftItem(item.id, {
          title: item.title || preview.title,
          price: item.price || preview.price,
          image: preview.image,
          article: item.article || preview.article
        });
        renderGiftsWishlist();
      });
    }
  });
}

function initGiftsWishlist() {
  renderGiftsWishlist();
  loadAllGiftPreviews();
  document.getElementById('exportGiftsBtn')?.addEventListener('click', exportGiftsList);
}

/* К родам — единый список товаров по категориям */

const SHOP_ITEMS_KEY = 'nashe_chudo_shop_items';
const SHOP_MIGRATED_KEY = 'nashe_chudo_shop_migrated_v2';
let shopActiveFilter = 'all';
let shopAddMode = 'marketplace';

function getShopItems() {
  try {
    return JSON.parse(localStorage.getItem(SHOP_ITEMS_KEY)) || [];
  } catch {
    return [];
  }
}

function saveShopItems(items) {
  localStorage.setItem(SHOP_ITEMS_KEY, JSON.stringify(items));
}

function generateShopItemId() {
  return 'item_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
}

function getCategoryMeta(id) {
  return SHOPPING_CATEGORIES.find(c => c.id === id) || { id: 'other', title: 'Другое', icon: 'fa-star' };
}

function getItemsByCategory(categoryId) {
  return getShopItems().filter(i => i.categoryId === categoryId);
}

function updateShopItem(id, patch) {
  const items = getShopItems();
  const idx = items.findIndex(i => i.id === id);
  if (idx < 0) return null;
  items[idx] = { ...items[idx], ...patch, updatedAt: new Date().toISOString() };
  saveShopItems(items);
  return items[idx];
}

function deleteShopItem(id) {
  saveShopItems(getShopItems().filter(i => i.id !== id));
}

function toggleShopItemSelected(id) {
  const items = getShopItems();
  const idx = items.findIndex(i => i.id === id);
  if (idx < 0) return;
  items[idx].selected = !items[idx].selected;
  saveShopItems(items);
}

async function addMarketplaceItem(categoryId, rawInput) {
  const parsed = parseMarketplaceInput(rawInput);
  if (!parsed?.url) {
    showToast?.('Вставьте ссылку WB/Ozon или артикул');
    return null;
  }

  const preview = await fetchProductPreview(parsed.url);
  const mp = detectMarketplace(parsed.url);
  const title = isValidProductTitle(preview?.title)
    ? preview.title
    : (preview?.article ? `Арт. ${preview.article}` : `Товар ${mp.name}`);
  const item = {
    id: generateShopItemId(),
    categoryId,
    source: 'marketplace',
    title,
    price: preview?.price || '',
    article: parsed.article || preview?.article || '',
    url: parsed.url,
    image: preview?.image || '',
    note: '',
    platform: parsed.marketplace || mp.id,
    selected: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const items = getShopItems();
  items.push(item);
  saveShopItems(items);
  return item;
}

function addCustomItem(categoryId, data) {
  const title = (data.title || '').trim();
  if (!title) return null;

  const url = normalizeShopUrl(data.url);
  const item = {
    id: generateShopItemId(),
    categoryId,
    source: 'custom',
    title,
    price: (data.price || '').trim(),
    article: (data.article || '').trim(),
    url,
    image: (data.image || '').trim(),
    note: (data.note || '').trim(),
    platform: url ? detectMarketplace(url).id : 'other',
    selected: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const items = getShopItems();
  items.push(item);
  saveShopItems(items);
  return item;
}

function migrateLegacyShopData() {
  if (localStorage.getItem(SHOP_MIGRATED_KEY)) return;

  const items = getShopItems();
  const ids = new Set(items.map(i => i.id));

  try {
    const wishlist = JSON.parse(localStorage.getItem('nashe_chudo_wishlist')) || [];
    wishlist.forEach(w => {
      const id = 'wl_' + w.id;
      if (ids.has(id)) return;
      items.push({
        id,
        categoryId: w.category || 'other',
        source: w.platform && w.platform !== 'link' ? 'video' : 'custom',
        title: w.title || 'Хотелка',
        price: w.price || '',
        article: '',
        url: w.url || '',
        image: w.thumbnail || '',
        note: w.description || '',
        platform: w.platform || 'other',
        selected: false,
        createdAt: w.createdAt || new Date().toISOString(),
        updatedAt: w.updatedAt || new Date().toISOString()
      });
      ids.add(id);
    });
  } catch { /* ignore */ }

  try {
    const customMap = JSON.parse(localStorage.getItem('nashe_chudo_shop_custom')) || {};
    Object.entries(customMap).forEach(([catId, list]) => {
      (list || []).forEach(opt => {
        const id = 'custom_' + opt.id;
        if (ids.has(id)) return;
        items.push({
          id,
          categoryId: catId,
          source: opt.url ? 'marketplace' : 'custom',
          title: opt.name,
          price: opt.price && opt.price !== '—' ? opt.price : '',
          article: '',
          url: opt.url || '',
          image: '',
          note: opt.note || '',
          platform: opt.url ? detectMarketplace(opt.url).id : 'other',
          selected: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        ids.add(id);
      });
    });
  } catch { /* ignore */ }

  try {
    const choices = JSON.parse(localStorage.getItem('nashe_chudo_choices')) || {};
    const links = JSON.parse(localStorage.getItem('nashe_chudo_shop_links')) || {};
    Object.entries(choices).forEach(([catId, optId]) => {
      const item = items.find(i => i.id === 'custom_' + optId || i.id === optId);
      if (item) item.selected = true;
      const link = links[catId];
      if (link?.url) {
        const existing = items.find(i => i.categoryId === catId && i.url === link.url);
        if (existing) {
          existing.selected = true;
        } else if (!items.some(i => i.id === 'link_' + catId)) {
          items.push({
            id: 'link_' + catId,
            categoryId: catId,
            source: 'marketplace',
            title: link.preview?.title || 'Выбранный товар',
            price: link.preview?.price || '',
            article: link.preview?.article || '',
            url: link.url,
            image: link.preview?.image || '',
            note: '',
            platform: detectMarketplace(link.url).id,
            selected: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
        }
      }
    });
  } catch { /* ignore */ }

  saveShopItems(items);
  localStorage.setItem(SHOP_MIGRATED_KEY, '1');
}

function renderShopItemCard(item) {
  const mp = item.url ? detectMarketplace(item.url) : { name: 'Сайт', icon: 'fa-link' };
  const imgHtml = item.image
    ? `<img src="${escapeHtml(item.image)}" alt="" class="shop-item-img" loading="lazy"${item.article ? ` data-nm="${escapeHtml(item.article)}" onerror="wbImgFallback(this)"` : ''}>`
    : `<div class="shop-item-img shop-item-img--placeholder"><i class="fas ${item.source === 'video' ? 'fa-play' : mp.icon}"></i></div>`;

  const articleHtml = item.article ? `<span class="shop-item-article">Арт. ${escapeHtml(item.article)}</span>` : '';
  const priceHtml = item.price ? `<span class="shop-item-price">${escapeHtml(item.price)}</span>` : '';
  const noteHtml = item.note ? `<p class="shop-item-note">${escapeHtml(item.note)}</p>` : '';
  const sourceLabel = item.source === 'video' ? 'Рилс / видео' : item.source === 'marketplace' ? mp.name : 'Свой товар';

  const openBtn = item.url
    ? `<a href="${escapeHtml(item.url)}" class="btn-wish btn-wish-outline btn-sm shop-item-open" target="_blank" rel="noopener noreferrer"><i class="fas fa-external-link-alt"></i> На сайт</a>`
    : '';

  return `<article class="shop-item-card${item.selected ? ' shop-item-card--selected' : ''}" data-id="${escapeHtml(item.id)}">
    <div class="shop-item-media">${imgHtml}</div>
    <div class="shop-item-body">
      <div class="shop-item-top">
        <span class="shop-item-source"><i class="fas ${mp.icon}"></i> ${escapeHtml(sourceLabel)}</span>
        ${item.selected ? '<span class="shop-item-badge"><i class="fas fa-check"></i> Выбрали</span>' : ''}
      </div>
      <h4 class="shop-item-title">${escapeHtml(item.title)}</h4>
      ${articleHtml}
      ${priceHtml}
      ${noteHtml}
      <div class="shop-item-actions">
        <button type="button" class="btn-wish btn-sm ${item.selected ? 'btn-wish-primary' : 'btn-wish-outline'} shop-item-select" data-id="${escapeHtml(item.id)}">
          <i class="fas fa-check"></i> ${item.selected ? 'Выбрано' : 'Выбрали'}
        </button>
        ${openBtn}
        <button type="button" class="btn-wish btn-wish-ghost btn-sm shop-item-delete" data-id="${escapeHtml(item.id)}" title="Удалить"><i class="fas fa-trash-alt"></i></button>
      </div>
    </div>
  </article>`;
}

function renderShopAddForm(categoryId) {
  return `<div class="shop-add-panel" data-add-cat="${categoryId}">
    <div class="shop-add-tabs">
      <button type="button" class="shop-add-tab${shopAddMode === 'marketplace' ? ' active' : ''}" data-mode="marketplace" data-cat="${categoryId}"><i class="fas fa-bag-shopping"></i> WB / Ozon</button>
      <button type="button" class="shop-add-tab${shopAddMode === 'custom' ? ' active' : ''}" data-mode="custom" data-cat="${categoryId}"><i class="fas fa-pen"></i> Свой товар</button>
    </div>
    ${shopAddMode === 'marketplace' ? `
      <form class="shop-add-form shop-add-form--mp" data-cat="${categoryId}">
        <label class="shop-add-field shop-add-field-grow">
          <span>Ссылка или артикул Wildberries / Ozon</span>
          <input type="text" name="input" placeholder="https://www.wildberries.ru/... или 123456789" required>
        </label>
        <button type="submit" class="btn-wish btn-wish-primary"><i class="fas fa-plus"></i> Добавить</button>
      </form>
      <p class="shop-add-hint">Подтянем фото, название, артикул и цену автоматически.</p>
    ` : `
      <form class="shop-add-form shop-add-form--custom" data-cat="${categoryId}">
        <div class="shop-add-grid">
          <label class="shop-add-field shop-add-field-grow"><span>Название</span><input type="text" name="title" placeholder="Бренд и модель" required maxlength="120"></label>
          <label class="shop-add-field"><span>Цена</span><input type="text" name="price" placeholder="~15 000 ₽" maxlength="40"></label>
          <label class="shop-add-field shop-add-field-grow"><span>Ссылка на сайт</span><input type="url" name="url" placeholder="https://..." maxlength="500"></label>
          <label class="shop-add-field shop-add-field-grow"><span>Фото — ссылка на картинку</span><input type="url" name="image" placeholder="https://...jpg" maxlength="500"></label>
          <label class="shop-add-field shop-add-field-full"><span>Заметка</span><input type="text" name="note" placeholder="Цвет, размер, почему понравилось..." maxlength="200"></label>
        </div>
        <button type="submit" class="btn-wish btn-wish-primary"><i class="fas fa-plus"></i> Добавить</button>
      </form>
    `}
  </div>`;
}

function renderShopping() {
  const grid = document.getElementById('shoppingGrid');
  const filters = document.getElementById('shoppingFilters');
  if (!grid) return;

  migrateLegacyShopData();
  const allItems = getShopItems();
  const activeFilter = shopActiveFilter;

  if (filters) {
    filters.innerHTML = `
      <button type="button" class="shop-filter${activeFilter === 'all' ? ' active' : ''}" data-filter="all">Все (${allItems.length})</button>
      ${SHOPPING_CATEGORIES.map(c => {
        const count = allItems.filter(i => i.categoryId === c.id).length;
        if (!count && activeFilter !== c.id) return '';
        return `<button type="button" class="shop-filter${activeFilter === c.id ? ' active' : ''}" data-filter="${c.id}">
          <i class="fas ${c.icon}"></i> ${c.title} (${count})
        </button>`;
      }).join('')}
    `;
    filters.querySelectorAll('.shop-filter').forEach(btn => {
      btn.addEventListener('click', () => {
        shopActiveFilter = btn.dataset.filter;
        renderShopping();
      });
    });
  }

  const categories = activeFilter === 'all'
    ? SHOPPING_CATEGORIES
    : SHOPPING_CATEGORIES.filter(c => c.id === activeFilter);

  grid.innerHTML = categories.map(cat => {
    const items = getItemsByCategory(cat.id);
    return `
      <div class="shop-category" data-shop-cat="${cat.id}">
        <div class="shop-cat-head">
          <i class="fas ${cat.icon}"></i>
          <div>
            <h3>${cat.title}</h3>
            <p class="shop-qty">${cat.quantity}</p>
          </div>
        </div>
        <div class="shop-items-grid">
          ${items.length
            ? items.map(renderShopItemCard).join('')
            : '<p class="shop-items-empty">Пока пусто — добавьте товар с WB/Ozon или вручную.</p>'}
        </div>
        ${renderShopAddForm(cat.id)}
      </div>
    `;
  }).join('');

  grid.querySelectorAll('.shop-add-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      shopAddMode = btn.dataset.mode;
      renderShopping();
    });
  });

  grid.querySelectorAll('.shop-add-form--mp').forEach(form => {
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
      await addMarketplaceItem(catId, input.value);
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-plus"></i> Добавить';
      }
      form.reset();
      renderShopping();
      updateSummary();
      showToast?.('Товар добавлен');
    });
  });

  grid.querySelectorAll('.shop-add-form--custom').forEach(form => {
    form.addEventListener('submit', e => {
      e.preventDefault();
      const catId = form.dataset.cat;
      const fd = new FormData(form);
      addCustomItem(catId, {
        title: fd.get('title'),
        price: fd.get('price'),
        url: fd.get('url'),
        image: fd.get('image'),
        note: fd.get('note')
      });
      form.reset();
      renderShopping();
      updateSummary();
      showToast?.('Товар добавлен');
    });
  });

  grid.querySelectorAll('.shop-item-select').forEach(btn => {
    btn.addEventListener('click', () => {
      toggleShopItemSelected(btn.dataset.id);
      renderShopping();
      updateSummary();
    });
  });

  grid.querySelectorAll('.shop-item-delete').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!confirm('Удалить этот товар?')) return;
      deleteShopItem(btn.dataset.id);
      renderShopping();
      updateSummary();
    });
  });

  updateSummary();
}

function updateSummary() {
  const list = document.getElementById('selectedList');
  const empty = document.getElementById('summaryEmpty');
  if (!list) return;

  const selected = getShopItems().filter(i => i.selected);
  list.innerHTML = selected.map(item => {
    const cat = getCategoryMeta(item.categoryId);
    const linkHtml = item.url
      ? ` <a class="summary-link" href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer" title="Открыть товар"><i class="fas fa-external-link-alt"></i></a>`
      : '';
  const pricePart = item.price ? ` — ${escapeHtml(item.price)}` : '';
    return `<li><strong>${escapeHtml(cat.title)}:</strong> ${escapeHtml(item.title)}${pricePart}${linkHtml}</li>`;
  }).join('');

  if (empty) empty.style.display = selected.length ? 'none' : 'block';
  const exportBtn = document.getElementById('exportShoppingBtn');
  if (exportBtn) exportBtn.style.display = selected.length ? 'inline-flex' : 'none';
}

function initShopping() {
  migrateLegacyShopData();
  renderShopping();
  loadAllShopPreviews?.();
}

function exportShoppingList() {
  const selected = getShopItems().filter(i => i.selected);
  const lines = ['🛒 Наш список к родам\n'];
  selected.forEach(item => {
    const cat = getCategoryMeta(item.categoryId);
    lines.push(`• ${cat.title}: ${item.title}${item.price ? ' (' + item.price + ')' : ''}${item.url ? '\n  ' + item.url : ''}`);
  });
  if (!selected.length) {
    getShopItems().forEach(item => {
      const cat = getCategoryMeta(item.categoryId);
      lines.push(`• ${cat.title}: ${item.title}${item.price ? ' (' + item.price + ')' : ''}${item.url ? '\n  ' + item.url : ''}`);
    });
  }
  copyToClipboard?.(lines.join('\n'));
}

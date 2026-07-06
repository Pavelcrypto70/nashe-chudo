/* Превью товаров Ozon / Wildberries через microlink */

const PREVIEW_CACHE_KEY = 'nashe_chudo_product_previews';

function getPreviewCache() {
  try {
    return JSON.parse(localStorage.getItem(PREVIEW_CACHE_KEY)) || {};
  } catch {
    return {};
  }
}

function savePreviewCache(cache) {
  localStorage.setItem(PREVIEW_CACHE_KEY, JSON.stringify(cache));
}

function cacheKeyForUrl(url) {
  return (url || '').split('?')[0].toLowerCase();
}

function getCachedPreview(url) {
  return getPreviewCache()[cacheKeyForUrl(url)] || null;
}

function setCachedPreview(url, preview) {
  if (!url || !preview) return;
  const cache = getPreviewCache();
  cache[cacheKeyForUrl(url)] = { ...preview, cachedAt: Date.now() };
  savePreviewCache(cache);
}

function extractPrice(text) {
  if (!text) return '';
  const m = String(text).match(/(\d[\d\s]*)\s*₽/);
  return m ? m[0].replace(/\s+/g, ' ') : '';
}

async function fetchProductPreview(url) {
  const normalized = typeof normalizeShopUrl === 'function' ? normalizeShopUrl(url) : url;
  if (!normalized) return null;

  const cached = getCachedPreview(normalized);
  if (cached?.image) return cached;

  try {
    const api = `https://api.microlink.io/?url=${encodeURIComponent(normalized)}&palette=false&audio=false&video=false`;
    const res = await fetch(api, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;
    const json = await res.json();
    const data = json.data || {};
    const preview = {
      title: data.title || '',
      image: data.image?.url || data.logo?.url || '',
      price: extractPrice(data.description) || extractPrice(data.title) || '',
      url: normalized
    };
    if (preview.image || preview.title) {
      setCachedPreview(normalized, preview);
      return preview;
    }
  } catch { /* сеть / блокировка */ }
  return null;
}

function renderProductPreviewCard(preview, url, compact) {
  if (!preview?.image && !preview?.title) return '';
  const mp = typeof detectMarketplace === 'function' ? detectMarketplace(url) : { name: 'Магазин', icon: 'fa-store' };
  const cls = compact ? 'product-preview product-preview--compact' : 'product-preview';
  const img = preview.image
    ? `<img src="${escapeHtml(preview.image)}" alt="" loading="lazy" onerror="this.closest('.product-preview').classList.add('no-img')">`
    : `<div class="product-preview-placeholder"><i class="fas ${mp.icon}"></i></div>`;
  return `<a href="${escapeHtml(url)}" class="${cls}" target="_blank" rel="noopener noreferrer">
    ${img}
    <div class="product-preview-body">
      <span class="product-preview-store"><i class="fas ${mp.icon}"></i> ${mp.name}</span>
      ${preview.title ? `<strong class="product-preview-title">${escapeHtml(preview.title)}</strong>` : ''}
      ${preview.price ? `<span class="product-preview-price">${escapeHtml(preview.price)}</span>` : ''}
    </div>
  </a>`;
}

async function refreshShopLinkPreview(categoryId, optionId, url) {
  const preview = await fetchProductPreview(url);
  if (!preview) return null;
  const map = getShopLinksMap();
  const entry = map[categoryId];
  if (entry && entry.optionId === optionId && entry.url === url) {
    entry.preview = preview;
    saveShopLinksMap(map);
  }
  return preview;
}

function loadAllShopPreviews() {
  const map = getShopLinksMap();
  Object.entries(map).forEach(([catId, entry]) => {
    if (!entry?.url) return;
    const cached = getCachedPreview(entry.url);
    if (cached && !entry.preview) {
      entry.preview = cached;
      saveShopLinksMap(map);
    }
    if (!entry.preview?.image) {
      refreshShopLinkPreview(catId, entry.optionId, entry.url).then(() => {
        if (typeof renderShopping === 'function') renderShopping();
      });
    }
  });
}

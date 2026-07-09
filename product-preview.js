/* Превью товаров Ozon / Wildberries */

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
  const m = String(text).match(/(\d[\d\s\u00a0]*)\s*₽/);
  if (m) return m[0].replace(/\s+/g, ' ').trim();
  const m2 = String(text).match(/(\d[\d\s\u00a0]{2,})\s*(?:руб|р\.)/i);
  return m2 ? m2[1].replace(/\s+/g, ' ').trim() + ' ₽' : '';
}

function normalizeShopUrl(raw) {
  let url = (raw || '').trim();
  if (!url) return '';
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  try {
    return new URL(url).href;
  } catch {
    return '';
  }
}

function detectMarketplace(url) {
  const u = (url || '').toLowerCase();
  if (u.includes('wildberries') || u.includes('wb.ru')) return { id: 'wildberries', name: 'Wildberries', icon: 'fa-bag-shopping' };
  if (u.includes('ozon')) return { id: 'ozon', name: 'Ozon', icon: 'fa-box' };
  if (u.includes('market.yandex') || u.includes('yandex.ru/market')) return { id: 'yandex', name: 'Яндекс Маркет', icon: 'fa-store' };
  if (u.includes('dns-shop') || u.includes('dns.ru')) return { id: 'dns', name: 'DNS', icon: 'fa-laptop' };
  if (u.includes('detmir')) return { id: 'detmir', name: 'Детский мир', icon: 'fa-child' };
  if (u.includes('lamoda')) return { id: 'lamoda', name: 'Lamoda', icon: 'fa-shirt' };
  return { id: 'other', name: 'Магазин', icon: 'fa-external-link-alt' };
}

function parseMarketplaceInput(raw) {
  const input = (raw || '').trim();
  if (!input) return null;

  if (/^\d{5,12}$/.test(input)) {
    const article = input;
    return {
      marketplace: 'wildberries',
      article,
      url: `https://www.wildberries.ru/catalog/${article}/detail.aspx`
    };
  }

  let url = input;
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  url = normalizeShopUrl(url);
  if (!url) return null;

  const wb = url.match(/wildberries\.ru\/catalog\/(\d+)/i) || url.match(/wb\.ru\/catalog\/(\d+)/i);
  if (wb) {
    return {
      marketplace: 'wildberries',
      article: wb[1],
      url: `https://www.wildberries.ru/catalog/${wb[1]}/detail.aspx`
    };
  }

  const ozon = url.match(/ozon\.ru\/product\/[^/?]+-(\d+)/i)
    || url.match(/ozon\.ru\/context\/detail\/id\/(\d+)/i)
    || url.match(/ozon\.ru\/t\/[^/?]+-(\d+)/i);
  if (ozon) {
    return {
      marketplace: 'ozon',
      article: ozon[1],
      url: url.split('?')[0]
    };
  }

  if (/ozon\.ru/i.test(url)) return { marketplace: 'ozon', article: '', url };
  if (/wildberries|wb\.ru/i.test(url)) return { marketplace: 'wildberries', article: '', url };

  return null;
}

async function fetchProductPreview(url) {
  const normalized = normalizeShopUrl(url);
  if (!normalized) return null;

  const parsed = parseMarketplaceInput(normalized);
  const cached = getCachedPreview(normalized);
  if (cached?.image) return cached;

  try {
    const api = `https://api.microlink.io/?url=${encodeURIComponent(normalized)}&palette=false&audio=false&video=false`;
    const res = await fetch(api, { signal: AbortSignal.timeout(12000) });
    if (!res.ok) return null;
    const json = await res.json();
    const data = json.data || {};
    const preview = {
      title: data.title || '',
      image: data.image?.url || data.logo?.url || '',
      price: extractPrice(data.description) || extractPrice(data.title) || '',
      article: parsed?.article || '',
      marketplace: parsed?.marketplace || detectMarketplace(normalized).id,
      url: normalized
    };
    if (preview.image || preview.title) {
      setCachedPreview(normalized, preview);
      return preview;
    }
  } catch { /* сеть / блокировка */ }
  return parsed ? { title: '', image: '', price: '', article: parsed.article, marketplace: parsed.marketplace, url: normalized } : null;
}

function renderProductPreviewCard(preview, url, compact) {
  if (!preview?.image && !preview?.title && !preview?.article) return '';
  const mp = detectMarketplace(url);
  const cls = compact ? 'product-preview product-preview--compact' : 'product-preview';
  const img = preview.image
    ? `<img src="${escapeHtml(preview.image)}" alt="" loading="lazy" onerror="this.closest('.product-preview').classList.add('no-img')">`
    : `<div class="product-preview-placeholder"><i class="fas ${mp.icon}"></i></div>`;
  const articleHtml = preview.article ? `<span class="product-preview-article">Арт. ${escapeHtml(preview.article)}</span>` : '';
  return `<a href="${escapeHtml(url)}" class="${cls}" target="_blank" rel="noopener noreferrer">
    ${img}
    <div class="product-preview-body">
      <span class="product-preview-store"><i class="fas ${mp.icon}"></i> ${mp.name}</span>
      ${preview.title ? `<strong class="product-preview-title">${escapeHtml(preview.title)}</strong>` : ''}
      ${articleHtml}
      ${preview.price ? `<span class="product-preview-price">${escapeHtml(preview.price)}</span>` : ''}
    </div>
  </a>`;
}

function loadAllShopPreviews() {
  if (typeof getShopItems !== 'function') return;
  getShopItems().forEach(item => {
    if (item.url && item.source === 'marketplace' && !item.image) {
      fetchProductPreview(item.url).then(preview => {
        if (!preview) return;
        updateShopItem(item.id, {
          title: item.title || preview.title,
          price: item.price || preview.price,
          image: preview.image,
          article: item.article || preview.article
        });
        if (typeof renderShopping === 'function') renderShopping();
      });
    }
  });
}

/* Превью товаров Ozon / Wildberries */

const PREVIEW_CACHE_KEY = 'nashe_chudo_product_previews';
const BAD_TITLE_RE = /^(почти готово|загрузка|loading|wildberries|вайлдберриз|ozon|озон|маркетплейс|интернет-магазин)/i;

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

function isValidProductTitle(title) {
  const t = (title || '').trim();
  if (t.length < 3) return false;
  if (BAD_TITLE_RE.test(t)) return false;
  return true;
}

function getCachedPreview(url) {
  const cached = getPreviewCache()[cacheKeyForUrl(url)];
  if (!cached) return null;
  if (!isValidProductTitle(cached.title) && !cached.price) return null;
  if (cached.image || (isValidProductTitle(cached.title) && cached.price)) return cached;
  return null;
}

function setCachedPreview(url, preview) {
  if (!url || !preview) return;
  if (!isValidProductTitle(preview.title) && !preview.price && !preview.image) return;
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

function formatRub(amount) {
  const n = Math.round(Number(amount) || 0);
  if (!n) return '';
  return n.toLocaleString('ru-RU') + ' ₽';
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

function getWbBasketHost(vol) {
  const ranges = [
    143, 287, 431, 719, 1007, 1061, 1115, 1169, 1313, 1601, 1655, 1919, 2045, 2189,
    2405, 2621, 2837, 3053, 3269, 3485, 3701, 3917, 4133, 4349, 4565, 4781, 4997,
    5213, 5429, 5645, 5861, 6077, 6293, 6509, 6725, 6941, 7157, 7373, 7589, 7805,
    8021, 8237, 8453, 8670, 8886, 9102, 9318, 9534
  ];
  for (let i = 0; i < ranges.length; i++) {
    if (vol <= ranges[i]) return String(i + 1).padStart(2, '0');
  }
  return String(ranges.length + 1).padStart(2, '0');
}

function wbImageUrl(nm) {
  const id = Number(nm);
  if (!id) return '';
  const vol = Math.floor(id / 100000);
  const part = Math.floor(id / 1000);
  const basket = getWbBasketHost(vol);
  return `https://basket-${basket}.wbbasket.ru/vol${vol}/part${part}/${id}/images/c516x688/1.webp`;
}

async function fetchWbPreview(article) {
  const nm = parseInt(article, 10);
  if (!nm) return null;
  const productUrl = `https://www.wildberries.ru/catalog/${nm}/detail.aspx`;
  try {
    const api = `https://card.wb.ru/cards/v4/detail?appType=1&curr=rub&dest=-1257786&spp=30&nm=${nm}`;
    const res = await fetch(api, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const json = await res.json();
    const p = json?.products?.[0];
    if (!p) return null;

    const size = p.sizes?.[0];
    const priceRaw = size?.price?.product || size?.price?.basic || size?.price?.sale;
    const price = priceRaw ? formatRub(priceRaw / 100) : '';
    const name = [p.brand, p.name].filter(Boolean).join(' — ') || p.name || '';
    const title = isValidProductTitle(name) ? name : (p.brand ? String(p.brand) : '');

    return {
      title,
      image: wbImageUrl(nm),
      price,
      article: String(nm),
      marketplace: 'wildberries',
      url: productUrl
    };
  } catch {
    return null;
  }
}

function parseOzonComposer(json, url, article) {
  const widgets = json?.widgetStates || {};
  let title = '';
  let price = '';
  let image = '';

  if (json?.seo?.title) {
    title = String(json.seo.title).replace(/\s+купить.*$/i, '').replace(/\s+на\s+Ozon.*$/i, '').trim();
  }

  Object.entries(widgets).forEach(([key, raw]) => {
    let w;
    try {
      w = typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch {
      return;
    }
    if (key.includes('webSale') || key.includes('webPrice') || key.includes('webProductHeading')) {
      const p = w?.cellTrackingInfo?.product || w?.product || w;
      if (p?.title && !title) title = p.title;
      const pr = p?.finalPrice ?? p?.price ?? p?.cardPrice ?? w?.price;
      if (pr && !price) {
        const num = Number(pr);
        price = formatRub(num > 99999 ? num / 100 : num);
      }
    }
    if (!image && (key.includes('webGallery') || key.includes('webProductGallery'))) {
      const img = w?.images?.[0]?.src || w?.images?.[0] || w?.coverImage || w?.image;
      if (img) image = img;
    }
  });

  return {
    title: isValidProductTitle(title) ? title : '',
    image: image || '',
    price,
    article: article || '',
    marketplace: 'ozon',
    url
  };
}

async function fetchOzonPreview(url, article) {
  try {
    const path = new URL(url).pathname;
    const api = `https://www.ozon.ru/api/composer-api.bx/page/json/v2?url=${encodeURIComponent(path)}`;
    const res = await fetch(api, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;
    const json = await res.json();
    return parseOzonComposer(json, url, article);
  } catch {
    return null;
  }
}

async function fetchMicrolinkPreview(url, parsed) {
  try {
    const api = `https://api.microlink.io/?url=${encodeURIComponent(url)}&palette=false&audio=false&video=false`;
    const res = await fetch(api, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    const json = await res.json();
    const data = json.data || {};
    const title = isValidProductTitle(data.title) ? data.title : '';
    const preview = {
      title,
      image: data.image?.url || data.logo?.url || '',
      price: extractPrice(data.description) || extractPrice(data.title) || '',
      article: parsed?.article || '',
      marketplace: parsed?.marketplace || detectMarketplace(url).id,
      url
    };
    if (!isValidProductTitle(preview.title)) preview.title = '';
    return preview;
  } catch {
    return null;
  }
}

function mergePreview(base, extra) {
  if (!extra) return base;
  return {
    title: (isValidProductTitle(extra.title) ? extra.title : '') || base?.title || '',
    image: extra.image || base?.image || '',
    price: extra.price || base?.price || '',
    article: extra.article || base?.article || '',
    marketplace: extra.marketplace || base?.marketplace || '',
    url: extra.url || base?.url || ''
  };
}

async function fetchProductPreview(url) {
  const normalized = normalizeShopUrl(url);
  if (!normalized) return null;

  const parsed = parseMarketplaceInput(normalized);
  const cached = getCachedPreview(normalized);
  if (cached) return cached;

  let preview = null;

  if (parsed?.marketplace === 'wildberries' && parsed.article) {
    preview = await fetchWbPreview(parsed.article);
  } else if (parsed?.marketplace === 'ozon') {
    preview = await fetchOzonPreview(normalized, parsed.article);
  }

  const needsMore = !preview || !isValidProductTitle(preview.title) || !preview.price;
  if (needsMore) {
    const micro = await fetchMicrolinkPreview(normalized, parsed);
    preview = mergePreview(preview, micro);
  }

  if (preview && (isValidProductTitle(preview.title) || preview.price || preview.image)) {
    if (!isValidProductTitle(preview.title)) preview.title = '';
    setCachedPreview(normalized, preview);
    return preview;
  }

  return parsed
    ? { title: '', image: '', price: '', article: parsed.article || '', marketplace: parsed.marketplace, url: normalized }
    : null;
}

function needsPreviewRefresh(item) {
  if (!item?.url || item.source === 'custom') return false;
  if (!item.image) return true;
  if (!item.price) return true;
  if (!isValidProductTitle(item.title)) return true;
  return false;
}

function applyPreviewToItem(item, preview) {
  if (!preview) return;
  const patch = {
    title: isValidProductTitle(preview.title) ? preview.title : (isValidProductTitle(item.title) ? item.title : (item.article ? `Арт. ${item.article}` : item.title)),
    price: preview.price || item.price || '',
    image: preview.image || item.image || '',
    article: item.article || preview.article || ''
  };
  if (isValidProductTitle(preview.title)) patch.title = preview.title;
  return patch;
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

function refreshItemPreview(item, updateFn, renderFn) {
  if (!needsPreviewRefresh(item)) return;
  fetchProductPreview(item.url).then(preview => {
    if (!preview) return;
    const patch = applyPreviewToItem(item, preview);
    if (!patch) return;
    updateFn(item.id, patch);
    if (typeof renderFn === 'function') renderFn();
  });
}

function loadAllShopPreviews() {
  if (typeof getShopItems !== 'function' || typeof updateShopItem !== 'function') return;
  getShopItems().forEach(item => {
    refreshItemPreview(item, updateShopItem, renderShopping);
  });
}

function loadAllGiftPreviews() {
  if (typeof getGiftItems !== 'function' || typeof updateGiftItem !== 'function') return;
  getGiftItems().forEach(item => {
    refreshItemPreview(item, updateGiftItem, renderGiftsWishlist);
  });
}

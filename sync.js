/* Облачная синхронизация — общая база для телефона, ПК и всех устройств (MantleDB) */

const SYNC_POLL_MS = 8000;
const SYNC_DEBOUNCE_MS = 1000;
const DEVICE_ID_KEY = 'nashe_chudo_device_id';

let lastRemoteAt = 0;
let lastPushAt = 0;
let applyingRemote = false;
let syncReady = false;
let syncStatus = 'off';
let pushTimer = null;
let pollTimer = null;
let origSetItem = null;

function getSyncConfig() {
  return CONFIG?.sync || {};
}

function isSyncConfigured() {
  const c = getSyncConfig();
  return Boolean(c.namespace && c.key && c.namespace !== 'YOUR_NAMESPACE');
}

const SYNC_BLOB_PATHS = {
  nashe_chudo_ultrasound: 'family/album/ultrasound',
  nashe_chudo_story_photos: 'family/album/story'
};
const ALBUM_ITEM_BLOB_PREFIX = 'family/album/item/';
const BLOB_MAX_CHARS = 120000;

function syncApiUrl() {
  const c = getSyncConfig();
  const path = c.path || 'family/sync';
  return `https://mantledb.sh/v2/${c.namespace}/${path}`;
}

function syncBlobUrl(path) {
  const c = getSyncConfig();
  return `https://mantledb.sh/v2/${c.namespace}/${path}`;
}

function syncAuthHeaders() {
  return { 'X-Mantle-Key': getSyncConfig().key };
}

function syncWriteHeaders() {
  return { ...syncAuthHeaders(), 'Content-Type': 'application/json' };
}

const SYNC_PROXIES = [
  url => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  url => `https://proxy.cors.sh/${url}`,
  url => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
  url => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`
];

function syncMirrorUrl() {
  return `sync-data.json?t=${Date.now()}`;
}

async function pullFromLocalMirror() {
  const urls = [
    syncMirrorUrl(),
    `https://raw.githubusercontent.com/Pavelcrypto70/nashe-chudo/main/sync-data.json?t=${Date.now()}`
  ];

  for (const url of urls) {
    try {
      const res = await fetchWithTimeout(url, { cache: 'no-store' }, 8000);
      if (!res.ok) continue;
      const data = await res.json();
      if (!data?.keys || payloadScore(data) < 1) continue;
      return data;
    } catch {
      /* try next source */
    }
  }
  return null;
}

async function pullFromPublicCloud() {
  try {
    const res = await fetchWithTimeout(syncApiUrl(), { method: 'GET' }, 8000);
    if (res.status === 404) return null;
    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.keys || payloadScore(data) < 1) return null;
    return data;
  } catch {
    return null;
  }
}

function fetchWithTimeout(url, options = {}, ms = 20000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { ...options, signal: ctrl.signal }).finally(() => clearTimeout(timer));
}

async function syncRequestUrl(targetUrl, method, body, { silent = false, allowProxy = true } = {}) {
  const headers = method === 'GET' ? syncAuthHeaders() : syncWriteHeaders();
  const init = { method, headers };
  if (body != null) init.body = JSON.stringify(body);

  const attempts = [
    () => fetchWithTimeout(targetUrl, init, allowProxy ? 20000 : 8000)
  ];
  if (allowProxy) {
    attempts.push(
      ...SYNC_PROXIES.map(proxy => () => fetchWithTimeout(proxy(targetUrl), init, 15000))
    );
  }

  let lastErr = null;
  for (const attempt of attempts) {
    try {
      const res = await attempt();
      if (res.status === 404) return res;
      if (res.ok) return res;
      lastErr = new Error(`HTTP ${res.status}`);
    } catch (err) {
      lastErr = err;
    }
  }

  if (!silent) console.warn('Sync request failed:', lastErr);
  throw lastErr || new Error('sync failed');
}

async function syncRequest(method, body, opts = {}) {
  return syncRequestUrl(syncApiUrl(), method, body, opts);
}

function getDeviceId() {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = 'dev_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

function getDeviceLabel() {
  return /iPhone|iPad|Android/i.test(navigator.userAgent) ? 'mobile' : 'desktop';
}

function payloadScore(payload) {
  if (!payload?.keys) return 0;
  let score = 0;
  Object.values(payload.keys).forEach(v => {
    if (v && typeof v === 'string') score += v.length;
  });
  return score;
}

function collectSyncPayload() {
  const keys = {};
  BACKUP_KEYS.forEach(key => {
    const val = localStorage.getItem(key);
    if (val != null) keys[key] = val;
  });
  return {
    updatedAt: Date.now(),
    keys,
    device: getDeviceLabel(),
    deviceId: getDeviceId()
  };
}

function pickBetterValue(a, b) {
  if (a == null && b == null) return null;
  if (a == null) return b;
  if (b == null) return a;
  return a.length >= b.length ? a : b;
}

function parseJsonSafe(str, fallback) {
  try { return JSON.parse(str || ''); } catch { return fallback; }
}

function mergeJsonObjects(remoteStr, localStr) {
  const remote = parseJsonSafe(remoteStr, {});
  const local = parseJsonSafe(localStr, {});
  if (!remote || typeof remote !== 'object' || Array.isArray(remote)) return pickBetterValue(remoteStr, localStr);
  if (!local || typeof local !== 'object' || Array.isArray(local)) return pickBetterValue(remoteStr, localStr);

  const merged = { ...remote };
  Object.entries(local).forEach(([key, localVal]) => {
    const remoteVal = remote[key];
    if (remoteVal == null) {
      merged[key] = localVal;
      return;
    }
    if (localVal == null) return;

    if (typeof localVal === 'object' && typeof remoteVal === 'object' && !Array.isArray(localVal) && !Array.isArray(remoteVal)) {
      merged[key] = { ...remoteVal, ...localVal };
      return;
    }

    const localScore = JSON.stringify(localVal).length;
    const remoteScore = JSON.stringify(remoteVal).length;
    merged[key] = localScore >= remoteScore ? localVal : remoteVal;
  });
  return JSON.stringify(merged);
}

function mergeNamesState(remoteStr, localStr) {
  const remote = parseJsonSafe(remoteStr, {});
  const local = parseJsonSafe(localStr, {});
  const merged = { ...remote };

  Object.entries(local).forEach(([key, localEntry]) => {
    const remoteEntry = remote[key];
    if (!remoteEntry) {
      merged[key] = localEntry;
      return;
    }
    if (localEntry?.hidden) {
      merged[key] = localEntry;
      return;
    }
    if (remoteEntry?.hidden) {
      merged[key] = remoteEntry;
      return;
    }

    const voteRank = v => (v === 'yes' ? 3 : v === 'maybe' ? 2 : v === 'no' ? 1 : 0);
    const localVote = localEntry?.vote;
    const remoteVote = remoteEntry?.vote;
    const vote = voteRank(localVote) >= voteRank(remoteVote) ? localVote : remoteVote;
    const updatedAt = [localEntry?.updatedAt, remoteEntry?.updatedAt].filter(Boolean).sort().pop();

    merged[key] = {
      ...remoteEntry,
      ...localEntry,
      name: localEntry?.name || remoteEntry?.name,
      gender: localEntry?.gender || remoteEntry?.gender,
      vote,
      updatedAt
    };
  });

  return JSON.stringify(merged);
}

function mergeJsonArraysById(remoteStr, localStr) {
  try {
    const r = JSON.parse(remoteStr || '[]');
    const l = JSON.parse(localStr || '[]');
    if (!Array.isArray(r) || !Array.isArray(l)) return pickBetterValue(remoteStr, localStr);
    const itemKey = item => item?.id || (item?.url ? item.url.slice(0, 120) : '');
    const map = new Map();
    l.forEach(item => {
      const k = itemKey(item);
      if (k) map.set(k, item);
    });
    r.forEach(item => {
      const k = itemKey(item);
      if (!k) return;
      const prev = map.get(k);
      if (!prev || String(item.updatedAt || item.date || '') >= String(prev.updatedAt || prev.date || '')) {
        map.set(k, item);
      }
    });
    return JSON.stringify([...map.values()]);
  } catch {
    return pickBetterValue(remoteStr, localStr);
  }
}

const MERGE_ARRAY_KEYS = [
  'nashe_chudo_shop_items',
  'nashe_chudo_gifts_wishlist',
  'nashe_chudo_ultrasound',
  'nashe_chudo_story_photos'
];

const MERGE_OBJECT_KEYS = [
  'nashe_chudo_settings',
  'nashe_chudo_checklists',
  'nashe_chudo_milestones',
  'nashe_chudo_calendar_done',
  'nashe_chudo_choices',
  'nashe_chudo_shop_links',
  'nashe_chudo_shop_custom',
  'nashe_chudo_growth',
  'nashe_chudo_savings',
  'nashe_chudo_child_wishes',
  'nashe_chudo_baby_log',
  'nashe_chudo_vaccines_done',
  'nashe_chudo_product_previews',
  'nashe_chudo_calendar_custom'
];

function mergePayloads(remote, local) {
  const keys = {};
  BACKUP_KEYS.forEach(key => {
    let merged;
    if (key === 'nashe_chudo_names') {
      merged = mergeNamesState(remote?.keys?.[key], local?.keys?.[key]);
    } else if (MERGE_ARRAY_KEYS.includes(key)) {
      merged = mergeJsonArraysById(remote?.keys?.[key], local?.keys?.[key]);
    } else if (MERGE_OBJECT_KEYS.includes(key)) {
      merged = mergeJsonObjects(remote?.keys?.[key], local?.keys?.[key]);
    } else {
      merged = pickBetterValue(remote?.keys?.[key], local?.keys?.[key]);
    }
    if (merged != null) keys[key] = merged;
  });
  return {
    keys,
    updatedAt: Date.now(),
    device: getDeviceLabel(),
    deviceId: getDeviceId()
  };
}

function applyCloudSnapshot(remote) {
  if (!remote?.keys) return false;

  applyingRemote = true;
  if (remote.updatedAt) lastRemoteAt = remote.updatedAt;

  BACKUP_KEYS.forEach(key => {
    if (!Object.prototype.hasOwnProperty.call(remote.keys, key)) return;
    const val = remote.keys[key];
    if (val == null) return;
    try {
      origSetItem(key, val);
    } catch (err) {
      console.warn('Sync skip key (quota?):', key, err);
    }
  });

  applyingRemote = false;
  return true;
}

function applySyncPayload(data, force = false) {
  if (!data?.keys) return false;
  if (!force && data.updatedAt && data.updatedAt <= lastRemoteAt) return false;

  applyingRemote = true;
  if (data.updatedAt) lastRemoteAt = data.updatedAt;

  BACKUP_KEYS.forEach(key => {
    if (!Object.prototype.hasOwnProperty.call(data.keys, key)) return;
    const val = data.keys[key];
    if (val == null) return;
    try {
      origSetItem(key, val);
    } catch (err) {
      console.warn('Sync skip key (quota?):', key, err);
    }
  });

  applyingRemote = false;
  return true;
}

function scheduleSyncPush() {
  if (applyingRemote) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => pushSyncToCloud(false), SYNC_DEBOUNCE_MS);
}

function albumItemBlobPath(itemId) {
  return `${ALBUM_ITEM_BLOB_PREFIX}${itemId}`;
}

function stripAlbumDataUrls(items) {
  return (items || []).map(item => {
    if (!item?.url || !String(item.url).startsWith('data:')) return item;
    return { ...item, url: '', cloudRef: item.id || item.cloudRef || '' };
  });
}

async function hydrateAlbumItems(items) {
  const hydrated = [];
  for (const item of items || []) {
    if (!item) continue;
    if (item.url && !item.cloudRef) {
      hydrated.push(item);
      continue;
    }
    const ref = item.cloudRef || item.id;
    if (!ref) {
      hydrated.push(item);
      continue;
    }
    try {
      const res = await syncRequestUrl(syncBlobUrl(albumItemBlobPath(ref)), 'GET', null, { silent: true, allowProxy: true });
      if (!res.ok) {
        hydrated.push(item);
        continue;
      }
      const data = await res.json();
      hydrated.push({ ...item, url: data?.value || item.url || '', cloudRef: ref });
    } catch {
      hydrated.push(item);
    }
  }
  return hydrated;
}

async function pullAlbumBlobs() {
  const out = {};
  for (const [key, path] of Object.entries(SYNC_BLOB_PATHS)) {
    try {
      const res = await syncRequestUrl(syncBlobUrl(path), 'GET', null, { silent: true, allowProxy: true });
      if (!res.ok) continue;
      const data = await res.json();
      if (!data?.value) continue;
      const items = parseJsonSafe(data.value, null);
      if (Array.isArray(items)) {
        const hydrated = await hydrateAlbumItems(items);
        out[key] = JSON.stringify(hydrated);
      } else {
        out[key] = data.value;
      }
    } catch { /* try next blob */ }
  }
  return out;
}

async function pushAlbumItemBlob(item, opts = {}) {
  if (!item?.id || !item?.url || !String(item.url).startsWith('data:')) return;
  const body = {
    updatedAt: Date.now(),
    deviceId: getDeviceId(),
    device: getDeviceLabel(),
    value: item.url
  };
  await syncRequestUrl(syncBlobUrl(albumItemBlobPath(item.id)), 'POST', body, { silent: true, allowProxy: true, ...opts });
}

async function pushAlbumBlobs(keys, opts = {}) {
  for (const [key, path] of Object.entries(SYNC_BLOB_PATHS)) {
    const val = keys?.[key];
    if (!val || val.length < 3) continue;

    const items = parseJsonSafe(val, null);
    if (!Array.isArray(items)) {
      if (val.length > BLOB_MAX_CHARS) continue;
      const body = {
        updatedAt: Date.now(),
        deviceId: getDeviceId(),
        device: getDeviceLabel(),
        value: val
      };
      await syncRequestUrl(syncBlobUrl(path), 'POST', body, { silent: true, allowProxy: true, ...opts });
      continue;
    }

    for (const item of items) {
      try { await pushAlbumItemBlob(item, opts); } catch { /* skip item */ }
    }

    const lean = JSON.stringify(stripAlbumDataUrls(items));
    const body = {
      updatedAt: Date.now(),
      deviceId: getDeviceId(),
      device: getDeviceLabel(),
      value: lean
    };
    await syncRequestUrl(syncBlobUrl(path), 'POST', body, { silent: true, allowProxy: true, ...opts });
  }
}

async function pullRemoteForMerge() {
  let main = await pullFromLocalMirror();

  if (!main?.keys) {
    try {
      const res = await syncRequest('GET', null, { silent: true, allowProxy: true });
      if (res.ok) main = await res.json();
    } catch { /* fallback */ }
  }

  if (!main?.keys) main = { keys: {}, updatedAt: 0 };

  const blobs = await pullAlbumBlobs();
  main.keys = { ...main.keys, ...blobs };
  return payloadScore(main) > 0 ? main : null;
}

async function pushPayloadToCloud(payload, { silent = false, allowProxy = true } = {}) {
  lastPushAt = payload.updatedAt;
  const leanKeys = { ...payload.keys };
  Object.keys(SYNC_BLOB_PATHS).forEach(k => delete leanKeys[k]);
  const lean = { ...payload, keys: leanKeys };
  const res = await syncRequest('POST', lean, { silent, allowProxy });
  if (!res.ok) throw new Error('push failed');
  await pushAlbumBlobs(payload.keys, { silent: true, allowProxy: true });
  syncStatus = 'live';
  updateSyncStatusUI();
}

async function pushSyncToCloud(allowOverwrite = false) {
  if (!isSyncConfigured() || applyingRemote) return;

  const local = collectSyncPayload();
  if (payloadScore(local) < 1) return;

  try {
    if (!allowOverwrite) {
      const remote = await pullRemoteForMerge();
      if (remote?.keys) {
        const remoteScore = payloadScore(remote);
        const localScore = payloadScore(local);

        if (remoteScore > localScore + 50) {
          const merged = mergePayloads(remote, local);
          applySyncPayload(merged, true);
          refreshAfterSync();
          return;
        }

        const merged = mergePayloads(remote, local);
        await pushPayloadToCloud(merged);
        return;
      }
    }

    await pushPayloadToCloud(local);
  } catch {
    syncStatus = 'error';
    updateSyncStatusUI();
  }
}

async function pullSyncFromCloud({ silent = false } = {}) {
  if (!isSyncConfigured()) return null;

  const live = await pullRemoteForMerge();
  if (live) return live;

  if (!silent) {
    syncStatus = 'error';
    updateSyncStatusUI();
  }
  return null;
}

function patchLocalStorageForSync() {
  if (origSetItem) return;
  origSetItem = localStorage.setItem.bind(localStorage);
  localStorage.setItem = function (key, value) {
    origSetItem(key, value);
    if (BACKUP_KEYS.includes(key) && !applyingRemote) scheduleSyncPush();
  };
}

function payloadsDiffer(a, b) {
  if (!a?.keys || !b?.keys) return true;
  return BACKUP_KEYS.some(key => (a.keys[key] || '') !== (b.keys[key] || ''));
}

async function runAutoSync({ refresh = false } = {}) {
  if (!isSyncConfigured() || applyingRemote) return false;

  const local = collectSyncPayload();
  const remote = await pullRemoteForMerge();
  let changed = false;

  if (remote?.keys && payloadScore(remote) > 0) {
    const merged = mergePayloads(remote, local);
    if (payloadsDiffer(merged, local)) {
      changed = applySyncPayload(merged, true);
    }
    try {
      await pushPayloadToCloud(merged, { silent: true });
      syncStatus = 'live';
    } catch {
      syncStatus = changed ? 'live' : 'error';
    }
  } else if (payloadScore(local) > 0) {
    try {
      await pushPayloadToCloud(local, { silent: true });
      lastRemoteAt = local.updatedAt;
      syncStatus = 'live';
    } catch {
      syncStatus = 'error';
    }
  }

  if (changed && refresh) refreshAfterSync();
  updateSyncStatusUI();
  return changed;
}

function refreshAfterSync() {
  if (typeof refreshAllData === 'function') refreshAllData();
  else location.reload();
}

function startSyncPolling() {
  clearInterval(pollTimer);
  pollTimer = setInterval(async () => {
    if (!syncReady || document.hidden) return;

    const remote = await pullRemoteForMerge();
    if (!remote?.keys) return;

    const isOwnEcho = remote.deviceId === getDeviceId()
      && Math.abs(remote.updatedAt - lastPushAt) < 1500;
    if (isOwnEcho) return;

    const local = collectSyncPayload();
    const merged = mergePayloads(remote, local);
    if (!payloadsDiffer(merged, local)) return;

    if (applySyncPayload(merged, true)) {
      refreshAfterSync();
      showToast?.('Обновлено с другого устройства');
    }
  }, SYNC_POLL_MS);

  document.addEventListener('visibilitychange', async () => {
    if (!document.hidden && syncReady) await runAutoSync({ refresh: true });
  });
}

async function initSync() {
  if (!isSyncConfigured()) {
    syncStatus = 'off';
    updateSyncStatusUI();
    return;
  }

  patchLocalStorageForSync();
  syncStatus = 'connecting';
  updateSyncStatusUI();

  try {
    const changed = await runAutoSync({ refresh: true });
    syncReady = true;
    startSyncPolling();
    if (!changed && syncStatus === 'error') syncStatus = 'live';
  } catch (err) {
    console.error('Sync error:', err);
    syncReady = true;
    syncStatus = 'error';
    startSyncPolling();
  }

  updateSyncStatusUI();
}

function updateSyncStatusUI() {
  const el = document.getElementById('syncStatus');
  if (!el) return;

  const meta = {
    off: { icon: 'fa-cloud-slash', text: 'Синхронизация не настроена' },
    connecting: { icon: 'fa-spinner fa-spin', text: 'Загружаем общие данные...' },
    live: { icon: 'fa-cloud', text: 'Общая база — синхронизация автоматическая (~8 сек)' },
    error: { icon: 'fa-cloud', text: 'Синхронизация в фоне — данные сохраняются на этом устройстве' }
  }[syncStatus] || { icon: 'fa-cloud', text: '' };

  el.className = 'sync-status sync-status--' + syncStatus;
  el.innerHTML = `<i class="fas ${meta.icon}"></i><span>${meta.text}</span>`;
}

async function forceSyncNow() {
  syncStatus = 'connecting';
  updateSyncStatusUI();
  await runAutoSync({ refresh: true });
  syncReady = true;
  updateSyncStatusUI();
}

async function forcePushNow() {
  await forceSyncNow();
}

function notifyDataChanged() {
  scheduleSyncPush();
}

window.updateSyncStatus = updateSyncStatusUI;
window.forceSyncNow = forceSyncNow;
window.forcePushNow = forcePushNow;
window.notifyDataChanged = notifyDataChanged;

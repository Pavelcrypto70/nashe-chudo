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

function syncApiUrl() {
  const c = getSyncConfig();
  const path = c.path || 'family/sync';
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

async function syncRequest(method, body, { silent = false, allowProxy = false } = {}) {
  const url = syncApiUrl();
  const headers = method === 'GET' ? syncAuthHeaders() : syncWriteHeaders();
  const init = { method, headers };
  if (body != null) init.body = JSON.stringify(body);

  const attempts = [
    () => fetchWithTimeout(url, init, allowProxy ? 15000 : 8000)
  ];
  if (allowProxy) {
    attempts.push(
      ...SYNC_PROXIES.map(proxy => () => fetchWithTimeout(proxy(url), init, 12000))
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

function mergeJsonArraysById(remoteStr, localStr) {
  try {
    const r = JSON.parse(remoteStr || '[]');
    const l = JSON.parse(localStr || '[]');
    if (!Array.isArray(r) || !Array.isArray(l)) return pickBetterValue(remoteStr, localStr);
    const map = new Map();
    l.forEach(item => { if (item?.id) map.set(item.id, item); });
    r.forEach(item => {
      if (!item?.id) return;
      const prev = map.get(item.id);
      if (!prev || String(item.updatedAt || '') >= String(prev.updatedAt || '')) map.set(item.id, item);
    });
    return JSON.stringify([...map.values()]);
  } catch {
    return pickBetterValue(remoteStr, localStr);
  }
}

const MERGE_ARRAY_KEYS = ['nashe_chudo_shop_items'];

function mergePayloads(remote, local) {
  const keys = {};
  BACKUP_KEYS.forEach(key => {
    let merged;
    if (MERGE_ARRAY_KEYS.includes(key)) {
      merged = mergeJsonArraysById(remote?.keys?.[key], local?.keys?.[key]);
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
  if (!syncReady || applyingRemote) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => pushSyncToCloud(false), SYNC_DEBOUNCE_MS);
}

async function pullRemoteForMerge() {
  try {
    const res = await syncRequest('GET', null, { silent: true, allowProxy: true });
    if (res.status === 404) return null;
    if (res.ok) {
      const data = await res.json();
      if (data?.keys && payloadScore(data) > 0) return data;
    }
  } catch { /* fallback to mirror */ }
  return pullFromLocalMirror();
}

async function pushPayloadToCloud(payload, { silent = false, allowProxy = true } = {}) {
  lastPushAt = payload.updatedAt;
  const res = await syncRequest('POST', payload, { silent, allowProxy });
  if (!res.ok) throw new Error('push failed');
  syncStatus = 'live';
  updateSyncStatusUI();
}

async function pushSyncToCloud(allowOverwrite = false) {
  if (!isSyncConfigured() || applyingRemote) return;

  const local = collectSyncPayload();
  if (payloadScore(local) < 10) return;

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
  } else if (payloadScore(local) > 10) {
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
      && Math.abs(remote.updatedAt - lastPushAt) < 5000;
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

window.updateSyncStatus = updateSyncStatusUI;
window.forceSyncNow = forceSyncNow;
window.forcePushNow = forcePushNow;

/* Облачная синхронизация — общая база для телефона, ПК и всех устройств (MantleDB) */

const SYNC_POLL_MS = 4000;
const SYNC_DEBOUNCE_MS = 2000;
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
  url => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`
];

function fetchWithTimeout(url, options = {}, ms = 20000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { ...options, signal: ctrl.signal }).finally(() => clearTimeout(timer));
}

async function syncRequest(method, body, { silent = false } = {}) {
  const url = syncApiUrl();
  const headers = method === 'GET' ? syncAuthHeaders() : syncWriteHeaders();
  const init = { method, headers };
  if (body != null) init.body = JSON.stringify(body);

  const attempts = [
    () => fetchWithTimeout(url, init),
    ...SYNC_PROXIES.map(proxy => () => fetchWithTimeout(proxy(url), init))
  ];

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

function mergePayloads(remote, local) {
  const keys = {};
  BACKUP_KEYS.forEach(key => {
    const merged = pickBetterValue(remote?.keys?.[key], local?.keys?.[key]);
    if (merged != null) keys[key] = merged;
  });
  return {
    keys,
    updatedAt: Date.now(),
    device: getDeviceLabel(),
    deviceId: getDeviceId()
  };
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

async function pushPayloadToCloud(payload, { silent = false } = {}) {
  lastPushAt = payload.updatedAt;
  const res = await syncRequest('POST', payload, { silent });
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
      const remote = await pullSyncFromCloud();
      if (remote?.keys) {
        const remoteScore = payloadScore(remote);
        const localScore = payloadScore(local);

        if (remoteScore > localScore) {
          applySyncPayload(remote, true);
          refreshAfterSync();
          return;
        }

        if (remoteScore === localScore && remote.updatedAt >= local.updatedAt) {
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
  try {
    const res = await syncRequest('GET', null, { silent });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error('pull failed');
    return res.json();
  } catch {
    if (!silent) {
      syncStatus = 'error';
      updateSyncStatusUI();
    }
    return null;
  }
}

function patchLocalStorageForSync() {
  if (origSetItem) return;
  origSetItem = localStorage.setItem.bind(localStorage);
  localStorage.setItem = function (key, value) {
    origSetItem(key, value);
    if (BACKUP_KEYS.includes(key) && !applyingRemote) scheduleSyncPush();
  };
}

function refreshAfterSync() {
  if (typeof refreshAllData === 'function') refreshAllData();
  else location.reload();
}

function startSyncPolling() {
  clearInterval(pollTimer);
  pollTimer = setInterval(async () => {
    if (!syncReady) return;

    const remote = await pullSyncFromCloud({ silent: true });
    if (!remote?.keys) return;

    const local = collectSyncPayload();
    const remoteScore = payloadScore(remote);
    const localScore = payloadScore(local);
    const isOwnEcho = remote.deviceId === getDeviceId() && Math.abs(remote.updatedAt - lastPushAt) < 3000;

    if (isOwnEcho) return;

    const shouldPull = remote.updatedAt > lastRemoteAt
      || remoteScore > localScore + 20;

    if (!shouldPull) return;

    const changed = applySyncPayload(remote, true);
    if (changed) {
      refreshAfterSync();
      showToast?.('Обновлено с другого устройства');
    }
  }, SYNC_POLL_MS);

  document.addEventListener('visibilitychange', async () => {
    if (!document.hidden && syncReady) await forceSyncNow();
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
    const remote = await pullSyncFromCloud();
    const local = collectSyncPayload();

    if (remote?.keys && payloadScore(remote) > 0) {
      const remoteScore = payloadScore(remote);
      const localScore = payloadScore(local);

      if (remoteScore >= localScore) {
        applySyncPayload(remote, true);
      } else {
        const merged = mergePayloads(remote, local);
        applySyncPayload(merged, true);
        await pushPayloadToCloud(merged);
      }
    } else if (payloadScore(local) > 50) {
      await pushPayloadToCloud(local);
      lastRemoteAt = local.updatedAt;
    }

    syncReady = true;
    syncStatus = 'live';
    startSyncPolling();
  } catch (err) {
    console.error('Sync error:', err);
    syncStatus = 'error';
  }

  updateSyncStatusUI();
}

function updateSyncStatusUI() {
  const el = document.getElementById('syncStatus');
  if (!el) return;

  const meta = {
    off: { icon: 'fa-cloud-slash', text: 'Синхронизация не настроена' },
    connecting: { icon: 'fa-spinner fa-spin', text: 'Загружаем общие данные...' },
    live: { icon: 'fa-cloud', text: 'Общая база работает — изменения синхронизируются' },
    error: { icon: 'fa-triangle-exclamation', text: 'Облако недоступно (не интернет!) — нажмите «Загрузить из облака» или «Сбросить кэш»' }
  }[syncStatus] || { icon: 'fa-cloud', text: '' };

  el.className = 'sync-status sync-status--' + syncStatus;
  el.innerHTML = `<i class="fas ${meta.icon}"></i><span>${meta.text}</span>`;
}

async function forceSyncNow() {
  if (!isSyncConfigured()) {
    showToast?.('Синхронизация не настроена');
    return;
  }

  syncStatus = 'connecting';
  updateSyncStatusUI();

  try {
    const remote = await pullSyncFromCloud();
    if (!remote?.keys || payloadScore(remote) < 1) {
      showToast?.('В облаке пока нет данных');
      syncStatus = syncReady ? 'live' : 'error';
      updateSyncStatusUI();
      return;
    }

    const local = collectSyncPayload();
    const remoteScore = payloadScore(remote);
    const localScore = payloadScore(local);

    if (remoteScore >= localScore) {
      applySyncPayload(remote, true);
    } else {
      const merged = mergePayloads(remote, local);
      applySyncPayload(merged, true);
    }

    syncReady = true;
    syncStatus = 'live';
    refreshAfterSync();
    showToast?.('Данные из облака загружены');
  } catch {
    syncStatus = 'error';
    showToast?.('Не удалось загрузить из облака');
  }

  updateSyncStatusUI();
}

window.updateSyncStatus = updateSyncStatusUI;
window.forceSyncNow = forceSyncNow;

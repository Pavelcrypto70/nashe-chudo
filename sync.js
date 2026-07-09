/* Облачная синхронизация — общая база для телефона, ПК и всех устройств (MantleDB) */

const SYNC_POLL_MS = 4000;
const SYNC_DEBOUNCE_MS = 1200;

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

function syncHeaders() {
  return {
    'Content-Type': 'application/json',
    'X-Mantle-Key': getSyncConfig().key
  };
}

function fetchWithTimeout(url, options = {}, ms = 8000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { ...options, signal: ctrl.signal }).finally(() => clearTimeout(timer));
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
    device: /iPhone|iPad|Android/i.test(navigator.userAgent) ? 'mobile' : 'desktop'
  };
}

function applySyncPayload(data) {
  if (!data?.keys) return false;
  if (data.updatedAt <= lastRemoteAt) return false;

  applyingRemote = true;
  lastRemoteAt = data.updatedAt;
  BACKUP_KEYS.forEach(key => {
    if (!Object.prototype.hasOwnProperty.call(data.keys, key)) return;
    try {
      origSetItem(key, data.keys[key]);
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
  pushTimer = setTimeout(pushSyncToCloud, SYNC_DEBOUNCE_MS);
}

async function pushSyncToCloud() {
  if (!isSyncConfigured()) return;
  const payload = collectSyncPayload();
  lastPushAt = payload.updatedAt;
  try {
    const res = await fetchWithTimeout(syncApiUrl(), {
      method: 'POST',
      headers: syncHeaders(),
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('push failed');
    syncStatus = 'live';
    updateSyncStatusUI();
  } catch {
    syncStatus = 'error';
    updateSyncStatusUI();
  }
}

async function pullSyncFromCloud() {
  if (!isSyncConfigured()) return null;
  try {
    const res = await fetchWithTimeout(syncApiUrl(), { headers: syncHeaders() });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error('pull failed');
    return res.json();
  } catch {
    syncStatus = 'error';
    updateSyncStatusUI();
    return null;
  }
}

function patchLocalStorageForSync() {
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
    if (document.hidden || !syncReady) return;
    const remote = await pullSyncFromCloud();
    if (!remote?.keys) return;
    if (Math.abs(remote.updatedAt - lastPushAt) < 500) return;
    if (remote.updatedAt <= lastRemoteAt) return;
    const changed = applySyncPayload(remote);
    if (changed) {
      refreshAfterSync();
      showToast?.('Обновлено с другого устройства');
    }
  }, SYNC_POLL_MS);

  document.addEventListener('visibilitychange', async () => {
    if (!document.hidden && syncReady) {
      const remote = await pullSyncFromCloud();
      if (remote?.keys && remote.updatedAt > lastRemoteAt) {
        if (applySyncPayload(remote)) refreshAfterSync();
      }
    }
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

    if (remote?.keys) {
      applySyncPayload(remote);
    } else {
      const payload = collectSyncPayload();
      lastPushAt = payload.updatedAt;
      lastRemoteAt = payload.updatedAt;
      await pushSyncToCloud();
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
    connecting: { icon: 'fa-spinner fa-spin', text: 'Подключаем общую базу...' },
    live: { icon: 'fa-cloud', text: 'Общая база работает — телефон и ПК синхронизируются' },
    error: { icon: 'fa-triangle-exclamation', text: 'Не удалось связаться с облаком — проверьте интернет' }
  }[syncStatus] || { icon: 'fa-cloud', text: '' };

  el.className = 'sync-status sync-status--' + syncStatus;
  el.innerHTML = `<i class="fas ${meta.icon}"></i><span>${meta.text}</span>`;
}

async function forceSyncNow() {
  if (!syncReady) {
    showToast?.('Синхронизация не подключена');
    return;
  }
  await pushSyncToCloud();
  const remote = await pullSyncFromCloud();
  if (remote?.keys && remote.updatedAt > lastRemoteAt) {
    if (applySyncPayload(remote)) refreshAfterSync();
  }
  showToast?.('Синхронизировано');
}

window.updateSyncStatus = updateSyncStatusUI;
window.forceSyncNow = forceSyncNow;

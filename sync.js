/* Облачная синхронизация — одна база для телефона, ПК и всех устройств */

const SYNC_DEBOUNCE_MS = 1200;
let syncRef = null;
let lastRemoteAt = 0;
let lastPushAt = 0;
let applyingRemote = false;
let syncReady = false;
let syncStatus = 'off';
let pushTimer = null;
let origSetItem = null;

function isSyncConfigured() {
  const fb = CONFIG?.sync?.firebase;
  return Boolean(
    fb?.apiKey &&
    fb?.databaseURL &&
    fb.apiKey !== 'YOUR_API_KEY' &&
    !String(fb.databaseURL).includes('YOUR_PROJECT')
  );
}

function getSyncPath() {
  return 'families/' + (CONFIG.sync?.familyId || 'nashe_chudo_family');
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
    if (Object.prototype.hasOwnProperty.call(data.keys, key)) {
      origSetItem(key, data.keys[key]);
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

function pushSyncToCloud() {
  if (!syncRef) return;
  const payload = collectSyncPayload();
  lastPushAt = payload.updatedAt;
  syncRef.set(payload)
    .then(() => {
      syncStatus = 'live';
      updateSyncStatusUI();
    })
    .catch(() => {
      syncStatus = 'error';
      updateSyncStatusUI();
    });
}

function patchLocalStorageForSync() {
  origSetItem = localStorage.setItem.bind(localStorage);
  localStorage.setItem = function (key, value) {
    origSetItem(key, value);
    if (BACKUP_KEYS.includes(key) && !applyingRemote) scheduleSyncPush();
  };
}

function refreshAfterSync() {
  if (typeof refreshAllData === 'function') {
    refreshAllData();
  } else {
    location.reload();
  }
}

async function initSync() {
  if (!isSyncConfigured()) {
    syncStatus = 'off';
    updateSyncStatusUI();
    return;
  }
  if (typeof firebase === 'undefined') {
    syncStatus = 'error';
    updateSyncStatusUI();
    return;
  }

  patchLocalStorageForSync();
  syncStatus = 'connecting';
  updateSyncStatusUI();

  try {
    if (!firebase.apps.length) firebase.initializeApp(CONFIG.sync.firebase);
    syncRef = firebase.database().ref(getSyncPath());

    const snapshot = await syncRef.once('value');
    const remote = snapshot.val();

    if (remote?.keys) {
      applySyncPayload(remote);
    } else {
      const payload = collectSyncPayload();
      lastPushAt = payload.updatedAt;
      lastRemoteAt = payload.updatedAt;
      await syncRef.set(payload);
    }

    syncRef.on('value', snap => {
      const data = snap.val();
      if (!data?.keys || applyingRemote) return;
      if (Math.abs(data.updatedAt - lastPushAt) < 500) return;
      if (data.updatedAt <= lastRemoteAt) return;

      const changed = applySyncPayload(data);
      if (!changed) return;

      refreshAfterSync();
      if (typeof showToast === 'function') showToast('Обновлено с другого устройства');
    });

    syncReady = true;
    syncStatus = 'live';
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
    off: { icon: 'fa-cloud-slash', text: 'Синхронизация не настроена — данные только на этом устройстве' },
    connecting: { icon: 'fa-spinner fa-spin', text: 'Подключаем общую базу...' },
    live: { icon: 'fa-cloud', text: 'Общая база работает — телефон и ПК синхронизируются' },
    error: { icon: 'fa-triangle-exclamation', text: 'Не удалось подключиться к облаку — проверьте Firebase в CONFIG' }
  }[syncStatus] || { icon: 'fa-cloud', text: '' };

  el.className = 'sync-status sync-status--' + syncStatus;
  el.innerHTML = `<i class="fas ${meta.icon}"></i><span>${meta.text}</span>`;
}

function forceSyncNow() {
  if (!syncReady) {
    showToast?.('Синхронизация не подключена');
    return;
  }
  pushSyncToCloud();
  showToast?.('Отправлено в облако');
}

window.updateSyncStatus = updateSyncStatusUI;
window.forceSyncNow = forceSyncNow;

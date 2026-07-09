/* Настройки сайта — ПДР, дата рождения, реквизиты */

const SETTINGS_KEY = 'nashe_chudo_settings';

const DEFAULT_SETTINGS = {
  dueDate: null,
  birthDate: null,
  babyName: '',
  giftHolder: '',
  giftBank: '',
  giftAccount: '',
  giftNote: 'Если хотите помочь подарком — можно перевести на счёт. Спасибо от всего сердца!',
  hospitalName: 'Областная клиническая больница (ОКБ)',
  hospitalAddress: 'г. Томск, ул. И. Черных, 96',
  hospitalPhone: '8 (3822) 90-20-20',
  hospitalNotes: 'Уточните телефон роддома при записи. Сумку собрать заранее — чек-лист в разделе «Чек-листы».'
};

function getSettings() {
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY)) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function saveSettings(partial) {
  const next = { ...getSettings(), ...partial };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  return next;
}

function getEffectiveDueDate() {
  const s = getSettings();
  if (s.dueDate) return parseDate(s.dueDate);
  if (CONFIG.dueDate) return parseDate(CONFIG.dueDate);
  const lmp = getLMP();
  const due = new Date(lmp);
  due.setDate(due.getDate() + 280);
  return due;
}

function getBirthDateStr() {
  return getSettings().birthDate || null;
}

function isBabyBorn() {
  return Boolean(getBirthDateStr());
}

function getBabyAgeDays() {
  const bd = getBirthDateStr();
  if (!bd) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return daysBetween(parseDate(bd), today);
}

function initSettings() {
  applyPersonalization();
  renderSettingsPanel();
  bindSettingsForm();
  registerServiceWorker();
  setupPwaInstall();
}

function applyPersonalization() {
  const s = getSettings();
  const wife = CONFIG.wifeName || 'Ира';
  const husband = CONFIG.husbandName || 'Павел';

  document.querySelectorAll('.hero-title em').forEach(el => { el.textContent = wife; });
  const eyebrow = document.querySelector('.hero-eyebrow');
  if (eyebrow) eyebrow.textContent = `С любовью, ${husband}`;

  const sign = document.querySelector('.story-sign');
  if (sign) sign.textContent = `— ${husband}`;

  const footerFrom = document.querySelector('.footer-from strong');
  if (footerFrom) footerFrom.textContent = husband;

  if (s.babyName && isBabyBorn()) {
    const lead = document.querySelector('.hero-lead');
    if (lead) lead.textContent = `${s.babyName} с нами! Этот сайт — наш семейный путеводитель.`;
  }
}

function renderSettingsPanel() {
  const panel = document.getElementById('settingsPanel');
  if (!panel) return;
  const s = getSettings();

  panel.innerHTML = `
    <div class="settings-grid">
      <div class="settings-card">
        <h3><i class="fas fa-calendar-heart"></i> Даты</h3>
        <label class="settings-field">
          <span>ПДР (точная с УЗИ)</span>
          <input type="date" id="setDueDate" value="${s.dueDate || ''}">
        </label>
        <label class="settings-field">
          <span>Дата рождения малыша</span>
          <input type="date" id="setBirthDate" value="${s.birthDate || ''}">
        </label>
        <label class="settings-field">
          <span>Имя малыша (после родов)</span>
          <input type="text" id="setBabyName" value="${escapeAttr(s.babyName)}" placeholder="Когда решите — впишите">
        </label>
        <button type="button" class="btn-wish btn-wish-primary" id="saveDatesBtn"><i class="fas fa-check"></i> Сохранить даты</button>
      </div>
      <div class="settings-card">
        <h3><i class="fas fa-gift"></i> Реквизиты для подарков</h3>
        <label class="settings-field"><span>Получатель</span><input type="text" id="setGiftHolder" value="${escapeAttr(s.giftHolder)}" placeholder="Иванова Ирина Петровна"></label>
        <label class="settings-field"><span>Банк</span><input type="text" id="setGiftBank" value="${escapeAttr(s.giftBank)}" placeholder="Сбербанк"></label>
        <label class="settings-field"><span>Номер счёта / карты</span><input type="text" id="setGiftAccount" value="${escapeAttr(s.giftAccount)}" placeholder="4081..."></label>
        <label class="settings-field"><span>Заметка для родных</span><textarea id="setGiftNote" rows="2">${escapeHtml(s.giftNote)}</textarea></label>
        <button type="button" class="btn-wish btn-wish-outline" id="saveGiftBtn"><i class="fas fa-check"></i> Сохранить</button>
        ${s.giftAccount ? `<div class="settings-copy-block"><code id="giftCopyText">${escapeHtml([s.giftHolder, s.giftBank, s.giftAccount].filter(Boolean).join(' · '))}</code><button type="button" class="btn-wish btn-wish-ghost btn-sm" id="copyGiftBtn"><i class="fas fa-copy"></i> Копировать</button></div>` : ''}
      </div>
      <div class="settings-card">
        <h3><i class="fas fa-hospital"></i> Наш роддом</h3>
        <label class="settings-field"><span>Название</span><input type="text" id="setHospitalName" value="${escapeAttr(s.hospitalName)}"></label>
        <label class="settings-field"><span>Адрес</span><input type="text" id="setHospitalAddress" value="${escapeAttr(s.hospitalAddress)}"></label>
        <label class="settings-field"><span>Телефон</span><input type="tel" id="setHospitalPhone" value="${escapeAttr(s.hospitalPhone)}"></label>
        <label class="settings-field"><span>Заметки</span><textarea id="setHospitalNotes" rows="2">${escapeHtml(s.hospitalNotes)}</textarea></label>
        <button type="button" class="btn-wish btn-wish-outline" id="saveHospitalBtn"><i class="fas fa-check"></i> Сохранить</button>
      </div>
      <div class="settings-card settings-card-sync">
        <h3><i class="fas fa-cloud"></i> Общая база</h3>
        <p class="settings-sync-hint">Галочки, хотелки и заметки автоматически синхронизируются между телефоном и ПК.</p>
        <div class="sync-status sync-status--off" id="syncStatus"><i class="fas fa-cloud-slash"></i><span>Проверяем...</span></div>
        <button type="button" class="btn-wish btn-wish-outline btn-sm" id="forceSyncBtn"><i class="fas fa-rotate"></i> Синхронизировать сейчас</button>
      </div>
      <div class="settings-card settings-card-pwa">
        <h3><i class="fas fa-mobile-screen"></i> На экран iPhone</h3>
        <p class="settings-pwa-hint">Safari → «Поделиться» → «На экран Домой». Сайт откроется как приложение.</p>
        <button type="button" class="btn-wish btn-wish-primary" id="pwaInstallBtn" hidden><i class="fas fa-download"></i> Установить</button>
      </div>
    </div>
  `;

  document.getElementById('saveDatesBtn')?.addEventListener('click', () => {
    saveSettings({
      dueDate: document.getElementById('setDueDate')?.value || null,
      birthDate: document.getElementById('setBirthDate')?.value || null,
      babyName: document.getElementById('setBabyName')?.value?.trim() || ''
    });
    applyPersonalization();
    updateCountdown(getPregnancyState());
    if (typeof renderCalendar === 'function') renderCalendar();
    if (typeof renderHospitalCard === 'function') renderHospitalCard();
    renderSettingsPanel();
    showToast('Даты сохранены');
  });

  document.getElementById('saveGiftBtn')?.addEventListener('click', () => {
    saveSettings({
      giftHolder: document.getElementById('setGiftHolder')?.value?.trim() || '',
      giftBank: document.getElementById('setGiftBank')?.value?.trim() || '',
      giftAccount: document.getElementById('setGiftAccount')?.value?.trim() || '',
      giftNote: document.getElementById('setGiftNote')?.value?.trim() || DEFAULT_SETTINGS.giftNote
    });
    if (typeof renderGiftCard === 'function') renderGiftCard();
    renderSettingsPanel();
    showToast('Реквизиты сохранены');
  });

  document.getElementById('saveHospitalBtn')?.addEventListener('click', () => {
    saveSettings({
      hospitalName: document.getElementById('setHospitalName')?.value?.trim() || '',
      hospitalAddress: document.getElementById('setHospitalAddress')?.value?.trim() || '',
      hospitalPhone: document.getElementById('setHospitalPhone')?.value?.trim() || '',
      hospitalNotes: document.getElementById('setHospitalNotes')?.value?.trim() || ''
    });
    if (typeof renderHospitalCard === 'function') renderHospitalCard();
    showToast('Роддом сохранён');
  });

  document.getElementById('copyGiftBtn')?.addEventListener('click', () => {
    const text = document.getElementById('giftCopyText')?.textContent;
    if (text) copyToClipboard(text);
  });

  bindPwaButton();
  updateSyncStatus?.();
  document.getElementById('forceSyncBtn')?.addEventListener('click', () => forceSyncNow?.());
}

function bindSettingsForm() { /* rendered in renderSettingsPanel */ }

function escapeAttr(str) {
  return String(str || '').replace(/"/g, '&quot;');
}

function escapeHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function showToast(msg) {
  let t = document.getElementById('siteToast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'siteToast';
    t.className = 'site-toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 2400);
}

function copyToClipboard(text) {
  navigator.clipboard?.writeText(text).then(() => showToast('Скопировано')).catch(() => showToast('Не удалось скопировать'));
}

let deferredPwaPrompt = null;

function setupPwaInstall() {
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredPwaPrompt = e;
    const btn = document.getElementById('pwaInstallBtn');
    if (btn) btn.hidden = false;
  });
}

function bindPwaButton() {
  document.getElementById('pwaInstallBtn')?.addEventListener('click', async () => {
    if (!deferredPwaPrompt) return;
    deferredPwaPrompt.prompt();
    await deferredPwaPrompt.userChoice;
    deferredPwaPrompt = null;
  });
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

function renderGiftCard() {
  const el = document.getElementById('giftCard');
  if (!el) return;
  const s = getSettings();
  if (!s.giftAccount && !s.giftHolder) {
    el.innerHTML = `<p class="gift-empty">Реквизиты можно добавить внизу страницы в «Настройках» — для родственников, если захотите.</p>`;
    return;
  }
  el.innerHTML = `
    <div class="gift-card-inner">
      <p class="gift-note">${escapeHtml(s.giftNote)}</p>
      ${s.giftHolder ? `<p><strong>Получатель:</strong> ${escapeHtml(s.giftHolder)}</p>` : ''}
      ${s.giftBank ? `<p><strong>Банк:</strong> ${escapeHtml(s.giftBank)}</p>` : ''}
      ${s.giftAccount ? `<p class="gift-account"><strong>Счёт:</strong> ${escapeHtml(s.giftAccount)}</p>` : ''}
      <button type="button" class="btn-wish btn-wish-outline btn-sm" id="giftCardCopy"><i class="fas fa-copy"></i> Скопировать для отправки</button>
    </div>
  `;
  document.getElementById('giftCardCopy')?.addEventListener('click', () => {
    const lines = [s.giftNote, s.giftHolder && `Получатель: ${s.giftHolder}`, s.giftBank && `Банк: ${s.giftBank}`, s.giftAccount && `Счёт: ${s.giftAccount}`].filter(Boolean);
    copyToClipboard(lines.join('\n'));
  });
}

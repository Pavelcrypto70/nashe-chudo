/* Регион: Томск */

function renderRegionSection() {
  const container = document.getElementById('regionTomsk');
  if (!container || typeof REGION_TOMSK === 'undefined') return;

  const r = REGION_TOMSK;

  container.innerHTML = `
    <div class="region-hero">
      <span class="region-badge"><i class="fas fa-map-marker-alt"></i> ${r.region} · ${r.city}</span>
      <p>${r.tagline}</p>
    </div>
    <div class="region-grid">
      <div class="region-block">
        <h3><i class="fas fa-wallet"></i> Выплаты в регионе</h3>
        <div class="region-cards">
          ${r.payments.map(p => `
            <div class="region-card">
              <h4>${p.title}</h4>
              <span class="region-amount">${p.amount}</span>
              <p><strong>Куда:</strong> ${p.where}</p>
              <p class="region-note">${p.note}</p>
            </div>
          `).join('')}
        </div>
      </div>
      <div class="region-block">
        <h3><i class="fas fa-hospital"></i> Роддома в Томске</h3>
        <ul class="region-list">
          ${r.hospitals.map(h => `
            <li>
              <strong>${h.name}</strong>
              <span>${h.address}</span>
              <em>${h.note}</em>
            </li>
          `).join('')}
        </ul>
      </div>
      <div class="region-block">
        <h3><i class="fas fa-building"></i> МФЦ</h3>
        <ul class="region-list">
          ${r.mfc.map(m => `
            <li>
              <strong>${m.name}</strong>
              <span>${m.address}</span>
              <em>${m.note}</em>
            </li>
          `).join('')}
        </ul>
      </div>
      <div class="region-block region-contacts">
        <h3><i class="fas fa-link"></i> Полезные ссылки</h3>
        <ul class="region-links">
          ${r.contacts.map(c => `
            <li><i class="fas ${c.icon}"></i> <strong>${c.label}:</strong> ${c.value}</li>
          `).join('')}
        </ul>
        <p class="region-disclaimer">Суммы и адреса уточняйте на год получения — данные могут меняться.</p>
      </div>
    </div>
  `;
}

function initRegion() {
  renderRegionSection();
}

/* График роста и веса */

const GROWTH_STORAGE = 'nashe_chudo_growth';

function getGrowthRecords() {
  try {
    const data = JSON.parse(localStorage.getItem(GROWTH_STORAGE)) || [];
    return data.sort((a, b) => new Date(a.date) - new Date(b.date));
  } catch {
    return [];
  }
}

function saveGrowthRecords(records) {
  localStorage.setItem(GROWTH_STORAGE, JSON.stringify(records));
}

function monthsFromBirth(dateStr, birthDateStr) {
  const birth = birthDateStr ? new Date(birthDateStr) : null;
  const d = new Date(dateStr);
  if (!birth || isNaN(birth)) {
    return null;
  }
  const months = (d.getFullYear() - birth.getFullYear()) * 12 + (d.getMonth() - birth.getMonth());
  const dayFrac = (d.getDate() - birth.getDate()) / 30;
  return Math.max(0, Math.round((months + dayFrac) * 10) / 10);
}

function getBirthDate() {
  if (typeof getDueDate === 'function') {
    return getDueDate().toISOString().slice(0, 10);
  }
  return null;
}

function formatDateRu(str) {
  const d = new Date(str);
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
}

function drawGrowthChart(records) {
  const canvas = document.getElementById('growthChart');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);
  const w = rect.width;
  const h = rect.height;

  ctx.clearRect(0, 0, w, h);

  const padding = { top: 24, right: 16, bottom: 36, left: 44 };
  const chartW = w - padding.left - padding.right;
  const chartH = h - padding.top - padding.bottom;

  if (!records.length) {
    ctx.fillStyle = '#5C5650';
    ctx.font = '14px Jost, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Добавьте первые измерения', w / 2, h / 2);
    return;
  }

  const birth = getBirthDate();
  const points = records.map(r => ({
    ...r,
    month: r.month != null ? r.month : monthsFromBirth(r.date, birth)
  })).filter(p => p.month != null);

  if (!points.length) {
    ctx.fillStyle = '#5C5650';
    ctx.font = '14px Jost, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Укажите дату рождения в настройках или возраст в месяцах', w / 2, h / 2);
    return;
  }

  const maxMonth = Math.max(12, ...points.map(p => p.month), 1);
  const maxWeight = Math.max(6, ...points.map(p => p.weight), 4);
  const maxHeight = Math.max(80, ...points.map(p => p.height), 55);

  const x = m => padding.left + (m / maxMonth) * chartW;
  const yW = kg => padding.top + chartH - (kg / maxWeight) * chartH;
  const yH = cm => padding.top + chartH - (cm / maxHeight) * chartH;

  ctx.strokeStyle = 'rgba(196,164,164,0.25)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = padding.top + (chartH / 4) * i;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(w - padding.right, y);
    ctx.stroke();
  }

  ctx.fillStyle = '#5C5650';
  ctx.font = '11px Jost, sans-serif';
  ctx.textAlign = 'center';
  for (let m = 0; m <= maxMonth; m += Math.ceil(maxMonth / 6)) {
    ctx.fillText(m + ' мес', x(m), h - 10);
  }

  ctx.textAlign = 'right';
  ctx.fillStyle = '#B8956B';
  ctx.fillText('кг', padding.left - 8, padding.top + 4);
  ctx.fillStyle = '#9B7B7B';
  ctx.fillText('см', padding.left - 8, padding.top + 16);

  function drawLine(getY, color, key) {
    const valid = points.filter(p => p[key] > 0);
    if (valid.length < 1) return;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    valid.forEach((p, i) => {
      const px = x(p.month);
      const py = getY(p[key]);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.stroke();
    valid.forEach(p => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x(p.month), getY(p[key]), 5, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  drawLine(yW, '#B8956B', 'weight');
  drawLine(yH, '#9B7B7B', 'height');

  if (typeof WHO_WEIGHT_BOY !== 'undefined') {
    ctx.strokeStyle = 'rgba(184,149,107,0.25)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    WHO_WEIGHT_BOY.forEach((kg, i) => {
      const px = x(i);
      const py = yW(kg);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.stroke();
    ctx.setLineDash([]);
  }

  const legendY = padding.top - 8;
  ctx.font = '11px Jost, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#B8956B';
  ctx.fillRect(padding.left, legendY - 8, 12, 3);
  ctx.fillText('Вес', padding.left + 16, legendY);
  ctx.fillStyle = '#9B7B7B';
  ctx.fillRect(padding.left + 56, legendY - 8, 12, 3);
  ctx.fillText('Рост', padding.left + 72, legendY);
  ctx.fillStyle = 'rgba(184,149,107,0.5)';
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(padding.left + 118, legendY - 6);
  ctx.lineTo(padding.left + 136, legendY - 6);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = '#5C5650';
  ctx.fillText('норма (ориентир)', padding.left + 140, legendY);
}

function renderGrowthTable(records) {
  const tbody = document.getElementById('growthTableBody');
  if (!tbody) return;

  const birth = getBirthDate();

  if (!records.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="growth-empty">Пока нет записей</td></tr>';
    return;
  }

  tbody.innerHTML = records.map((r, i) => {
    const month = r.month != null ? r.month : monthsFromBirth(r.date, birth);
    return `<tr>
      <td>${formatDateRu(r.date)}</td>
      <td>${month != null ? month + ' мес' : '—'}</td>
      <td>${r.weight ? r.weight + ' кг' : '—'}</td>
      <td>${r.height ? r.height + ' см' : '—'}</td>
      <td><button type="button" class="btn-wish btn-wish-ghost btn-sm growth-del" data-id="${r.id}"><i class="fas fa-trash-alt"></i></button></td>
    </tr>`;
  }).join('');

  tbody.querySelectorAll('.growth-del').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = Number(btn.dataset.id);
      saveGrowthRecords(getGrowthRecords().filter(r => r.id !== id));
      refreshGrowth();
    });
  });
}

function refreshGrowth() {
  const records = getGrowthRecords();
  drawGrowthChart(records);
  renderGrowthTable(records);
}

function setupGrowthForm() {
  const form = document.getElementById('growthForm');
  if (!form) return;

  const dateInput = document.getElementById('growthDate');
  if (dateInput && !dateInput.value) {
    dateInput.value = new Date().toISOString().slice(0, 10);
  }

  form.addEventListener('submit', e => {
    e.preventDefault();
    const date = document.getElementById('growthDate').value;
    const weight = parseFloat(document.getElementById('growthWeight').value) || 0;
    const height = parseFloat(document.getElementById('growthHeight').value) || 0;
    const monthManual = document.getElementById('growthMonth').value;

    if (!date || (!weight && !height)) {
      alert('Укажите дату и хотя бы вес или рост');
      return;
    }

    const records = getGrowthRecords();
    records.push({
      id: Date.now(),
      date,
      weight,
      height,
      month: monthManual !== '' ? parseFloat(monthManual) : null
    });
    saveGrowthRecords(records);
    form.reset();
    if (dateInput) dateInput.value = new Date().toISOString().slice(0, 10);
    refreshGrowth();
  });

  window.addEventListener('resize', () => {
    drawGrowthChart(getGrowthRecords());
  });
}

function initGrowth() {
  setupGrowthForm();
  refreshGrowth();
}

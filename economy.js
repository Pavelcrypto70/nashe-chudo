/* Экономика, накопления и пожелания ребёнку */

const WISHES_STORAGE = 'nashe_chudo_child_wishes';
const SAVINGS_STORAGE = 'nashe_chudo_savings';

function getSavingsSettings() {
  try {
    return JSON.parse(localStorage.getItem(SAVINGS_STORAGE)) || {
      monthly: 5000,
      giftLump: 50000,
      rate: 8,
      childName: 'малыш'
    };
  } catch {
    return { monthly: 5000, giftLump: 50000, rate: 8, childName: 'малыш' };
  }
}

function saveSavingsSettings(data) {
  localStorage.setItem(SAVINGS_STORAGE, JSON.stringify(data));
}

function getChildWishes() {
  try {
    const saved = JSON.parse(localStorage.getItem(WISHES_STORAGE));
    if (saved && saved.length) return saved;
  } catch { /* ignore */ }
  return [...DEFAULT_CHILD_WISHES];
}

function saveChildWishes(wishes) {
  localStorage.setItem(WISHES_STORAGE, JSON.stringify(wishes));
}

function calcSavings(monthly, lump, ratePercent, years) {
  const r = ratePercent / 100 / 12;
  const months = years * 12;
  let total = lump;
  if (r > 0) {
    const futureMonthly = monthly * ((Math.pow(1 + r, months) - 1) / r);
    const futureLump = lump * Math.pow(1 + r, months);
    total = futureLump + futureMonthly;
  } else {
    total = lump + monthly * months;
  }
  const contributed = lump + monthly * months;
  return { total: Math.round(total), contributed: Math.round(contributed), interest: Math.round(total - contributed) };
}

function formatMoney(n) {
  return n.toLocaleString('ru-RU') + ' ₽';
}

function renderEconomySection() {
  const adviceEl = document.getElementById('economyAdvice');
  const wishesEl = document.getElementById('childWishesList');
  if (!adviceEl) return;

  adviceEl.innerHTML = ECONOMY_ADVICE.map(a => `
    <div class="economy-tip">
      <span class="economy-tip-icon"><i class="fas ${a.icon}"></i></span>
      <div>
        <h4>${a.title}</h4>
        <p>${a.text}</p>
      </div>
    </div>
  `).join('');

  const wishes = getChildWishes();
  if (wishesEl) {
    wishesEl.innerHTML = wishes.map((w, i) => `
      <li class="wish-item-text">
        <i class="fas fa-heart"></i>
        <span>${w}</span>
      </li>
    `).join('');
  }

  updateSavingsCalculator();
  setupSavingsForm();
  setupWishesForm();
}

function updateSavingsCalculator() {
  const s = getSavingsSettings();
  const result18 = calcSavings(s.monthly, s.giftLump, s.rate, 18);
  const result5 = calcSavings(s.monthly, s.giftLump, s.rate, 5);

  const el18 = document.getElementById('savingsResult18');
  const el5 = document.getElementById('savingsResult5');
  const elDetail = document.getElementById('savingsDetail');

  if (el18) el18.textContent = formatMoney(result18.total);
  if (el5) el5.textContent = formatMoney(result5.total);
  if (elDetail) {
    elDetail.innerHTML = `
      К 18 годам: вложено <strong>${formatMoney(result18.contributed)}</strong>,
      проценты ~<strong>${formatMoney(result18.interest)}</strong>
      (ставка ${s.rate}% годовых, ориентир)
    `;
  }

  const monthlyInput = document.getElementById('savingsMonthly');
  const lumpInput = document.getElementById('savingsLump');
  const rateInput = document.getElementById('savingsRate');
  if (monthlyInput) monthlyInput.value = s.monthly;
  if (lumpInput) lumpInput.value = s.giftLump;
  if (rateInput) rateInput.value = s.rate;
}

function setupSavingsForm() {
  const form = document.getElementById('savingsForm');
  if (!form) return;

  const recalc = () => {
    const data = {
      monthly: Number(document.getElementById('savingsMonthly')?.value) || 0,
      giftLump: Number(document.getElementById('savingsLump')?.value) || 0,
      rate: Number(document.getElementById('savingsRate')?.value) || 0,
      childName: getSavingsSettings().childName
    };
    saveSavingsSettings(data);
    updateSavingsCalculator();
  };

  form.querySelectorAll('input').forEach(inp => {
    inp.addEventListener('input', recalc);
  });
}

function setupWishesForm() {
  const form = document.getElementById('wishesForm');
  if (!form) return;

  form.addEventListener('submit', e => {
    e.preventDefault();
    const input = document.getElementById('newWishText');
    const text = input?.value.trim();
    if (!text) return;
    const wishes = getChildWishes();
    wishes.push(text);
    saveChildWishes(wishes);
    input.value = '';
    renderEconomySection();
  });
}

function initEconomy() {
  renderEconomySection();
}

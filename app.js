import { calculateForecast, getMonthlyBuckets, peopleText, formatPercent } from './src/calculator.mjs';
import { labelsFor } from './src/translations.mjs';

const $ = (selector) => document.querySelector(selector);
const inputs = {
  language: $('#language'),
  currency: $('#currency'),
  start: $('#start'),
  end: $('#end'),
  revenue: $('#revenue'),
  orderValue: $('#order-value'),
  leadRate: $('#lead-rate'),
  prospectRate: $('#prospect-rate'),
};
const elements = {
  error: $('#error-message'),
  prospects: $('#prospects-value'),
  leads: $('#leads-value'),
  customers: $('#customers-value'),
  leadsPercent: $('#leads-percent'),
  customersPercent: $('#customers-percent'),
  leadsProgress: $('#leads-progress'),
  customersProgress: $('#customers-progress'),
  prospectProgress: $('#prospects-progress'),
  leadOutput: $('#lead-rate-output'),
  prospectOutput: $('#prospect-rate-output'),
  summary: $('#forecast-summary'),
  period: $('#campaign-period'),
  chart: $('#chart'),
  toast: $('#toast'),
};

const words = {
  bg: {
    invalidNumbers: 'Въведете валиден оборот (≥ 0), средна поръчка (> 0) и проценти от 0 до 100.',
    numbersTooLarge: 'Стойностите са прекалено големи за надеждно изчисление.',
    invalidDates: 'Крайната дата трябва да е след или равна на началната.',
    dateRangeTooLarge: 'Изберете период до 50 години.',
    impossible: 'При 0% отговор няма достатъчен брой контакти за тази цел. Увеличете процента.',
    targetSummary: (c, l, p, money) => `За целеви оборот <strong>${money}</strong> са необходими <strong>${p} контакта</strong>, <strong>${l} лийда</strong> и <strong>${c} клиента</strong>.`,
    noTarget: 'Въведете целеви оборот, за да видите необходимия брой контакти и клиенти.',
    chartError: 'Коригирайте данните, за да видите графиката.',
    chartImpossible: 'Графиката не може да бъде изчислена при 0% отговор.',
    chartInfo: (month, prospects, leads, customers) => `${month}: ${prospects} контакта · ${leads} лийда · ${customers} клиента`,
    copyText: (revenue, c, l, p, rateL, rateP) => `LeadPredictor — целеви оборот ${revenue}\nКлиенти: ${c}\nЛийдове: ${l}\nКонтакти: ${p}\nОтговор от лийдове: ${rateL}%\nОтговор от контакти: ${rateP}%`,
    copied: 'Прогнозата е копирана.', copyFailed: 'Копирането не е налично в този браузър.', resetDone: 'Настройките са възстановени.',
    ariaChart: 'Натрупване на контакти, лийдове и клиенти по месеци',
  },
  en: {
    invalidNumbers: 'Enter valid revenue (≥ 0), average order value (> 0), and rates from 0 to 100.',
    numbersTooLarge: 'These values are too large to calculate reliably.',
    invalidDates: 'The end date must be on or after the start date.',
    dateRangeTooLarge: 'Please select a range of up to 50 years.',
    impossible: 'At a 0% response rate, there are not enough prospects to meet this target. Increase the rate.',
    targetSummary: (c, l, p, money) => `To reach <strong>${money}</strong>, you need <strong>${p} prospects</strong>, <strong>${l} leads</strong>, and <strong>${c} customers</strong>.`,
    noTarget: 'Enter a revenue target to calculate your required audience and customers.',
    chartError: 'Correct the inputs to display the chart.',
    chartImpossible: 'The chart cannot be calculated at a 0% response rate.',
    chartInfo: (month, prospects, leads, customers) => `${month}: ${prospects} prospects · ${leads} leads · ${customers} customers`,
    copyText: (revenue, c, l, p, rateL, rateP) => `LeadPredictor — revenue target ${revenue}\nCustomers: ${c}\nLeads: ${l}\nProspects: ${p}\nLead response rate: ${rateL}%\nProspect response rate: ${rateP}%`,
    copied: 'Forecast copied.', copyFailed: 'Copying is unavailable in this browser.', resetDone: 'Settings reset.',
    ariaChart: 'Cumulative prospects, leads, and customers by month',
  },
};

function localISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
function defaultDates() {
  const today = new Date();
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 7, 0).getDate();
  const end = new Date(today.getFullYear(), today.getMonth() + 6, Math.min(today.getDate(), lastDay));
  return { start: localISO(today), end: localISO(end) };
}
const defaults = { language: 'bg', currency: 'EUR', ...defaultDates(), revenue: '10000', orderValue: '1000', leadRate: '40', prospectRate: '20' };

function getInputs() {
  return Object.fromEntries(Object.entries(inputs).map(([key, input]) => [key, input.value]));
}
function setInputs(values) {
  for (const [key, input] of Object.entries(inputs)) {
    input.value = values[key] ?? defaults[key];
  }
}
function numberString(value, lang) { return peopleText(value, lang); }
function moneyText(value, language, currency) {
  try { return new Intl.NumberFormat(language === 'bg' ? 'bg-BG' : 'en-US', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value); }
  catch { return `${value} ${currency}`; }
}
function monthLabel(bucket, lang) {
  const locale = lang === 'bg' ? 'bg-BG' : 'en-US';
  const start = new Date(`${bucket.start}T12:00:00Z`);
  const end = new Date(`${bucket.end}T12:00:00Z`);
  const s = new Intl.DateTimeFormat(locale, { month: 'short', timeZone: 'UTC' }).format(start).replace('.', '');
  const e = new Intl.DateTimeFormat(locale, { month: 'short', timeZone: 'UTC' }).format(end).replace('.', '');
  return bucket.grouped ? `${s}–${e}` : `${s} ${String(start.getUTCFullYear()).slice(2)}`;
}
function dateDescription(value, lang) {
  const date = new Date(`${value}T12:00:00Z`);
  if (!Number.isFinite(date.getTime())) return '';
  return new Intl.DateTimeFormat(lang === 'bg' ? 'bg-BG' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(date);
}
function markSlider(input) { input.style.setProperty('--fill', `${input.value}%`); }
function updateKpis(result, lang) {
  elements.customers.textContent = numberString(result.customers, lang);
  elements.leads.textContent = numberString(result.leads, lang);
  elements.prospects.textContent = numberString(result.prospects, lang);
  elements.leadsPercent.textContent = Number.isFinite(result.prospects) ? formatPercent(result.leadShare, lang) : '—';
  elements.customersPercent.textContent = Number.isFinite(result.prospects) ? formatPercent(result.customerShare, lang) : '—';
  elements.prospectProgress.style.width = Number.isFinite(result.prospects) ? '100%' : '0%';
  elements.leadsProgress.style.width = Number.isFinite(result.prospects) ? `${result.leadShare}%` : '0%';
  elements.customersProgress.style.width = Number.isFinite(result.prospects) ? `${result.customerShare}%` : '0%';
}
function emptyKpis() {
  for (const node of [elements.customers, elements.leads, elements.prospects, elements.leadsPercent, elements.customersPercent]) node.textContent = '—';
  for (const node of [elements.prospectProgress, elements.leadsProgress, elements.customersProgress]) node.style.width = '0%';
}
function createEl(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}
function drawChart(forecast, dates, lang) {
  const chart = elements.chart;
  chart.replaceChildren();
  chart.setAttribute('aria-label', words[lang].ariaChart);
  if (!forecast.valid || !dates.valid || !Number.isFinite(forecast.prospects)) {
    chart.append(createEl('p', 'chart-empty', !forecast.valid || !dates.valid ? words[lang].chartError : words[lang].chartImpossible));
    return;
  }
  const max = Math.max(forecast.prospects, 1);
  for (const bucket of dates.buckets) {
    const label = monthLabel(bucket, lang);
    const p = Math.ceil(forecast.prospects * bucket.portion);
    const l = Math.ceil(forecast.leads * bucket.portion);
    const c = Math.ceil(forecast.customers * bucket.portion);
    const row = createEl('div', 'chart-row');
    row.append(createEl('span', 'month-label', label));
    const bg = createEl('div', 'bar-background');
    const bar = createEl('div', 'chart-bar');
    bar.style.width = `${Math.max(0, Math.min(100, p / max * 100))}%`;
    const barLeads = createEl('span', 'chart-bar-leads');
    const barCustomers = createEl('span', 'chart-bar-customers');
    barLeads.style.width = `${p ? Math.min(100, l / p * 100) : 0}%`;
    barCustomers.style.width = `${p ? Math.min(100, c / p * 100) : 0}%`;
    bar.append(barLeads, barCustomers, createEl('span', 'bar-marker'));
    bar.tabIndex = 0;
    const hint = words[lang].chartInfo(label, numberString(p,lang), numberString(l,lang), numberString(c,lang));
    bar.title = hint;
    bar.setAttribute('aria-label', hint);
    bar.setAttribute('role', 'img');
    bg.append(bar);
    row.append(bg);
    chart.append(row);
  }
  const axis = createEl('div', 'axis-row');
  for (const fraction of [0, .25, .5, .75, 1]) axis.append(createEl('span','',numberString(Math.round(forecast.prospects * fraction),lang)));
  chart.append(axis);
}
function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => elements.toast.classList.remove('show'), 2800);
}
let lastCopyText = '';
function recalculate() {
  const values = getInputs();
  const lang = values.language === 'en' ? 'en' : 'bg';
  const t = words[lang];
  document.documentElement.lang = lang;
  const labels = labelsFor(lang);
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const translation = labels[el.dataset.i18n];
    if (translation) el.textContent = translation;
  });
  $('#reset-button').title = lang === 'bg' ? 'Възстанови настройките' : 'Reset settings';
  $('#reset-button').setAttribute('aria-label', $('#reset-button').title);
  document.title = lang === 'bg' ? 'LeadPredictor · Прогноза за кампанията' : 'LeadPredictor · Campaign Forecast';
  const symbols = { EUR: '€', USD: '$', BGN: 'лв.' };
  document.querySelectorAll('.currency-symbol').forEach((el) => { el.textContent = symbols[values.currency] || values.currency; });
  const forecast = calculateForecast({ revenue: values.revenue, orderValue: values.orderValue, leadRate: values.leadRate, prospectRate: values.prospectRate });
  const dates = getMonthlyBuckets(values.start, values.end);
  elements.leadOutput.textContent = `${values.leadRate}%`;
  elements.prospectOutput.textContent = `${values.prospectRate}%`;
  markSlider(inputs.leadRate);
  markSlider(inputs.prospectRate);
  elements.period.textContent = `${dateDescription(values.start,lang)} — ${dateDescription(values.end,lang)}`;

  elements.error.textContent = !forecast.valid ? t[forecast.error] : !dates.valid ? t[dates.error] : '';
  if (!forecast.valid || !dates.valid) {
    emptyKpis();
    elements.summary.textContent = t.chartError;
    drawChart({ valid: false }, dates, lang);
    lastCopyText = '';
    $('#copy-summary').disabled = true;
  } else {
    updateKpis(forecast, lang);
    drawChart(forecast, dates, lang);
    if (!Number.isFinite(forecast.prospects)) {
      elements.summary.textContent = t.impossible;
      lastCopyText = '';
      $('#copy-summary').disabled = true;
    } else if (forecast.customers === 0) {
      elements.summary.textContent = t.noTarget;
      lastCopyText = '';
      $('#copy-summary').disabled = true;
    } else {
      const money = moneyText(Number(values.revenue),lang,values.currency);
      const c = numberString(forecast.customers,lang);
      const l = numberString(forecast.leads,lang);
      const p = numberString(forecast.prospects,lang);
      // Content is assembled from internal translations and formatted numeric values only.
      elements.summary.innerHTML = t.targetSummary(c,l,p,money);
      lastCopyText = t.copyText(money,c,l,p,values.leadRate,values.prospectRate);
      $('#copy-summary').disabled = false;
    }
  }
  try { localStorage.setItem('lead-predictor:settings:v1', JSON.stringify(values)); } catch { /* restricted storage */ }
}

try {
  const saved = JSON.parse(localStorage.getItem('lead-predictor:settings:v1') || 'null');
  setInputs(saved && typeof saved === 'object' ? { ...defaults, ...saved } : defaults);
} catch { setInputs(defaults); }
for (const input of Object.values(inputs)) {
  input.addEventListener(input.type === 'range' ? 'input' : 'change', recalculate);
  if (input.type === 'number' || input.type === 'date') input.addEventListener('input', recalculate);
}
$('#calculator-form').addEventListener('submit', (e) => e.preventDefault());
$('#reset-button').addEventListener('click', () => { setInputs(defaults); recalculate(); showToast(words[inputs.language.value].resetDone); });
$('#copy-summary').addEventListener('click', async () => {
  if (!lastCopyText) return;
  try {
    if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(lastCopyText);
    else {
      const temp = document.createElement('textarea'); temp.value = lastCopyText; temp.style.position = 'fixed'; temp.style.opacity = '0'; document.body.append(temp); temp.select();
      if (!document.execCommand('copy')) throw new Error('Clipboard unavailable');
      temp.remove();
    }
    showToast(words[inputs.language.value].copied);
  } catch { showToast(words[inputs.language.value].copyFailed); }
});
recalculate();

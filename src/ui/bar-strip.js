import { CACHE_TTL_SECONDS } from '../core/constants.js';

let container = null;
let cacheTimerInterval = null;
let lastResponseTime = null;

const els = {};

function formatTokens(n) {
  if (n >= 1000) return Math.round(n / 1000) + 'k';
  return String(n);
}

function formatTime(ms) {
  if (ms <= 0) return '0:00';
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (min >= 60) {
    const hr = Math.floor(min / 60);
    const rm = min % 60;
    return `${hr}h ${rm}m`;
  }
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

function formatCountdown(isoString) {
  if (!isoString) return '--:--';
  const ms = new Date(isoString).getTime() - Date.now();
  if (ms <= 0) return 'now';
  return formatTime(ms);
}

function createItem(labelText, valueText, miniBarClass) {
  const item = document.createElement('span');
  item.className = 'cm-item';

  const label = document.createElement('span');
  label.className = 'cm-item-label';
  label.textContent = labelText;
  item.appendChild(label);

  if (miniBarClass) {
    const bar = document.createElement('span');
    bar.className = 'cm-mini-bar';
    const fill = document.createElement('span');
    fill.className = `cm-mini-fill ${miniBarClass}`;
    fill.style.width = '0%';
    bar.appendChild(fill);
    item.appendChild(bar);
    item._fill = fill;
  }

  const value = document.createElement('span');
  value.className = 'cm-item-value';
  value.textContent = valueText;
  item.appendChild(value);
  item._value = value;

  return item;
}

function createSep() {
  const sep = document.createElement('span');
  sep.className = 'cm-sep';
  sep.textContent = '|';
  return sep;
}

export function createBarStrip() {
  container = document.createElement('div');
  container.className = 'cm-strip';
  container.id = 'claude-monitor-strip';

  // Tokens: 0/200k with mini bar
  const tokenItem = createItem('Tokens', '0/200k', 'cm-mini-fill--tokens');
  els.tokenValue = tokenItem._value;
  els.tokenFill = tokenItem._fill;
  container.appendChild(tokenItem);
  container.appendChild(createSep());

  // Session: 0% with mini bar
  const sessionItem = createItem('Session', '0%', 'cm-mini-fill--session');
  els.sessionValue = sessionItem._value;
  els.sessionFill = sessionItem._fill;
  container.appendChild(sessionItem);
  container.appendChild(createSep());

  // Weekly: 0% with mini bar
  const weeklyItem = createItem('Weekly', '0%', 'cm-mini-fill--weekly');
  els.weeklyValue = weeklyItem._value;
  els.weeklyFill = weeklyItem._fill;
  container.appendChild(weeklyItem);
  container.appendChild(createSep());

  // Cache timer
  els.cacheTimer = document.createElement('span');
  els.cacheTimer.className = 'cm-item';
  els.cacheTimer.innerHTML = '<span class="cm-item-label">Cache</span><span class="cm-item-value">--:--</span>';
  container.appendChild(els.cacheTimer);
  container.appendChild(createSep());

  // Reset countdown
  els.resetTimer = document.createElement('span');
  els.resetTimer.className = 'cm-item';
  els.resetTimer.innerHTML = '<span class="cm-item-label">Reset</span><span class="cm-item-value">--:--</span>';
  container.appendChild(els.resetTimer);
  container.appendChild(createSep());

  // Budget (hidden if not enabled)
  els.budgetInfo = document.createElement('span');
  els.budgetInfo.className = 'cm-item';
  els.budgetInfo.style.display = 'none';
  container.appendChild(els.budgetInfo);
  els.budgetSep = createSep();
  els.budgetSep.style.display = 'none';
  container.appendChild(els.budgetSep);

  // Model
  els.modelInfo = document.createElement('span');
  els.modelInfo.className = 'cm-item';
  els.modelInfo.innerHTML = '<span class="cm-item-value">--</span>';
  container.appendChild(els.modelInfo);

  startCacheTimer();

  return container;
}

export function getBarStripElement() {
  return container;
}

// --- Update functions ---

export function updateTokens(estimatedTokens, contextLimit) {
  if (!els.tokenValue) return;
  const pct = Math.min(100, (estimatedTokens / contextLimit) * 100);
  els.tokenValue.textContent = `${formatTokens(estimatedTokens)}/${formatTokens(contextLimit)}`;
  if (els.tokenFill) els.tokenFill.style.width = pct + '%';
}

export function updateSession(utilization) {
  if (!els.sessionValue) return;
  els.sessionValue.textContent = utilization + '%';
  if (els.sessionFill) els.sessionFill.style.width = Math.min(100, utilization) + '%';
}

export function updateWeekly(utilization) {
  if (!els.weeklyValue) return;
  els.weeklyValue.textContent = utilization + '%';
  if (els.weeklyFill) els.weeklyFill.style.width = Math.min(100, utilization) + '%';
}

export function updateModel(label) {
  if (!els.modelInfo) return;
  els.modelInfo.querySelector('.cm-item-value').textContent = label;
}

export function updateBudget(enabled, currentUsage, monthlyBudget, alertLevel) {
  if (!els.budgetInfo) return;
  if (!enabled) {
    els.budgetInfo.style.display = 'none';
    els.budgetSep.style.display = 'none';
    return;
  }
  els.budgetInfo.style.display = '';
  els.budgetSep.style.display = '';
  const remaining = Math.max(0, monthlyBudget - currentUsage);
  els.budgetInfo.innerHTML = `<span class="cm-item-label">Budget</span><span class="cm-item-value ${
    alertLevel === 'critical' ? 'cm-alert-critical' : alertLevel === 'warning' ? 'cm-alert-warning' : ''
  }">${remaining}%</span>`;
}

export function markResponseReceived() {
  lastResponseTime = Date.now();
}

export function updateResetCountdown(sessionResetsAt) {
  if (!els.resetTimer) return;
  const str = formatCountdown(sessionResetsAt);
  const valueEl = els.resetTimer.querySelector('.cm-item-value');
  if (valueEl) valueEl.textContent = str;
}

function startCacheTimer() {
  if (cacheTimerInterval) clearInterval(cacheTimerInterval);
  cacheTimerInterval = setInterval(tickCacheTimer, 1000);
}

function tickCacheTimer() {
  if (!els.cacheTimer) return;
  const valueEl = els.cacheTimer.querySelector('.cm-item-value');
  if (!valueEl) return;

  if (!lastResponseTime) {
    valueEl.textContent = '--:--';
    valueEl.classList.remove('cm-alert-expired');
    return;
  }

  const elapsed = Date.now() - lastResponseTime;
  const remaining = (CACHE_TTL_SECONDS * 1000) - elapsed;

  if (remaining <= 0) {
    valueEl.textContent = 'expired';
    valueEl.classList.add('cm-alert-expired');
  } else {
    valueEl.textContent = formatTime(remaining);
    valueEl.classList.remove('cm-alert-expired');
  }
}

export function updateHistory(entries) {
  if (!container) return;

  let sparkline = container.querySelector('.cm-sparkline');
  if (!sparkline) {
    sparkline = document.createElement('div');
    sparkline.className = 'cm-sparkline';
    container.appendChild(sparkline);
  }

  if (!entries || entries.length < 2) {
    sparkline.innerHTML = '<span style="font-size:10px;color:#888">Not enough history data</span>';
    return;
  }

  const recent = entries.slice(-7);
  const maxVal = Math.max(...recent.map((e) => e.weekly), 1);

  const bars = recent.map((e) => {
    const height = Math.round((e.weekly / maxVal) * 100);
    return `<div style="display:inline-block;width:12%;height:${height}%;background:#6bd49a;border-radius:2px;margin:0 1%" title="${e.date}: ${e.weekly}%"></div>`;
  }).join('');

  sparkline.innerHTML = `
    <div style="font-size:9px;color:#888;margin-bottom:4px">Weekly — last 7 days</div>
    <div style="display:flex;align-items:flex-end;height:30px">${bars}</div>
  `;
}

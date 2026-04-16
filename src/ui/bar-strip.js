import { CACHE_TTL_SECONDS } from '../core/constants.js';

let container = null;
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

  // Cost
  els.costValue = document.createElement('span');
  const costItem = document.createElement('span');
  costItem.className = 'cm-item';
  costItem.innerHTML = '<span class="cm-item-label">Cost</span>';
  els.costValue = document.createElement('span');
  els.costValue.className = 'cm-item-value';
  els.costValue.textContent = '--';
  costItem.appendChild(els.costValue);
  container.appendChild(costItem);
  container.appendChild(createSep());

  // Reset countdown
  els.resetTimer = document.createElement('span');
  els.resetTimer.className = 'cm-item';
  els.resetTimer.innerHTML = '<span class="cm-item-label">Reset</span><span class="cm-item-value">--:--</span>';
  container.appendChild(els.resetTimer);

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
  // Weekly removed from UI but keep function for compatibility
}

export function updateModel(label) {
  // Model shown via Opus 4.7 button already — no duplicate needed
}

export function updateBudget(enabled, currentUsage, monthlyBudget, alertLevel) {
  // Budget info shown via Cost field now
  if (!els.costValue) return;
  if (!enabled) {
    els.costValue.textContent = '--';
    return;
  }
  const remaining = Math.max(0, monthlyBudget - currentUsage);
  els.costValue.textContent = `${remaining}% left`;
  els.costValue.className = 'cm-item-value' + (
    alertLevel === 'critical' ? ' cm-alert-critical' :
    alertLevel === 'warning' ? ' cm-alert-warning' : ''
  );
}

export function updateCost(estimatedCostUSD) {
  if (!els.costValue) return;
  if (estimatedCostUSD <= 0) {
    els.costValue.textContent = '$0.00';
  } else if (estimatedCostUSD < 0.01) {
    els.costValue.textContent = '<$0.01';
  } else {
    els.costValue.textContent = '$' + estimatedCostUSD.toFixed(2);
  }
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

export function updateHistory(entries) {
  // History sparkline removed from inline — could be shown in popup later
}

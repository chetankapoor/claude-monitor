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

function createBarRow(label, fillClass) {
  const row = document.createElement('div');
  row.className = 'cm-row';

  const labelEl = document.createElement('span');
  labelEl.className = 'cm-label';
  labelEl.textContent = label;

  const track = document.createElement('div');
  track.className = 'cm-bar-track';

  const fill = document.createElement('div');
  fill.className = `cm-bar-fill ${fillClass}`;
  fill.style.width = '0%';
  track.appendChild(fill);

  const value = document.createElement('span');
  value.className = 'cm-value';
  value.textContent = '--';

  row.appendChild(labelEl);
  row.appendChild(track);
  row.appendChild(value);

  return { row, fill, value };
}

export function createBarStrip() {
  container = document.createElement('div');
  container.className = 'cm-bar-strip';
  container.id = 'claude-monitor-strip';

  const tokens = createBarRow('Tokens', 'cm-bar-fill--tokens');
  els.tokenFill = tokens.fill;
  els.tokenValue = tokens.value;
  container.appendChild(tokens.row);

  const session = createBarRow('Session', 'cm-bar-fill--session');
  els.sessionFill = session.fill;
  els.sessionValue = session.value;
  container.appendChild(session.row);

  const weekly = createBarRow('Weekly', 'cm-bar-fill--weekly');
  els.weeklyFill = weekly.fill;
  els.weeklyValue = weekly.value;
  container.appendChild(weekly.row);

  const meta = document.createElement('div');
  meta.className = 'cm-meta-row';

  els.cacheTimer = document.createElement('span');
  els.cacheTimer.textContent = 'Cache: --:--';

  els.resetTimer = document.createElement('span');
  els.resetTimer.textContent = 'Reset: --:--';

  els.budgetInfo = document.createElement('span');
  els.budgetInfo.textContent = '';

  els.modelInfo = document.createElement('span');
  els.modelInfo.textContent = 'Model: --';

  meta.appendChild(els.cacheTimer);
  meta.appendChild(els.resetTimer);
  meta.appendChild(els.budgetInfo);
  meta.appendChild(els.modelInfo);
  container.appendChild(meta);

  startCacheTimer();

  return container;
}

export function getBarStripElement() {
  return container;
}

export function updateTokens(estimatedTokens, contextLimit) {
  if (!els.tokenFill) return;
  const pct = Math.min(100, (estimatedTokens / contextLimit) * 100);
  els.tokenFill.style.width = pct + '%';
  els.tokenValue.textContent = `${formatTokens(estimatedTokens)}/${formatTokens(contextLimit)}`;
}

export function updateSession(utilization, resetsAt) {
  if (!els.sessionFill) return;
  els.sessionFill.style.width = Math.min(100, utilization) + '%';
  els.sessionValue.textContent = utilization + '%';
}

export function updateWeekly(utilization, resetsAt) {
  if (!els.weeklyFill) return;
  els.weeklyFill.style.width = Math.min(100, utilization) + '%';
  els.weeklyValue.textContent = utilization + '%';
}

export function updateModel(label) {
  if (!els.modelInfo) return;
  els.modelInfo.textContent = `Model: ${label}`;
}

export function updateBudget(enabled, currentUsage, monthlyBudget, alertLevel) {
  if (!els.budgetInfo) return;
  if (!enabled) {
    els.budgetInfo.textContent = '';
    return;
  }
  const remaining = Math.max(0, monthlyBudget - currentUsage);
  els.budgetInfo.textContent = `Budget: ${remaining}% left`;

  if (alertLevel === 'critical') {
    els.budgetInfo.style.color = '#d46b6b';
  } else if (alertLevel === 'warning') {
    els.budgetInfo.style.color = '#d4c56b';
  } else {
    els.budgetInfo.style.color = '';
  }
}

export function markResponseReceived() {
  lastResponseTime = Date.now();
}

export function updateResetCountdown(sessionResetsAt, weeklyResetsAt) {
  if (!els.resetTimer) return;
  const sessionStr = formatCountdown(sessionResetsAt);
  els.resetTimer.textContent = `Reset: ${sessionStr}`;
}

function startCacheTimer() {
  if (cacheTimerInterval) clearInterval(cacheTimerInterval);
  cacheTimerInterval = setInterval(tickCacheTimer, 1000);
}

function tickCacheTimer() {
  if (!els.cacheTimer) return;
  if (!lastResponseTime) {
    els.cacheTimer.textContent = 'Cache: --:--';
    return;
  }

  const elapsed = Date.now() - lastResponseTime;
  const remaining = (CACHE_TTL_SECONDS * 1000) - elapsed;

  if (remaining <= 0) {
    els.cacheTimer.textContent = 'Cache: expired';
    els.cacheTimer.style.color = '#d46b6b';
  } else {
    els.cacheTimer.textContent = `Cache: ${formatTime(remaining)}`;
    els.cacheTimer.style.color = '';
  }
}

export function updateHistory(entries) {
  if (!container) return;

  let sparkline = container.querySelector('.cm-sparkline');
  if (!sparkline) {
    sparkline = document.createElement('div');
    sparkline.className = 'cm-sparkline';
    container.style.position = 'relative';
    container.appendChild(sparkline);
  }

  if (!entries || entries.length < 2) {
    sparkline.innerHTML = '<span style="font-size:10px;color:#888">Not enough data yet</span>';
    return;
  }

  const recent = entries.slice(-7);
  const maxVal = Math.max(...recent.map((e) => e.weekly), 1);

  const bars = recent.map((e) => {
    const height = Math.round((e.weekly / maxVal) * 100);
    return `<div style="display:inline-block;width:12%;height:${height}%;background:#6bd49a;border-radius:2px;margin:0 1%" title="${e.date}: ${e.weekly}%"></div>`;
  }).join('');

  sparkline.innerHTML = `
    <div style="font-size:9px;color:#888;margin-bottom:4px">Weekly usage — last 7 days</div>
    <div style="display:flex;align-items:flex-end;height:40px">${bars}</div>
  `;
}

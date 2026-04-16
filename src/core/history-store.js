import { STORAGE_KEYS } from './constants.js';
import { storageGet, storageSet } from './storage.js';
import { getUsageState } from './usage-tracker.js';
import { getTokenState } from './token-estimator.js';

const MAX_HISTORY_DAYS = 30;

const state = {
  entries: [],
};

const changeListeners = [];

export function onHistoryChange(cb) {
  changeListeners.push(cb);
}

function notifyChange() {
  for (const cb of changeListeners) {
    try { cb({ entries: [...state.entries] }); } catch (e) { console.error('[ClaudeMonitor]', e); }
  }
}

export function getHistoryState() {
  return { entries: [...state.entries] };
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

async function loadHistory() {
  const result = await storageGet([STORAGE_KEYS.HISTORY]);
  const history = result[STORAGE_KEYS.HISTORY];
  if (Array.isArray(history)) {
    state.entries = history;
  }
}

async function saveHistory() {
  await storageSet({ [STORAGE_KEYS.HISTORY]: state.entries });
}

export async function takeSnapshot() {
  const usage = getUsageState();
  const tokens = getTokenState();
  const today = todayStr();

  const idx = state.entries.findIndex((e) => e.date === today);
  const entry = {
    date: today,
    session: usage.session.utilization,
    weekly: usage.weekly.utilization,
    tokens: tokens.estimatedTokens,
  };

  if (idx >= 0) {
    state.entries[idx] = entry;
  } else {
    state.entries.push(entry);
  }

  if (state.entries.length > MAX_HISTORY_DAYS) {
    state.entries = state.entries.slice(-MAX_HISTORY_DAYS);
  }

  await saveHistory();
  notifyChange();
}

export function handleSnapshotAlarm() {
  takeSnapshot();
}

export async function initHistoryStore() {
  await loadHistory();
  setTimeout(takeSnapshot, 5000);
}

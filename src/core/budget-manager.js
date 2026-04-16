import { BUDGET_THRESHOLDS, STORAGE_KEYS } from './constants.js';
import { storageGet, storageSet } from './storage.js';
import { onUsageChange, getUsageState } from './usage-tracker.js';

const state = {
  enabled: false,
  monthlyBudget: 100,
  budgetType: 'percentage',
  currentUsage: 0,
  alertLevel: null,
  month: null,
};

const changeListeners = [];

export function onBudgetChange(cb) {
  changeListeners.push(cb);
}

function notifyChange() {
  for (const cb of changeListeners) {
    try { cb({ ...state }); } catch (e) { console.error('[ClaudeMonitor]', e); }
  }
}

export function getBudgetState() {
  return { ...state };
}

function getCurrentMonth() {
  return new Date().toISOString().slice(0, 7);
}

async function loadConfig() {
  const result = await storageGet([STORAGE_KEYS.BUDGET_CONFIG, STORAGE_KEYS.BUDGET_USED]);
  const config = result[STORAGE_KEYS.BUDGET_CONFIG];
  const used = result[STORAGE_KEYS.BUDGET_USED];

  if (config) {
    state.enabled = config.enabled ?? false;
    state.monthlyBudget = config.monthlyBudget ?? 100;
    state.budgetType = config.budgetType ?? 'percentage';
  }

  const currentMonth = getCurrentMonth();
  if (used && used.month === currentMonth) {
    state.currentUsage = used.currentUsage ?? 0;
    state.month = currentMonth;
  } else {
    state.currentUsage = 0;
    state.month = currentMonth;
    await storageSet({
      [STORAGE_KEYS.BUDGET_USED]: { month: currentMonth, currentUsage: 0 },
    });
  }

  updateAlertLevel();
}

export async function setBudgetConfig(config) {
  state.enabled = config.enabled ?? state.enabled;
  state.monthlyBudget = config.monthlyBudget ?? state.monthlyBudget;
  state.budgetType = config.budgetType ?? state.budgetType;

  await storageSet({
    [STORAGE_KEYS.BUDGET_CONFIG]: {
      enabled: state.enabled,
      monthlyBudget: state.monthlyBudget,
      budgetType: state.budgetType,
    },
  });

  updateAlertLevel();
  notifyChange();
}

function updateAlertLevel() {
  if (!state.enabled || state.monthlyBudget === 0) {
    state.alertLevel = null;
    return;
  }

  const pct = (state.currentUsage / state.monthlyBudget) * 100;
  if (pct >= BUDGET_THRESHOLDS.CRITICAL) {
    state.alertLevel = 'critical';
  } else if (pct >= BUDGET_THRESHOLDS.WARNING) {
    state.alertLevel = 'warning';
  } else {
    state.alertLevel = null;
  }
}

function handleUsageChange(usageState) {
  if (!state.enabled) return;

  state.currentUsage = usageState.weekly.utilization;
  state.month = getCurrentMonth();

  storageSet({
    [STORAGE_KEYS.BUDGET_USED]: {
      month: state.month,
      currentUsage: state.currentUsage,
    },
  });

  updateAlertLevel();
  notifyChange();
}

export function initBudgetManager() {
  loadConfig();
  onUsageChange(handleUsageChange);
}

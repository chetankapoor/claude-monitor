import { SELECTORS } from '../core/constants.js';
import { injectBridge, onBridgeEvent } from '../core/bridge-client.js';
import { initUsageTracker, onUsageChange, getUsageState, fetchUsage } from '../core/usage-tracker.js';
import { initTokenEstimator, onTokenChange, getTokenState } from '../core/token-estimator.js';
import { initModelDetector, onModelChange, getModelState } from '../core/model-detector.js';
import { initBudgetManager, onBudgetChange, getBudgetState } from '../core/budget-manager.js';
import { initHistoryStore, handleSnapshotAlarm, getHistoryState, onHistoryChange } from '../core/history-store.js';
import {
  createBarStrip,
  getBarStripElement,
  updateTokens,
  updateSession,
  updateWeekly,
  updateModel,
  updateBudget,
  updateCost,
  updateResetCountdown,
  updateHistory,
  markResponseReceived,
} from '../ui/bar-strip.js';

let stripInjected = false;

function injectBarStrip() {
  if (stripInjected && document.getElementById('claude-monitor-strip')) return;

  const strip = getBarStripElement() || createBarStrip();
  const modelSelector = document.querySelector(SELECTORS.MODEL_SELECTOR);

  if (modelSelector) {
    // Walk up from model selector to find a parent that also contains file-upload
    let container = modelSelector.parentElement;
    for (let i = 0; i < 15; i++) {
      if (!container) break;
      if (container.querySelector('[data-testid="file-upload"]')) {
        // This container holds both + and Opus — it's the toolbar area
        // Find the direct child that contains the model selector
        let modelGroup = modelSelector;
        while (modelGroup.parentElement !== container) {
          modelGroup = modelGroup.parentElement;
        }
        // Insert strip before the model selector's group
        container.insertBefore(strip, modelGroup);
        strip.style.flex = '1';
        stripInjected = true;
        renderAll();
        console.log('[ClaudeMonitor] Strip injected in toolbar');
        return;
      }
      container = container.parentElement;
    }
  }

  // Fallback: find the fieldset (chat input box) and insert after it
  const fieldset = document.querySelector('fieldset');
  if (fieldset) {
    fieldset.after(strip);
    stripInjected = true;
    renderAll();
    console.log('[ClaudeMonitor] Strip injected after fieldset');
    return;
  }

  console.warn('[ClaudeMonitor] Could not find injection point');
}

function renderAll() {
  const usage = getUsageState();
  const tokens = getTokenState();
  const model = getModelState();

  updateTokens(tokens.estimatedTokens, model.contextLimit);
  updateSession(usage.session.utilization);
  updateCost(tokens.estimatedCostUSD);
  updateResetCountdown(usage.session.resetsAt);
}

function observeStripRemoval() {
  const observer = new MutationObserver(() => {
    if (!document.getElementById('claude-monitor-strip')) {
      stripInjected = false;
      // Also remove orphaned spacer
      const spacer = document.getElementById('cm-spacer');
      if (spacer) spacer.remove();
      injectBarStrip();
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
}

function waitForElement(selector, timeoutMs = 30000) {
  return new Promise((resolve) => {
    const existing = document.querySelector(selector);
    if (existing) { resolve(existing); return; }

    let timeoutId;
    const observer = new MutationObserver(() => {
      const el = document.querySelector(selector);
      if (el) {
        if (timeoutId) clearTimeout(timeoutId);
        observer.disconnect();
        resolve(el);
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
    timeoutId = setTimeout(() => { observer.disconnect(); resolve(null); }, timeoutMs);
  });
}

function startResetTicker() {
  setInterval(() => {
    const usage = getUsageState();
    updateResetCountdown(usage.session.resetsAt, usage.weekly.resetsAt);
  }, 1000);
}

if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'alarm-fired') {
      fetchUsage();
    }
    if (msg.type === 'take-snapshot') {
      handleSnapshotAlarm();
    }
  });
}

async function init() {
  injectBridge();

  await new Promise((resolve) => {
    onBridgeEvent('cm:bridge_ready', resolve);
    setTimeout(resolve, 3000);
  });

  initUsageTracker();
  initTokenEstimator();
  initModelDetector();
  initBudgetManager();
  await initHistoryStore();

  onUsageChange((usage) => {
    updateSession(usage.session.utilization);
    updateResetCountdown(usage.session.resetsAt);

    try {
      if (usage.session.resetsAt && chrome?.runtime?.sendMessage) {
        chrome.runtime.sendMessage({
          type: 'set-alarm',
          name: 'session-reset-check',
          when: new Date(usage.session.resetsAt).getTime(),
        });
      }
      if (usage.weekly.resetsAt && chrome?.runtime?.sendMessage) {
        chrome.runtime.sendMessage({
          type: 'set-alarm',
          name: 'weekly-reset-check',
          when: new Date(usage.weekly.resetsAt).getTime(),
        });
      }
    } catch (e) {
      // Chrome runtime not available
    }
  });

  onTokenChange((tokens) => {
    const model = getModelState();
    updateTokens(tokens.estimatedTokens, model.contextLimit);
    updateCost(tokens.estimatedCostUSD);
  });

  onModelChange((model) => {
    const tokens = getTokenState();
    updateTokens(tokens.estimatedTokens, model.contextLimit);
    updateModel(model.modelLabel);
  });

  onBudgetChange((budget) => {
    updateBudget(budget.enabled, budget.currentUsage, budget.monthlyBudget, budget.alertLevel);
  });

  onHistoryChange((history) => {
    updateHistory(history.entries);
  });

  onBridgeEvent('cm:message_limit', () => {
    markResponseReceived();
  });

  await waitForElement(SELECTORS.CHAT_INPUT);
  injectBarStrip();

  observeStripRemoval();
  startResetTicker();

  onBridgeEvent('cm:urlchange', () => {
    setTimeout(async () => {
      await waitForElement(SELECTORS.CHAT_INPUT, 10000);
      injectBarStrip();
    }, 500);
  });

  console.log('[ClaudeMonitor] Initialized');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

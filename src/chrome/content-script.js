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

  // Find the toolbar row that contains + and Opus 4.7
  // The model-selector-dropdown is inside the right side of the toolbar
  const modelSelector = document.querySelector(SELECTORS.MODEL_SELECTOR);
  if (modelSelector) {
    // Walk up to find the flex row that is the toolbar
    let toolbarRow = modelSelector.parentElement;
    while (toolbarRow) {
      const cs = window.getComputedStyle(toolbarRow);
      // The toolbar row is a flex container with justify-content that has both + and model selector
      if (cs.display === 'flex' && toolbarRow.querySelector('[data-testid="file-upload"]')) {
        break;
      }
      toolbarRow = toolbarRow.parentElement;
    }

    if (toolbarRow) {
      // Find the right-side group (contains model selector, audio button, etc.)
      // Insert strip as a child of the toolbar, pushed to center via CSS
      // Find the first child that contains the model selector (right group)
      let rightGroup = modelSelector;
      while (rightGroup.parentElement !== toolbarRow) {
        rightGroup = rightGroup.parentElement;
      }

      // Create a spacer that pushes the strip to center
      const spacer = document.createElement('div');
      spacer.style.flex = '1';
      spacer.id = 'cm-spacer';

      // Insert: [+ button] [spacer] [STRIP] [right group with Opus]
      toolbarRow.insertBefore(spacer, rightGroup);
      toolbarRow.insertBefore(strip, rightGroup);

      stripInjected = true;
      renderAll();
      console.log('[ClaudeMonitor] Strip injected in toolbar between + and Opus');
      return;
    }
  }

  // Fallback: insert after chat-input
  const chatInput = document.querySelector(SELECTORS.CHAT_INPUT);
  if (chatInput) {
    chatInput.after(strip);
    stripInjected = true;
    renderAll();
    console.log('[ClaudeMonitor] Strip injected after chat input');
    return;
  }

  console.warn('[ClaudeMonitor] Could not find injection point');
}

function renderAll() {
  const usage = getUsageState();
  const tokens = getTokenState();
  const model = getModelState();
  const budget = getBudgetState();
  const history = getHistoryState();

  updateTokens(tokens.estimatedTokens, model.contextLimit);
  updateSession(usage.session.utilization);
  updateCost(usage.session.utilization, usage.weekly.utilization);
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

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'alarm-fired') {
    fetchUsage();
  }
  if (msg.type === 'take-snapshot') {
    handleSnapshotAlarm();
  }
});

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
    updateCost(usage.session.utilization, usage.weekly.utilization);
    updateResetCountdown(usage.session.resetsAt);

    if (usage.session.resetsAt) {
      chrome.runtime.sendMessage({
        type: 'set-alarm',
        name: 'session-reset-check',
        when: new Date(usage.session.resetsAt).getTime(),
      });
    }
    if (usage.weekly.resetsAt) {
      chrome.runtime.sendMessage({
        type: 'set-alarm',
        name: 'weekly-reset-check',
        when: new Date(usage.weekly.resetsAt).getTime(),
      });
    }
  });

  onTokenChange((tokens) => {
    const model = getModelState();
    updateTokens(tokens.estimatedTokens, model.contextLimit);
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

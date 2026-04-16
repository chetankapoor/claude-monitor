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
  updateResetCountdown,
  updateHistory,
  markResponseReceived,
} from '../ui/bar-strip.js';

let stripInjected = false;

function injectBarStrip() {
  if (stripInjected && document.getElementById('claude-monitor-strip')) return;

  const strip = getBarStripElement() || createBarStrip();

  // Strategy 1: Insert between chat-input and the toolbar row (+ | Opus 4.7)
  // Find the model selector toolbar row and insert the strip BEFORE it
  const modelSelector = document.querySelector(SELECTORS.MODEL_SELECTOR);
  if (modelSelector) {
    // Walk up to find the toolbar row containing + and model selector
    let toolbarRow = modelSelector.closest('[class]');
    let el = modelSelector.parentElement;
    while (el) {
      const style = window.getComputedStyle(el);
      if (style.display === 'flex' && el.querySelector(SELECTORS.MODEL_SELECTOR)) {
        toolbarRow = el;
        break;
      }
      el = el.parentElement;
    }
    if (toolbarRow && toolbarRow.parentElement) {
      toolbarRow.parentElement.insertBefore(strip, toolbarRow);
      stripInjected = true;
      renderAll();
      console.log('[ClaudeMonitor] Strip injected above toolbar row');
      return;
    }
  }

  // Strategy 2: Insert after chat-input div
  const chatInput = document.querySelector(SELECTORS.CHAT_INPUT);
  if (chatInput) {
    chatInput.after(strip);
    stripInjected = true;
    renderAll();
    console.log('[ClaudeMonitor] Strip injected after chat input');
    return;
  }

  // Strategy 3: Find ProseMirror editor container
  const editor = document.querySelector('.ProseMirror, .tiptap');
  if (editor) {
    let container = editor;
    for (let i = 0; i < 3; i++) {
      if (container.parentElement) container = container.parentElement;
    }
    container.after(strip);
    stripInjected = true;
    renderAll();
    console.log('[ClaudeMonitor] Strip injected after editor container');
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
  updateSession(usage.session.utilization, usage.session.resetsAt);
  updateWeekly(usage.weekly.utilization, usage.weekly.resetsAt);
  updateModel(model.modelLabel);
  updateBudget(budget.enabled, budget.currentUsage, budget.monthlyBudget, budget.alertLevel);
  updateResetCountdown(usage.session.resetsAt, usage.weekly.resetsAt);
  updateHistory(history.entries);
}

function observeStripRemoval() {
  const observer = new MutationObserver(() => {
    if (!document.getElementById('claude-monitor-strip')) {
      stripInjected = false;
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
    updateSession(usage.session.utilization, usage.session.resetsAt);
    updateWeekly(usage.weekly.utilization, usage.weekly.resetsAt);
    updateResetCountdown(usage.session.resetsAt, usage.weekly.resetsAt);

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

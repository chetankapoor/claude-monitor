import { MODEL_LIMITS, SELECTORS } from './constants.js';
import { onBridgeEvent } from './bridge-client.js';

const state = {
  modelId: null,
  modelLabel: MODEL_LIMITS.default.label,
  contextLimit: MODEL_LIMITS.default.context,
};

const changeListeners = [];

export function onModelChange(cb) {
  changeListeners.push(cb);
}

function notifyChange() {
  for (const cb of changeListeners) {
    try { cb({ ...state }); } catch (e) { console.error('[ClaudeMonitor]', e); }
  }
}

export function getModelState() {
  return { ...state };
}

function resolveModel(rawId) {
  if (!rawId) return;

  const id = rawId.toLowerCase();
  for (const [key, info] of Object.entries(MODEL_LIMITS)) {
    if (key === 'default') continue;
    if (id.includes(key) || id.includes(key.replace('claude-', ''))) {
      state.modelId = key;
      state.modelLabel = info.label;
      state.contextLimit = info.context;
      notifyChange();
      return;
    }
  }

  state.modelId = rawId;
  state.modelLabel = rawId;
  state.contextLimit = MODEL_LIMITS.default.context;
  notifyChange();
}

function detectFromDOM() {
  const selector = document.querySelector(SELECTORS.MODEL_SELECTOR);
  if (selector) {
    const text = selector.textContent?.trim();
    if (text) resolveModel(text);
  }
}

export function initModelDetector() {
  onBridgeEvent('cm:message_start', (data) => {
    if (data?.model) resolveModel(data.model);
  });

  detectFromDOM();
  setInterval(detectFromDOM, 10000);
}

import { CHARS_PER_TOKEN } from './constants.js';
import { onBridgeEvent } from './bridge-client.js';

// Per-million-token pricing (USD) by model family
const MODEL_PRICING = {
  'opus':   { input: 15,    output: 75 },
  'sonnet': { input: 3,     output: 15 },
  'haiku':  { input: 0.25,  output: 1.25 },
  default:  { input: 3,     output: 15 }, // assume Sonnet pricing
};

const state = {
  estimatedTokens: 0,
  contextLimit: 200000,
  // Cumulative session cost tracking
  totalInputTokens: 0,
  totalOutputTokens: 0,
  estimatedCostUSD: 0,
  currentModel: 'default',
};

const changeListeners = [];

export function onTokenChange(cb) {
  changeListeners.push(cb);
}

function notifyChange() {
  for (const cb of changeListeners) {
    try { cb({ ...state }); } catch (e) { console.error('[ClaudeMonitor]', e); }
  }
}

export function getTokenState() {
  return { ...state };
}

function getPricing(model) {
  const id = (model || '').toLowerCase();
  for (const [key, pricing] of Object.entries(MODEL_PRICING)) {
    if (key === 'default') continue;
    if (id.includes(key)) return pricing;
  }
  return MODEL_PRICING.default;
}

function recalcCost() {
  const pricing = getPricing(state.currentModel);
  state.estimatedCostUSD =
    (state.totalInputTokens / 1_000_000) * pricing.input +
    (state.totalOutputTokens / 1_000_000) * pricing.output;
}

function countConversationChars() {
  const messages = document.querySelectorAll(
    '[data-testid^="chat-message-"], .font-claude-message, .font-user-message'
  );
  let totalChars = 0;
  for (const msg of messages) {
    totalChars += (msg.textContent || '').length;
  }
  return totalChars;
}

export function estimateTokens() {
  const chars = countConversationChars();
  state.estimatedTokens = Math.round(chars / CHARS_PER_TOKEN);
  notifyChange();
  return state.estimatedTokens;
}

function handleConversationTree(data) {
  if (!data || !data.chat_messages) return;
  let totalChars = 0;
  for (const msg of data.chat_messages) {
    if (msg.text) totalChars += msg.text.length;
    if (msg.content) {
      for (const block of msg.content) {
        if (block.text) totalChars += block.text.length;
      }
    }
  }
  state.estimatedTokens = Math.round(totalChars / CHARS_PER_TOKEN);
  notifyChange();
}

// message_start gives us input tokens for this turn
function handleMessageStart(data) {
  if (data?.model) {
    state.currentModel = data.model;
  }
  if (data?.usage?.input_tokens) {
    state.estimatedTokens = data.usage.input_tokens;
    state.totalInputTokens += data.usage.input_tokens;
    recalcCost();
    notifyChange();
  }
}

// message_delta gives us output tokens for this turn
function handleMessageDelta(data) {
  if (data?.usage?.output_tokens) {
    state.totalOutputTokens += data.usage.output_tokens;
    recalcCost();
    notifyChange();
  }
}

export function initTokenEstimator() {
  onBridgeEvent('cm:conversation', handleConversationTree);
  onBridgeEvent('cm:message_start', handleMessageStart);
  onBridgeEvent('cm:message_delta', handleMessageDelta);

  setInterval(estimateTokens, 5000);
  setTimeout(estimateTokens, 1000);
}

import { CHARS_PER_TOKEN } from './constants.js';
import { onBridgeEvent } from './bridge-client.js';

// Per-million-token pricing (USD) by model family
const MODEL_PRICING = {
  'opus':   { input: 15,    output: 75 },
  'sonnet': { input: 3,     output: 15 },
  'haiku':  { input: 0.25,  output: 1.25 },
  default:  { input: 3,     output: 15 },
};

const state = {
  estimatedTokens: 0,
  contextLimit: 200000,
  inputTokens: 0,
  outputTokens: 0,
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
    (state.inputTokens / 1_000_000) * pricing.input +
    (state.outputTokens / 1_000_000) * pricing.output;
}

// Count tokens by scanning the DOM — separate user (input) vs Claude (output)
function countFromDOM() {
  let inputChars = 0;
  let outputChars = 0;

  // User messages
  const userMsgs = document.querySelectorAll(
    '[data-testid="user-message"], [data-is-human="true"], .font-user-message'
  );
  for (const msg of userMsgs) {
    inputChars += (msg.textContent || '').length;
  }

  // Claude messages — everything that's not a user message in the conversation
  const allMsgs = document.querySelectorAll(
    '[data-testid^="chat-message-"], .font-claude-message'
  );
  for (const msg of allMsgs) {
    outputChars += (msg.textContent || '').length;
  }

  // If selectors didn't separate well, try a broader approach
  if (inputChars === 0 && outputChars === 0) {
    // Look for the conversation container and split by turn
    const turns = document.querySelectorAll('[data-testid]');
    for (const turn of turns) {
      const testId = turn.getAttribute('data-testid') || '';
      const text = (turn.textContent || '').length;
      if (testId.includes('user')) {
        inputChars += text;
      } else if (testId.includes('message') && !testId.includes('user')) {
        outputChars += text;
      }
    }
  }

  // Broader fallback: count all visible conversation text
  if (inputChars === 0 && outputChars === 0) {
    const container = document.querySelector('[class*="conversation"], [class*="chat-messages"], main');
    if (container) {
      const total = (container.textContent || '').length;
      // Rough split: ~30% user input, ~70% Claude output
      inputChars = Math.round(total * 0.3);
      outputChars = Math.round(total * 0.7);
    }
  }

  state.inputTokens = Math.round(inputChars / CHARS_PER_TOKEN);
  state.outputTokens = Math.round(outputChars / CHARS_PER_TOKEN);
  state.estimatedTokens = state.inputTokens + state.outputTokens;
  recalcCost();
}

export function estimateTokens() {
  countFromDOM();
  notifyChange();
  return state.estimatedTokens;
}

// If API provides actual token counts, use those (more accurate)
function handleMessageStart(data) {
  if (data?.model) {
    state.currentModel = data.model;
    recalcCost();
  }
  if (data?.usage?.input_tokens) {
    state.inputTokens = data.usage.input_tokens;
    state.estimatedTokens = state.inputTokens + state.outputTokens;
    recalcCost();
    notifyChange();
  }
}

function handleMessageDelta(data) {
  if (data?.usage?.output_tokens) {
    state.outputTokens = data.usage.output_tokens;
    state.estimatedTokens = state.inputTokens + state.outputTokens;
    recalcCost();
    notifyChange();
  }
}

function handleConversationTree(data) {
  if (!data || !data.chat_messages) return;
  let inputChars = 0;
  let outputChars = 0;
  for (const msg of data.chat_messages) {
    const text = msg.text || '';
    const contentText = (msg.content || []).map(b => b.text || '').join('');
    const chars = text.length + contentText.length;
    if (msg.sender === 'human') {
      inputChars += chars;
    } else {
      outputChars += chars;
    }
  }
  state.inputTokens = Math.round(inputChars / CHARS_PER_TOKEN);
  state.outputTokens = Math.round(outputChars / CHARS_PER_TOKEN);
  state.estimatedTokens = state.inputTokens + state.outputTokens;
  recalcCost();
  notifyChange();
}

export function initTokenEstimator() {
  onBridgeEvent('cm:conversation', handleConversationTree);
  onBridgeEvent('cm:message_start', handleMessageStart);
  onBridgeEvent('cm:message_delta', handleMessageDelta);

  // Recount from DOM every 3 seconds
  setInterval(estimateTokens, 3000);
  setTimeout(estimateTokens, 1000);
}

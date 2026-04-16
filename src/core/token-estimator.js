import { CHARS_PER_TOKEN, SELECTORS } from './constants.js';
import { onBridgeEvent } from './bridge-client.js';

const state = {
  estimatedTokens: 0,
  contextLimit: 200000,
  lastApiTokenCount: null,
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

function handleMessageDelta(data) {
  if (data?.usage?.output_tokens) {
    state.lastApiTokenCount = data.usage.output_tokens;
  }
}

function handleMessageStart(data) {
  if (data?.usage?.input_tokens) {
    state.estimatedTokens = data.usage.input_tokens;
    notifyChange();
  }
}

export function initTokenEstimator() {
  onBridgeEvent('cm:conversation', handleConversationTree);
  onBridgeEvent('cm:message_delta', handleMessageDelta);
  onBridgeEvent('cm:message_start', handleMessageStart);

  setInterval(estimateTokens, 5000);
  setTimeout(estimateTokens, 1000);
}

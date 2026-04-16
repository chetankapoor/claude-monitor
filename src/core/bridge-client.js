import { BRIDGE_TAG } from './constants.js';

const listeners = {};
let requestCounter = 0;
const pendingRequests = {};

export function onBridgeEvent(type, callback) {
  if (!listeners[type]) listeners[type] = [];
  listeners[type].push(callback);
}

export function offBridgeEvent(type, callback) {
  if (!listeners[type]) return;
  listeners[type] = listeners[type].filter((cb) => cb !== callback);
}

function emit(type, data) {
  const cbs = listeners[type];
  if (cbs) {
    for (const cb of cbs) {
      try { cb(data); } catch (e) { console.error('[ClaudeMonitor]', e); }
    }
  }
}

export function bridgeRequest(kind, payload = {}, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const requestId = `${Date.now()}-${++requestCounter}`;
    const timer = setTimeout(() => {
      delete pendingRequests[requestId];
      reject(new Error(`Bridge request ${kind} timed out`));
    }, timeoutMs);

    pendingRequests[requestId] = { resolve, reject, timer };

    window.postMessage({
      tag: BRIDGE_TAG,
      type: 'cm:request',
      kind,
      requestId,
      ...payload,
    }, '*');
  });
}

export function injectBridge() {
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('bridge.js');
  script.onload = () => script.remove();
  (document.head || document.documentElement).appendChild(script);
}

window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  const msg = event.data;
  if (!msg || msg.tag !== BRIDGE_TAG) return;

  if (msg.type === 'cm:response' && msg.data?.requestId) {
    const pending = pendingRequests[msg.data.requestId];
    if (pending) {
      clearTimeout(pending.timer);
      delete pendingRequests[msg.data.requestId];
      if (msg.data.error) {
        pending.reject(new Error(msg.data.error));
      } else {
        pending.resolve(msg.data.data);
      }
    }
    return;
  }

  emit(msg.type, msg.data);
});

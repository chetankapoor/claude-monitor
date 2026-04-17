// Thin abstraction over chrome.storage.local
// Falls back to in-memory storage if chrome.storage is unavailable

const memoryStore = {};

function hasChrome() {
  return typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;
}

export function storageGet(keys) {
  if (!hasChrome()) {
    const result = {};
    const keyList = Array.isArray(keys) ? keys : [keys];
    for (const k of keyList) {
      if (k in memoryStore) result[k] = memoryStore[k];
    }
    return Promise.resolve(result);
  }
  return new Promise((resolve) => {
    chrome.storage.local.get(keys, resolve);
  });
}

export function storageSet(items) {
  if (!hasChrome()) {
    Object.assign(memoryStore, items);
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    chrome.storage.local.set(items, resolve);
  });
}

export function storageRemove(keys) {
  if (!hasChrome()) {
    const keyList = Array.isArray(keys) ? keys : [keys];
    for (const k of keyList) delete memoryStore[k];
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    chrome.storage.local.remove(keys, resolve);
  });
}

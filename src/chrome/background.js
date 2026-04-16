// Background service worker for Claude Monitor
// Uses chrome.alarms for reliable timers that survive worker termination

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'session-reset-check' || alarm.name === 'weekly-reset-check') {
    chrome.tabs.query({ url: 'https://claude.ai/*' }, (tabs) => {
      for (const tab of tabs) {
        chrome.tabs.sendMessage(tab.id, {
          type: 'alarm-fired',
          name: alarm.name,
        });
      }
    });
  }

  if (alarm.name === 'usage-snapshot') {
    chrome.tabs.query({ url: 'https://claude.ai/*' }, (tabs) => {
      for (const tab of tabs) {
        chrome.tabs.sendMessage(tab.id, {
          type: 'take-snapshot',
        });
      }
    });
  }
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create('usage-snapshot', {
    periodInMinutes: 1440,
  });
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'set-alarm') {
    chrome.alarms.create(msg.name, {
      when: msg.when,
    });
    sendResponse({ ok: true });
  }
  if (msg.type === 'get-alarm') {
    chrome.alarms.get(msg.name, (alarm) => {
      sendResponse({ alarm: alarm || null });
    });
    return true;
  }
});

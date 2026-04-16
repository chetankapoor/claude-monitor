import { USAGE_ENDPOINT_WINDOWS } from './constants.js';
import { onBridgeEvent, bridgeRequest } from './bridge-client.js';

const state = {
  session: { utilization: 0, resetsAt: null },
  weekly: { utilization: 0, resetsAt: null },
  lastUpdated: null,
  orgId: null,
};

const changeListeners = [];

export function onUsageChange(cb) {
  changeListeners.push(cb);
}

function notifyChange() {
  for (const cb of changeListeners) {
    try { cb({ ...state }); } catch (e) { console.error('[ClaudeMonitor]', e); }
  }
}

export function getUsageState() {
  return { ...state };
}

export function setOrgId(orgId) {
  state.orgId = orgId;
}

function parseFromMessageLimit(data) {
  if (!data) return;

  const windows = data.windows || data;
  if (windows['5h']) {
    state.session.utilization = Math.round(windows['5h'].utilization * 100);
    if (windows['5h'].resets_at) {
      state.session.resetsAt = new Date(windows['5h'].resets_at * 1000).toISOString();
    }
  }
  if (windows['7d']) {
    state.weekly.utilization = Math.round(windows['7d'].utilization * 100);
    if (windows['7d'].resets_at) {
      state.weekly.resetsAt = new Date(windows['7d'].resets_at * 1000).toISOString();
    }
  }

  state.lastUpdated = new Date().toISOString();
  notifyChange();
}

function parseFromUsageEndpoint(data) {
  if (!data) return;

  for (const [endpointKey, windowKey] of Object.entries(USAGE_ENDPOINT_WINDOWS)) {
    const window = data[endpointKey];
    if (!window) continue;

    const target = windowKey === '5h' ? state.session : state.weekly;
    target.utilization = Math.round(window.utilization);
    if (window.resets_at) {
      target.resetsAt = window.resets_at;
    }
  }

  state.lastUpdated = new Date().toISOString();
  notifyChange();
}

export async function fetchUsage() {
  if (!state.orgId) {
    const orgId = getOrgIdFromCookie();
    if (orgId) state.orgId = orgId;
    else return;
  }

  try {
    const data = await bridgeRequest('usage', { orgId: state.orgId });
    parseFromUsageEndpoint(data);
  } catch (e) {
    console.warn('[ClaudeMonitor] Failed to fetch usage:', e.message);
  }
}

function getOrgIdFromCookie() {
  try {
    return document.cookie
      .split('; ')
      .find((row) => row.startsWith('lastActiveOrg='))
      ?.split('=')[1] || null;
  } catch {
    return null;
  }
}

function extractOrgIdFromUrl(url) {
  if (!url) return;
  const match = url.match(/\/organizations\/([^/]+)/);
  if (match && match[1]) {
    state.orgId = match[1];
  }
}

export function initUsageTracker() {
  onBridgeEvent('cm:message_limit', parseFromMessageLimit);

  onBridgeEvent('cm:generation_start', (data) => {
    extractOrgIdFromUrl(data?.url);
  });

  setTimeout(fetchUsage, 2000);
}

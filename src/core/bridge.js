(() => {
  'use strict';

  const TAG = 'ClaudeMonitor';
  const originalFetch = window.fetch;

  function post(type, data) {
    window.postMessage({ tag: TAG, type, data }, '*');
  }

  function parseSSELines(text) {
    const events = [];
    const lines = text.split('\n');
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          events.push(JSON.parse(line.slice(6)));
        } catch {
          // Not valid JSON, skip
        }
      }
    }
    return events;
  }

  async function handleEventStream(response, url) {
    const clone = response.clone();
    const reader = clone.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const events = parseSSELines(buffer);
        const lastNewline = buffer.lastIndexOf('\n');
        buffer = lastNewline >= 0 ? buffer.slice(lastNewline + 1) : buffer;

        for (const event of events) {
          if (event.type === 'message_limit') {
            post('cm:message_limit', event.message_limit);
          }
          if (event.type === 'message_start' && event.message) {
            post('cm:message_start', {
              model: event.message.model,
              usage: event.message.usage,
            });
          }
          if (event.type === 'message_delta' && event.usage) {
            post('cm:message_delta', {
              usage: event.usage,
            });
          }
        }
      }
    } catch {
      // Stream closed or errored
    }
  }

  function extractOrgId(url) {
    const match = url.match(/\/organizations\/([^/]+)/);
    return match ? match[1] : null;
  }

  window.fetch = async function (...args) {
    const request = args[0];
    const url = typeof request === 'string' ? request : request?.url || '';

    if (typeof url === 'string' && (url.includes('/completion') || url.includes('/retry_completion'))) {
      const method = args[1]?.method || (typeof request === 'object' ? request.method : 'GET');
      if (method === 'POST') {
        post('cm:generation_start', { url });
      }
    }

    const response = await originalFetch.apply(this, args);

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('text/event-stream')) {
      handleEventStream(response, url);
    }

    if (typeof url === 'string' && url.includes('/chat_conversations/') && url.includes('tree=')) {
      try {
        const clone = response.clone();
        const json = await clone.json();
        post('cm:conversation', json);
      } catch {
        // Not JSON or failed
      }
    }

    return response;
  };

  window.addEventListener('message', async (event) => {
    if (event.source !== window) return;
    if (!event.data || event.data.tag !== TAG || event.data.type !== 'cm:request') return;

    const { kind, requestId, orgId } = event.data;

    if (kind === 'usage' && orgId) {
      try {
        const resp = await originalFetch(
          `https://claude.ai/api/organizations/${orgId}/usage`,
          { credentials: 'include' }
        );
        const json = await resp.json();
        post('cm:response', { requestId, data: json });
      } catch (err) {
        post('cm:response', { requestId, error: err.message });
      }
    }
  });

  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;

  history.pushState = function (...args) {
    originalPushState.apply(this, args);
    post('cm:urlchange', { url: window.location.href });
  };
  history.replaceState = function (...args) {
    originalReplaceState.apply(this, args);
    post('cm:urlchange', { url: window.location.href });
  };
  window.addEventListener('popstate', () => {
    post('cm:urlchange', { url: window.location.href });
  });

  post('cm:bridge_ready', {});
})();

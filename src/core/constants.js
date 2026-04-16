// DOM selectors used to find injection points on claude.ai
export const SELECTORS = {
  CHAT_INPUT: '[data-testid="chat-input"]',
  MODEL_SELECTOR: '[data-testid="model-selector-dropdown"]',
  CHAT_MENU_TRIGGER: '[data-testid="chat-menu-trigger"]',
};

export const MODEL_LIMITS = {
  'claude-opus-4': { context: 200000, label: 'Opus 4' },
  'claude-sonnet-4': { context: 200000, label: 'Sonnet 4' },
  'claude-haiku-4': { context: 200000, label: 'Haiku 4' },
  default: { context: 200000, label: 'Claude' },
};

export const CHARS_PER_TOKEN = 4;
export const CACHE_TTL_SECONDS = 300;

export const BUDGET_THRESHOLDS = {
  WARNING: 80,
  CRITICAL: 90,
};

export const API_BASE = 'https://claude.ai/api';

export const RATE_WINDOWS = {
  SESSION: '5h',
  WEEKLY: '7d',
};

export const BRIDGE_TAG = 'ClaudeMonitor';

export const STORAGE_KEYS = {
  BUDGET_CONFIG: 'cm_budget_config',
  BUDGET_USED: 'cm_budget_used',
  HISTORY: 'cm_history',
  PREFERENCES: 'cm_preferences',
};

export const USAGE_ENDPOINT_WINDOWS = {
  five_hour: '5h',
  seven_day: '7d',
};

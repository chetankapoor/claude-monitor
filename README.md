<p align="center">
  <img src="icons/icon128.png" alt="Claude Monitor" width="80" />
</p>

<h1 align="center">Claude Monitor</h1>

<p align="center">
  <strong>Real-time token usage, cost tracking, and session stats for claude.ai</strong>
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT License" /></a>
  <img src="https://img.shields.io/badge/manifest-v3-green.svg" alt="Manifest V3" />
  <img src="https://img.shields.io/badge/chrome-%3E%3D120-brightgreen.svg" alt="Chrome 120+" />
</p>

---

A lightweight Chrome extension that injects a compact usage strip directly into the claude.ai interface. See your token consumption, estimated API cost, session utilization, and rate limit reset — all without leaving the conversation.

## Features

| Feature | Description |
|---------|-------------|
| **Token Counter** | Approximate token usage vs 200k context limit with visual progress bar |
| **Session Usage** | 5-hour rolling rate limit utilization from Claude's SSE stream |
| **Cost Tracker** | Estimated API-equivalent cost based on model pricing (Opus/Sonnet/Haiku) |
| **Reset Countdown** | Time until your rate limit resets |

### How Cost is Calculated

Cost shows the **estimated API-equivalent** of your conversation based on current model pricing:

| Model | Input | Output |
|-------|-------|--------|
| Opus | $15 / MTok | $75 / MTok |
| Sonnet | $3 / MTok | $15 / MTok |
| Haiku | $0.25 / MTok | $1.25 / MTok |

> This is an estimate based on visible conversation text, not actual API billing. Useful for understanding the value of your usage.

## Installation

### From source (Developer mode)

1. Clone the repo:
   ```bash
   git clone https://github.com/chetankapoor/claude-monitor.git
   cd claude-monitor
   ```

2. Install dependencies and build:
   ```bash
   npm install
   npm run build
   ```

3. Load in Chrome:
   - Open `chrome://extensions`
   - Enable **Developer mode** (top-right toggle)
   - Click **Load unpacked**
   - Select the `build/chrome` directory

4. Navigate to [claude.ai](https://claude.ai) — the usage strip appears on the toolbar row.

### From ZIP

1. Download the latest release ZIP
2. Open `chrome://extensions`
3. Enable **Developer mode**
4. Drag and drop the ZIP file

## Usage

Once installed, the monitor strip appears inline on the claude.ai toolbar between the `+` button and the model selector:

```
+   Tokens [████░░░░░░|░░░░░░░░░░] 45k/200k | Session [░░░░░░░░░░|░░░░░░░░░░] 0% | Cost $0.12 | Reset 2h 15m   Opus 4.7 ∨
```

- **Bars** fill with Claude's terracotta brand color and include a 50% tick mark
- **Cost** updates live as Claude streams responses
- **Reset** counts down to when your rate limit refreshes
- Everything runs **locally** — no data leaves your browser

## Architecture

```
src/
├── core/                  # Platform-agnostic logic (pure JS)
│   ├── bridge.js          # Injected into page context — intercepts fetch/SSE
│   ├── bridge-client.js   # Content script side — receives bridge messages
│   ├── usage-tracker.js   # Parses message_limit SSE + /usage endpoint
│   ├── token-estimator.js # Token counting + cost calculation
│   ├── model-detector.js  # Detects active model from SSE/DOM
│   ├── budget-manager.js  # Monthly budget tracking
│   ├── history-store.js   # Daily usage snapshots
│   ├── storage.js         # Storage abstraction (chrome.storage / memory fallback)
│   └── constants.js       # Selectors, limits, pricing
├── ui/
│   ├── bar-strip.js       # DOM component — single-line usage strip
│   └── styles.css         # Scoped styles with dark/light mode
└── chrome/
    ├── manifest.json      # Manifest V3
    ├── content-script.js  # Entry point — wires everything together
    └── background.js      # Service worker for alarms
```

**Key design decisions:**
- **SSE interception in content script** — service workers die after ~30s idle
- **IIFE bundles via esbuild** — ES modules not supported in Firefox content scripts
- **Char ÷ 4 token heuristic** — no vendored tokenizer, keeps extension under 30KB
- **Core has zero browser API deps** — portable to Firefox and Safari later

## Development

```bash
npm run build    # Build extension → build/chrome/
npm run zip      # Build + create ZIP for Chrome Web Store
npm run icons    # Regenerate extension icons
```

After changes, reload the extension at `chrome://extensions` and hard refresh claude.ai (`Cmd+Shift+R`).

## Privacy

- Runs **entirely locally** — zero external server calls
- No analytics, no telemetry, no tracking
- Only communicates with `claude.ai` domains
- All data stored on your machine

## Roadmap

| Phase | Status | Target |
|-------|--------|--------|
| Chrome Extension | ✅ | Chrome Web Store |
| Firefox | Planned | Add firefox/ manifest + webextension-polyfill |
| Mac App | Planned | Safari Web Extension via Xcode converter |

## License

[MIT](LICENSE) — built by [Chetan Kapoor](https://github.com/chetankapoor)

Inspired by techniques from [claude-counter](https://github.com/she-llac/claude-counter) (MIT). Clean-room implementation — no code copied.

# Recent Tab Switcher

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A lightweight Chrome extension that makes switching between recently-used tabs fast and visual. Press a single keyboard shortcut to open a quick-switch overlay, then press it again to cycle back through your tab history. It works just like `Alt+Tab` for browser tabs.

## Why use this?

If you keep many tabs open and constantly jump between a few of them, browser tab switching can feel slow. Recent Tab Switcher keeps a history of the tabs you have actually used and lets you flip back instantly, without hunting through the tab bar.

## Features

- **Quick switcher overlay** — press `Alt+Q` (Windows/Linux) or `Ctrl+Q` (macOS) to open it.
- **Cycle through recent tabs** — keep pressing the shortcut to go further back in your tab history.
- **Popup view** — click the extension icon to see a ranked list of recent tabs.
- **Smart ordering** — background tabs opened from links are placed right after your current tab, so Alt+Tab-style switching feels natural.
- **No remote servers** — all tab history is stored locally in your browser.
- **Privacy first** — no analytics, no tracking, and no data ever leaves your device.

## Install

### Option 1: Chrome Web Store (recommended)

1. Visit the extension page in the Chrome Web Store.
2. Click **Add to Chrome**.
3. Confirm the permissions prompt.

### Option 2: Manual install (developer mode)

1. Download or clone this repository.
2. Open Chrome and go to `chrome://extensions/`.
3. Enable **Developer mode** in the top-right corner.
4. Click **Load unpacked**.
5. Select the folder containing the extension files.
6. The extension icon should appear in your toolbar.

## Usage

### Keyboard shortcut

| Action | Windows/Linux | macOS |
|--------|---------------|-------|
| Open switcher / go back one tab | `Alt+Q` | `Ctrl+Q` |
| Cycle further back | keep pressing `Alt+Q` / `Ctrl+Q` | keep pressing `Alt+Q` / `Ctrl+Q` |
| Close switcher without switching | `Esc` | `Esc` |
| Select highlighted tab | release `Alt` / `Ctrl` | release `Alt` / `Ctrl` |

The exact shortcut can be customized from the extension popup or by visiting `chrome://extensions/shortcuts`.

### Extension popup

Click the Recent Tab Switcher icon to open a popup listing all recent tabs. Click any tab to jump to it.

## Permissions

The extension requests these permissions to function:

- `tabs` — read tab titles, URLs, and switch between tabs.
- `activeTab` — interact with the currently active tab to show the switcher overlay.
- `scripting` — inject the switcher overlay UI into the current page.
- `storage` — persist recent tab history in the browser session.

No data is sent to any server.

## Development

This is a Manifest V3 Chrome extension. There are no build steps required.

1. Clone the repository.
2. Open Chrome and go to `chrome://extensions/`.
3. Enable **Developer mode**.
4. Click **Load unpacked** and select the project folder.
5. Make changes and click the refresh icon in `chrome://extensions/`.

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

---

Made with ❤️ by [Aarav Goyal](https://github.com/gl-aarav)

# Privacy Policy

_Last updated: 2026-10-16_

Tab Dupes Begone does not collect, store, sell, or transmit any personal or browsing data.

**What the extension accesses, and why**

- **Tab URLs and window types** (`tabs` permission): to check whether a newly opened tab's URL
  exactly matches a tab that is already open, and to switch to that tab.
- **Navigation events** (`webNavigation` permission): to tell links opened from desktop apps apart
  from tabs you open yourself.
- **Session storage** (`storage` permission): to remember, for a second or two, which newly created
  tabs are still being checked. This lives in `chrome.storage.session`, stays on your device, and
  is cleared when the browser closes.

All processing happens locally in your browser. The extension makes no network requests, uses no
analytics, and contains no remote code.

**Contact:** open an issue at https://github.com/siddiqus/tab-dupes-begone/issues

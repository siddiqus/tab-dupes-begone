# Privacy Policy

_Last updated: 2026-10-18_

Tab Dupes Begone does not collect, sell, or transmit any personal or browsing data. The extension
makes no network requests, uses no analytics, and contains no remote code.

**What the extension accesses, and why**

- **Tab URLs and window types** (`tabs` permission): to check whether a tab you're opening exactly
  matches a tab that is already open, and to switch to that tab.
- **Navigation events** (`webNavigation` permission): to tell how a new tab was opened (from a
  desktop app, by a page right after a click, or by typing a URL into a new tab).
- **Access to all websites** (`<all_urls>` host permission): to run a small content script on web
  pages that observes link clicks. For each click it sees only the clicked link's URL and target,
  whether it is a download link, the mouse button, and which modifier keys were held; for a
  right-click on a link, only that link's URL. Chrome also tells the extension the URL of the page
  the click happened in. The script does not read page content, form fields, or keystrokes. It
  passes what it sees to the extension's own background script, and nowhere else.
- **Script injection** (`scripting` permission): to add that content script to tabs that were
  already open when the extension was installed or updated.
- **Storage** (`storage` permission):
  - Your five on/off settings are kept in `chrome.storage.sync`. If you use Chrome sync, Chrome
    syncs them to your other browsers through your Google account, as it does for any extension
    settings. Nothing else is stored there.
  - Per-tab bookkeeping — new tabs still being checked, and each tab's most recent click (time,
    kind of click, link URL) — is kept in `chrome.storage.session`. It stays on your device,
    is removed when the tab closes, and is cleared when the browser closes.

All processing happens locally in your browser. Apart from Chrome syncing your settings, no data
leaves your device.

**Contact:** open an issue at https://github.com/siddiqus/tab-dupes-begone/issues

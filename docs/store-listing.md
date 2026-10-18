# Chrome Web Store listing

Copy-paste source for the Developer Dashboard. Keep in sync with the README when behaviour changes.

## Store listing tab

**Name:** Tab Dupes Begone

**Summary** (max 132 chars):
> Links from Slack, Mail, web pages and more switch to the tab you already have open. Choose which kinds of links it applies to.

**Category:** Productivity → Tools

**Language:** English

**Description:**
> Clicked the same link in Slack five times? You'd normally get five identical tabs. Tab Dupes Begone switches you to the tab you already have open instead.
>
> Choose, from the toolbar popup, which kinds of links this applies to:
> • Links from desktop apps (Slack, Mail, Teams, Zoom, and more) and installed web apps — on by default
> • Links that open in a new tab — on by default
> • Cmd/Ctrl-click, middle-click, "Open link in new tab" — off by default
> • Regular links that open in the same tab — off by default
> • Typing a URL into a new tab — off by default
>
> Right-click → Duplicate, reopening a closed tab, and tabs a page opens without your click are always left alone.
>
> Why "Read and change all your data on all websites"? A small script on each page notices which link you clicked and which modifier keys you held, so it can switch tabs before a duplicate opens. It never reads page content, and nothing leaves your device.
>
> Exact URL matching. No data collected. Open source: https://github.com/siddiqus/tab-dupes-begone

**Graphic assets** (regenerate with `scripts/render-store-assets.sh`):
- Store icon 128×128: `assets/store/store-icon-128.png`
- Screenshot 1280×800: `assets/store/screenshot-before-after.png`

**Homepage URL:** https://github.com/siddiqus/tab-dupes-begone
**Support URL:** https://github.com/siddiqus/tab-dupes-begone/issues

## Privacy tab

**Single purpose:**
> Prevents duplicate tabs: when a link or URL the user opens points to a page that is already open, it switches to the existing tab instead. The user chooses which kinds of links this applies to.

**Permission justifications:**
- `tabs` — Read tab URLs and window types to detect that a link or new tab exactly matches an already-open tab, then activate that tab and close the duplicate.
- `webNavigation` — Read the navigation transition type and which tab spawned a new tab, to tell whether a tab came from a desktop app, from a page right after a click, or from a URL typed into a new tab.
- `scripting` — Inject the extension's own bundled content script into tabs that were already open when the extension is installed or updated, so link clicks there are handled without a reload. No remote code.
- `storage` — Save the user's on/off settings in `chrome.storage.sync`, and keep per-tab bookkeeping (tabs being checked, each tab's last link click) in `chrome.storage.session`, which is cleared when the browser closes.
- Host permission `<all_urls>` — Run a content script on web pages that observes link clicks (link URL and target, mouse button, modifier keys) so the extension can classify the click and, when the user's setting is on and the URL is already open, cancel it and switch to the existing tab. It does not read page content and sends nothing off the device. Needed on all sites because any page can link to a page the user already has open.

**Remote code:** No, I am not using remote code.

**Data usage:** check none of the data categories. Certify all three statements (no selling, no unrelated use, no creditworthiness use).

**Privacy policy URL:** https://github.com/siddiqus/tab-dupes-begone/blob/main/PRIVACY.md

## Distribution tab

Visibility: Public. Regions: all.

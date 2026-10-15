# Chrome Web Store listing

Copy-paste source for the Developer Dashboard. Keep in sync with the README when behaviour changes.

## Store listing tab

**Name:** Tab Dupes Begone

**Summary** (max 132 chars):
> Links from Slack, Mail, and other desktop apps switch to the tab you already have open instead of opening a duplicate.

**Category:** Productivity → Tools

**Language:** English

**Description:**
> Clicked the same link in Slack five times? You'd normally get five identical tabs. Tab Dupes Begone switches you to the tab you already have open instead.
>
> Works with links from desktop apps (Slack, Mail, Teams, Zoom, and more) and installed web apps. Duplicates you make on purpose — right-click → Duplicate, Cmd/Ctrl-click, typing a URL — are left alone.
>
> Exact URL matching. No settings. No data collected. Open source: https://github.com/siddiqus/tab-dupes-begone

**Graphic assets** (regenerate with `scripts/render-store-assets.sh`):
- Store icon 128×128: `assets/store/store-icon-128.png`
- Screenshot 1280×800: `assets/store/screenshot-before-after.png`

**Homepage URL:** https://github.com/siddiqus/tab-dupes-begone
**Support URL:** https://github.com/siddiqus/tab-dupes-begone/issues

## Privacy tab

**Single purpose:**
> Prevents duplicate tabs when a link opened from a desktop application points to a page that is already open, by switching to the existing tab.

**Permission justifications:**
- `tabs` — Read tab URLs and window types to detect that a newly opened tab exactly matches an already-open tab, then activate that tab and close the duplicate.
- `webNavigation` — Read the navigation transition type and which tab spawned a new tab, to distinguish links opened from desktop apps from tabs the user opens intentionally.
- `storage` — Keep short-lived per-tab bookkeeping in `chrome.storage.session` while a new tab is being checked; cleared when the browser closes.

**Remote code:** No, I am not using remote code.

**Data usage:** check none of the data categories. Certify all three statements (no selling, no unrelated use, no creditworthiness use).

**Privacy policy URL:** https://github.com/siddiqus/tab-dupes-begone/blob/main/PRIVACY.md

## Distribution tab

Visibility: Public. Regions: all.

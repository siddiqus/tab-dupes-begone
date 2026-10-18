# Chrome Web Store listing

Copy-paste source for the Developer Dashboard. Keep in sync with the README when behaviour changes.

## Store listing tab

**Name:** Tab Dupes Begone

**Summary** (max 132 chars):
> Already have that page open? Switch to it instead of opening a duplicate. Works for links from Slack, Mail, web pages and more.

**Category:** Productivity → Tools

**Language:** English

**Description:**
```
Clicked the same link in Slack five times? You'd normally get five identical tabs. Tab Dupes Begone switches you to the tab you already have open instead.

CHOOSE WHEN IT SWITCHES
From the toolbar popup, turn each one on or off:
• Links from desktop apps (Slack, Mail, Teams, Zoom…) and installed web apps (on by default)
• Links that open in a new tab (on by default)
• Cmd/Ctrl-click, middle-click, and "Open link in new tab" (off by default)
• Regular links that open in the same tab (off by default)
• Typing a URL into a new tab (off by default)

ALWAYS LEFT ALONE
Right-click → Duplicate, reopening a closed tab (Cmd/Ctrl-Shift-T), and tabs a page opens without your click.

EXACT MATCHING
Only an exact URL match counts. github.com/foo and github.com/foo#readme are treated as different pages.

WHY "READ AND CHANGE ALL YOUR DATA ON ALL WEBSITES"?
To catch a duplicate before it opens, a small script on each page notices which link you clicked and which keys you held. It never reads page content. Nothing is collected or sent anywhere. Your on/off settings sync through your own Chrome profile, like any extension setting.

NEW IN 2.0
• Per-trigger settings in the toolbar popup
• Links on web pages can now switch to the open tab, not just links from desktop apps
• Chrome will ask you to approve site access when updating. This is what makes switching on web-page links possible.

Open source: https://github.com/siddiqus/tab-dupes-begone
```

**Graphic assets** (regenerate with `scripts/render-store-assets.sh`):
- Store icon 128×128: `assets/store/store-icon-128.png`
- Screenshot 1280×800: `assets/store/screenshot-before-after.png`

**Homepage URL:** https://github.com/siddiqus/tab-dupes-begone
**Support URL:** https://github.com/siddiqus/tab-dupes-begone/issues

## Privacy tab

**Single purpose:**
> Prevents duplicate tabs: when a link or URL the user opens points to a page that is already open, it switches to the existing tab instead. The user chooses which kinds of links this applies to.

**tabs justification:**
> Reads tab URLs and window types to detect that a link or new tab exactly matches an already-open tab, then activates that tab and closes the duplicate.

**webNavigation justification:**
> Reads the navigation transition type and which tab spawned a new tab, to tell whether a tab came from a desktop app, from a page right after a click, or from a URL typed into a new tab.

**storage justification:**
> Saves the user's on/off settings in chrome.storage.sync, and keeps per-tab bookkeeping (tabs being checked, each tab's last link click) in chrome.storage.session, which is cleared when the browser closes.

**scripting justification:**
> Injects the extension's own bundled content script (content.js, the same file declared in the manifest) into tabs that were already open when the extension is installed, updated, or re-enabled. Without this, link clicks in those tabs would not be handled until each tab is reloaded. No remote or dynamically generated code is executed.

**Host permission justification:**
> The extension runs a content script on web pages so it can tell which link the user clicked and how: the link URL and target, the mouse button, and the modifier keys held. With that, it decides whether the click matches one of the user's enabled settings (for example a plain click on a link that opens in a new tab, versus a Cmd/Ctrl-click). If it does and the URL is already open, it cancels the click and switches to the existing tab, so no duplicate tab is created. The script does not read or modify page content and sends nothing off the device; click details are only passed to the extension's own background service worker. Access is needed on all sites because any page can link to a page the user already has open.

**Remote code:** No, I am not using remote code.

**Data usage:** check none of the data categories. Certify all three statements (no selling, no unrelated use, no creditworthiness use).

**Privacy policy URL:** https://github.com/siddiqus/tab-dupes-begone/blob/main/PRIVACY.md

## Distribution tab

Visibility: Public. Regions: all.

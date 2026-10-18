# Per-trigger switch toggles — Design

## Goal
Let users choose, per trigger, whether opening an already-open URL switches to the existing tab
instead. Settings live in the extension's action popup. Matching stays exact-URL.

| Key | Popup label | Default |
|---|---|---|
| `desktopApp` | Links from desktop apps & installed web apps | on |
| `newTabLink` | Links that open in a new tab | on |
| `modifiedClick` | Cmd/Ctrl-click, middle-click, "Open link in new tab" | off |
| `sameTabLink` | Regular links that open in the same tab | off |
| `typedNewTab` | Typing a URL into a new tab | off |

Never switch (explained in an info pane in the popup): right-click → Duplicate, reopening a closed
tab, `window.open` not preceded by a click, typing a URL into a tab already showing a page (Chrome's
own omnibox "Switch to tab" covers that).

## Permissions
`host_permissions: ["<all_urls>"]` requested at install, plus `scripting` (inject the content script
into tabs already open at install/update). A welcome page opens on first install explaining why site
access is needed: the content script observes link clicks only to see modifier keys and link
targets; it never reads page content and nothing leaves the device.

## Files
```
src/settings.ts      Settings type, DEFAULT_SETTINGS, getSettings (cached), saveSettings
src/messages.d.ts    ambient (global) message types shared by content + background
src/decide.ts        pure decisions (unit tested)
src/pending.ts       per-tab bookkeeping + per-tab last-click records (storage.session)
src/background.ts    event wiring, message handlers, all tab/window API calls
src/content.ts       thin click observer — classic script: NO import/export (not even `import type`)
src/toggles.ts       renders the five toggles into a container (shared by popup + welcome)
src/popup.ts         popup page
src/welcome.ts       welcome page
public/popup.html, public/welcome.html, public/ui.css
```
`content.ts` must compile to a classic script: any `import`/`export` makes tsc emit `export {}`,
which is a syntax error in a content script. Wrap its body in a block/IIFE so its top-level names
don't leak into the global type scope. Message types come from the ambient `messages.d.ts`.

## Click classification (`decide.ts`, background side)
`classifyClick(facts, pageUrl, frameId) → SettingKey | null` where facts are raw event data from
the content script (`href`, `target`, `button`, `metaKey`, `ctrlKey`, `shiftKey`, `altKey`,
`download`):
- `href` not http(s) → null. Anchor with `download` → null. `altKey` → null (download gesture).
- `button === 1` or `metaKey` or `ctrlKey` or `shiftKey` → `modifiedClick`.
- `button !== 0` → null.
- Plain left click, `target` non-empty and not `_self`/`_parent`/`_top` → `newTabLink`.
- Otherwise (same-tab): if `frameId !== 0` and target isn't `_top` → null (navigates a subframe).
  If `href` equals `pageUrl` ignoring the hash → null (same-document). Else → `sameTabLink`.

## Path 1 — click-time interception (content script + background)
Content script runs at `document_start`, `all_frames: true`, listens on `window` in capture phase.
1. `pointerdown` (button 0/1) whose composed path contains an `<a href>`: send
   `{type:"probe", facts}`; store `{anchor, facts, intercept: undefined}`; on response set
   `intercept`.
2. Background `probe` handler: kind = classifyClick; intercept = kind && settings[kind] && an
   existing tab matches `href` exactly. For `sameTabLink` the sender tab is excluded from matches;
   for new-tab kinds it is included (switching to self = no duplicate). Reply `{intercept}`.
   Uses `sendResponse` + `return true`.
3. `click` (button 0) / `auxclick` (button 1): if the stored probe is for the same anchor with
   identical facts and `intercept === true` → `preventDefault()` + `stopImmediatePropagation()`
   (stops SPA routers), send `{type:"switch", href, kind-relevant facts}`. Background re-finds the
   tab and focuses it; replies `{switched}`. If `switched` is false, the content script performs the
   navigation itself (`location.assign(href)` for same-tab, `window.open(href, "_blank")` otherwise)
   so the click is never lost.
4. Every `click`/`auxclick` that was NOT intercepted (anchor or not) sends
   `{type:"click", facts}` (href may be absent) so the fallback can classify `window.open` calls.
   `contextmenu` on an anchor sends `{type:"contextmenu", href}`.
5. Keyboard activation (Enter) has no pointerdown → never intercepted; fallback still applies.
6. Orphan handling: on start, dispatch `document` CustomEvent `tab-dupes-begone:detach`; listen for
   it and remove own listeners when received (a newer instance took over). Also detach if
   `chrome.runtime?.id` is undefined or `sendMessage` throws.

## Path 2 — fallback correlation (background)
- `click` message: store `{at, kind, href?}` for the sender tab, kind from classifyClick (when href
  is absent: plain button 0 → `newTabLink`, modified → `modifiedClick`). `contextmenu`: store
  `{at, kind: "modifiedClick", href, contextMenu: true}`.
- `onCreatedNavigationTarget` from a source tab in a `normal` window, new tab in a `normal` window:
  read the source tab's click record. Valid if `now - at <= CLICK_TTL_MS (1000)`, or for context menu
  records `<= CONTEXTMENU_TTL_MS (60000)` and `href === d.url`. If valid and `settings[kind]`, set
  `linkKind` on the new tab's pending entry and, if `d.url` already matches, focus + close now.
- `onCommitted` (main frame) with `linkKind` set and `settings[linkKind]`: match the committed URL
  (handles redirect wrappers like Gmail's) → focus existing + close new.

## Path 3 — typed URL in a new tab
`onCreated` with `pendingUrl`/`url` a new-tab-page URL (`isNewTabPageUrl`: `chrome://newtab/`,
`chrome://new-tab-page/`, `chrome-search://local-ntp/…`) marks the pending entry `newTabPage`.
`onCommitted` ignores (does not consume pending for) new-tab-page URLs. On first real commit with
transition `typed` or `generated` and `settings.typedNewTab` → match → focus existing + close new.

## Path 4 — desktop apps (existing)
Unchanged, gated on `settings.desktopApp`. Fix: `isFastCandidate` requires an http(s) `pendingUrl`
(a fresh NTP has `pendingUrl` `chrome://newtab/` and would otherwise match other NTP tabs).

## Matching
`pickExistingTab` additionally takes the source's `incognito` flag and only matches tabs with the
same value; only http(s) URLs are ever matched. Only `normal` windows.

## onCommitted order
take pending (skip NTP URLs) → `linkKind` path → `navTarget` return → `newTabPage` typed path →
desktop path (`start_page`, gated).

## Install / update
`runtime.onInstalled`: on `install`, open `welcome.html`. On `install` and `update`, inject
`content.js` into all existing http(s) tabs (all frames), ignoring failures.

## Popup / welcome
Popup: title, five toggles (label + one-line explanation, saves on change), `<details>` "What never
switches", link to welcome page ("Why does this need site access?"). Welcome: what it does, why site
access, the same toggles, "pin the icon to change these later". Plain CSS, light/dark via
`prefers-color-scheme`.

## Testing
Unit tests (vitest) for every `decide.ts` function, including classifyClick across modifier/target/
frame combinations, click-record validity, `isNewTabPageUrl`, `isTypedCommit`, the fixed
`isFastCandidate`, and incognito filtering. Manual checklist in README per toggle, on and off.

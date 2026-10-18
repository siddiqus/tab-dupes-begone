# Tab Dupes Begone — Design

## Goal
When opening a URL would show a page that is already open in another tab, switch to the existing
tab instead. Which triggers do this is configurable per trigger (desktop/PWA links, new-tab links,
modified clicks, same-tab links, typing into a new tab); see
[`superpowers/specs/2026-10-18-per-trigger-toggles-design.md`](superpowers/specs/2026-10-18-per-trigger-toggles-design.md)
for the full spec. Duplicate, reopening a closed tab, `window.open` without a preceding click, and
typing into a tab already showing a page never switch. Applies to every site; match is exact URL
string equality, http(s) only, normal windows only, never across incognito.

## Empirical findings (spike, Chrome on macOS)
| Source | onCreated | onCreatedNavigationTarget | first commit transitionType |
|---|---|---|---|
| Native app (`open <url>`) | pendingUrl set, url "" , opener = active tab | not fired | `start_page` |
| PWA link | no pendingUrl, url "" | fired; source tab window type `app` | `link` |
| Cmd-click / target=_blank / window.open | url "" | fired; source window `normal` | `link` |
| Duplicate / reopen closed | pendingUrl set, url set | not fired | `reload` |
| New tab + typing | pendingUrl chrome://newtab/ | not fired | `typed` |

`openerTabId` is set in nearly every case and is not a useful signal.

## Detection
- **Desktop apps:** a new tab is external if a tab in an `app` window spawned it (PWA), or its
  first commit is `start_page` (native).
- **Clicks:** the content script reports raw click facts (href, target, button, modifiers,
  `download`); `classifyClick` maps them to `newTabLink`, `modifiedClick`, `sameTabLink`, or none
  (non-http, `download`, Alt, same-document, subframe-only navigations).
- **Tabs a page opens after a click:** the last non-intercepted click per tab is recorded. A
  navTarget from a normal window within `CLICK_TTL_MS` (1s) of it, or within 60s of a context menu
  on the same href, inherits its kind. A plain click on anything that isn't a new-tab link (button,
  `href="#"`) counts as `newTabLink`, since script opened the tab.
- **Typed:** a tab created on the new tab page whose first real commit is `typed`/`generated`.

Each path does nothing unless its setting is on.

## Timing
- **Click-time interception:** on `pointerdown` the content script sends a probe; the background
  classifies, checks the setting and looks for an exact match (excluding the clicking tab for
  same-tab links). If the reply says intercept and the `click`/`auxclick` has identical facts, it
  is cancelled (`preventDefault` + `stopImmediatePropagation`) and the background focuses the tab.
  If that tab is gone by then, the content script performs the original navigation itself.
- **Click fallback:** on navTarget with a valid click record, mark the new tab with `linkKind`
  and close it now if its URL already matches; otherwise re-check on first commit, which covers
  redirect wrappers (Gmail).
- **Typed path:** on first commit after the new tab page; NTP commits don't consume tracking.
- **PWA path:** on navTarget with source window type `app` + exact match → focus existing, close
  new tab immediately.
- **Native fast path:** on onCreated with an http(s) `pendingUrl` and `url === ""` and an exact
  match, wait a grace period (~150ms) for navTarget. If none, focus the existing tab but keep the
  new tab in the background.
- **Native confirm:** on first commit, if `start_page`, close the background tab; otherwise
  (misfire) leave it.
- **Native fallback:** if the fast path did not trigger and the first commit is `start_page` with
  an exact match, focus existing and close the new tab.
- New tabs are tracked only until their first main-frame commit; click records until replaced or
  the tab closes. All tracking lives in `chrome.storage.session` to survive service-worker
  restarts.
- Target choice when multiple matches: prefer the new (or clicking) tab's window, then most
  recently accessed.

## Structure
TypeScript, compiled with `tsc` to `dist/` (load unpacked from `dist/`). Yarn. No bundler.
- `src/settings.ts` — settings, defaults, cached load/save in `chrome.storage.sync`.
- `src/messages.d.ts` — ambient message types shared by content script and background.
- `src/decide.ts` — pure decision functions (unit tested with vitest).
- `src/pending.ts` — per-tab tracking and click records in `chrome.storage.session`.
- `src/background.ts` — wires chrome events and messages to decisions; only file calling
  tab/window APIs. Injects the content script into open tabs on install/update.
- `src/content.ts` — click observer; a classic script (no import/export), detaches when a newer
  instance starts or the extension context is invalidated.
- `src/toggles.ts`, `src/popup.ts`, `src/welcome.ts` — settings UI (toolbar popup, welcome page
  on install).
- `test/decide.test.ts`.

Out of scope: allow/blocklists, badge, URL normalization.

## Testing
Unit tests for `decide.ts`; manual checklist in README covering each toggle on and off and every
never-switch case.

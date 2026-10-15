# Tab Dupes Begone — Design

## Goal
When a link opened from outside the browser (native desktop app or Chrome PWA) would create a
tab whose URL exactly matches an already-open tab, switch to the existing tab and close the new
one. All intentional duplication (Duplicate, Cmd-click, target=_blank, window.open, typing a URL,
reopening a closed tab) is left alone. Applies to every site; match is exact URL string equality.

## Empirical findings (spike, Chrome on macOS)
| Source | onCreated | onCreatedNavigationTarget | first commit transitionType |
|---|---|---|---|
| Native app (`open <url>`) | pendingUrl set, url "" , opener = active tab | not fired | `start_page` |
| PWA link | no pendingUrl, url "" | fired; source tab window type `app` | `link` |
| Cmd-click / target=_blank / window.open | url "" | fired; source window `normal` | `link` |
| Duplicate / reopen closed | pendingUrl set, url set | not fired | `reload` |
| New tab + typing | pendingUrl chrome://newtab/ | not fired | `typed` |

`openerTabId` is set in nearly every case and is not a useful signal.

## Detection rule
A new tab is **external** if a tab in an `app` window spawned it (PWA), or its first commit is
`start_page` (native). Only external tabs are deduped, and only on an exact URL match against a
tab in a normal window.

## Timing
- **PWA path:** on navTarget with source window type `app` + exact match → focus existing, close
  new tab immediately.
- **Native fast path:** on onCreated with `pendingUrl` set and `url === ""` and an exact match,
  wait a grace period (~150ms) for navTarget. If none, focus the existing tab but keep the new
  tab in the background.
- **Native confirm:** on first commit, if `start_page`, close the background tab; otherwise
  (misfire) leave it.
- **Native fallback:** if the fast path did not trigger and the first commit is `start_page` with
  an exact match, focus existing and close the new tab.
- Tabs are tracked only until their first main-frame commit. Tracking state lives in
  `chrome.storage.session` to survive service-worker restarts.
- Target choice when multiple matches: prefer the new tab's window, then most recently accessed.

## Structure
TypeScript, compiled with `tsc` to `dist/` (load unpacked from `dist/`). Yarn. No bundler.
- `src/decide.ts` — pure decision functions (unit tested with vitest).
- `src/pending.ts` — tracking state in `chrome.storage.session`.
- `src/background.ts` — wires chrome events to decisions; only file calling tab/window APIs.
- `test/decide.test.ts`.

Out of scope: options page, allow/blocklists, badge, URL normalization.

## Testing
Unit tests for `decide.ts`; manual checklist in README covering native, PWA, and every
intentional-duplicate path.

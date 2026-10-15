<p align="center"><img src="assets/icon.svg" width="96" alt=""></p>

# Tab Dupes Begone

Click a GitHub link in Slack five times, get five identical GitHub tabs. Not anymore.

**Tab Dupes Begone** is a Chrome extension that notices when a link coming from *outside* the
browser — a native desktop app or an installed web app (PWA) — is about to open a URL you
already have open. Instead of a new tab, it switches you to the existing one.

Duplicates you make on purpose are left alone.

| You do this | Result |
|---|---|
| Click a link in Slack, Mail, Teams, Zoom, … for a URL that's already open | Switches to the existing tab |
| Click a link in an installed web app (PWA) for a URL that's already open | Switches to the existing tab |
| Same, for a URL that isn't open yet | Opens normally |
| Right-click → Duplicate, Cmd/Ctrl-click, `target=_blank` links, `window.open`, typing a URL, reopening a closed tab | Opens normally, even if the URL is already open |

Matching is an **exact URL match**: `github.com/foo` and `github.com/foo#readme` are different pages.

## Install

- **Chrome Web Store:** _coming soon_
- **From source:** see [Development](#development), then load `dist/` via
  `chrome://extensions` → Developer mode → **Load unpacked**.

Requires Chrome 121 or newer.

## How it works

Chrome doesn't let extensions see *which app* opened a link, so the extension infers it from
signals Chrome does expose:

- **Native apps:** the OS hands the URL to Chrome, and the tab's first navigation has the
  transition type `start_page`. The only other source of that is Chrome's own
  "open these pages on startup" setting, where there's nothing open yet to match.
- **PWAs:** the new tab is spawned (`webNavigation.onCreatedNavigationTarget`) by a tab that lives
  in an `app` window rather than a normal browser window.

For native-app links the extension switches focus as soon as the tab is created and closes the new
tab once Chrome confirms the `start_page` transition, so you barely see it. If the confirmation
never comes, the new tab is simply left open in the background — nothing you wanted is closed.

The full design, including the measurements behind these signals, is in
[`docs/design.md`](docs/design.md).

### Limitations

- Tested on Chrome for macOS. Windows and Linux should behave the same but are not yet verified —
  reports welcome.
- Other Chromium browsers (Edge, Brave, Arc) may label navigations differently.

## Privacy

The extension does not collect, store, or transmit any data. It reads tab URLs locally only to
compare them, and keeps short-lived bookkeeping in session memory that is cleared when the browser
closes. See [PRIVACY.md](PRIVACY.md).

## Development

```sh
yarn install
yarn build       # compile to dist/
yarn test        # unit tests (vitest)
yarn typecheck
yarn package     # build + zip to release/ for the Chrome Web Store
```

After rebuilding, click reload on the extension card in `chrome://extensions`. The service worker
console (the "service worker" link on that card) shows debug output.

### Project layout

```
src/decide.ts      pure decision functions (unit tested)
src/pending.ts     per-tab bookkeeping in chrome.storage.session
src/background.ts  wires Chrome events to the decisions
public/            manifest and icons, copied into dist/
assets/            icon source and store assets (scripts/render-store-assets.sh)
scripts/           build helpers
```

### Manual test checklist

With `https://github.com/` already open in a tab:

- [ ] `open "https://github.com/"` (macOS) → focus jumps to the existing tab; no extra tab remains
- [ ] Link to the same URL from a PWA → same
- [ ] `open "https://github.com/explore"` (not open yet) → opens normally
- [ ] Right-click a tab → Duplicate → duplicate stays
- [ ] Cmd-click / plain click on a `target=_blank` link to an open URL → new tab stays
- [ ] `window.open(location.href)` in DevTools → new tab stays
- [ ] New tab, type an open URL → stays
- [ ] Close a tab, Cmd-Shift-T → reopens normally

## Contributing

Issues and pull requests are welcome — see [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE)

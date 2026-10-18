# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

## [2.0.0] - 2026-10-18

### Added
- Toolbar popup with a toggle per trigger: desktop & web-app links (on), links that open in a new
  tab (on), Cmd/Ctrl/Shift-click, middle-click and "Open link in new tab" (off), regular same-tab
  links (off), typing a URL into a new tab (off). Settings sync via `chrome.storage.sync`.
- Content script that intercepts link clicks to an already-open URL and switches tabs before the
  duplicate opens; tabs a page opens right after a click are caught as a fallback, including
  through redirect links.
- Welcome page on install explaining the site-access permission.

### Changed
- Plain clicks on `target=_blank` links (and tabs a page opens right after a click) now switch to
  an already-open tab by default. Turn off "Links that open in a new tab" for the old behaviour.
- New permissions: access to all websites (`<all_urls>`) and `scripting`. Chrome disables the
  extension on update until existing users approve them.
- Matching never crosses incognito and regular windows, and only considers http(s) URLs.

## [1.0.0] - 2026-10-16

### Added
- Switch to an existing tab instead of opening an exact-URL duplicate when the link comes from a
  native desktop app (`start_page` transition) or an installed web app (PWA window).
- Intentional duplicates (Duplicate, Cmd-click, `target=_blank`, `window.open`, typed URLs,
  reopened tabs) are left alone.

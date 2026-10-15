# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

## [1.0.0] - 2026-10-16

### Added
- Switch to an existing tab instead of opening an exact-URL duplicate when the link comes from a
  native desktop app (`start_page` transition) or an installed web app (PWA window).
- Intentional duplicates (Duplicate, Cmd-click, `target=_blank`, `window.open`, typed URLs,
  reopened tabs) are left alone.

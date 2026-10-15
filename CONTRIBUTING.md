# Contributing

Thanks for helping out!

## Setup

```sh
yarn install
yarn build
```

Load `dist/` as an unpacked extension (`chrome://extensions` → Developer mode → Load unpacked).

## Before opening a pull request

- `yarn typecheck && yarn test` pass (CI runs both, plus a build).
- Decision logic belongs in `src/decide.ts` as plain functions with unit tests; keep `chrome.*`
  calls in `src/background.ts`.
- If you change detection behaviour, run through the manual checklist in the README and describe
  what you tested (OS, browser, version) in the PR.

## Reporting a misdetection

The most useful bug report says what you did (for example "clicked a link in Slack"), what you
expected, what happened, and your OS + Chrome version. Logs from the extension's service worker
console help too.

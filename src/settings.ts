// User settings: one toggle per way a duplicate tab can be opened.
// Stored in chrome.storage.sync so they follow the user's Chrome profile.

export interface Settings {
  /** Links from native desktop apps and installed web apps (PWAs). */
  desktopApp: boolean;
  /** Plain click on a link that opens in a new tab (target=_blank). */
  newTabLink: boolean;
  /** Cmd/Ctrl/Shift-click, middle-click, context menu "Open link in new tab". */
  modifiedClick: boolean;
  /** Plain click on a regular link that navigates the current tab. */
  sameTabLink: boolean;
  /** Typing a URL into a fresh new tab. */
  typedNewTab: boolean;
}

export type SettingKey = keyof Settings;

export const DEFAULT_SETTINGS: Readonly<Settings> = {
  desktopApp: true,
  newTabLink: true,
  modifiedClick: false,
  sameTabLink: false,
  typedNewTab: false,
};

export const SETTING_KEYS = Object.keys(DEFAULT_SETTINGS) as SettingKey[];

let cached: Promise<Settings> | undefined;

if (typeof chrome !== "undefined" && chrome.storage?.onChanged) {
  chrome.storage.onChanged.addListener((_changes, area) => {
    if (area === "sync") cached = undefined;
  });
}

/** Current settings merged over defaults. Cached until storage.sync changes. */
export function getSettings(): Promise<Settings> {
  cached ??= chrome.storage.sync
    .get(SETTING_KEYS)
    .then((stored) => ({ ...DEFAULT_SETTINGS, ...(stored as Partial<Settings>) }));
  return cached;
}

export async function saveSettings(patch: Partial<Settings>): Promise<void> {
  await chrome.storage.sync.set(patch);
  cached = undefined;
}

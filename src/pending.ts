// Per-tab bookkeeping: new tabs until their first main-frame commit, and each tab's last click.
// Stored in chrome.storage.session so it survives service-worker restarts.
import type { ClickRecord } from "./decide.js";
import type { SettingKey } from "./settings.js";

export interface PendingTab {
  createdAt: number;
  /** A page spawned this tab (onCreatedNavigationTarget fired). */
  navTarget: boolean;
  /** Fast path already switched focus to this existing tab. */
  switchedTo?: number;
  /** Opened by a link click whose setting is on: dedupe on first commit (after redirects). */
  linkKind?: SettingKey;
  /** linkKind check found no match on the first commit: also check a client redirect before this time. */
  redirectUntil?: number;
  /** Opened as a new tab page: dedupe if the user types a URL into it. */
  newTabPage?: boolean;
  /** URL the omnibox prerendered in this tab; dedupe when that page is shown. */
  prerenderUrl?: string;
}

const key = (tabId: number) => `pending:${tabId}`;
const clickKey = (tabId: number) => `click:${tabId}`;

// Listeners fire concurrently; serialize storage access so read-modify-write updates don't clobber each other.
let queue: Promise<unknown> = Promise.resolve();
function serialized<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.catch(() => {});
  return run;
}

async function read<T>(k: string): Promise<T | undefined> {
  const result = await chrome.storage.session.get(k);
  return result[k] as T | undefined;
}

export function getPending(tabId: number): Promise<PendingTab | undefined> {
  return serialized(() => read<PendingTab>(key(tabId)));
}

/** Merge `patch` into the entry, creating it if missing. */
export function updatePending(tabId: number, patch: Partial<PendingTab>): Promise<PendingTab> {
  return serialized(async () => {
    const entry: PendingTab = { createdAt: Date.now(), navTarget: false, ...(await read(key(tabId))), ...patch };
    await chrome.storage.session.set({ [key(tabId)]: entry });
    return entry;
  });
}

/** Merge `patch` only if the entry still exists. */
export function patchIfPending(tabId: number, patch: Partial<PendingTab>): Promise<void> {
  return serialized(async () => {
    const entry = await read<PendingTab>(key(tabId));
    if (entry) await chrome.storage.session.set({ [key(tabId)]: { ...entry, ...patch } });
  });
}

/** Remove and return the entry in one step. */
export function takePending(tabId: number): Promise<PendingTab | undefined> {
  return serialized(async () => {
    const entry = await read<PendingTab>(key(tabId));
    if (entry) await chrome.storage.session.remove(key(tabId));
    return entry;
  });
}

export function clearPending(tabId: number): Promise<void> {
  return serialized(() => chrome.storage.session.remove(key(tabId)));
}

/** Replace the tab's click record; `undefined` clears it. */
export function setClickRecord(tabId: number, rec: ClickRecord | undefined): Promise<void> {
  return serialized(() =>
    rec ? chrome.storage.session.set({ [clickKey(tabId)]: rec }) : chrome.storage.session.remove(clickKey(tabId)),
  );
}

export function getClickRecord(tabId: number): Promise<ClickRecord | undefined> {
  return serialized(() => read<ClickRecord>(clickKey(tabId)));
}

/** Drop everything stored for a closed tab. */
export function forgetTab(tabId: number): Promise<void> {
  return serialized(() => chrome.storage.session.remove([key(tabId), clickKey(tabId)]));
}

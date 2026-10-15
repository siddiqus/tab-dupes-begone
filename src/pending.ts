// Tracks newly created tabs until their first main-frame commit.
// Stored in chrome.storage.session so it survives service-worker restarts.

export interface PendingTab {
  createdAt: number;
  /** A page spawned this tab (onCreatedNavigationTarget fired). */
  navTarget: boolean;
  /** Fast path already switched focus to this existing tab. */
  switchedTo?: number;
}

const key = (tabId: number) => `pending:${tabId}`;

// Listeners fire concurrently; serialize storage access so read-modify-write updates don't clobber each other.
let queue: Promise<unknown> = Promise.resolve();
function serialized<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.catch(() => {});
  return run;
}

async function read(tabId: number): Promise<PendingTab | undefined> {
  const k = key(tabId);
  const result = await chrome.storage.session.get(k);
  return result[k] as PendingTab | undefined;
}

export function getPending(tabId: number): Promise<PendingTab | undefined> {
  return serialized(() => read(tabId));
}

/** Merge `patch` into the entry, creating it if missing. */
export function updatePending(tabId: number, patch: Partial<PendingTab>): Promise<PendingTab> {
  return serialized(async () => {
    const entry: PendingTab = { createdAt: Date.now(), navTarget: false, ...(await read(tabId)), ...patch };
    await chrome.storage.session.set({ [key(tabId)]: entry });
    return entry;
  });
}

/** Merge `patch` only if the entry still exists. */
export function patchIfPending(tabId: number, patch: Partial<PendingTab>): Promise<void> {
  return serialized(async () => {
    const entry = await read(tabId);
    if (entry) await chrome.storage.session.set({ [key(tabId)]: { ...entry, ...patch } });
  });
}

/** Remove and return the entry in one step. */
export function takePending(tabId: number): Promise<PendingTab | undefined> {
  return serialized(async () => {
    const entry = await read(tabId);
    if (entry) await chrome.storage.session.remove(key(tabId));
    return entry;
  });
}

export function clearPending(tabId: number): Promise<void> {
  return serialized(() => chrome.storage.session.remove(key(tabId)));
}

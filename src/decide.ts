// Pure decision logic. No chrome.* calls so it can be unit tested.

export interface TabLike {
  id?: number;
  windowId: number;
  url?: string;
  pendingUrl?: string;
  lastAccessed?: number;
}

/** Native-app launches create a tab whose URL is known but not yet loaded. */
export function isFastCandidate(tab: TabLike): boolean {
  return !!tab.pendingUrl && !tab.url;
}

/** A tab spawned from a PWA window counts as an external open. */
export function isExternalSource(sourceWindowType: string | undefined): boolean {
  return sourceWindowType === "app";
}

/** Links handed to Chrome by the OS commit as start_page. */
export function isExternalCommit(transitionType: string): boolean {
  return transitionType === "start_page";
}

/**
 * Pick the existing tab with exactly `url`, excluding the new tab itself.
 * Prefers the new tab's window, then the most recently accessed tab.
 */
export function pickExistingTab(
  tabs: readonly TabLike[],
  url: string,
  newTabId: number,
  preferredWindowId: number,
): TabLike | null {
  const matches = tabs.filter((t) => t.id !== undefined && t.id !== newTabId && t.url === url);
  if (matches.length === 0) return null;
  return matches.reduce((best, t) => {
    const bestPreferred = best.windowId === preferredWindowId;
    const tPreferred = t.windowId === preferredWindowId;
    if (tPreferred !== bestPreferred) return tPreferred ? t : best;
    return (t.lastAccessed ?? 0) > (best.lastAccessed ?? 0) ? t : best;
  });
}

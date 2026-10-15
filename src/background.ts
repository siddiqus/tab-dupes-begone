import { isExternalCommit, isExternalSource, isFastCandidate, pickExistingTab } from "./decide.js";
import { clearPending, getPending, patchIfPending, takePending, updatePending } from "./pending.js";

/** How long to wait for onCreatedNavigationTarget before treating a tab as a native-app open. */
const GRACE_MS = 150;

async function findExisting(url: string, newTabId: number, preferredWindowId: number) {
  const tabs = await chrome.tabs.query({ windowType: "normal" });
  return pickExistingTab(tabs, url, newTabId, preferredWindowId);
}

async function focus(tabId: number, windowId: number): Promise<void> {
  await chrome.tabs.update(tabId, { active: true });
  await chrome.windows.update(windowId, { focused: true });
}

async function closeQuietly(tabId: number): Promise<void> {
  await clearPending(tabId);
  await chrome.tabs.remove(tabId).catch(() => {});
}

chrome.tabs.onCreated.addListener(async (tab) => {
  if (tab.id === undefined) return;
  const tabId = tab.id;
  await updatePending(tabId, {});

  if (!isFastCandidate(tab) || !tab.pendingUrl) return;
  const url = tab.pendingUrl;

  setTimeout(async () => {
    const entry = await getPending(tabId);
    if (!entry || entry.navTarget) return; // committed already, or spawned by a page
    const existing = await findExisting(url, tabId, tab.windowId);
    if (!existing?.id) return;
    await focus(existing.id, existing.windowId);
    // The tab may have committed meanwhile; then the commit handler has already dealt with it.
    await patchIfPending(tabId, { switchedTo: existing.id });
  }, GRACE_MS);
});

chrome.webNavigation.onCreatedNavigationTarget.addListener(async (d) => {
  const entry = await updatePending(d.tabId, { navTarget: true });
  // Used to tune GRACE_MS: shows how long after tab creation this event arrives.
  console.debug(`navTarget tab=${d.tabId} +${Date.now() - entry.createdAt}ms`);

  const source = await chrome.tabs.get(d.sourceTabId).catch(() => undefined);
  if (!source) return;
  const sourceWindow = await chrome.windows.get(source.windowId).catch(() => undefined);
  if (!isExternalSource(sourceWindow?.type)) return;

  const newTab = await chrome.tabs.get(d.tabId).catch(() => undefined);
  if (!newTab) return;
  const existing = await findExisting(d.url, d.tabId, newTab.windowId);
  if (!existing?.id) return;
  await focus(existing.id, existing.windowId);
  await closeQuietly(d.tabId);
});

chrome.webNavigation.onCommitted.addListener(async (d) => {
  if (d.frameId !== 0) return;
  const entry = await takePending(d.tabId);
  if (!entry) return;

  if (entry.navTarget) return; // PWA path handled it, or a page opened it intentionally
  if (!isExternalCommit(d.transitionType)) return; // includes fast-path misfires: leave the tab

  if (entry.switchedTo !== undefined) {
    await closeQuietly(d.tabId);
    return;
  }

  const newTab = await chrome.tabs.get(d.tabId).catch(() => undefined);
  if (!newTab) return;
  const existing = await findExisting(d.url, d.tabId, newTab.windowId);
  if (!existing?.id) return;
  await focus(existing.id, existing.windowId);
  await closeQuietly(d.tabId);
});

chrome.tabs.onRemoved.addListener((tabId) => {
  void clearPending(tabId);
});

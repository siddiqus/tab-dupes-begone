import {
  CLIENT_REDIRECT_MS,
  classifyClick,
  classifyRecordedClick,
  isClickRecordValid,
  isExternalCommit,
  isExternalSource,
  isFastCandidate,
  isHttpUrl,
  isNewTabPageUrl,
  isTimelyClientRedirect,
  isTypedCommit,
  isTypedPrerender,
  pickExistingTab,
  type MatchOptions,
  type TabLike,
} from "./decide.js";
import {
  clearPending,
  forgetTab,
  getClickRecord,
  getPending,
  patchIfPending,
  setClickRecord,
  takePending,
  updatePending,
} from "./pending.js";
import { getSettings } from "./settings.js";

/** How long to wait for onCreatedNavigationTarget before treating a tab as a native-app open. */
const GRACE_MS = 150;

async function findExisting(url: string, opts: MatchOptions) {
  const tabs = await chrome.tabs.query({ windowType: "normal" });
  return pickExistingTab(tabs, url, opts);
}

/** Match options for deduping `tab` itself against the other open tabs. */
const asNewTab = (tab: chrome.tabs.Tab): MatchOptions => ({
  excludeTabId: tab.id,
  windowId: tab.windowId,
  incognito: tab.incognito,
});

async function focus(tabId: number, windowId: number): Promise<void> {
  await chrome.tabs.update(tabId, { active: true });
  await chrome.windows.update(windowId, { focused: true });
}

async function closeQuietly(tabId: number): Promise<void> {
  await clearPending(tabId);
  await chrome.tabs.remove(tabId).catch(() => {});
}

/** If another tab already shows `url`, focus it and close `tabId`. Returns whether it did. */
async function switchAndClose(tabId: number, url: string): Promise<boolean> {
  const newTab = await chrome.tabs.get(tabId).catch(() => undefined);
  if (!newTab) return false;
  const existing = await findExisting(url, asNewTab(newTab));
  if (!existing?.id) return false;
  await focus(existing.id, existing.windowId);
  await closeQuietly(tabId);
  return true;
}

const windowType = async (windowId: number) => (await chrome.windows.get(windowId).catch(() => undefined))?.type;

/** URL a same-tab click in this frame would leave: the frame's own, or the tab's for _top links in subframes. */
const pageUrlOf = (sender: chrome.runtime.MessageSender) =>
  (sender.frameId === 0 ? sender.url : sender.tab?.url) ?? "";

// --- Path 1: click-time interception ---

/** The tab a click should switch to instead of navigating/opening, if any. */
async function interceptTarget(facts: ClickFacts, sender: chrome.runtime.MessageSender): Promise<TabLike | null> {
  const tab = sender.tab;
  if (tab?.id === undefined || sender.frameId === undefined || !facts.href) return null;
  const kind = classifyClick(facts, pageUrlOf(sender), sender.frameId);
  if (!kind || !(await getSettings())[kind]) return null;
  const tabs = await chrome.tabs.query({ windowType: "normal" });
  if (!tabs.some((t) => t.id === tab.id)) return null; // clicks in PWA/popup windows go through the fallback
  // Same-tab links must go elsewhere; for new-tab links, switching to the clicking tab itself is fine.
  const excludeTabId = kind === "sameTabLink" ? tab.id : undefined;
  return pickExistingTab(tabs, facts.href, { excludeTabId, windowId: tab.windowId, incognito: tab.incognito });
}

async function handleSwitch(facts: ClickFacts, sender: chrome.runtime.MessageSender): Promise<boolean> {
  const existing = await interceptTarget(facts, sender);
  if (!existing?.id) return false;
  await focus(existing.id, existing.windowId);
  return true;
}

// --- Path 2: remember clicks so tabs the page opens right after can be attributed ---

function recordClick(facts: ClickFacts, sender: chrome.runtime.MessageSender): void {
  const tabId = sender.tab?.id;
  if (tabId === undefined || sender.frameId === undefined) return;
  const kind = classifyRecordedClick(facts, pageUrlOf(sender), sender.frameId);
  // Enqueued synchronously so a navTarget event that follows reads the new record.
  void setClickRecord(tabId, kind ? { at: Date.now(), kind, href: facts.href } : undefined);
}

chrome.runtime.onMessage.addListener((msg: ContentMessage, sender, sendResponse) => {
  switch (msg.type) {
    case "probe":
      interceptTarget(msg.facts, sender).then(
        (t) => sendResponse({ intercept: !!t } satisfies ProbeReply),
        () => sendResponse({ intercept: false } satisfies ProbeReply),
      );
      return true;
    case "switch":
      handleSwitch(msg.facts, sender).then(
        (switched) => sendResponse({ switched } satisfies SwitchReply),
        () => sendResponse({ switched: false } satisfies SwitchReply),
      );
      return true;
    case "click":
      recordClick(msg.facts, sender);
      return;
    case "contextmenu":
      if (sender.tab?.id !== undefined && isHttpUrl(msg.href)) {
        void setClickRecord(sender.tab.id, { at: Date.now(), kind: "modifiedClick", href: msg.href, contextMenu: true });
      }
      return;
  }
});

// --- Tab lifecycle ---

chrome.tabs.onCreated.addListener(async (tab) => {
  if (tab.id === undefined) return;
  const tabId = tab.id;
  await updatePending(tabId, isNewTabPageUrl(tab.pendingUrl || tab.url) ? { newTabPage: true } : {});

  // Path 4 fast path: native-app opens.
  if (!isFastCandidate(tab) || !tab.pendingUrl) return;
  if (!(await getSettings()).desktopApp) return;
  const url = tab.pendingUrl;

  setTimeout(async () => {
    const entry = await getPending(tabId);
    if (!entry || entry.navTarget) return; // committed already, or spawned by a page
    const existing = await findExisting(url, asNewTab(tab));
    if (!existing?.id) return;
    await focus(existing.id, existing.windowId);
    // The tab may have committed meanwhile; then the commit handler has already dealt with it.
    await patchIfPending(tabId, { switchedTo: existing.id });
  }, GRACE_MS);
});

/** onCreatedNavigationTarget handlers still running; the new tab's commit waits for their verdict. */
const navTargetWork = new Map<number, Promise<void>>();

chrome.webNavigation.onCreatedNavigationTarget.addListener((d) => {
  const work: Promise<void> = onNavTarget(d)
    .catch(() => {})
    .finally(() => {
      if (navTargetWork.get(d.tabId) === work) navTargetWork.delete(d.tabId);
    });
  navTargetWork.set(d.tabId, work);
});

async function onNavTarget(d: chrome.webNavigation.WebNavigationSourceCallbackDetails): Promise<void> {
  const entry = await updatePending(d.tabId, { navTarget: true });
  // Used to tune GRACE_MS: shows how long after tab creation this event arrives.
  console.debug(`navTarget tab=${d.tabId} +${Date.now() - entry.createdAt}ms`);
  const now = Date.now();

  const source = await chrome.tabs.get(d.sourceTabId).catch(() => undefined);
  if (!source) return;
  const sourceType = await windowType(source.windowId);
  const settings = await getSettings();

  // Path 4: link from a PWA window.
  if (isExternalSource(sourceType)) {
    if (settings.desktopApp) await switchAndClose(d.tabId, d.url);
    return;
  }

  // Path 2: a page in a normal window opened a tab right after a click.
  if (sourceType !== "normal") return;
  const rec = await getClickRecord(d.sourceTabId);
  if (!rec || !isClickRecordValid(rec, d.url, now) || !settings[rec.kind]) return;
  const newTab = await chrome.tabs.get(d.tabId).catch(() => undefined);
  if (!newTab || (await windowType(newTab.windowId)) !== "normal") return;
  await patchIfPending(d.tabId, { linkKind: rec.kind });
  await switchAndClose(d.tabId, d.url);
}

chrome.webNavigation.onCommitted.addListener(async (d) => {
  // NTP, new-tab override pages, about:blank: keep the tab pending for its first real page.
  if (!isHttpUrl(d.url)) return;
  if (d.frameId !== 0) {
    // Omnibox prerender: shown on Enter without a frame-0 commit (see tabs.onUpdated).
    if (isTypedPrerender(d)) await patchIfPending(d.tabId, { prerenderUrl: d.url });
    return;
  }
  await navTargetWork.get(d.tabId);
  const entry = await takePending(d.tabId);
  if (!entry) return;
  const settings = await getSettings();

  // Path 2: the committed URL may differ from the link (redirect wrappers like Gmail's).
  if (entry.linkKind) {
    if (entry.redirectUntil !== undefined && !isTimelyClientRedirect(d.transitionQualifiers, entry.redirectUntil, Date.now())) return;
    if (!settings[entry.linkKind] || (await switchAndClose(d.tabId, d.url))) return;
    // Wrappers that redirect by meta refresh or script commit their own page first: check the next commit too.
    await updatePending(d.tabId, { ...entry, redirectUntil: entry.redirectUntil ?? Date.now() + CLIENT_REDIRECT_MS });
    return;
  }
  if (entry.navTarget) return; // PWA path handled it, or a page opened it without a click

  // Path 3: URL typed into a fresh new tab.
  if (entry.newTabPage) {
    if (settings.typedNewTab && isTypedCommit(d.transitionType)) await switchAndClose(d.tabId, d.url);
    return;
  }

  // Path 4: native apps.
  if (!settings.desktopApp) return;
  if (!isExternalCommit(d.transitionType)) return; // includes fast-path misfires: leave the tab
  if (entry.switchedTo !== undefined) {
    await closeQuietly(d.tabId);
    return;
  }
  await switchAndClose(d.tabId, d.url);
});

// Path 3, activated omnibox prerender: the tab shows the prerendered URL with no frame-0 commit.
chrome.tabs.onUpdated.addListener(async (tabId, info) => {
  if (!isHttpUrl(info.url)) return;
  const entry = await getPending(tabId);
  if (!entry?.newTabPage || entry.prerenderUrl !== info.url || !(await takePending(tabId))) return;
  if ((await getSettings()).typedNewTab) await switchAndClose(tabId, info.url);
});

chrome.tabs.onRemoved.addListener((tabId) => {
  void forgetTab(tabId);
});

chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === "install") void chrome.tabs.create({ url: chrome.runtime.getURL("welcome.html") });
});

// Tabs open before install, update or re-enable have no (or an orphaned) content script. storage.session
// starts empty after each of those (and after a browser restart, where re-injecting is harmless).
void chrome.storage.session.get("injected").then(async ({ injected }) => {
  if (injected) return;
  await chrome.storage.session.set({ injected: true });
  const tabs = await chrome.tabs.query({ url: ["http://*/*", "https://*/*"] });
  for (const tab of tabs) {
    if (tab.id === undefined) continue;
    chrome.scripting
      .executeScript({ target: { tabId: tab.id, allFrames: true }, files: ["content.js"] })
      .catch(() => {});
  }
});

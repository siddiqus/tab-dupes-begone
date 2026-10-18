// Pure decision logic. No chrome.* calls so it can be unit tested.
import type { SettingKey } from "./settings.js";

export interface TabLike {
  id?: number;
  windowId: number;
  url?: string;
  pendingUrl?: string;
  lastAccessed?: number;
  incognito?: boolean;
}

/** The last click in a tab, kept so a tab the page opens right after can be attributed to it. */
export interface ClickRecord {
  at: number;
  kind: SettingKey;
  href?: string;
  /** Context menu opened on a link: "Open link in new tab" may follow much later. */
  contextMenu?: boolean;
}

export const CLICK_TTL_MS = 1000;
export const CONTEXTMENU_TTL_MS = 60_000;
/** How long after a link's first commit a client redirect (meta refresh, location.replace) is still followed. */
export const CLIENT_REDIRECT_MS = 5000;

export function isHttpUrl(url: string | undefined): url is string {
  return !!url && /^https?:\/\//i.test(url);
}

/** Native-app launches create a tab whose http(s) URL is known but not yet loaded. */
export function isFastCandidate(tab: TabLike): boolean {
  return isHttpUrl(tab.pendingUrl) && !tab.url;
}

/** A tab spawned from a PWA window counts as an external open. */
export function isExternalSource(sourceWindowType: string | undefined): boolean {
  return sourceWindowType === "app";
}

/** Links handed to Chrome by the OS commit as start_page. */
export function isExternalCommit(transitionType: string): boolean {
  return transitionType === "start_page";
}

const NEW_TAB_PAGE = /^(chrome:\/\/(newtab|new-tab-page|new-tab-page-third-party)|chrome-search:\/\/local-ntp)\//i;

export function isNewTabPageUrl(url: string | undefined): boolean {
  return !!url && NEW_TAB_PAGE.test(url);
}

/** Omnibox navigations: a typed URL, or a search/suggestion picked from the omnibox. */
export function isTypedCommit(transitionType: string): boolean {
  return transitionType === "typed" || transitionType === "generated";
}

/** A client redirect committed before `until`: the page a redirect wrapper sends the new tab on to. */
export function isTimelyClientRedirect(qualifiers: readonly string[], until: number, now: number): boolean {
  return now <= until && qualifiers.includes("client_redirect");
}

/**
 * A main-frame commit Chrome prerendered from omnibox input. The page is shown later without another
 * frame-0 commit, if the user presses Enter.
 */
export function isTypedPrerender(d: { frameType: string; documentLifecycle: string; transitionType: string }): boolean {
  return d.frameType === "outermost_frame" && d.documentLifecycle === "prerender" && isTypedCommit(d.transitionType);
}

const SAME_TAB_TARGETS = ["", "_self", "_parent", "_top"];
const stripHash = (url: string) => url.split("#")[0];
const isModified = (f: ClickFacts) => f.button === 1 || f.metaKey || f.ctrlKey || f.shiftKey;

/** Which setting governs a click on a link, or null if it can never open a duplicate tab. */
export function classifyClick(f: ClickFacts, pageUrl: string, frameId: number): SettingKey | null {
  if (!isHttpUrl(f.href) || f.download || f.altKey) return null;
  if (isModified(f)) return "modifiedClick";
  if (f.button !== 0) return null;
  const target = f.target.toLowerCase();
  if (!SAME_TAB_TARGETS.includes(target)) return "newTabLink";
  if (frameId !== 0 && target !== "_top") return null; // navigates a subframe
  if (stripHash(f.href) === stripHash(pageUrl)) return null; // same-document
  return "sameTabLink";
}

/**
 * Kind to record for a non-intercepted click, used only if the page opens a tab right after it.
 * A tab spawned by a plain click on anything other than a new-tab link (no link, `href="#"`,
 * `javascript:`, a same-tab link with a script handler) was opened by script: treat as newTabLink.
 */
export function classifyRecordedClick(f: ClickFacts, pageUrl: string, frameId: number): SettingKey | null {
  if (f.download || f.altKey) return null;
  const kind = classifyClick(f, pageUrl, frameId);
  if (kind === "newTabLink" || kind === "modifiedClick") return kind;
  if (isModified(f)) return "modifiedClick";
  return f.button === 0 ? "newTabLink" : null;
}

/** Does `rec` explain a tab its source tab just opened to `url`? */
export function isClickRecordValid(rec: ClickRecord, url: string, now: number): boolean {
  const age = now - rec.at;
  return age <= CLICK_TTL_MS || (!!rec.contextMenu && age <= CONTEXTMENU_TTL_MS && rec.href === url);
}

export interface MatchOptions {
  /** Tab to never return (the new tab itself). */
  excludeTabId?: number;
  /** Preferred window, usually the new tab's. */
  windowId: number;
  /** Only match tabs in the same (incognito or not) profile. */
  incognito: boolean;
}

/**
 * Pick the existing tab with exactly `url` (http(s) only).
 * Prefers `windowId`, then the most recently accessed tab.
 */
export function pickExistingTab(tabs: readonly TabLike[], url: string, opts: MatchOptions): TabLike | null {
  if (!isHttpUrl(url)) return null;
  const matches = tabs.filter(
    (t) => t.id !== undefined && t.id !== opts.excludeTabId && t.url === url && !!t.incognito === opts.incognito,
  );
  if (matches.length === 0) return null;
  return matches.reduce((best, t) => {
    const bestPreferred = best.windowId === opts.windowId;
    const tPreferred = t.windowId === opts.windowId;
    if (tPreferred !== bestPreferred) return tPreferred ? t : best;
    return (t.lastAccessed ?? 0) > (best.lastAccessed ?? 0) ? t : best;
  });
}

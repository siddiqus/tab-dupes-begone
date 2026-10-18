import { describe, expect, it } from "vitest";
import {
  CLICK_TTL_MS,
  CLIENT_REDIRECT_MS,
  CONTEXTMENU_TTL_MS,
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
  type ClickRecord,
  type MatchOptions,
  type TabLike,
} from "../src/decide.js";

// Shapes below mirror what the spike logged in Chrome on macOS.
describe("isFastCandidate", () => {
  it("accepts a native-app open: pendingUrl set, url empty", () => {
    expect(isFastCandidate({ windowId: 1, pendingUrl: "https://github.com/", url: "" })).toBe(true);
  });
  it("rejects duplicate / reopened tabs: url already set", () => {
    const url = "https://github.com/x";
    expect(isFastCandidate({ windowId: 1, pendingUrl: url, url })).toBe(false);
  });
  it("rejects PWA / window.open tabs: no pendingUrl", () => {
    expect(isFastCandidate({ windowId: 1, url: "" })).toBe(false);
  });
  it("rejects a fresh new tab page: pendingUrl is not http(s)", () => {
    expect(isFastCandidate({ windowId: 1, pendingUrl: "chrome://newtab/", url: "" })).toBe(false);
  });
  it("accepts http as well as https", () => {
    expect(isFastCandidate({ windowId: 1, pendingUrl: "http://localhost:3000/", url: "" })).toBe(true);
  });
});

describe("isHttpUrl", () => {
  it.each(["https://a.com/", "http://a.com/x", "HTTPS://A.COM/"])("accepts %s", (u) => expect(isHttpUrl(u)).toBe(true));
  it.each(["chrome://newtab/", "file:///x", "javascript:void(0)", "about:blank", "", undefined])("rejects %s", (u) =>
    expect(isHttpUrl(u)).toBe(false),
  );
});

describe("isExternalSource", () => {
  it("treats app windows (PWAs) as external", () => expect(isExternalSource("app")).toBe(true));
  it.each(["normal", "popup", "devtools", undefined])("treats %s as internal", (type) =>
    expect(isExternalSource(type)).toBe(false),
  );
});

describe("isExternalCommit", () => {
  it("treats start_page as external", () => expect(isExternalCommit("start_page")).toBe(true));
  it.each(["link", "reload", "typed", "auto_bookmark", "form_submit"])("treats %s as intentional", (t) =>
    expect(isExternalCommit(t)).toBe(false),
  );
});

describe("isNewTabPageUrl", () => {
  it.each([
    "chrome://newtab/",
    "chrome://new-tab-page/",
    "chrome://new-tab-page-third-party/",
    "chrome-search://local-ntp/local-ntp.html",
  ])("recognises %s", (u) => expect(isNewTabPageUrl(u)).toBe(true));
  it.each(["https://www.google.com/", "chrome://settings/", "chrome://newtabx/", "about:blank", "", undefined])(
    "rejects %s",
    (u) => expect(isNewTabPageUrl(u)).toBe(false),
  );
});

describe("isTypedCommit", () => {
  it.each(["typed", "generated"])("treats %s as typed", (t) => expect(isTypedCommit(t)).toBe(true));
  it.each(["link", "auto_bookmark", "reload", "start_page", "form_submit"])("treats %s as not typed", (t) =>
    expect(isTypedCommit(t)).toBe(false),
  );
});

describe("isTimelyClientRedirect", () => {
  const until = 10_000 + CLIENT_REDIRECT_MS;
  it("follows a client redirect before the deadline", () => {
    expect(isTimelyClientRedirect(["client_redirect"], until, until)).toBe(true);
  });
  it("ignores a client redirect after the deadline", () => {
    expect(isTimelyClientRedirect(["client_redirect"], until, until + 1)).toBe(false);
  });
  it("ignores navigations that are not client redirects", () => {
    expect(isTimelyClientRedirect([], until, 10_000)).toBe(false);
    expect(isTimelyClientRedirect(["server_redirect"], until, 10_000)).toBe(false);
  });
});

describe("isTypedPrerender", () => {
  const prerender = { frameType: "outermost_frame", documentLifecycle: "prerender", transitionType: "typed" };
  it("accepts an omnibox prerender of a typed URL or suggestion", () => {
    expect(isTypedPrerender(prerender)).toBe(true);
    expect(isTypedPrerender({ ...prerender, transitionType: "generated" })).toBe(true);
  });
  it("rejects active documents, subframes, and prerenders from links", () => {
    expect(isTypedPrerender({ ...prerender, documentLifecycle: "active" })).toBe(false);
    expect(isTypedPrerender({ ...prerender, frameType: "sub_frame" })).toBe(false);
    expect(isTypedPrerender({ ...prerender, transitionType: "link" })).toBe(false);
  });
});

const page = "https://example.com/page";
const facts = (over: Partial<ClickFacts> = {}): ClickFacts => ({
  href: "https://github.com/a",
  target: "",
  download: false,
  button: 0,
  metaKey: false,
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
  ...over,
});

describe("classifyClick", () => {
  it("plain click on a regular link → sameTabLink", () => expect(classifyClick(facts(), page, 0)).toBe("sameTabLink"));
  it.each(["_self", "_parent", "_top", "_SELF"])("target=%s in the top frame → sameTabLink", (target) =>
    expect(classifyClick(facts({ target }), page, 0)).toBe("sameTabLink"),
  );
  it.each(["_blank", "_BLANK", "somewindow"])("target=%s → newTabLink", (target) =>
    expect(classifyClick(facts({ target }), page, 0)).toBe("newTabLink"),
  );
  it.each([
    { button: 1 },
    { metaKey: true },
    { ctrlKey: true },
    { shiftKey: true },
    { metaKey: true, target: "_blank" },
    { button: 1, target: "_blank" },
  ])("modified click %o → modifiedClick", (over) => expect(classifyClick(facts(over), page, 0)).toBe("modifiedClick"));
  it("modified clicks in a subframe still open a tab → modifiedClick", () =>
    expect(classifyClick(facts({ metaKey: true }), page, 3)).toBe("modifiedClick"));
  it("ignores right and other buttons", () => {
    expect(classifyClick(facts({ button: 2 }), page, 0)).toBeNull();
    expect(classifyClick(facts({ button: 3 }), page, 0)).toBeNull();
  });
  it("alt-click is a download gesture → null, even with other modifiers", () => {
    expect(classifyClick(facts({ altKey: true }), page, 0)).toBeNull();
    expect(classifyClick(facts({ altKey: true, metaKey: true }), page, 0)).toBeNull();
  });
  it("download links → null", () => {
    expect(classifyClick(facts({ download: true }), page, 0)).toBeNull();
    expect(classifyClick(facts({ download: true, target: "_blank" }), page, 0)).toBeNull();
  });
  it.each([undefined, "javascript:void(0)", "mailto:a@b.c", "chrome://settings/", "file:///etc"])(
    "non-http(s) href %s → null",
    (href) => expect(classifyClick(facts({ href, metaKey: true }), page, 0)).toBeNull(),
  );
  it("same-tab link in a subframe navigates the subframe → null", () => {
    expect(classifyClick(facts(), page, 2)).toBeNull();
    expect(classifyClick(facts({ target: "_self" }), page, 2)).toBeNull();
    expect(classifyClick(facts({ target: "_parent" }), page, 2)).toBeNull();
  });
  it("target=_top in a subframe navigates the tab → sameTabLink", () =>
    expect(classifyClick(facts({ target: "_top" }), page, 2)).toBe("sameTabLink"));
  it("new-tab link in a subframe → newTabLink", () =>
    expect(classifyClick(facts({ target: "_blank" }), page, 2)).toBe("newTabLink"));
  it("same-document links (hash only) → null", () => {
    expect(classifyClick(facts({ href: page }), page, 0)).toBeNull();
    expect(classifyClick(facts({ href: page + "#section" }), page, 0)).toBeNull();
    expect(classifyClick(facts({ href: page }), page + "#top", 0)).toBeNull();
  });
  it("same page with a different query is a real navigation → sameTabLink", () =>
    expect(classifyClick(facts({ href: page + "?q=1" }), page, 0)).toBe("sameTabLink"));
  it("a new-tab link to the current page is still newTabLink", () =>
    expect(classifyClick(facts({ href: page, target: "_blank" }), page, 0)).toBe("newTabLink"));
});

describe("classifyRecordedClick", () => {
  it("keeps new-tab kinds from classifyClick", () => {
    expect(classifyRecordedClick(facts({ target: "_blank" }), page, 0)).toBe("newTabLink");
    expect(classifyRecordedClick(facts({ ctrlKey: true }), page, 0)).toBe("modifiedClick");
  });
  it("click with no link: plain → newTabLink, modified → modifiedClick", () => {
    expect(classifyRecordedClick(facts({ href: undefined }), page, 0)).toBe("newTabLink");
    expect(classifyRecordedClick(facts({ href: undefined, button: 1 }), page, 0)).toBe("modifiedClick");
    expect(classifyRecordedClick(facts({ href: undefined, shiftKey: true }), page, 4)).toBe("modifiedClick");
  });
  it("script-handled links (#, javascript:, same-tab) that spawn a tab → newTabLink", () => {
    expect(classifyRecordedClick(facts({ href: page + "#" }), page, 0)).toBe("newTabLink");
    expect(classifyRecordedClick(facts({ href: "javascript:void(0)" }), page, 0)).toBe("newTabLink");
    expect(classifyRecordedClick(facts(), page, 0)).toBe("newTabLink");
    expect(classifyRecordedClick(facts(), page, 2)).toBe("newTabLink");
  });
  it("download, alt and non-primary buttons → null", () => {
    expect(classifyRecordedClick(facts({ download: true }), page, 0)).toBeNull();
    expect(classifyRecordedClick(facts({ altKey: true }), page, 0)).toBeNull();
    expect(classifyRecordedClick(facts({ href: undefined, altKey: true }), page, 0)).toBeNull();
    expect(classifyRecordedClick(facts({ button: 2 }), page, 0)).toBeNull();
  });
});

describe("isClickRecordValid", () => {
  const url = "https://github.com/a";
  const click: ClickRecord = { at: 1000, kind: "newTabLink" };
  const menu: ClickRecord = { at: 1000, kind: "modifiedClick", href: url, contextMenu: true };

  it("accepts a click within CLICK_TTL_MS", () => {
    expect(isClickRecordValid(click, url, 1000)).toBe(true);
    expect(isClickRecordValid(click, url, 1000 + CLICK_TTL_MS)).toBe(true);
  });
  it("rejects a stale click", () => expect(isClickRecordValid(click, url, 1001 + CLICK_TTL_MS)).toBe(false));
  it("click records don't need a matching href", () =>
    expect(isClickRecordValid({ ...click, href: "https://x.com/" }, url, 1500)).toBe(true));
  it("accepts a context-menu record for the same URL within CONTEXTMENU_TTL_MS", () => {
    expect(isClickRecordValid(menu, url, 1000 + CONTEXTMENU_TTL_MS)).toBe(true);
  });
  it("rejects a stale context-menu record", () =>
    expect(isClickRecordValid(menu, url, 1001 + CONTEXTMENU_TTL_MS)).toBe(false));
  it("rejects a context-menu record for another URL after CLICK_TTL_MS", () =>
    expect(isClickRecordValid(menu, "https://github.com/b", 5000)).toBe(false));
  it("does not extend plain clicks to CONTEXTMENU_TTL_MS even with a matching href", () =>
    expect(isClickRecordValid({ ...click, href: url }, url, 5000)).toBe(false));
});

describe("pickExistingTab", () => {
  const url = "https://github.com/a";
  const tab = (id: number, windowId: number, u: string, lastAccessed = 0, incognito = false): TabLike => ({
    id,
    windowId,
    url: u,
    lastAccessed,
    incognito,
  });
  const opts = (over: Partial<MatchOptions> = {}): MatchOptions => ({
    excludeTabId: 99,
    windowId: 1,
    incognito: false,
    ...over,
  });

  it("returns null when nothing matches", () => {
    expect(pickExistingTab([tab(1, 1, "https://github.com/b")], url, opts())).toBeNull();
  });
  it("requires an exact URL match", () => {
    const tabs = [tab(1, 1, url + "#readme"), tab(2, 1, url + "/")];
    expect(pickExistingTab(tabs, url, opts())).toBeNull();
  });
  it("never returns the excluded (new) tab itself", () => {
    expect(pickExistingTab([tab(99, 1, url)], url, opts())).toBeNull();
  });
  it("may return any tab when nothing is excluded", () => {
    expect(pickExistingTab([tab(99, 1, url)], url, opts({ excludeTabId: undefined }))?.id).toBe(99);
  });
  it("prefers the new tab's window over a more recent tab elsewhere", () => {
    const tabs = [tab(1, 2, url, 500), tab(2, 1, url, 100)];
    expect(pickExistingTab(tabs, url, opts())?.id).toBe(2);
  });
  it("picks the most recently accessed within the same preference", () => {
    const tabs = [tab(1, 2, url, 100), tab(2, 2, url, 300), tab(3, 3, url, 200)];
    expect(pickExistingTab(tabs, url, opts())?.id).toBe(2);
  });
  it("never matches across incognito and regular profiles", () => {
    expect(pickExistingTab([tab(1, 1, url, 0, true)], url, opts())).toBeNull();
    expect(pickExistingTab([tab(1, 1, url, 0, false)], url, opts({ incognito: true }))).toBeNull();
    const tabs = [tab(1, 1, url, 900, false), tab(2, 2, url, 100, true)];
    expect(pickExistingTab(tabs, url, opts({ incognito: true }))?.id).toBe(2);
  });
  it("treats a missing incognito flag as regular", () => {
    expect(pickExistingTab([{ id: 1, windowId: 1, url }], url, opts())?.id).toBe(1);
  });
  it("only matches http(s) URLs", () => {
    const ntp = "chrome://newtab/";
    expect(pickExistingTab([tab(1, 1, ntp)], ntp, opts())).toBeNull();
    const file = "file:///tmp/x.html";
    expect(pickExistingTab([tab(1, 1, file)], file, opts())).toBeNull();
  });
});

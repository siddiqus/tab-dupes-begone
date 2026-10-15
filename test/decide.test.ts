import { describe, expect, it } from "vitest";
import { isExternalCommit, isExternalSource, isFastCandidate, pickExistingTab, type TabLike } from "../src/decide.js";

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

describe("pickExistingTab", () => {
  const url = "https://github.com/a";
  const tab = (id: number, windowId: number, u: string, lastAccessed = 0): TabLike => ({ id, windowId, url: u, lastAccessed });

  it("returns null when nothing matches", () => {
    expect(pickExistingTab([tab(1, 1, "https://github.com/b")], url, 99, 1)).toBeNull();
  });
  it("requires an exact URL match", () => {
    const tabs = [tab(1, 1, url + "#readme"), tab(2, 1, url + "/")];
    expect(pickExistingTab(tabs, url, 99, 1)).toBeNull();
  });
  it("never returns the new tab itself", () => {
    expect(pickExistingTab([tab(99, 1, url)], url, 99, 1)).toBeNull();
  });
  it("prefers the new tab's window over a more recent tab elsewhere", () => {
    const tabs = [tab(1, 2, url, 500), tab(2, 1, url, 100)];
    expect(pickExistingTab(tabs, url, 99, 1)?.id).toBe(2);
  });
  it("picks the most recently accessed within the same preference", () => {
    const tabs = [tab(1, 2, url, 100), tab(2, 2, url, 300), tab(3, 3, url, 200)];
    expect(pickExistingTab(tabs, url, 99, 1)?.id).toBe(2);
  });
});

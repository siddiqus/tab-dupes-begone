// Thin click observer. Must stay a classic script: no import/export (types come from messages.d.ts).
// It only looks at the clicked link and modifier keys; it never reads page content.
(() => {
  const DETACH = "tab-dupes-begone:detach";
  const SAME_TAB_TARGETS = ["", "_self", "_parent", "_top"];

  type Anchor = HTMLAnchorElement | HTMLAreaElement;
  interface Probe {
    anchor: Anchor;
    facts: ClickFacts;
    intercept?: boolean;
  }
  let probe: Probe | undefined;

  function anchorOf(e: Event): Anchor | undefined {
    for (const el of e.composedPath()) {
      if ((el instanceof HTMLAnchorElement || el instanceof HTMLAreaElement) && el.hasAttribute("href")) return el;
    }
    return undefined;
  }

  function factsOf(e: MouseEvent, anchor: Anchor | undefined): ClickFacts {
    const target = anchor ? anchor.target || document.querySelector("base[target]")?.getAttribute("target") || "" : "";
    return {
      href: anchor?.href,
      target,
      download: !!anchor?.hasAttribute("download"),
      button: e.button,
      metaKey: e.metaKey,
      ctrlKey: e.ctrlKey,
      shiftKey: e.shiftKey,
      altKey: e.altKey,
    };
  }

  const sameFacts = (a: ClickFacts, b: ClickFacts) => JSON.stringify(a) === JSON.stringify(b);

  /** Send to the background; detaches if this instance was orphaned by an extension reload/update. */
  function send<R>(msg: ContentMessage): Promise<R | undefined> {
    try {
      if (chrome.runtime?.id) return chrome.runtime.sendMessage<ContentMessage, R>(msg).catch(() => undefined);
    } catch {
      // Extension context invalidated.
    }
    detach();
    return Promise.resolve(undefined);
  }

  function onPointerDown(e: PointerEvent): void {
    if (!e.isTrusted || (e.button !== 0 && e.button !== 1)) return;
    const anchor = anchorOf(e);
    if (!anchor) return;
    const p: Probe = { anchor, facts: factsOf(e, anchor) };
    probe = p;
    void send<ProbeReply>({ type: "probe", facts: p.facts }).then((r) => {
      p.intercept = r?.intercept;
    });
  }

  function onClick(e: MouseEvent): void {
    if (!e.isTrusted || e.button !== (e.type === "click" ? 0 : 1)) return;
    const anchor = anchorOf(e);
    const facts = factsOf(e, anchor);
    const p = probe;
    probe = undefined;

    if (!p || p.anchor !== anchor || p.intercept !== true || !sameFacts(p.facts, facts) || !facts.href) {
      void send({ type: "click", facts });
      return;
    }

    e.preventDefault();
    e.stopImmediatePropagation(); // keep SPA routers from navigating
    const href = facts.href;
    const newTab =
      facts.button === 1 || facts.metaKey || facts.ctrlKey || facts.shiftKey ||
      !SAME_TAB_TARGETS.includes(facts.target.toLowerCase());
    void send<SwitchReply>({ type: "switch", facts }).then((r) => {
      if (r?.switched) return;
      // The tab went away meanwhile: do what the click would have done.
      if (newTab) window.open(href, "_blank", "noopener");
      else if (facts.target.toLowerCase() === "_top" && window.top) window.top.location.href = href;
      else location.assign(href);
    });
  }

  function onContextMenu(e: MouseEvent): void {
    if (!e.isTrusted) return;
    const anchor = anchorOf(e);
    if (anchor) void send({ type: "contextmenu", href: anchor.href });
  }

  const listeners: [string, (e: never) => void][] = [
    ["pointerdown", onPointerDown],
    ["click", onClick],
    ["auxclick", onClick],
    ["contextmenu", onContextMenu],
  ];

  function detach(): void {
    for (const [type, fn] of listeners) window.removeEventListener(type, fn as EventListener, true);
    document.removeEventListener(DETACH, detach);
  }

  // A previous instance (orphaned by an extension update, or injected twice) steps aside for this one.
  document.dispatchEvent(new CustomEvent(DETACH));
  document.addEventListener(DETACH, detach);
  for (const [type, fn] of listeners) window.addEventListener(type, fn as EventListener, true);
})();

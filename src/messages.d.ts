// Ambient message types shared by content.ts (a classic script that cannot import) and background.ts.
// No import/export here: this file must stay a global declaration file.

/** Raw facts about a pointer/click event on (or off) a link, as seen by the content script. */
interface ClickFacts {
  /** Absolute URL of the clicked <a href>, if the event hit one. */
  href?: string;
  /** The anchor's effective target (anchor.target, else <base target>), "" if none. */
  target: string;
  /** Anchor has a `download` attribute. */
  download: boolean;
  button: number;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}

/** pointerdown on a link: should the coming click be intercepted? Reply: ProbeReply. */
interface ProbeMessage {
  type: "probe";
  facts: ClickFacts;
}
interface ProbeReply {
  intercept: boolean;
}

/** Intercepted click: switch to the existing tab for `facts.href`. Reply: SwitchReply. */
interface SwitchMessage {
  type: "switch";
  facts: ClickFacts;
}
interface SwitchReply {
  switched: boolean;
}

/** A click that was not intercepted; recorded for fallback correlation. No reply. */
interface ClickMessage {
  type: "click";
  facts: ClickFacts;
}

/** Context menu opened on a link; "Open link in new tab" may follow. No reply. */
interface ContextMenuMessage {
  type: "contextmenu";
  href: string;
}

type ContentMessage = ProbeMessage | SwitchMessage | ClickMessage | ContextMenuMessage;

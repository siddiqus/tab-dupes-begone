// The five per-trigger switches, shared by the popup and the welcome page.
import { SETTING_KEYS, getSettings, saveSettings, type SettingKey } from "./settings.js";

const COPY: Record<SettingKey, { label: string; hint: string }> = {
  desktopApp: {
    label: "Links from desktop apps & installed web apps",
    hint: "A link from Slack, Mail, Zoom or a web app goes to the tab you already have open.",
  },
  newTabLink: {
    label: "Links that open in a new tab",
    hint: "A link that would open a new tab goes to the open one instead.",
  },
  modifiedClick: {
    label: "Cmd/Ctrl-click, middle-click, “Open link in new tab”",
    hint: "Even when you ask for a new tab, go to the open one instead.",
  },
  sameTabLink: {
    label: "Regular links that open in the same tab",
    hint: "Go to the page’s open tab and leave the current tab where it is.",
  },
  typedNewTab: {
    label: "Typing a URL into a new tab",
    hint: "Typing an open page’s address into a new tab goes to that tab and closes the new one.",
  },
};

/** Renders a labelled switch per setting into `container`; changes are saved immediately. */
export async function renderToggles(container: HTMLElement): Promise<void> {
  const settings = await getSettings();
  const inputs = {} as Record<SettingKey, HTMLInputElement>;

  for (const key of SETTING_KEYS) {
    const label = document.createElement("label");
    label.className = "toggle";

    const text = document.createElement("span");
    text.className = "toggle-text";
    const title = document.createElement("span");
    title.className = "toggle-label";
    title.textContent = COPY[key].label;
    const hint = document.createElement("span");
    hint.className = "toggle-hint";
    hint.id = `hint-${key}`;
    hint.textContent = COPY[key].hint;
    text.append(title, hint);

    const input = document.createElement("input");
    input.type = "checkbox";
    input.setAttribute("role", "switch");
    input.setAttribute("aria-describedby", hint.id);
    input.checked = settings[key];
    input.addEventListener("change", () => {
      // Revert if storage rejects the write (e.g. sync rate limits).
      saveSettings({ [key]: input.checked }).catch(() => (input.checked = !input.checked));
    });

    label.append(text, input);
    container.append(label);
    inputs[key] = input;
  }

  // Keep in sync when the same toggles are changed elsewhere (popup vs. welcome page).
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync") return;
    for (const key of SETTING_KEYS) {
      const value = changes[key]?.newValue;
      if (typeof value === "boolean") inputs[key].checked = value;
    }
  });
}

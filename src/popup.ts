import { renderToggles } from "./toggles.js";

void renderToggles(document.getElementById("toggles")!);

document.getElementById("why")!.addEventListener("click", (e) => {
  e.preventDefault();
  void chrome.tabs.create({ url: chrome.runtime.getURL("welcome.html") });
  window.close();
});

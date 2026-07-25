import Phaser from "phaser";
import { responsiveScale } from "@core-loop/phaser";
import {
  BrowserAudioActivation,
  registerProductionServiceWorker,
} from "@core-loop/phaser";
import { registerSW } from "virtual:pwa-register";
import { BootScene } from "./game/scenes/BootScene";
import { LabScene } from "./game/scenes/LabScene";
import { MenuScene } from "./game/scenes/MenuScene";
import "./style.css";
import {
  contentBrowserRows,
  definitionDetail,
  developmentToolsEnabled,
} from "./devtools";

const pwaStatus = document.createElement("div");
pwaStatus.className = "pwa-status";
pwaStatus.setAttribute("role", "status");
pwaStatus.textContent = "Loading";
document.body.append(pwaStatus);
const audio = new BrowserAudioActivation();
document.addEventListener("pointerdown", () => void audio.activate(), {
  once: true,
});
void registerProductionServiceWorker(
  import.meta.env.PROD,
  async () => {
    let update: (reload?: boolean) => Promise<void> = async () => {};
    update = registerSW({
      immediate: true,
      onOfflineReady: () => {
        pwaStatus.textContent = "Ready for offline use";
      },
      onNeedRefresh: () => {
        pwaStatus.replaceChildren("Update available · ");
        const button = document.createElement("button");
        button.textContent = "Save and reload";
        button.onclick = () => void update(true);
        pwaStatus.append(button);
      },
      onRegisterError: () => {
        pwaStatus.textContent =
          "Offline setup failed; online play remains available";
      },
    });
    return { updateServiceWorker: update };
  },
  ({ state }) => {
    if (state === "unsupported") pwaStatus.remove();
    else
      pwaStatus.textContent =
        state === "preparing"
          ? "Preparing offline cache…"
          : state.replaceAll("-", " ");
  },
);
window.addEventListener("offline", () => {
  pwaStatus.textContent = "Offline · packaged play remains available";
});

if (developmentToolsEnabled(import.meta.env.DEV, location.search)) {
  const panel = document.createElement("aside");
  panel.className = "content-browser";
  panel.innerHTML = `<header><strong>Content browser</strong><button type="button" aria-label="Close">×</button></header><label>Search <input type="search" placeholder="name, ID or description"></label><label>Category <select><option value="">All categories</option>${[...new Set(contentBrowserRows().map((row) => row.category))].map((value) => `<option>${value}</option>`).join("")}</select></label><div class="content-results"></div><pre class="content-detail">Select a definition</pre>`;
  document.body.append(panel);
  const search = panel.querySelector("input")!;
  const category = panel.querySelector("select")!;
  const results = panel.querySelector<HTMLDivElement>(".content-results")!;
  const detail = panel.querySelector<HTMLElement>(".content-detail")!;
  const render = () => {
    results.replaceChildren(
      ...contentBrowserRows({
        text: search.value,
        category: category.value,
      }).map((row) => {
        const button = document.createElement("button");
        button.type = "button";
        button.innerHTML = `<b>${row.name}</b><small>${row.id}<br>${row.category} · ${row.rarity} · ${row.price ?? "—"}</small>`;
        button.onclick = () => {
          const value = definitionDetail(row.id);
          detail.textContent = `${value.pack}\n${row.name} (${row.id})\n\nTags: ${row.tags.join(", ")}\nCompatible: ${row.compatibleModules.join(", ") || "none"}\nPools: ${value.poolMembership.join(", ") || "none"}\nLoadouts: ${value.loadoutInclusion.join(", ") || "none"}\n\n${value.formattedJson}`;
        };
        return button;
      }),
    );
  };
  search.addEventListener("input", render);
  category.addEventListener("change", render);
  panel
    .querySelector("header button")!
    .addEventListener("click", () => panel.remove());
  render();
}

new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  backgroundColor: "#101827",
  scale: responsiveScale,
  scene: [BootScene, MenuScene, LabScene],
});

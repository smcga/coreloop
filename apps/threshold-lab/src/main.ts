import Phaser from "phaser";
import { responsiveScale } from "@core-loop/phaser";
import { BootScene } from "./game/scenes/BootScene";
import { LabScene } from "./game/scenes/LabScene";
import { MenuScene } from "./game/scenes/MenuScene";
import "./style.css";
import {
  contentBrowserRows,
  definitionDetail,
  developmentToolsEnabled,
} from "./devtools";

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

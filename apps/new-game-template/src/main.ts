import { starterTerminology, starterContentRegistry } from "./content";
import { choiceModule, type ChoiceState } from "./gameplay";
import { StarterRuntime } from "./runtime";
import "./style.css";

const root = document.querySelector<HTMLElement>("#app")!;
const storage = {
  read: () => localStorage.getItem("starter:save"),
  write: (text: string) => localStorage.setItem("starter:save", text),
  remove: () => localStorage.removeItem("starter:save"),
};
const runtime = new StarterRuntime(storage);
const term = (key: keyof typeof starterTerminology.terms) =>
  starterTerminology.terms[key].singular;
const title = starterTerminology.applicationTitle!;
let notice = "";

function seed() {
  const value = Number(
    new URLSearchParams(location.search).get("seed") ?? Date.now() >>> 0,
  );
  return Number.isSafeInteger(value) && value >= 0 ? value >>> 0 : 1;
}
function act(command: Parameters<StarterRuntime["command"]>[0]) {
  notice = runtime.command(command) ? "" : "That action is not legal now.";
  render();
}
function exchange(kind: "save" | "replay", mode: "export" | "import") {
  try {
    if (mode === "export")
      prompt(
        `Copy ${kind} text`,
        kind === "save" ? runtime.exportSave() : runtime.exportReplay(),
      );
    else {
      const text = prompt(`Paste ${kind} text`);
      if (text) {
        if (kind === "save") runtime.importSave(text);
        else
          notice = runtime.verifyReplay(text).ok
            ? "Replay verified."
            : "Replay diverged.";
      }
    }
  } catch (error) {
    notice = error instanceof Error ? error.message : "Import failed";
  }
  render();
}

function render() {
  const s = runtime.state,
    total = s.schedule.length,
    current = Math.max(0, s.schedulePosition + 1);
  const header = `<header><h1>${title}</h1>${s.phase !== "idle" ? `<p>${term("run")} ${s.seed} · ${term("encounter")} ${current}/${total} · ${s.currency} ${term("currency")}${s.currentEncounter ? ` · ${term("target")} ${s.currentEncounter.target}` : ""}</p>` : ""}</header>`;
  let body = "";
  if (s.phase === "idle" || s.phase === "abandoned")
    body = `<section class="panel"><h2>Start a ${term("run")}</h2><button id="new">New ${term("run")}</button>${storage.read() ? `<button id="continue">Continue</button><button id="delete" class="quiet">Delete save</button>` : ""}</section>`;
  else if (s.phase === "encounter-ready")
    body = `<section class="panel"><h2>${term("encounter")} ${current}</h2><p>${s.currentEncounter?.rules.length ? term("special-encounter") : "Choose three deterministic values."}</p><button id="start">Start</button><button id="use" class="quiet">Use ${term("consumable")}</button></section>`;
  else if (s.phase === "encounter-active") {
    const moduleState = choiceModule.validateState(
      s.gameplaySession!.data,
    ) as ChoiceState;
    const progress = choiceModule.getProgress(moduleState);
    body = `<section class="panel"><h2>${term("score")} ${progress.score}</h2><div class="choices">${moduleState.options.map((v, i) => `<button data-choice="${i}" ${moduleState.choices.length >= 3 ? "disabled" : ""}>${v}</button>`).join("")}</div><p>${progress.completedActions}/${progress.totalActions} choices</p></section>`;
  } else if (s.phase === "reward")
    body = `<section class="panel"><h2>${term("score")} ${s.lastReport?.score} / ${term("target")} ${s.currentEncounter?.target}</h2>${ledger()}<button id="shop">Visit ${term("shop")}</button><button id="skip" class="quiet">Skip ${term("shop")}</button></section>`;
  else if (s.phase === "shop" && s.shop)
    body = `<section class="panel"><h2>${term("shop")}</h2><div class="offers">${s.shop.offers
      .map((o) => {
        const d = starterContentRegistry.get(o.definitionId);
        return `<button data-buy="${o.id}">${d.presentation.name}<small>${o.price} ${term("currency")}</small></button>`;
      })
      .join(
        "",
      )}</div><button id="reroll" class="quiet">${term("reroll")} · ${s.shop.rerollPrice}</button><button id="next">Next ${term("encounter")}</button></section>`;
  else
    body = `<section class="panel"><h2>${s.phase === "run-complete" ? `${term("run")} complete` : `${term("run")} finished`}</h2>${ledger()}<button id="new">New ${term("run")}</button></section>`;
  root.innerHTML = `${header}${notice ? `<p class="notice" role="status">${notice}</p>` : ""}${body}<footer><button id="export-save" class="text">Save text</button><button id="import-save" class="text">Import save</button><button id="export-replay" class="text">Replay text</button><button id="verify-replay" class="text">Verify replay</button></footer>`;
  root
    .querySelector<HTMLButtonElement>("#new")
    ?.addEventListener("click", () => {
      runtime.newRun(seed());
      render();
    });
  root
    .querySelector<HTMLButtonElement>("#continue")
    ?.addEventListener("click", () => {
      runtime.continue();
      render();
    });
  root
    .querySelector<HTMLButtonElement>("#delete")
    ?.addEventListener("click", () => {
      runtime.deleteSave();
      render();
    });
  root
    .querySelector<HTMLButtonElement>("#start")
    ?.addEventListener("click", () => act({ type: "start-encounter" }));
  root
    .querySelector<HTMLButtonElement>("#shop")
    ?.addEventListener("click", () => act({ type: "enter-shop" }));
  root
    .querySelector<HTMLButtonElement>("#skip")
    ?.addEventListener("click", () => act({ type: "advance" }));
  root
    .querySelector<HTMLButtonElement>("#reroll")
    ?.addEventListener("click", () => act({ type: "reroll-shop" }));
  root
    .querySelector<HTMLButtonElement>("#next")
    ?.addEventListener("click", () => act({ type: "leave-shop" }));
  root
    .querySelector<HTMLButtonElement>("#use")
    ?.addEventListener("click", () => {
      const item = runtime.state.inventory.instances.find(
        (i) =>
          starterContentRegistry.get(i.definitionId).category === "consumable",
      );
      if (item) act({ type: "use-consumable", instanceId: item.instanceId });
      else {
        notice = "No boost available.";
        render();
      }
    });
  root.querySelectorAll<HTMLElement>("[data-choice]").forEach((button) =>
    button.addEventListener("click", () => {
      runtime.action({ type: "choose", index: Number(button.dataset.choice) });
      render();
    }),
  );
  root
    .querySelectorAll<HTMLElement>("[data-buy]")
    .forEach((button) =>
      button.addEventListener("click", () =>
        act({ type: "buy-offer", offerId: button.dataset.buy! }),
      ),
    );
  root.querySelector<HTMLButtonElement>("#export-save")!.onclick = () =>
    exchange("save", "export");
  root.querySelector<HTMLButtonElement>("#import-save")!.onclick = () =>
    exchange("save", "import");
  root.querySelector<HTMLButtonElement>("#export-replay")!.onclick = () =>
    exchange("replay", "export");
  root.querySelector<HTMLButtonElement>("#verify-replay")!.onclick = () =>
    exchange("replay", "import");
}
function ledger() {
  return runtime.state.scoreLedger.length
    ? `<details><summary>Effect ledger</summary>${runtime.state.scoreLedger.map((x) => `<p>${x.label}: ${x.before} → ${x.after}</p>`).join("")}</details>`
    : "";
}
render();

import {
  createSaveFile,
  loadSaveFile,
  type RunCommand,
  type RunState,
} from "@core-loop/core";
import { gardenContentPack, gardenTerms } from "./content";
import { createRewardViewModel } from "@core-loop/content";
import { createGardenSession, gardenModules } from "./configuration";
import { gardenModule, type GardenState } from "./gameplay";
import "./style.css";

const SAVE_KEY = "garden-loop:season:v1";
const root = document.querySelector<HTMLElement>("#app")!;
const session = createGardenSession();
const requestedSeed =
  Number(new URLSearchParams(location.search).get("seed") ?? 7) >>> 0;

const save = () => {
  if (state.phase === "idle" || state.phase === "abandoned") return;
  localStorage.setItem(
    SAVE_KEY,
    JSON.stringify(
      createSaveFile(state, undefined, {
        content: {
          packId: gardenContentPack.id,
          packVersion: gardenContentPack.version,
        },
        gameplay: {
          moduleId: gardenModule.id,
          moduleVersion: gardenModule.version,
        },
        policies: state.policyReferences,
      }),
    ),
  );
};

const restore = (): RunState | undefined => {
  const text = localStorage.getItem(SAVE_KEY);
  if (!text) return undefined;
  try {
    const loaded = loadSaveFile(text, {
      contentPacks: new Map([
        [gardenContentPack.id, [gardenContentPack.version]],
      ]),
      gameplayModules: new Map([[gardenModule.id, [gardenModule.version]]]),
      policies: new Map(
        Object.values(session.policyReferences).map((policy) => [
          policy.id,
          [policy.version],
        ]),
      ),
    }).save.run;
    return session.validateRestoredState(loaded);
  } catch (error) {
    localStorage.removeItem(SAVE_KEY);
    root.dataset.recovery =
      error instanceof Error
        ? error.message
        : "The saved season was incompatible.";
    return undefined;
  }
};

let state =
  restore() ??
  session.handleCommand(session.createInitialState(), {
    type: "start-run",
    seed: requestedSeed,
    gameplayModuleId: gardenModule.id,
  }).state;
save();

const command = (value: RunCommand) => {
  state = session.handleCommand(state, value).state;
  save();
  render();
};
const action = (index: number) => {
  state = session.handleGameplayAction(state, { type: "plant", index }).state;
  save();
  render();
};
const nameOf = (definitionId: string) =>
  gardenContentPack.definitions.find(
    (definition) => definition.id === definitionId,
  )?.presentation.name ?? definitionId;
const gardenState = (): GardenState | undefined =>
  state.gameplaySession
    ? (gardenModules.restore(state.gameplaySession) as GardenState)
    : undefined;

function render() {
  const growing = gardenState();
  const progress = growing ? gardenModule.getProgress(growing) : undefined;
  const weather = state.currentEncounter?.rules[0];
  const owned = state.inventory.instances.filter(
    (item) => !item.hostInstanceId,
  );
  const result = state.lastReport;
  const reward = createRewardViewModel(state.pendingReward, nameOf);
  const routeLabel =
    state.pendingRoute?.type === "shop"
      ? "Visit garden centre"
      : state.pendingRoute?.type === "run-complete"
        ? "Finish season"
        : "Continue";
  root.innerHTML = `
    <header><div><p class="eyebrow">Season seed ${state.seed}</p><h1>${gardenTerms.applicationTitle}</h1></div><button class="quiet" id="new">New season</button></header>
    <div class="status"><span>Session <strong>${Math.max(1, state.schedulePosition + 1)}/${state.schedule.length || 5}</strong></span><span>${gardenTerms.terms.currency.singular} <strong>${state.currency}</strong></span><span>Goal <strong>${state.currentEncounter?.target ?? result?.score ?? "—"}</strong></span></div>
    ${weather ? `<aside class="weather"><strong>${nameOf(weather.id)}</strong><span>${gardenContentPack.presentation?.[weather.id] ?? "Special growing conditions apply."}</span></aside>` : ""}
    <main>
      ${
        state.phase === "encounter-ready"
          ? `<h2>${state.currentEncounter?.number === 1 ? "Begin the season" : "The next bed is ready"}</h2><p>Choose supplies before starting, then make a two-plant plan.</p><div class="actions"><button id="start">Start growing</button>${owned
              .filter((item) => nameOf(item.definitionId) === "Watering Can")
              .map(
                (item) =>
                  `<button class="secondary" data-use="${item.instanceId}">Use Watering Can</button>`,
              )
              .join("")}</div>`
          : ""
      }
      ${state.phase === "encounter-active" && growing ? `<h2>Choose two plants</h2><p>Water allowance ${growing.waterAllowance}${growing.minimumResilience ? ` · resilience needed ${growing.minimumResilience}` : ""}</p><section class="plants">${growing.plants.map((plant, index) => `<button data-plant="${index}" ${growing.planted.includes(index) ? "disabled" : ""}><strong>${nameOf(plant.definitionId)}</strong><span>Growth ${plant.growth}</span><small>Water ${plant.water} · resilience ${plant.resilience} · ${plant.instanceId}</small></button>`).join("")}</section><p class="harvest">Harvest <strong>${progress?.score ?? 0}</strong></p>` : ""}
          ${state.phase === "reward" ? `<h2>${reward ? "Garden reward" : result && result.score >= (state.currentEncounter?.target ?? Infinity) ? "Harvest gathered" : "The first setback is recoverable"}</h2>${reward?.type === "container" ? `<p>${reward.label} is ready.</p><button id="open-reward">Open reward</button>` : reward?.type === "choice" ? `<p>Choose one authored reward.</p><section class="offers">${reward.options.map((option) => `<button data-reward="${option.id}"><strong>${option.label}</strong></button>`).join("")}</section>` : reward?.type === "target" ? `<p>Choose a compatible plant for ${reward.option.label}.</p><div class="actions">${owned.map((item) => `<button class="secondary" data-reward-target="${item.instanceId}">${nameOf(item.definitionId)} · ${item.instanceId}</button>`).join("")}</div>` : `<p>Harvest ${result?.score} against a goal of ${state.currentEncounter?.target}. The authoritative route is ${state.pendingRoute?.type ?? "pending"}.</p><div class="actions"><button id="continue">${routeLabel}</button></div>`}` : ""}
      ${state.phase === "shop" && state.shop ? `<h2>Garden centre</h2><p>All offers come from the authored Garden content pool.</p><section class="offers">${state.shop.offers.map((offer) => `<button data-buy="${offer.id}"><strong>${nameOf(offer.definitionId)}</strong><span>${offer.price} compost</span></button>`).join("")}</section>${state.pendingAcquisition ? `<h3>Choose a host for ${nameOf(state.pendingAcquisition.offer.definitionId)}</h3><div class="actions">${owned.map((item) => `<button class="secondary" data-target="${item.instanceId}">${nameOf(item.definitionId)}</button>`).join("")}</div>` : ""}<div class="actions"><button class="secondary" id="reroll">Refresh · ${state.shop.rerollPrice}</button><button id="leave">Leave centre</button></div>` : ""}
      ${state.phase === "run-complete" ? `<h2>Season complete!</h2><p>Five growing sessions finished with ${state.currency} compost.</p>` : ""}
      ${state.phase === "run-failed" ? `<h2>Season ended</h2><p>The garden could not recover from this weather.</p>` : ""}
    </main>
    <details><summary>Garden shed · ${owned.length} items</summary><ul>${owned.map((item) => `<li>${nameOf(item.definitionId)} <small>${item.instanceId}</small>${item.attachmentIds.length ? ` · ${item.attachmentIds.map((id) => nameOf(state.inventory.instances.find((candidate) => candidate.instanceId === id)?.definitionId ?? id)).join(", ")}` : ""}${state.phase === "shop" ? ` <button class="link" data-sell="${item.instanceId}">Return</button>` : ""}</li>`).join("")}</ul></details>
    ${
      state.scoreLedger.length
        ? `<details><summary>Harvest attribution · ${state.scoreLedger.length}</summary><ul>${state.scoreLedger
            .map((entry) => {
              const amount = entry.amount ?? entry.after - entry.before;
              return `<li>${nameOf(entry.source.definitionId)} · ${amount >= 0 ? "+" : ""}${amount} ${entry.track}</li>`;
            })
            .join("")}</ul></details>`
        : ""
    }
    <details><summary>Save tools</summary><textarea id="transfer" aria-label="Save export or import"></textarea><div class="actions"><button class="secondary" id="export">Export save</button><button class="secondary" id="import">Import save</button></div></details>`;
  root
    .querySelector<HTMLButtonElement>("#open-reward")
    ?.addEventListener("click", () =>
      command({ type: "open-reward-container" }),
    );
  root
    .querySelector<HTMLButtonElement>("#start")
    ?.addEventListener("click", () => command({ type: "start-encounter" }));
  root
    .querySelector<HTMLButtonElement>("#continue")
    ?.addEventListener("click", () => command({ type: "continue" }));
  root
    .querySelector<HTMLButtonElement>("#reroll")
    ?.addEventListener("click", () => command({ type: "reroll-shop" }));
  root
    .querySelector<HTMLButtonElement>("#leave")
    ?.addEventListener("click", () => command({ type: "leave-shop" }));
  root
    .querySelectorAll<HTMLElement>("[data-plant]")
    .forEach((button) =>
      button.addEventListener("click", () =>
        action(Number(button.dataset.plant)),
      ),
    );
  root
    .querySelectorAll<HTMLElement>("[data-buy]")
    .forEach((button) =>
      button.addEventListener("click", () =>
        command({ type: "buy-offer", offerId: button.dataset.buy! }),
      ),
    );
  root.querySelectorAll<HTMLElement>("[data-target]").forEach((button) =>
    button.addEventListener("click", () =>
      command({
        type: "choose-acquisition-target",
        offerId: state.pendingAcquisition!.offer.id,
        targetInstanceId: button.dataset.target!,
      }),
    ),
  );
  root
    .querySelectorAll<HTMLElement>("[data-reward]")
    .forEach((button) =>
      button.addEventListener("click", () =>
        command({ type: "choose-reward", optionId: button.dataset.reward! }),
      ),
    );
  root.querySelectorAll<HTMLElement>("[data-reward-target]").forEach((button) =>
    button.addEventListener("click", () =>
      command({
        type: "choose-reward-target",
        optionId:
          state.pendingReward?.type === "target"
            ? state.pendingReward.option.id
            : "",
        targetInstanceId: button.dataset.rewardTarget!,
      }),
    ),
  );
  root
    .querySelectorAll<HTMLElement>("[data-use]")
    .forEach((button) =>
      button.addEventListener("click", () =>
        command({ type: "use-consumable", instanceId: button.dataset.use! }),
      ),
    );
  root
    .querySelectorAll<HTMLElement>("[data-sell]")
    .forEach((button) =>
      button.addEventListener("click", () =>
        command({ type: "sell-item", instanceId: button.dataset.sell! }),
      ),
    );
  root.querySelector<HTMLButtonElement>("#new")!.onclick = () => {
    localStorage.removeItem(SAVE_KEY);
    location.reload();
  };
  root.querySelector<HTMLButtonElement>("#export")!.onclick = () => {
    root.querySelector<HTMLTextAreaElement>("#transfer")!.value =
      localStorage.getItem(SAVE_KEY) ?? "";
  };
  root.querySelector<HTMLButtonElement>("#import")!.onclick = () => {
    const value = root.querySelector<HTMLTextAreaElement>("#transfer")!.value;
    localStorage.setItem(SAVE_KEY, value);
    const loaded = restore();
    if (loaded) {
      state = loaded;
      render();
    }
  };
}
render();

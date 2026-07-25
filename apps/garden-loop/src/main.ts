import { gardenModule, type GardenState } from "./gameplay";
import "./style.css";
const root = document.querySelector<HTMLElement>("#app")!;
const seed =
  Number(new URLSearchParams(location.search).get("seed") ?? 7) >>> 0;
let round = 1,
  state: GardenState;
function begin() {
  const x = gardenModule.createEncounter({
    encounterId: `growing-${round}`,
    encounterNumber: round,
    target: 9 + round,
    rules:
      round % 3 === 0 ? [{ id: "garden-loop:bad-weather", version: 1 }] : [],
    seed: (seed + round) >>> 0,
  });
  state = x.state;
  render();
}
function render() {
  root.innerHTML = `<h1>Garden Loop</h1><p>Season seed ${seed} · growing session ${round}/6 ${round % 3 === 0 ? "· bad weather" : ""}</p><h2>Choose two plants</h2><section>${state.plants.map((p, i) => `<button data-i="${i}">Growth ${p.growth}<small>Water ${p.water} · resilience ${p.resilience}</small></button>`).join("")}</section><p>Harvest ${gardenModule.getProgress(state).score}</p>`;
  root.querySelectorAll("button").forEach(
    (b) =>
      (b.onclick = () => {
        state = gardenModule.handleAction(
          state,
          { type: "plant", index: Number((b as HTMLElement).dataset.i) },
          { encounterId: "", encounterNumber: round },
        ).state;
        if (gardenModule.isComplete(state)) {
          const score = gardenModule.createReport(state, {
            encounterId: "",
            encounterNumber: round,
          }).score;
          if (score < 9 + round) {
            root.innerHTML += `<h2>Season ended · harvest ${score}</h2>`;
          } else if (round++ === 6)
            root.innerHTML += `<h2>Season complete!</h2>`;
          else {
            localStorage.setItem(
              "garden.save",
              JSON.stringify({ seed, round }),
            );
            root.innerHTML += `<h2>Garden centre</h2><p>Spend compost on a helper or supply.</p><button id="next">Next session</button>`;
            document.querySelector<HTMLButtonElement>("#next")!.onclick = begin;
          }
        } else render();
      }),
  );
}
begin();

import { createRandom } from "@core-loop/core";
import { choiceModule, type ChoiceState } from "./gameplay";
import "./style.css";
const root = document.querySelector<HTMLElement>("#app")!;
const params = new URLSearchParams(location.search);
const parsed = Number(params.get("seed") ?? "1");
const seed =
  Number.isInteger(parsed) && parsed >= 0 && parsed <= 0xffffffff ? parsed : 1;
let rng = createRandom(seed),
  round = 1,
  state: ChoiceState;
function begin() {
  const made = choiceModule.createEncounter({
    encounterId: `choice-${round}`,
    encounterNumber: round,
    target: 12 + round,
    specialRuleId: null,
    rng,
  });
  state = made.state;
  rng = made.rng;
  render();
}
function render() {
  root.innerHTML = `<h1>New Game Template</h1><p>Run seed ${seed} · encounter ${round}/6</p><h2>Choose three values</h2><section>${state.options.map((v, i) => `<button data-i="${i}">${v}</button>`).join("")}</section><p>Score ${choiceModule.getProgress(state).score}</p>`;
  root.querySelectorAll("button").forEach(
    (b) =>
      (b.onclick = () => {
        const out = choiceModule.handleAction(
          state,
          { type: "choose", index: Number((b as HTMLElement).dataset.i) },
          { encounterId: `choice-${round}`, encounterNumber: round },
        );
        state = out.state;
        if (choiceModule.isComplete(state)) {
          const report = choiceModule.createReport(state, {
            encounterId: "",
            encounterNumber: round,
          });
          if (report.score < 12 + round) {
            root.innerHTML += `<h2>Run lost · score ${report.score}</h2><button onclick="location.reload()">Try again</button>`;
          } else if (round++ === 6) {
            root.innerHTML += `<h2>Run won</h2>`;
          } else {
            localStorage.setItem(
              "starter.save",
              JSON.stringify({ seed, round, rng }),
            );
            root.innerHTML += `<h2>Shop</h2><p>Example upgrade: +1 safety</p><button id="next">Next encounter</button>`;
            document.querySelector<HTMLButtonElement>("#next")!.onclick = begin;
          }
        } else render();
      }),
  );
}
begin();

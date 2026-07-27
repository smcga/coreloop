import {
  createReplay,
  createSaveFile,
  createSessionReplayExecutor,
  exportReplay,
  importReplay,
  loadSaveFile,
  stableHash,
  verifyReplay,
  type JsonValue,
  type RecordedInput,
  type ReplayEnvelope,
  type RunCommand,
  type RunEvent,
  type RunState,
} from "@core-loop/core";
import { starterContentPack, starterCustomEffect } from "./content";
import { starterSession } from "./composition";
import { choiceModule } from "./gameplay";

export interface TextStore {
  read(): string | null;
  write(text: string): void;
  remove(): void;
}

/** Browser-independent presentation host: it records only accepted coordinator transitions. */
export class StarterRuntime {
  state: RunState = starterSession.createInitialState();
  events: readonly RunEvent[] = [];
  private inputs: RecordedInput[] = [];

  constructor(private readonly store?: TextStore) {}

  newRun(seed: number): void {
    this.state = starterSession.createInitialState();
    this.events = [];
    this.inputs = [];
    const started = starterSession.handleCommand(this.state, {
      type: "start-run",
      seed,
      gameplayModuleId: choiceModule.id,
      loadoutId: "starter:balanced",
    });
    this.state = started.state;
    // Replay envelopes carry run creation as metadata; recorded inputs begin
    // after the executor has recreated that initial state.
    this.autosave();
  }

  command(command: RunCommand): boolean {
    const result = starterSession.handleCommand(this.state, command);
    if (result.state === this.state) return false;
    this.commit(result.state, result.events, {
      sequence: this.inputs.length + 1,
      type: "run-command",
      command,
    });
    return true;
  }

  action(action: unknown): boolean {
    const result = starterSession.handleGameplayAction(this.state, action);
    if (!result.accepted) return false;
    this.commit(result.state, result.events, {
      sequence: this.inputs.length + 1,
      type: "gameplay-action",
      moduleId: choiceModule.id,
      action: action as JsonValue,
    });
    return true;
  }

  private commit(
    state: RunState,
    events: readonly RunEvent[],
    input: RecordedInput,
  ): void {
    this.state = state;
    this.events = [...this.events, ...events];
    this.inputs.push(input);
    this.autosave();
  }

  autosave(): void {
    if (!this.store) return;
    this.store.write(
      JSON.stringify(
        createSaveFile(this.state, undefined, {
          content: starterContentProviderIdentity(),
          gameplay: {
            moduleId: choiceModule.id,
            moduleVersion: choiceModule.version,
          },
          customEffects: [starterCustomEffect],
          replay: { inputCount: this.inputs.length },
        }),
      ),
    );
  }

  exportSave(): string {
    return JSON.stringify(
      createSaveFile(this.state, undefined, {
        content: starterContentProviderIdentity(),
        gameplay: {
          moduleId: choiceModule.id,
          moduleVersion: choiceModule.version,
        },
        customEffects: [starterCustomEffect],
        replay: { inputCount: this.inputs.length },
      }),
      null,
      2,
    );
  }

  importSave(text: string): void {
    const loaded = loadSaveFile(text, compatibility()).save;
    this.state = starterSession.validateRestoredState(loaded.run);
    this.events = [];
    this.inputs = [];
    this.autosave();
  }

  continue(): boolean {
    const text = this.store?.read();
    if (!text) return false;
    this.importSave(text);
    return true;
  }

  deleteSave(): void {
    this.store?.remove();
  }

  replay(): ReplayEnvelope {
    const checkpoints = this.inputs.map((input, index) => {
      const partial = this.buildReplay(this.inputs.slice(0, index + 1), []);
      const verified = executeInputs(partial.inputs, this.state.seed ?? 0);
      return {
        sequence: input.sequence,
        boundary: verified.state.phase,
        stateHash: stableHash(verified.state),
        eventHash: stableHash(verified.events),
      };
    });
    return this.buildReplay(this.inputs, checkpoints);
  }

  exportReplay(): string {
    return exportReplay(this.replay());
  }
  verifyReplay(text: string) {
    return verifyReplay(
      importReplay(text),
      createSessionReplayExecutor(starterSession),
    );
  }

  private buildReplay(
    inputs: readonly RecordedInput[],
    checkpoints: ReplayEnvelope["checkpoints"],
  ): ReplayEnvelope {
    const final = executeInputs(inputs, this.state.seed ?? 0);
    return createReplay({
      run: final.state,
      content: starterContentProviderIdentity(),
      gameplay: {
        moduleId: choiceModule.id,
        moduleVersion: choiceModule.version,
      },
      customEffects: [starterCustomEffect],
      seed: final.state.seed ?? 0,
      inputs,
      checkpoints,
      finalStateHash: stableHash(final.state),
      finalEventHash: stableHash(final.events),
    });
  }
}

const starterContentProviderIdentity = () => ({
  packId: starterContentPack.id,
  packVersion: starterContentPack.version,
});
const compatibility = () => ({
  contentPacks: new Map([
    [starterContentPack.id, [starterContentPack.version]],
  ]),
  gameplayModules: new Map([[choiceModule.id, [choiceModule.version]]]),
  policies: new Map(
    Object.values(starterSession.policyReferences).map((p) => [
      p.id,
      [p.version],
    ]),
  ),
  customEffects: new Map([
    [starterCustomEffect.id, [starterCustomEffect.version]],
  ]),
});

function executeInputs(inputs: readonly RecordedInput[], seed: number) {
  const executor = createSessionReplayExecutor(starterSession);
  let state = executor.initialState(seed, choiceModule.id);
  const events: RunEvent[] = [];
  for (const input of inputs) {
    const result =
      input.type === "run-command"
        ? executor.runCommand(state, input.command)
        : executor.gameplayAction(state, input.moduleId, input.action);
    state = result.state;
    events.push(...result.events);
  }
  return { state, events };
}

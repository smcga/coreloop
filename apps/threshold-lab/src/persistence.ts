import {
  createSaveFile,
  parseSaveFile,
  type RunState,
  type SaveFile,
  exportReplay,
  importReplay,
  loadSaveFile,
  type ReplayEnvelope,
} from "@core-loop/core";

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}
export const SAVE_KEY = "coreloop.threshold-lab.run.v1";
export const REPLAY_KEY = "coreloop.threshold-lab.replay.v1";
export class RunSaveStore {
  constructor(private readonly storage: StorageLike) {}
  load(): SaveFile | null {
    const value = this.storage.getItem(SAVE_KEY);
    return value === null ? null : parseSaveFile(value);
  }
  save(run: RunState): void {
    this.storage.setItem(SAVE_KEY, JSON.stringify(createSaveFile(run)));
  }
  clear(): void {
    this.storage.removeItem(SAVE_KEY);
  }
  exportText(): string | null {
    const save = this.load();
    return save ? JSON.stringify(save, null, 2) : null;
  }
  importText(text: string): { readonly migratedFrom: number | null } {
    const loaded = loadSaveFile(text);
    this.storage.setItem(SAVE_KEY, JSON.stringify(loaded.save));
    return { migratedFrom: loaded.migratedFrom };
  }
  saveReplay(replay: ReplayEnvelope): void {
    this.storage.setItem(REPLAY_KEY, exportReplay(replay));
  }
  loadReplay(): ReplayEnvelope | null {
    const text = this.storage.getItem(REPLAY_KEY);
    if (text === null) return null;
    try {
      return importReplay(text);
    } catch {
      return null;
    }
  }
  importReplayText(text: string): ReplayEnvelope {
    const replay = importReplay(text);
    this.storage.setItem(REPLAY_KEY, exportReplay(replay));
    return replay;
  }
  exportReplayText(): string | null {
    const replay = this.loadReplay();
    return replay ? exportReplay(replay) : null;
  }
}

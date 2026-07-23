import {
  createSaveFile,
  parseSaveFile,
  type RunState,
  type SaveFile,
} from "@core-loop/core";

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}
export const SAVE_KEY = "coreloop.threshold-lab.run.v1";
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
}

import { describe, expect, it } from "vitest";
import { createInitialRunState } from "@core-loop/core";
import { RunSaveStore, SAVE_KEY, type StorageLike } from "../src/persistence";

class MemoryStorage implements StorageLike {
  data = new Map<string, string>();
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.data.set(key, value);
  }
  removeItem(key: string) {
    this.data.delete(key);
  }
}
describe("RunSaveStore", () => {
  it("saves, validates, loads, and clears without browser globals", () => {
    const storage = new MemoryStorage();
    const store = new RunSaveStore(storage);
    const state = createInitialRunState();
    store.save(state);
    expect(store.load()?.run).toEqual(state);
    store.clear();
    expect(storage.getItem(SAVE_KEY)).toBeNull();
  });
  it("gracefully rejects malformed storage", () => {
    const storage = new MemoryStorage();
    storage.setItem(SAVE_KEY, "{");
    expect(new RunSaveStore(storage).load()).toBeNull();
  });
});

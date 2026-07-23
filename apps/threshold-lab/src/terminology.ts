import { ContentRegistry, thresholdLabContentPack } from "@core-loop/content";

const registry = new ContentRegistry(thresholdLabContentPack);
const storageKey = "core-loop:terminology";
export function selectedTerminologyId(): string {
  const saved = localStorage.getItem(storageKey);
  return thresholdLabContentPack.terminology.some((term) => term.id === saved)
    ? saved!
    : thresholdLabContentPack.defaultTerminologyId;
}
export function terminology() {
  return registry.terminology(selectedTerminologyId());
}
export function toggleTerminology(): string {
  const next = selectedTerminologyId().endsWith("lab-terms")
    ? "threshold-lab:music-terms"
    : "threshold-lab:lab-terms";
  localStorage.setItem(storageKey, next);
  return next;
}

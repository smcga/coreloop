export type OfflineLifecycle =
  | "unsupported"
  | "preparing"
  | "ready"
  | "offline"
  | "update-available"
  | "error";

export interface ServiceWorkerController {
  readonly state: OfflineLifecycle;
  readonly applyUpdate?: () => Promise<void>;
}

/** Registers only production workers, preventing stale workers during Vite development. */
export async function registerProductionServiceWorker(
  production: boolean,
  register: () => Promise<{
    updateServiceWorker(reload?: boolean): Promise<void>;
  }>,
  onState: (controller: ServiceWorkerController) => void,
): Promise<void> {
  if (!production || !("serviceWorker" in navigator)) {
    onState({ state: "unsupported" });
    return;
  }
  onState({ state: navigator.onLine ? "preparing" : "offline" });
  try {
    const registration = await register();
    onState({
      state: "ready",
      applyUpdate: () => registration.updateServiceWorker(true),
    });
  } catch {
    onState({ state: "error" });
  }
}

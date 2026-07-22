/** Identifies the initial, headless Core Loop package boundary. */
export const CORE_LOOP_VERSION = "0.1.0" as const;

export interface FrameworkIdentity {
  readonly name: "Core Loop";
  readonly version: typeof CORE_LOOP_VERSION;
}

export function getFrameworkIdentity(): FrameworkIdentity {
  return { name: "Core Loop", version: CORE_LOOP_VERSION };
}

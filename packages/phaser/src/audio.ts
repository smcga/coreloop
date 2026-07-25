export type AudioActivationState =
  "unavailable" | "locked" | "ready" | "failed";

/** Host-only audio boundary. It never enters serialised or deterministic state. */
export class BrowserAudioActivation {
  private context: AudioContext | null = null;
  state: AudioActivationState =
    typeof AudioContext === "undefined" ? "unavailable" : "locked";

  async activate(): Promise<AudioActivationState> {
    if (this.state === "unavailable") return this.state;
    try {
      this.context ??= new AudioContext();
      await this.context.resume();
      this.state = this.context.state === "running" ? "ready" : "locked";
    } catch {
      this.state = "failed";
    }
    return this.state;
  }
}

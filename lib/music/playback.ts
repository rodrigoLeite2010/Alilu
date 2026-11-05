import type { Playback } from "./types";

export const POLL_MS = 1250;
export const clip = (position: number) => Math.max(0, Math.min(1, position));

export function positionAt(state: Playback, elapsedMs: number) {
  return clip(state.position + (state.playing ? Math.max(0, elapsedMs) * state.speed / (1000 * (state.extent || 1000)) : 0));
}

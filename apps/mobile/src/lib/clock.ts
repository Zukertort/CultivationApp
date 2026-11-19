/**
 * The app's clock: every "now" in the app comes from here, never from
 * Date.now() directly. In a release build it is the device clock. In a
 * development build the dev scenario loader (src/dev) can move it forward
 * (time travel), and only while a scenario database is open; the real log
 * never sees an offset. The rules engine never reads a clock either way:
 * it gets times from events and advanceTo.
 */
let offsetMs = 0;
const listeners = new Set<() => void>();

export function now(): number {
  return Date.now() + offsetMs;
}

/** How far the clock is ahead of the device clock (0 outside dev scenarios). */
export function clockOffset(): number {
  return offsetMs;
}

/** Dev scenarios only; ignored in release builds. */
export function setClockOffset(ms: number): void {
  if (!__DEV__ || ms === offsetMs) return;
  offsetMs = ms;
  for (const l of listeners) l();
}

export function onClockChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

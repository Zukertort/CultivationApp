export const MINUTE = 60_000;
export const DAY = 24 * 60 * MINUTE;
export const WEEK = 7 * DAY;

/** Local calendar day number for the cultivator's timezone. */
export function localDay(at: number, tzOffsetMinutes: number): number {
  return Math.floor((at + tzOffsetMinutes * MINUTE) / DAY);
}

/** The first local midnight strictly after `at` (the end of `at`'s local day). */
export function nextLocalMidnight(at: number, tzOffsetMinutes: number): number {
  return (localDay(at, tzOffsetMinutes) + 1) * DAY - tzOffsetMinutes * MINUTE;
}

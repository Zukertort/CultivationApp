/**
 * Readable text for a database that can't be opened. On the web, expo-sqlite
 * keeps its files in the browser's private file storage, and only one page
 * at a time may hold them: a second tab (or a page still closing) gets an
 * "access handle" error, or SQLite's "unable to open database file" (14).
 */
export const OTHER_TAB_TEXT = "Cultivation is open in another tab. Close that tab, then try again here.";

const HELD = [/createSyncAccessHandle/, /Access Handles cannot be created/, /NoModificationAllowedError/, /unable to open database file/, /Error code 14/];

/** True when the error means the database files are held elsewhere (another tab). */
export function isDatabaseHeld(e: unknown): boolean {
  const text = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
  return HELD.some((r) => r.test(text));
}

export function databaseErrorText(e: unknown): string {
  if (isDatabaseHeld(e)) return OTHER_TAB_TEXT;
  return `The database couldn't be opened: ${e instanceof Error ? e.message : String(e)}`;
}

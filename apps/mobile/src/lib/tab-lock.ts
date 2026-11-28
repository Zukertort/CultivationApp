/**
 * One tab at a time on the web. The browser lets only one page hold the
 * database's files, so the app takes a Web Lock before opening any
 * database; a second tab finds it held and shows a message instead of
 * crashing. The lock is released when the tab closes or reloads. Native
 * apps have one instance and always get it.
 */
import { Platform } from "react-native";

const LOCK = "cultivation-database";

interface LockManagerLike {
  request(name: string, options: { ifAvailable: boolean }, callback: (lock: unknown) => Promise<void>): Promise<void>;
}

/**
 * Resolves true once this tab holds the lock (kept until the page goes), false if another tab holds it. One
 * request per page: kept on globalThis, so a fast refresh (which re-runs effects and may re-run this module)
 * reuses it instead of finding the lock held by this very page.
 */
export function acquireTabLock(): Promise<boolean> {
  const g = globalThis as { __cultivationTabLock?: Promise<boolean> };
  g.__cultivationTabLock ??= requestLock();
  return g.__cultivationTabLock;
}

function requestLock(): Promise<boolean> {
  const locks = Platform.OS === "web" ? (globalThis.navigator as { locks?: LockManagerLike } | undefined)?.locks : undefined;
  if (!locks) return Promise.resolve(true);
  return new Promise((resolve) => {
    void locks.request(LOCK, { ifAvailable: true }, (lock) => {
      if (lock === null) {
        resolve(false);
        return Promise.resolve();
      }
      resolve(true);
      // Held until the page unloads.
      return new Promise<void>(() => {});
    });
  });
}

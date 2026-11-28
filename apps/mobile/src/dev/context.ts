/**
 * DEV ONLY. The dev context shared by the dev root and the dev panel. It
 * lives apart from both so neither imports the other (root renders the
 * panel; the panel reads this context): no require cycle.
 */
import { createContext, useContext } from "react";
import type { LoadResult, Mode } from "./loader";

export interface Dev {
  mode: Mode;
  scenarioId: string | null;
  /** The last load's result, until the next load or mode change. */
  lastLoad: (LoadResult & { id: string }) | null;
  load: (id: string) => void;
  setMode: (m: Mode) => void;
  /** Admin mode: shows controls not meant for normal play (lib/admin). Off by default. */
  admin: boolean;
  setAdmin: (on: boolean) => void;
}

export const DevContext = createContext<Dev | null>(null);

export function useDev(): Dev {
  const d = useContext(DevContext);
  if (!d) throw new Error("useDev must be used inside DevRoot");
  return d;
}

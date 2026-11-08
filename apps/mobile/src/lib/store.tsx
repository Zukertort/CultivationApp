/**
 * App state: the event log plus the cultivator state derived from it. New
 * events are checked by the rules engine before they are written, so the log
 * never holds an event the rules reject.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import * as Crypto from "expo-crypto";
import { useSQLiteContext } from "expo-sqlite";
import { parseEvent, type GameEvent } from "@cultivation/schema";
import { RULES_V1, RuleViolation, advanceTo, applyEvent, initialState, replay, type CultivatorState } from "@cultivation/rules";
import { appendEvent, getUserId, loadEvents } from "./db";

/** An event as the UI builds it: the store adds id, userId and timestamp. */
export type EventInput = GameEvent extends infer E ? (E extends GameEvent ? Omit<E, "id" | "userId" | "at"> : never) : never;

export type LogResult = { ok: true; before: CultivatorState; after: CultivatorState } | { ok: false; message: string };

interface Store {
  ready: boolean;
  /** State advanced to `now` (food decay, demon growth, midnight evaluations). */
  state: CultivatorState;
  now: number;
  events: readonly GameEvent[];
  log: (input: EventInput) => Promise<LogResult>;
}

const StoreContext = createContext<Store | null>(null);

const TICK_MS = 60_000;

export function StoreProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const [ready, setReady] = useState(false);
  const [userId, setUserId] = useState("");
  const [events, setEvents] = useState<GameEvent[]>([]);
  /** State as of the last event. */
  const [base, setBase] = useState<CultivatorState>(() => initialState(RULES_V1));
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [id, log] = await Promise.all([getUserId(db), loadEvents(db)]);
      if (cancelled) return;
      setUserId(id);
      setEvents(log);
      setBase(replay(log, RULES_V1));
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [db]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(t);
  }, []);

  const state = useMemo(() => (base.created ? advanceTo(base, Math.max(now, base.clock), RULES_V1) : base), [base, now]);

  const log = useCallback(
    async (input: EventInput): Promise<LogResult> => {
      // Events must not go back in time; a clock that moved backwards logs at the last event's time.
      const at = Math.max(Date.now(), base.clock);
      try {
        const event = parseEvent({ ...input, id: Crypto.randomUUID(), userId, at });
        const before = advanceTo(base, at, RULES_V1);
        const after = applyEvent(base, event, RULES_V1);
        await appendEvent(db, event);
        setEvents((prev) => [...prev, event]);
        setBase(after);
        setNow(Date.now());
        return { ok: true, before, after };
      } catch (e) {
        if (e instanceof RuleViolation) return { ok: false, message: e.message };
        // Schema errors (e.g. an empty name) and storage errors surface the same way.
        return { ok: false, message: e instanceof Error ? e.message : String(e) };
      }
    },
    [base, db, userId],
  );

  const value = useMemo(() => ({ ready, state, now, events, log }), [ready, state, now, events, log]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const s = useContext(StoreContext);
  if (!s) throw new Error("useStore must be used inside StoreProvider");
  return s;
}

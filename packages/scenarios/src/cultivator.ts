/**
 * A synthetic cultivator: applies events through the real rules engine and
 * keeps the log of every event the engine accepted, in order. The simulator
 * uses it to measure the economy; the app's dev scenario loader replays its
 * log into a scenario database. Both get the same events from the same habits.
 *
 * Pure: no clock, no I/O. Time comes from `start` (a local midnight), and
 * random outcomes come from a seeded PRNG standing in for the server's
 * secure RNG, so a run is reproducible.
 */
import type { GameEvent, GearSlot } from "@cultivation/schema";
import {
  DAY,
  RULES_V1,
  type RulesConfig,
  RuleViolation,
  advanceTo,
  applyEvent,
  breakthroughRollOutcome,
  breakthroughRollSlot,
  classDropRoll,
  initialState,
  pendingBreakthroughRolls,
  pendingClassDrops,
  pendingQuestRolls,
  pendingSoulRolls,
  pendingTribulationRolls,
  questDropOutcome,
  soulDropOutcome,
  soulDropSlot,
  tribulationDropOutcome,
  type CultivatorState,
} from "@cultivation/rules";

/** Monday 2026-11-02 00:00 in Buenos Aires: the simulator's day 0. */
export const T0 = Date.UTC(2026, 10, 2, 3);
export const HOUR = 60 * 60 * 1000;

/** Seeded PRNG (mulberry32). */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface CultivatorOptions {
  /** Day 0's local midnight (epoch ms). */
  start?: number;
  userId?: string;
  /** Prefix for event ids. */
  idPrefix?: string;
  seed?: number;
  /**
   * Roll every pending outcome after each event, as the server will (soul,
   * quest, tribulation, class and breakthrough rolls). Off, only tribulation
   * and breakthrough rolls are made: the realm simulator's economy.
   */
  rollAll?: boolean;
  /** Sum the gold each event earns into `goldEarned` (an extra state copy per event; the gear report uses it). */
  trackGold?: boolean;
  /** The rules to run under (default RULES_V1); the simulator's sweeps pass variants. */
  rules?: RulesConfig;
}

export class Cultivator {
  readonly rules: RulesConfig;
  s: CultivatorState;
  /** Every accepted event, in the order applied (the order to replay them in). */
  readonly log: GameEvent[] = [];
  readonly start: number;
  private readonly userId: string;
  private readonly idPrefix: string;
  private readonly rollAll: boolean;
  private readonly roll: () => number;
  private queue: GameEvent[] = [];
  private seq = 0;
  waitingDays = 0;
  /** Sum of every legendary roll's chance: the expected legendary items, free of seed luck. */
  expectedLegendary = 0;
  /** Gold earned by events (with `trackGold`): each event's gain over the state advanced to its time. */
  goldEarned = 0;
  private readonly trackGold: boolean;

  constructor(o: CultivatorOptions = {}) {
    this.rules = o.rules ?? RULES_V1;
    this.s = initialState(this.rules);
    this.start = o.start ?? T0;
    this.userId = o.userId ?? "sim";
    this.idPrefix = o.idPrefix ?? "realm";
    this.rollAll = o.rollAll ?? false;
    this.trackGold = o.trackGold ?? false;
    this.roll = rng(o.seed ?? 23);
  }

  at(day: number, hour: number): number {
    return this.start + day * DAY + hour * HOUR;
  }
  /** The simulator day containing `at`. */
  dayOf(at: number): number {
    return Math.floor((at - this.start) / DAY);
  }
  private event(type: GameEvent["type"], at: number, rest: object): GameEvent {
    return { id: `${this.idPrefix}${++this.seq}`, userId: this.userId, at, type, ...rest } as GameEvent;
  }
  /** Queue a routine event; the day's routine is applied in time order by flush(). */
  ev(type: GameEvent["type"], at: number, rest: object): void {
    this.queue.push(this.event(type, at, rest));
  }
  flush(): void {
    const events = this.queue.sort((a, b) => a.at - b.at);
    this.queue = [];
    for (const e of events) this.apply(e);
  }
  /** Apply at once, then roll whatever the event earned; false if the rules reject it. */
  now(type: GameEvent["type"], at: number, rest: object): boolean {
    try {
      this.apply(this.event(type, at, rest));
      return true;
    } catch (e) {
      if (!(e instanceof RuleViolation)) throw e;
      return false;
    }
  }
  private apply(e: GameEvent): void {
    this.applyTracked(e);
    this.log.push(e);
    // In the order the server (and the app's temporary roller) appends them.
    if (this.rollAll) {
      for (const p of pendingSoulRolls(this.s.soul)) {
        const us = Array.from({ length: p.count }, () => this.roll());
        const drops = us.map((u) => soulDropOutcome(p.color, p.polarity, u, this.rules));
        const slots = us.map((u) => soulDropSlot(p.color, p.polarity, u, this.rules)).filter((x): x is GearSlot => x !== undefined);
        this.record(this.event("SoulDropRolled", this.s.clock, { eventId: p.eventId, drops, ...(slots.length > 0 ? { legendarySlots: slots } : {}) }));
      }
      for (const p of pendingQuestRolls(this.s)) this.record(this.event("MainQuestDropRolled", this.s.clock, { eventId: p.eventId, drop: questDropOutcome(p.chance, this.roll(), this.rules) }));
    }
    for (const p of pendingTribulationRolls(this.s)) {
      this.record(this.event("TribulationDropRolled", this.s.clock, { eventId: p.eventId, drop: tribulationDropOutcome(this.roll()) }));
    }
    if (this.rollAll) {
      for (const p of pendingClassDrops(this.s)) this.record(this.event("ClassDropRolled", this.s.clock, { eventId: p.eventId, ...classDropRoll(p.group, p.chance, this.roll(), this.rules) }));
    }
    for (const p of pendingBreakthroughRolls(this.s)) {
      this.expectedLegendary += p.chance;
      const u = this.roll();
      const slot = breakthroughRollSlot(p.chance, u);
      this.record(this.event("BreakthroughRolled", this.s.clock, { step: p.step, item: breakthroughRollOutcome(p.chance, u), ...(slot ? { slot } : {}) }));
    }
  }
  private applyTracked(e: GameEvent): void {
    const before = this.trackGold && this.s.created ? advanceTo(this.s, e.at, this.rules).gold : null;
    this.s = applyEvent(this.s, e, this.rules);
    if (before !== null) this.goldEarned += Math.max(0, this.s.gold - before);
  }
  /** Apply a roll event (rolls earn nothing new). */
  private record(e: GameEvent): void {
    this.applyTracked(e);
    this.log.push(e);
  }
}

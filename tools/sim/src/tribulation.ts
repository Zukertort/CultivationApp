/**
 * Tribulation simulator (Main part 2): what failures, edits and deletions
 * cost against a month of Main income, how many item rolls passing earns,
 * and how far closed-door rest can push a deadline.
 *
 * Every persona answers the interview, studies one mid task a day (a new
 * linked version every 4 weeks), and trains Body and Soul twice a week, so
 * only the tribulation habits differ. Claims are logged offline; the server
 * rolls their items on sync.
 *
 * Tribulations exist from Foundation on (ruling 89), and Foundation allows
 * only three, so every persona starts in early Core Formation (by override)
 * with one long-term tribulation due after the year: the set never reaches
 * 100%, so the persona stays in Core Formation and the losses are measured
 * against its thresholds (550 for each level, 700 for the breakthrough).
 * The realm simulator covers progression.
 *
 * Output: a summary on stdout and a CSV row per persona in tools/sim/out/.
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { OATH_TEXT, TRIBULATION_OATH, type GameEvent } from "@cultivation/schema";
import {
  DAY,
  RULES_V1,
  RuleViolation,
  applyEvent,
  initialState,
  pendingTribulationRolls,
  tribulationDropOutcome,
  tribulationStatus,
  type CultivatorState,
} from "@cultivation/rules";

const T0 = Date.UTC(2026, 10, 2, 3); // Monday 00:00 in Buenos Aires
const HOUR = 60 * 60 * 1000;
const WEEKS = 52;
const MONTHS = WEEKS / (52 / 12);

/** Seeded PRNG (mulberry32) standing in for the server's secure RNG, so runs are reproducible. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let seq = 0;

class Cultivator {
  s: CultivatorState = initialState(RULES_V1);
  private roll = rng(11);
  rejected = 0;
  maxDelayDays = 0;

  at(day: number, hour: number): number {
    return T0 + day * DAY + hour * HOUR;
  }
  event(type: GameEvent["type"], at: number, rest: object): GameEvent {
    return { id: `trib${++seq}`, userId: "sim", at, type, ...rest } as GameEvent;
  }
  apply(type: GameEvent["type"], at: number, rest: object): void {
    this.s = applyEvent(this.s, this.event(type, at, rest), RULES_V1);
    for (const p of pendingTribulationRolls(this.s)) {
      const drop = tribulationDropOutcome(this.roll());
      this.s = applyEvent(this.s, this.event("TribulationDropRolled", this.s.clock, { eventId: p.eventId, drop }), RULES_V1);
    }
  }
  /** Apply if the rules allow it; a rejection (e.g. too little Qi to delete) is counted, not thrown. */
  try(type: GameEvent["type"], at: number, rest: object): boolean {
    const ok = this.attempt(type, at, rest);
    if (!ok) this.rejected += 1;
    return ok;
  }
  /** Apply if the rules allow it, without counting a rejection (for probing a limit). */
  attempt(type: GameEvent["type"], at: number, rest: object): boolean {
    try {
      this.apply(type, at, rest);
      return true;
    } catch (e) {
      if (!(e instanceof RuleViolation)) throw e;
      return false;
    }
  }
  declare(id: string, day: number, days: number): void {
    const at = this.at(day, 22);
    this.apply("TribulationDeclared", at, { tribulationId: id, title: id, criteria: `Pass ${id}`, deadline: at + days * DAY });
  }
  claim(id: string, day: number): void {
    this.apply("TribulationClaimed", this.at(day, 22), { tribulationId: id, oath: TRIBULATION_OATH, llmReview: "skipped" });
  }
}

interface Persona {
  label: string;
  /** Tribulation habits for one day, applied at 22:00 after the day's routine. */
  plan: (c: Cultivator, day: number) => void;
}

/**
 * One open tribulation at a time, pushed back with as much closed-door rest
 * as the quota allows (the longest rest the engine accepts), and claimed at
 * the last moment once no more rest is allowed.
 */
function makeDelayer(): Persona["plan"] {
  const original = new Map<string, number>();
  return (c, day) => {
    const open = Object.entries(c.s.tribulations.items).find(([id]) => id !== LONG_TERM && tribulationStatus(c.s, id) === "open");
    const at = c.at(day, 22);
    if (!open) {
      c.declare(`d${day}`, day, 28);
      original.set(`d${day}`, at + 28 * DAY);
      return;
    }
    const [id, t] = open;
    // Rest must start before the deadline: one started at the deadline itself no longer moves it.
    const resting = c.s.rest !== null && c.s.rest.end > at; // a rest ending now is over, though the state only clears it when time moves on
    if (resting || !t.due || t.due.deadline - at > 2 * DAY) return;
    for (let k = 14; k >= 1; k--) {
      if (c.attempt("RestStarted", at, { kind: "closed_door", until: at + k * DAY })) return;
    }
    c.maxDelayDays = Math.max(c.maxDelayDays, (t.due.deadline - original.get(id)!) / DAY);
    c.claim(id, day);
  };
}

/** The long-term Core Formation tribulation every persona keeps open all year. */
const LONG_TERM = "long-term";

const PERSONAS: Persona[] = [
  {
    label: "honest: a 4-week tribulation, passed in week 3",
    plan: (c, d) => {
      if (d % 28 === 0) c.declare(`t${d}`, d, 28);
      if (d % 28 === 20) c.claim(`t${d - 20}`, d);
    },
  },
  {
    label: "misser: fails each one, reschedules 12 days, passes",
    plan: (c, d) => {
      const n = d - (d % 42);
      if (d % 42 === 0) c.declare(`t${n}`, d, 28);
      if (d % 42 === 29) c.apply("TribulationRescheduled", c.at(d, 22), { tribulationId: `t${n}`, deadline: c.at(d, 22) + 12 * DAY });
      if (d % 42 === 40) c.claim(`t${n}`, d);
    },
  },
  {
    label: "editor: edits on days 7 and 14, and once in the last quarter",
    plan: (c, d) => {
      const n = d - (d % 28);
      if (d % 28 === 0) c.declare(`t${n}`, d, 28);
      if ([7, 14, 23].includes(d % 28)) c.try("TribulationEdited", c.at(d, 22), { tribulationId: `t${n}`, criteria: `Pass t${n}, version ${d % 28}` });
      if (d % 28 === 26) c.claim(`t${n}`, d);
    },
  },
  {
    label: "deleter: deletes each one halfway",
    plan: (c, d) => {
      const n = d - (d % 28);
      if (d % 28 === 0) c.declare(`t${n}`, d, 28);
      if (d % 28 === 14) c.try("TribulationDeleted", c.at(d, 22), { tribulationId: `t${n}` });
    },
  },
  { label: "delayer: closed-door rest before every deadline", plan: makeDelayer() },
  {
    label: "farmer: a 24-hour tribulation every day",
    plan: (c, d) => {
      if (d > 0) c.claim(`f${d - 1}`, d);
      c.declare(`f${d}`, d, 1);
    },
  },
];

function simulate(p: Persona): Cultivator {
  const c = new Cultivator();
  c.apply("CultivatorCreated", T0, { name: "sim", tzOffsetMinutes: -180, oath: OATH_TEXT });
  c.apply("InterviewAnswered", T0, { interests: { main: "Mathematics", body: "Gym", soul: "Calm" } });
  c.apply("BodyActivityDefined", T0, { activityId: "gym-1", name: "Gym v1", kind: "routine" });
  c.apply("HeartDemonCreated", T0, { demonId: "d", name: "Impatience", positiveTasks: [{ taskId: "breathe", name: "Breathe" }], negativeTasks: [] });
  for (let i = 1; i <= 8; i++) c.apply("RealmOverride", T0 + i, {});
  c.apply("TribulationDeclared", T0 + HOUR, { tribulationId: LONG_TERM, title: "Long-term goal", criteria: "Due after the simulated year", deadline: T0 + 365 * DAY });
  const v = (day: number) => Math.floor(day / 28) + 1;
  for (let day = 0; day < WEEKS * 7; day++) {
    // The routine: a daily mid study (a new linked version every 4 weeks), Body and Soul twice a week.
    if (day % 28 === 0) {
      const replaces = day === 0 ? {} : { replaces: `study-${v(day) - 1}` };
      c.apply("MainTaskDefined", c.at(day, 7), {
        taskId: `study-${v(day)}`,
        name: `Study v${v(day)}`,
        difficulty: "mid",
        effort: "session",
        schedule: { kind: "recurring", count: 1, per: "day" },
        ...replaces,
      });
      if (day > 0) c.apply("BodyActivityDefined", c.at(day, 7), { activityId: `gym-${v(day)}`, name: `Gym v${v(day)}`, kind: "routine" });
    }
    c.apply("MainTaskCompleted", c.at(day, 19), { taskId: `study-${v(day)}` });
    if (day % 7 === 1 || day % 7 === 4) c.apply("BodyActivityLogged", c.at(day, 20), { activityId: `gym-${v(day)}` });
    if (day % 7 === 2 || day % 7 === 6) c.apply("SoulTaskLogged", c.at(day, 21), { taskId: "breathe" });
    p.plan(c, day);
  }
  return c;
}

export function runTribulationScenarios(outDir: string): void {
  const n = (x: number, d = 0) => x.toFixed(d);
  const header = [
    "persona",
    "Main Qi/mo",
    "passed",
    "end",
    "failed",
    "Qi lost to failures",
    "gold lost to failures",
    "edits",
    "edit Qi",
    "edit gold",
    "deletions",
    "delete Qi",
    "delete gold",
    "rejected",
    "cost Qi/mo as % of Main Qi",
    "item rolls",
    "potions",
    "max closed-door delay (days)",
  ];
  const rows: string[][] = [];
  for (const p of PERSONAS) {
    const c = simulate(p);
    const t = c.s.tribulations;
    const items = Object.values(t.items);
    const sp = t.spent;
    const costQi = sp.failures.qi + sp.edits.qi + sp.deletions.qi;
    const mainQi = c.s.main.earned.qi;
    rows.push([
      p.label,
      n(mainQi / MONTHS),
      String(items.filter((i) => i.status === "passed").length),
      `${c.s.main.realm.replace("_", " ")} ${c.s.progress.level ?? ""}`.trim(),
      String(sp.failures.count),
      n(sp.failures.qi),
      n(sp.failures.gold),
      String(sp.edits.count),
      n(sp.edits.qi),
      n(sp.edits.gold),
      String(sp.deletions.count),
      n(sp.deletions.qi, 1),
      n(sp.deletions.gold, 1),
      String(c.rejected),
      `${n((100 * costQi) / mainQi, 1)}%`,
      String(t.drops.none + t.drops.gain_potion + t.drops.legendary_potion),
      String(t.drops.gain_potion + t.drops.legendary_potion),
      n(c.maxDelayDays, 1),
    ]);
  }
  console.log(`\nTribulations: costs, item rolls and closed-door delay (${WEEKS} weeks; per month = /${n(MONTHS, 1)})\n`);
  console.log(header.join("\t"));
  for (const r of rows) console.log(r.join("\t"));
  writeFileSync(join(outDir, "tribulations.csv"), [header.join(","), ...rows.map((r) => r.map((x) => `"${x}"`).join(","))].join("\n"));
}

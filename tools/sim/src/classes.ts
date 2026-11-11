/**
 * Class simulator (Main part 4): a year of income by class, what cross-path
 * tags add, how many class drops a year brings, and what class hopping costs
 * (rulings 113-125).
 *
 * Every persona starts in early Core Formation (by override) and picks its
 * class with the override out of Foundation (a class is mandatory to enter
 * Core Formation). Its routine: one mid Main session a day (a new linked
 * version every 4 weeks), a gym routine twice a week, a soul practice twice a
 * week, and a 4-week tribulation each month, passed in week 3. Wearables are
 * worn as soon as they're held: a soul wearable on the demon, a pet wearable
 * of either kind. A long-term tribulation due after the year keeps every
 * persona in Core Formation. Physical-practice personas have a Body
 * discipline as their core (BJJ) and tag the daily session to Body;
 * soul-practice personas journal or meditate as their core and tag it to the
 * demon.
 *
 * Gains are measured event by event (time advanced first, so tax and decay
 * aren't counted; Qi spent on level-ups is added back).
 *
 * Output: a summary on stdout and a CSV row per persona in tools/sim/out/.
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { OATH_TEXT, TRIBULATION_OATH, type ClassId, type GameEvent } from "@cultivation/schema";
import {
  DAY,
  RULES_V1,
  RuleViolation,
  advanceTo,
  applyEvent,
  breakthroughRollOutcome,
  classDropOutcome,
  initialState,
  pendingBreakthroughRolls,
  pendingClassDrops,
  pendingSoulRolls,
  pendingTribulationRolls,
  soulDropOutcome,
  tribulationDropOutcome,
  type CultivatorState,
} from "@cultivation/rules";

const T0 = Date.UTC(2026, 10, 2, 3); // Monday 00:00 in Buenos Aires
const HOUR = 60 * 60 * 1000;
const DAYS = 364;
const MONTHS = 12;

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
const stepsQi = (s: CultivatorState) => s.progress.steps.reduce((sum, x) => sum + x.qiSpent, 0);
const changeGold = (s: CultivatorState) => s.class.history.reduce((sum, x) => sum + x.gold, 0);

class Cultivator {
  s: CultivatorState = initialState(RULES_V1);
  private roll = rng(31);
  gained = { qi: 0, gold: 0 };
  /** Sum of every class drop's chance: the expected drops, free of seed luck. */
  expectedDrops = 0;

  at(day: number, hour: number): number {
    return T0 + day * DAY + hour * HOUR;
  }
  private event(type: GameEvent["type"], at: number, rest: object): GameEvent {
    return { id: `cls${++seq}`, userId: "sim", at, type, ...rest } as GameEvent;
  }
  /** Apply if the rules allow it, then let the server roll whatever it earned. */
  now(type: GameEvent["type"], at: number, rest: object): boolean {
    try {
      this.step(this.event(type, at, rest));
    } catch (e) {
      if (!(e instanceof RuleViolation)) throw e;
      return false;
    }
    for (const p of pendingTribulationRolls(this.s)) this.step(this.event("TribulationDropRolled", this.s.clock, { eventId: p.eventId, drop: tribulationDropOutcome(this.roll()) }));
    for (const p of pendingClassDrops(this.s)) {
      this.expectedDrops += p.chance;
      this.step(this.event("ClassDropRolled", this.s.clock, { eventId: p.eventId, drop: classDropOutcome(p.group, p.chance, this.roll()) }));
    }
    for (const p of pendingBreakthroughRolls(this.s)) this.step(this.event("BreakthroughRolled", this.s.clock, { step: p.step, item: breakthroughRollOutcome(p.chance, this.roll()) }));
    for (const p of pendingSoulRolls(this.s.soul)) {
      const drops = Array.from({ length: p.count }, () => soulDropOutcome(p.color, p.polarity, this.roll(), RULES_V1));
      this.step(this.event("SoulDropRolled", this.s.clock, { eventId: p.eventId, drops }));
    }
    return true;
  }
  /** One event, its gains measured apart from the time before it. */
  private step(e: GameEvent): void {
    const before = advanceTo(this.s, e.at, RULES_V1);
    const after = applyEvent(before, e, RULES_V1);
    this.gained.qi += after.qi - before.qi + stepsQi(after) - stepsQi(before);
    this.gained.gold += after.gold - before.gold + changeGold(after) - changeGold(before);
    this.s = after;
  }
}

interface Persona {
  label: string;
  cls: ClassId;
  /** The daily Main session is a physical practice tagged to Body, or a soul practice tagged to the demon. */
  practice?: "physical" | "soul";
  /** Change class on the first of every month, cycling through these. */
  hop?: ClassId[];
}

function simulate(p: Persona) {
  const c = new Cultivator();
  c.now("CultivatorCreated", T0, { name: "sim", tzOffsetMinutes: -180, oath: OATH_TEXT });
  const main = p.practice === "physical" ? "BJJ" : p.practice === "soul" ? "Journaling" : "Mathematics";
  c.now("InterviewAnswered", T0, { interests: { main, body: "Gym", soul: "Calm" } });
  c.now("BodyActivityDefined", T0, { activityId: "gym", name: "Gym", kind: "routine" });
  c.now("HeartDemonCreated", T0, { demonId: "d", name: "Impatience", positiveTasks: [{ taskId: "breathe", name: "Breathe" }], negativeTasks: [] });
  for (let i = 1; i <= 8; i++) c.now("RealmOverride", T0 + i, { class: p.cls });
  // A long-term tribulation due after the year keeps the set below 100%, so the persona stays in Core Formation.
  c.now("TribulationDeclared", T0 + HOUR, { tribulationId: "long-term", title: "Long-term goal", criteria: "Due after the year", deadline: T0 + 365 * DAY });
  const changes = { tried: 0, done: 0 };
  const cross = { routines: 0, soulHits: 0 };

  for (let day = 0; day < DAYS; day++) {
    if (p.hop && day > 0 && day % 28 === 0) {
      changes.tried += 1;
      if (c.now("ClassChosen", c.at(day, 6), { class: p.hop[(day / 28) % p.hop.length]! })) changes.done += 1;
    }
    // The daily Main session, a new linked version every 4 weeks.
    const v = Math.floor(day / 28) + 1;
    if (day % 28 === 0) {
      const tags = p.practice === "physical" ? { alsoBody: true } : p.practice === "soul" ? { alsoSoulDemonId: "d" } : {};
      c.now("MainTaskDefined", c.at(day, 7), {
        taskId: `s${v}`,
        name: `${main} v${v}`,
        difficulty: "mid",
        effort: "session",
        schedule: { kind: "recurring", count: 1, per: "day" },
        ...(v > 1 ? { replaces: `s${v - 1}` } : {}),
        ...tags,
      });
    }
    const before = c.s.companion;
    const completedAt = c.at(day, 19);
    c.now("MainTaskCompleted", completedAt, { taskId: `s${v}` });
    const after = c.s.companion;
    // The daily counter resets lazily, so compare against the day the completion counted on.
    if (after.routinesToday > (after.routineDay === before.routineDay ? before.routinesToday : 0)) cross.routines += 1;
    if (p.practice === "soul" && c.s.main.paths.soul.lastActivityAt === completedAt) cross.soulHits += 1;
    if (day % 7 === 1 || day % 7 === 4) c.now("BodyActivityLogged", c.at(day, 20), { activityId: "gym" });
    if (day % 7 === 2 || day % 7 === 6) c.now("SoulTaskLogged", c.at(day, 21), { taskId: "breathe" });
    // A 4-week tribulation each month, passed in week 3.
    if (day % 28 === 0) c.now("TribulationDeclared", c.at(day, 22), { tribulationId: `t${day}`, title: `t${day}`, criteria: "Pass", deadline: c.at(day, 22) + 28 * DAY });
    if (day % 28 === 20) c.now("TribulationClaimed", c.at(day, 22), { tribulationId: `t${day - 20}`, oath: TRIBULATION_OATH, llmReview: "skipped" });
    // Wear what is held.
    const inv = c.s.inventory;
    const at = c.at(day, 23);
    if (inv.soulWearables > 0) c.now("WearableUsed", at, { wearable: "soul", demonId: "d" });
    if (inv.petHaloWearables > 0) c.now("WearableUsed", at, { wearable: "pet_halo" });
    if (inv.petKeepWearables > 0) c.now("WearableUsed", at, { wearable: "pet_keep" });
  }
  const s = c.s;
  const drops = s.class.drops;
  return {
    label: p.label,
    qi: c.gained.qi / MONTHS,
    gold: c.gained.gold / MONTHS,
    routines: cross.routines,
    soulHits: cross.soulHits,
    drops: drops.soul_wearable + drops.pet_keep + drops.pet_halo + drops.legendary,
    expected: c.expectedDrops,
    worn: s.class.worn.soul + s.class.worn.pet_keep + s.class.worn.pet_halo,
    forfeited: s.class.history.reduce((sum, x) => sum + x.forfeited, 0),
    changeGold: changeGold(s),
    changes: p.hop ? `${changes.done}/${changes.tried}` : "-",
    tier: s.companion.tier,
  };
}

const ALL: ClassId[] = ["bard", "erudite", "warrior", "knight", "dancer", "acrobat", "monk", "sorcerer"];
const PHYSICAL: ClassId[] = ["warrior", "knight", "dancer", "acrobat"];
const SOUL: ClassId[] = ["bard", "erudite", "dancer", "acrobat"];

const PERSONAS: Persona[] = [
  ...ALL.map((cls): Persona => ({ label: `studier: ${cls}`, cls })),
  ...PHYSICAL.map((cls): Persona => ({ label: `physical practice (BJJ), tags Body: ${cls}`, cls, practice: "physical" })),
  ...SOUL.map((cls): Persona => ({ label: `soul practice (journaling), tags the demon: ${cls}`, cls, practice: "soul" })),
  { label: "class hopper: studier, changes every 4 weeks", cls: "warrior", hop: ["monk", "warrior", "bard", "acrobat"] },
];

export function runClassScenarios(outDir: string): void {
  const header = [
    "persona",
    "Qi/mo",
    "gold/mo",
    "cross-path routines paid",
    "cross-path demon hits",
    "class drops/yr",
    "expected class drops/yr",
    "wearables worn",
    "forfeited",
    "change gold",
    "changes",
    "tier at end",
  ];
  const rows = PERSONAS.map((p) => {
    const r = simulate(p);
    return [
      r.label,
      r.qi.toFixed(0),
      r.gold.toFixed(0),
      String(r.routines),
      String(r.soulHits),
      String(r.drops),
      r.expected.toFixed(1),
      String(r.worn),
      String(r.forfeited),
      String(r.changeGold),
      r.changes,
      r.tier,
    ];
  });
  console.log(`\nClasses: income, cross-path rewards, class drops and changes over ${DAYS / 7} weeks in Core Formation\n`);
  console.log(header.join("\t"));
  for (const r of rows) console.log(r.join("\t"));
  writeFileSync(join(outDir, "classes.csv"), [header.join(","), ...rows.map((r) => r.map((x) => `"${x}"`).join(","))].join("\n"));
}

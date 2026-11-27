/**
 * Dev-only scenarios: cultivators built by running simulator personas
 * through the real rules engine, ending just before "now". The app's dev
 * build replays a scenario's log into its own scenario database; nothing
 * here is a cheat event, and the rules engine knows nothing about it.
 *
 * Each scenario runs day by day from a local midnight `days` days before
 * today. A scenario with a `stop` condition (e.g. "just entered Spirit
 * Realm") is rebuilt until the condition is met within the last few days
 * before today: the engine's calendar weeks and months depend on the start
 * date, so the day it's reached can move by a few days with the start.
 */
import { OATH_TEXT, type ClassId, type GameEvent, CLOSED_DOOR_OATH } from "@cultivation/schema";
import {
  DAY,
  RULES_V1,
  advanceTo,
  armorAtRisk,
  bestStashArmor,
  deviationStatus,
  shopPrice,
  stash,
  wornItem,
  effectiveDeadline,
  localDay,
  realmStatus,
  tribulationStatus,
  type CultivatorState,
  type Level,
  type Realm,
} from "@cultivation/rules";
import { Cultivator } from "./cultivator.js";
import { both, routineDay, setupBasic, study, tribulationPlan, weeklyMilestones, weeklyProject, type Habits, type Income, type Routine } from "./habits.js";

export interface ScenarioContext {
  /** Today's local midnight (epoch ms); the scenario's last day is the day before. */
  today: number;
  tzOffsetMinutes: number;
  /** The device's user id: every event carries it. */
  userId: string;
}

export interface Scenario {
  id: string;
  title: string;
  /** What the scenario is for, shown in the dev panel. */
  description: string;
  /** Rough cost to build, for the dev panel ("~2 s" on a phone is fine). */
  heavy?: boolean;
  build(ctx: ScenarioContext): GameEvent[];
  /** What isn't as the scenario says, in `state` advanced to `now`; empty when it holds. */
  check(state: CultivatorState, now: number): string[];
}

// ---- Building ---------------------------------------------------------------

type Day = (c: Cultivator, day: number, days: number) => void;

interface Spec {
  id: string;
  /** Days covered; with `stop`, the first guess. */
  days: number;
  seed?: number;
  setup?: (c: Cultivator, ctx: ScenarioContext) => void;
  /** Makes one run's day function (fresh habit state per run); `days` is the run's length, so day `days` is today. */
  day: () => Day;
  /** Ends the run once true (checked after each day). */
  stop?: (c: Cultivator, day: number) => boolean;
}

/** Days a stop scenario may end before today; more and food decay, demon growth and tax start to show. */
const MAX_IDLE_DAYS = 2;

function runOnce(ctx: ScenarioContext, spec: Spec, days: number): { c: Cultivator; reached: number | null } {
  const c = new Cultivator({ start: ctx.today - days * DAY, userId: ctx.userId, idPrefix: `scn-${spec.id}-`, seed: spec.seed ?? 23, rollAll: true });
  (spec.setup ?? basic)(c, ctx);
  const day = spec.day();
  for (let d = 0; d < days; d++) {
    day(c, d, days);
    if (spec.stop?.(c, d)) return { c, reached: d };
  }
  return { c, reached: null };
}

function generate(ctx: ScenarioContext, spec: Spec): GameEvent[] {
  if (!spec.stop) return runOnce(ctx, spec, spec.days).c.log;
  let days = spec.days;
  let best: { c: Cultivator; reached: number } | null = null;
  for (let attempt = 0; attempt < 8; attempt++) {
    const r = runOnce(ctx, spec, days);
    if (r.reached === null) {
      days = Math.ceil(days * 1.25) + 7;
      continue;
    }
    const idle = days - 1 - r.reached;
    if (idle <= MAX_IDLE_DAYS) return r.c.log;
    if (best === null || idle < days - 1 - best.reached) best = { c: r.c, reached: r.reached };
    days = r.reached + 1;
  }
  if (best) return best.c.log;
  throw new Error(`scenario ${spec.id} never reached its stop condition`);
}

const basic = (c: Cultivator, ctx: ScenarioContext) => setupBasic(c, { name: "Test cultivator", tzOffsetMinutes: ctx.tzOffsetMinutes });

/** A persona from the realm simulator: its routine plus its tribulation plan. */
function persona(routine: Routine, habits: Habits): Spec["day"] {
  return () => {
    const plan = tribulationPlan(habits);
    return (c, day) => {
      routineDay(c, routine, day);
      plan(c, day);
    };
  };
}

/** The plan's first week without its tribulations: areas on days 1, 3 and 6, then the lock (ruling 133). */
function areasThenLock(c: Cultivator, day: number): void {
  const at = c.at(day, 22);
  const path = ({ 1: "main", 3: "body", 6: "soul" } as Record<number, "main" | "body" | "soul">)[day];
  if (path) c.now("AreaDecided", at, { path, choice: `${path} discipline` });
  if (c.s.main.realm === "qi_condensation" && Object.values(c.s.progress.areas).every((a) => a !== null)) c.now("AreasLocked", at, {});
}

const status = (c: Cultivator) => realmStatus(c.s);
const heldWearables = (s: CultivatorState) => {
  const d = s.class.drops;
  const w = s.class.worn;
  return d.soul_wearable + d.pet_keep + d.pet_halo - (w.soul + w.pet_keep + w.pet_halo);
};
const repents = (s: CultivatorState) => Object.values(s.progress.repents).reduce((a, b) => a + b, 0);
const openTribulations = (s: CultivatorState) =>
  Object.entries(s.tribulations.items).filter(([id, t]) => tribulationStatus(s, id) === "open" && t.closedAt === null && t.realm === s.main.realm);

function scenario(spec: Spec & Omit<Scenario, "build" | "check" | "id">, check: (s: CultivatorState, now: number) => (string | boolean)[]): Scenario {
  return {
    id: spec.id,
    title: spec.title,
    description: spec.description,
    ...(spec.heavy ? { heavy: true } : {}),
    build: (ctx) => generate(ctx, spec),
    check: (s, now) => check(s, now).filter((x): x is string => typeof x === "string"),
  };
}

// ---- Checks -----------------------------------------------------------------

const alive = (s: CultivatorState) => s.progress.diedAt === null || "the avatar is dead";
const inRealm = (s: CultivatorState, realm: Realm, level?: Level | null) =>
  (s.main.realm === realm && (level === undefined || s.progress.level === level)) || `in ${s.main.realm} ${s.progress.level ?? ""}, expected ${realm} ${level ?? ""}`;

/** Every Step 1 milestone, in order, as "kind realm level". */
const FULL_CLIMB = [
  "level qi_condensation mid",
  "level qi_condensation late",
  "level qi_condensation great_circle",
  "breakthrough foundation_establishment early",
  "level foundation_establishment mid",
  "level foundation_establishment late",
  "level foundation_establishment great_circle",
  "breakthrough core_formation early",
  "level core_formation mid",
  "level core_formation late",
  "level core_formation great_circle",
  "breakthrough nascent_soul null",
  "breakthrough spirit_realm null",
];

/** After the persona's day: in Core Formation, buy the realm's shop weapon and armor once the gold allows, and wear them. */
function gearUp(c: Cultivator, day: number): void {
  if (c.s.main.realm !== "core_formation") return;
  const at = c.at(day, 23);
  const realm = "core_formation" as const;
  const weapon = wornItem(c.s, "weapon");
  if (!(weapon?.kind === "shop" && weapon.realm === realm) && c.s.gold >= shopPrice("weapon", realm)) c.now("GearBought", at, { slot: "weapon" });
  const armor = wornItem(c.s, "armor");
  if (!(armor?.kind === "shop" && armor.realm === realm) && c.s.gold >= shopPrice("armor", realm)) {
    c.now("GearBought", at, { slot: "armor" });
    // Bought into the stash when a robe is worn: put it on.
    const bought = stash(c.s).find((i) => i.kind === "shop" && i.slot === "armor" && i.realm === realm);
    if (bought) c.now("GearEquipped", at, { itemId: bought.id });
  }
}

const geared = (s: CultivatorState) => {
  const a = wornItem(s, "armor");
  const w = wornItem(s, "weapon");
  return a?.kind === "shop" && a.realm === "core_formation" && w?.kind === "shop" && w.realm === "core_formation";
};

const WHITE_ROBE = "robe:foundation_establishment";

// ---- The catalog ------------------------------------------------------------

export const SCENARIOS: readonly Scenario[] = [
  {
    id: "fresh",
    title: "Fresh start",
    description: "No events: the oath, the interview and the area step.",
    build: () => [],
    check: (s) => (s.created ? ["a cultivator exists"] : []),
  },
  scenario(
    {
      id: "qi-areas-decided",
      title: "Qi Condensation, areas decided",
      description: "All three areas decided but not locked: the \"Lock these areas and break through?\" confirmation.",
      days: 3,
      day: () => (c, day) => {
        routineDay(c, { income: study }, day);
        const path = (["main", "body", "soul"] as const)[day];
        if (path) c.now("AreaDecided", c.at(day, 22), { path, choice: `${path} discipline` });
      },
    },
    (s) => [inRealm(s, "qi_condensation"), realmStatus(s).next?.missing === "lock_areas" || "not waiting for the lock"],
  ),
  scenario(
    {
      id: "foundation-early",
      title: "Foundation, 2 weeks in",
      description: "An honest studier two weeks after starting, with a first tribulation open.",
      days: 14,
      day: persona({ income: study }, {}),
    },
    (s) => [inRealm(s, "foundation_establishment", "early"), openTribulations(s).length === 1 || "no open tribulation", alive(s)],
  ),
  scenario(
    {
      id: "foundation-ready",
      title: "Foundation, one tribulation left",
      description: "Two of Foundation's three tribulations completed and the third claimed, awaiting its 350 Qi (or still open): one completion from great circle and the end-of-Foundation choice (ruling 169).",
      days: 150,
      day: persona({ income: study }, {}),
      stop: (c) => c.s.main.realm === "foundation_establishment" && status(c).tribulations?.passed === 2 && openTribulations(c.s).length + (status(c).tribulations?.awaiting ?? 0) === 1,
    },
    (s) => [
      inRealm(s, "foundation_establishment"),
      realmStatus(s).tribulations?.passed === 2 || "not 2 completed",
      openTribulations(s).length + (realmStatus(s).tribulations?.awaiting ?? 0) === 1 || "no third tribulation open or awaiting",
      alive(s),
    ],
  ),
  scenario(
    {
      id: "core-mid",
      title: "Core Formation, mid, with wearables",
      description: "Weekly projects into Core Formation as an Acrobat (Hybrid), at mid level, holding class wearables from tribulation drops.",
      days: 190,
      seed: 5,
      day: persona({ income: weeklyProject }, { class: "acrobat" satisfies ClassId }),
      stop: (c) => c.s.main.realm === "core_formation" && c.s.progress.level === "mid" && heldWearables(c.s) > 0,
    },
    (s) => [inRealm(s, "core_formation", "mid"), s.class.id === "acrobat" || `class ${s.class.id}`, heldWearables(s) > 0 || "no wearable held", alive(s)],
  ),
  scenario(
    {
      id: "nascent-prelock",
      title: "Nascent Soul, before the lock",
      description: "A week into Nascent Soul with its set declared and not locked: edits and deletions are still free, claims wait for the lock.",
      days: 430,
      heavy: true,
      day: persona({ income: both }, {}),
      stop: (c, day) => c.s.main.realm === "nascent_soul" && c.s.progress.lockedAt === null && day >= c.dayOf(c.s.progress.enteredAt) + 7,
    },
    (s) => [inRealm(s, "nascent_soul"), s.progress.lockedAt === null || "the set is locked", (realmStatus(s).tribulations?.total ?? 0) > 0 || "no set declared", alive(s)],
  ),
  scenario(
    {
      id: "spirit-realm",
      title: "Spirit Realm (fast)",
      description: "The eager reference persona (a hard weekly milestone, tribulations as fast as allowed) just after entering Spirit Realm.",
      days: 62,
      day: persona({ income: weeklyMilestones }, { eager: true }),
      stop: (c) => c.s.main.realm === "spirit_realm",
    },
    (s) => [inRealm(s, "spirit_realm"), alive(s)],
  ),
  scenario(
    {
      id: "full-climb",
      title: "Full Step 1 climb",
      description: "Study plus weekly projects at an honest pace, from Qi Condensation through every level-up and breakthrough into Spirit Realm (about 2 years of history).",
      days: 775,
      heavy: true,
      day: persona({ income: both }, {}),
      stop: (c) => c.s.main.realm === "spirit_realm",
    },
    (s) => {
      const steps = s.progress.steps.filter((x) => !x.repented && x.kind !== "restart").map((x) => `${x.kind} ${x.realm} ${x.level}`);
      return [inRealm(s, "spirit_realm"), steps.join("|") === FULL_CLIMB.join("|") || `steps: ${steps.join(", ")}`, alive(s)];
    },
  ),
  scenario(
    {
      id: "core-geared",
      title: "Core Formation, shop armor and weapon",
      description: "Weekly projects into Core Formation as an Acrobat, then the realm's shop armor and weapon bought and worn; the robes wait in the stash.",
      days: 200,
      seed: 5,
      day: () => {
        const base = persona({ income: weeklyProject }, { class: "acrobat" satisfies ClassId })();
        return (c, day, days) => {
          base(c, day, days);
          gearUp(c, day);
        };
      },
      stop: (c) => geared(c.s),
    },
    (s) => [inRealm(s, "core_formation"), geared(s) || "shop armor and weapon of Core Formation aren't both worn", stash(s).some((i) => i.kind === "robe") || "no robe in the stash", alive(s)],
  ),
  scenario(
    {
      id: "robe-wearing-out",
      title: "Foundation, robe wearing out",
      description: "A studier who never trains (the Turtle bites 5% a day) in Foundation, with the white robe at 80% damage or more: the 95% warning and push come within days.",
      days: 30,
      day: persona({ income: study, gym: [] }, {}),
      stop: (c, day) => (advanceTo(c.s, Math.max(c.s.clock, c.at(day + 1, 0) + 1)).gear.items[WHITE_ROBE]?.damageBp ?? 0) >= 8000,
    },
    (s) => [
      inRealm(s, "foundation_establishment"),
      wornItem(s, "armor")?.id === WHITE_ROBE || "the white robe isn't worn (broken?)",
      (s.gear.items[WHITE_ROBE]?.damageBp ?? 0) >= 8000 || `robe damage ${s.gear.items[WHITE_ROBE]?.damageBp}`,
      alive(s),
    ],
  ),
  scenario(
    {
      id: "armor-at-risk",
      title: "Armor at risk before a deadline",
      description: "Foundation, Turtle, the white robe at about 85% with a tribulation due tomorrow, and Foundation shop armor in the stash: the before-deadline warning with its Swap and Repair actions (ruling 149).",
      days: 23,
      day: () => (c, day, days) => {
        routineDay(c, { income: study, gym: [] }, day);
        areasThenLock(c, day);
        if (day !== days - 2) return;
        const at = c.at(day, 22);
        if (c.s.gold >= shopPrice("armor", "foundation_establishment")) c.now("GearBought", at, { slot: "armor" });
        c.now("TribulationDeclared", at, { tribulationId: "armor-risk", title: "Run a 10 km race", criteria: "Finish a 10 km race under 60 minutes", deadline: c.at(days + 1, 23) + 59 * 60_000 });
      },
    },
    (s, now) => {
      const at = advanceTo(s, Math.max(s.clock, now));
      return [
        inRealm(s, "foundation_establishment"),
        armorAtRisk(at)?.item.id === WHITE_ROBE || `not at risk (robe damage ${at.gear.items[WHITE_ROBE]?.damageBp})`,
        (at.gear.items[WHITE_ROBE]?.damageBp ?? 0) < RULES_V1.gear.warnAtBp || "the robe is already at the 95% warning",
        bestStashArmor(at)?.kind === "shop" || "no shop armor in the stash to swap",
        alive(s),
      ];
    },
  ),
  scenario(
    {
      id: "body-lion",
      title: "Body at Lion",
      description: "Gym five times a week with a new routine version every 4 weeks, just promoted to Lion (petting and Lion pet wearables).",
      days: 40,
      day: persona({ income: study, gym: [0, 1, 2, 3, 4] }, {}),
      stop: (c) => c.s.companion.tier === "lion",
    },
    (s) => [s.companion.tier === "lion" || `companion ${s.companion.tier}`],
  ),
  scenario(
    {
      id: "soul-red",
      title: "Soul at Red, six demons",
      description: "Six heart demons, a new one every 2 weeks, fought with soul quests three times a week; all six defeated and the soul Red. Golden needs a seventh demon defeated (7 is the minimum).",
      days: 110,
      setup: (c, ctx) => setupBasic(c, { name: "Test cultivator", tzOffsetMinutes: ctx.tzOffsetMinutes, demon: false }),
      day: () => {
        const plan = tribulationPlan({});
        const demons: string[] = [];
        return (c, day) => {
          if (day % 14 === 0 && demons.length < 6) {
            const id = `d${demons.length}`;
            if (c.now("HeartDemonCreated", c.at(day, 6), { demonId: id, name: DEMON_NAMES[demons.length], positiveTasks: [{ taskId: `${id}+`, name: "Practice" }], negativeTasks: [] })) demons.push(id);
          }
          routineDay(c, { income: study, breathe: [] }, day);
          if ([1, 3, 5].includes(day % 7) && demons.length > 0) {
            if (demons.length >= 2) {
              c.now("SoulQuestDefined", c.at(day, 21), { questId: `sq${day}`, name: "Practice session", demonIds: [...demons] });
              c.now("SoulQuestCompleted", c.at(day, 21), { questId: `sq${day}` });
            } else c.now("SoulTaskLogged", c.at(day, 21), { taskId: `${demons[0]}+` });
          }
          plan(c, day);
        };
      },
      stop: (c) => c.s.soul.color === "red",
    },
    (s) => {
      const demons = Object.values(s.soul.demons);
      return [s.soul.color === "red" || `soul ${s.soul.color}`, demons.length === 6 || `${demons.length} demons`, demons.every((d) => d.defeated) || "a demon is undefeated"];
    },
  ),
  scenario(
    {
      id: "dead",
      title: "Dead avatar (repent cycler)",
      description: "The repent cycler after the 5th repent from Nascent Soul: the avatar is dead and nothing pays until the revival quest (ruling 106).",
      days: 400,
      day: persona({ income: weeklyMilestones }, { eager: true, repentCycle: true }),
      stop: (c) => c.s.progress.diedAt !== null,
    },
    (s) => [realmStatus(s).dead || "alive"],
  ),
  scenario(
    {
      id: "first-repent",
      title: "First repent",
      description: "Back in Core Formation, alive, after one repent from Nascent Soul (a Core Formation tribulation marked faked).",
      days: 50,
      day: persona({ income: weeklyMilestones }, { eager: true, repentCycle: true }),
      stop: (c) => repents(c.s) === 1 && c.s.main.realm === "core_formation",
    },
    (s) => [inRealm(s, "core_formation"), repents(s) === 1 || `${repents(s)} repents`, alive(s)],
  ),
  scenario(
    {
      id: "due-tomorrow",
      title: "Tribulation due tomorrow",
      description: "Foundation with a tribulation due at 23:59 tomorrow: deadline alerts and the last-day claim.",
      days: 21,
      day: () => (c, day, days) => {
        routineDay(c, { income: study }, day);
        areasThenLock(c, day);
        if (day === 8) {
          const at = c.at(day, 22);
          c.now("TribulationDeclared", at, { tribulationId: "due-tomorrow", title: "Run a 10 km race", criteria: "Finish a 10 km race under 60 minutes", deadline: c.at(days + 1, 23) + 59 * 60_000 });
        }
      },
    },
    (s, now) => {
      const t = s.tribulations.items["due-tomorrow"];
      const tz = s.tzOffsetMinutes;
      return [
        inRealm(s, "foundation_establishment"),
        (t !== undefined && tribulationStatus(s, "due-tomorrow") === "open" && t.due !== null && localDay(t.due.deadline, tz) === localDay(now, tz) + 1) || "the tribulation isn't open and due tomorrow",
      ];
    },
  ),
  scenario(
    {
      id: "deviation",
      title: "Qi deviation",
      description: "A daily study done for a week, then skipped: tax debt at the cap, in Qi deviation, with the comeback window open (3 tasks in 3 days).",
      days: 35,
      day: () => (c, day) => {
        if (day === 0) c.ev("MainTaskDefined", c.at(day, 7), { taskId: "study", name: "Study", difficulty: "mid", effort: "session", schedule: { kind: "recurring", count: 1, per: "day" } });
        if (day >= 8 && day < 14) c.ev("MainTaskCompleted", c.at(day, 19), { taskId: "study" });
        routineDay(c, { income: () => {} }, day);
        areasThenLock(c, day);
      },
    },
    (s, now) => {
      const d = deviationStatus(s, RULES_V1);
      return [d !== null || "not in deviation", s.main.debt.qi >= RULES_V1.main.debtCap.qi || `debt ${s.main.debt.qi.toFixed(1)} Qi`, (d !== null && d.windowEndsAt > now) || "no comeback window open"];
    },
  ),
  scenario(
    {
      id: "resting",
      title: "Closed-door cultivation",
      description: "Four days into an 8-day closed-door rest; an open tribulation's deadline (originally tomorrow) is being pushed back by the time inside (ruling 70).",
      days: 20,
      day: () => (c, day, days) => {
        const restStart = days - 4;
        if (day < restStart) routineDay(c, { income: study }, day);
        areasThenLock(c, day);
        if (day === 8) {
          c.now("TribulationDeclared", c.at(day, 22), { tribulationId: "rest-pushed", title: "Publish the essay", criteria: "The essay is published online", deadline: c.at(days + 1, 23) + 59 * 60_000 });
        }
        if (day === restStart) c.now("RestStarted", c.at(day, 9), { kind: "closed_door", oath: CLOSED_DOOR_OATH, until: c.at(days + 4, 9) });
      },
    },
    (s, now) => {
      const t = s.tribulations.items["rest-pushed"];
      return [
        s.rest?.kind === "closed_door" || "not in closed-door rest",
        (t !== undefined && tribulationStatus(s, "rest-pushed") === "open" && t.due !== null && effectiveDeadline(t.due, s.rest, now) > t.due.deadline) || "the deadline isn't being pushed back",
      ];
    },
  ),
];

const DEMON_NAMES = ["Impatience", "Envy", "Sloth", "Anger", "Doubt", "Vanity"] as const;

export function findScenario(id: string): Scenario | undefined {
  return SCENARIOS.find((s) => s.id === id);
}

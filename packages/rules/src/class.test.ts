import { describe, expect, it } from "vitest";
import { OATH_TEXT, REPENT_OATH, TRIBULATION_OATH, type ClassId, type GameEvent } from "@cultivation/schema";
import {
  DAY,
  RULES_V1,
  RuleViolation,
  advanceTo,
  applyEvent,
  classDropChance,
  classDropOutcome,
  goldMultiplier,
  mainQiMultiplier,
  pendingClassDrops,
  pendingSoulRolls,
  qiMultiplier,
  replay,
  trainingGoldMultiplier,
  type CultivatorState,
} from "./index.js";

// Day 0 = Monday 2026-11-02 00:00 in Buenos Aires (UTC-3).
const T0 = Date.UTC(2026, 10, 2, 3);
const H = 60 * 60 * 1000;
let seq = 0;
const ev = <T extends GameEvent["type"]>(type: T, at: number, rest: Omit<Extract<GameEvent, { type: T }>, "id" | "userId" | "at" | "type">) =>
  ({ id: `c${++seq}`, userId: "u1", at, type, ...rest }) as unknown as GameEvent;

const created = ev("CultivatorCreated", T0, { name: "Ricardo", tzOffsetMinutes: -180, oath: OATH_TEXT });
const interview = ev("InterviewAnswered", T0, { interests: { main: "BJJ", body: "Gym", soul: "Calm" } });
const decide = (path: "main" | "body" | "soul", choice: string, at = T0 + H) => ev("AreaDecided", at, { path, choice });
/** Overrides from Qi Condensation early: the 8th leaves Foundation and picks the class. */
const overrides = (n: number, from = T0, cls: ClassId = "monk") => Array.from({ length: n }, (_, i) => ev("RealmOverride", from + i + 1, { class: cls }));
const choose = (cls: ClassId, at: number) => ev("ClassChosen", at, { class: cls });
const demon = ev("HeartDemonCreated", T0, { demonId: "d", name: "Impatience", positiveTasks: [{ taskId: "breathe", name: "Breathe" }], negativeTasks: [] });
const task = (id: string, at: number, tags: { alsoBody?: boolean; alsoSoulDemonId?: string } = {}, effort: "quick" | "session" = "session") =>
  ev("MainTaskDefined", at, { taskId: id, name: id, difficulty: "mid", effort, schedule: { kind: "once", deadline: at + 5 * DAY }, ...tags });
const done = (id: string, at: number) => ev("MainTaskCompleted", at, { taskId: id });
const declare = (id: string, at: number) => ev("TribulationDeclared", at, { tribulationId: id, title: id, criteria: `Pass ${id}`, deadline: at + 30 * DAY });
const claim = (id: string, at: number, classDrop?: "soul_wearable" | "pet_keep" | "pet_halo" | "legendary" | "none") =>
  ev("TribulationClaimed", at, { tribulationId: id, oath: TRIBULATION_OATH, llmReview: "skipped", ...(classDrop ? { classDrop } : {}) });

function code(fn: () => unknown): string | undefined {
  try {
    fn();
  } catch (e) {
    if (e instanceof RuleViolation) return e.code;
    throw e;
  }
  return undefined;
}

const apply = (s: CultivatorState, ...events: GameEvent[]) => events.reduce((acc, e) => applyEvent(acc, e), s);
const rich = (s: CultivatorState, gold = 1000): CultivatorState => ({ ...s, gold });
/** Early Core Formation by override, the class picked by the override out of Foundation. */
const withClass = (cls: ClassId) => replay([created, interview, demon, ...overrides(8, T0, cls)]);
/** A state with no class, to measure what a class adds (no real cultivator in Core Formation has none). */
const classless = (s: CultivatorState): CultivatorState => ({ ...s, class: { ...s.class, id: null } });
const flagged = (s: CultivatorState, inv: Partial<CultivatorState["inventory"]>): CultivatorState => ({ ...s, inventory: { ...s.inventory, ...inv } });

describe("choosing a class (rulings 113, 114, 123)", () => {
  it("is picked for free with the end-of-Foundation choice", () => {
    let s = replay([created, interview, decide("main", "BJJ"), decide("body", "Gym"), decide("soul", "Calm")]);
    s = apply({ ...s, qi: 60 + 3 * 250 }, ev("BodyActivityDefined", T0 + 2 * H, { activityId: "x", name: "x", kind: "exercise" }));
    for (const id of ["a", "b", "c"]) s = apply(s, declare(id, T0 + 3 * H));
    expect(code(() => applyEvent(s, choose("monk", T0 + 4 * H)))).toBe("class_not_yet");
    s = apply(s, claim("a", T0 + DAY), claim("b", T0 + 2 * DAY), claim("c", T0 + 3 * DAY), ev("CoreFormed", T0 + 4 * DAY, { choice: "BJJ", class: "warrior" }));
    expect(s.class.id).toBe("warrior");
    expect(s.class.history).toEqual([{ at: T0 + 4 * DAY, from: null, to: "warrior", gold: 0, forfeited: 0 }]);
  });

  it("is mandatory to enter Core Formation: an override out of Foundation picks it; changes cost 500 gold, with no cooldown", () => {
    const foundation = replay([created, interview, ...overrides(7)]);
    expect(code(() => applyEvent(foundation, ev("RealmOverride", T0 + H, {})))).toBe("class_required");
    let s = apply(foundation, ev("RealmOverride", T0 + H, { class: "bard" }));
    expect([s.main.realm, s.class.id, s.gold]).toEqual(["core_formation", "bard", 0]);
    expect(code(() => applyEvent(s, choose("knight", T0 + 2 * H)))).toBe("insufficient_gold");
    expect(code(() => applyEvent(s, choose("bard", T0 + 2 * H)))).toBe("class_unchanged");
    s = apply(rich(s, 1200), choose("knight", T0 + 2 * H), choose("monk", T0 + 3 * H));
    expect([s.class.id, s.gold]).toEqual(["monk", 200]);
  });

  it("locks on entering Spirit Realm; a repent back to Nascent Soul unlocks it", () => {
    let s = replay([created, interview, ...overrides(13)]);
    expect(code(() => applyEvent(rich(s), choose("bard", T0 + 2 * H)))).toBe("class_locked");
    s = apply(rich(s), ev("Repented", T0 + 2 * H, { oath: REPENT_OATH, faked: [] }), choose("bard", T0 + 3 * H));
    expect(s.class.id).toBe("bard");
  });
});

describe("class bonuses (ruling 115)", () => {
  it("join every gain multiplier, from the current class only", () => {
    const monk = replay([created, interview, ...overrides(8)]);
    const none = classless(monk);
    expect(goldMultiplier(monk) - goldMultiplier(none)).toBeCloseTo(0.15, 9);
    expect(trainingGoldMultiplier(monk) - trainingGoldMultiplier(none)).toBeCloseTo(0.15, 9);
    expect(qiMultiplier(monk) - qiMultiplier(none)).toBeCloseTo(0.05, 9);
    expect(mainQiMultiplier(monk) - mainQiMultiplier(none)).toBeCloseTo(0.05, 9);
    const sorcerer = apply(rich(monk), choose("sorcerer", T0 + 2 * H));
    expect(qiMultiplier(sorcerer) - qiMultiplier(none)).toBeCloseTo(0.15, 9); // replaced, never stacked
  });
});

describe("cross-path tags (rulings 116, 117, 124)", () => {
  it("are checked when defined: session effort or longer, allowed by the class group, a real demon", () => {
    expect(code(() => replay([created, interview, ...overrides(4), task("t", T0 + H, { alsoBody: true })]))).toBe("class_disallows"); // Foundation: no class yet
    const warrior = withClass("warrior");
    expect(code(() => applyEvent(warrior, task("t", T0 + 2 * H, { alsoBody: true }, "quick")))).toBe("cross_credit_effort");
    expect(code(() => applyEvent(warrior, task("t", T0 + 2 * H, { alsoSoulDemonId: "d" })))).toBe("class_disallows");
    expect(code(() => applyEvent(withClass("monk"), task("t", T0 + 2 * H, { alsoBody: true })))).toBe("class_disallows");
    expect(code(() => applyEvent(withClass("bard"), task("t", T0 + 2 * H, { alsoSoulDemonId: "nobody" })))).toBe("unknown_demon");
    expect(code(() => applyEvent(withClass("dancer"), task("t", T0 + 2 * H, { alsoBody: true, alsoSoulDemonId: "d" })))).toBeUndefined();
    const quest = (tags: object) =>
      ev("MainQuestDefined", T0 + 2 * H, {
        questId: "q",
        name: "q",
        deadline: T0 + 30 * DAY,
        tasks: [
          { taskId: "q1", name: "q1", difficulty: "mid", effort: "session", ...tags },
          { taskId: "q2", name: "q2", difficulty: "mid", effort: "session" },
        ],
      });
    expect(code(() => applyEvent(warrior, quest({ alsoSoulDemonId: "d" })))).toBe("class_disallows");
    expect(apply(warrior, quest({ alsoBody: true })).main.tasks.q1!.crossBody).toBe(true);
  });

  it("pays a Body routine's treats and gold on a paying completion, under the daily routine cap", () => {
    const s = apply(withClass("warrior"), task("tagged", T0 + 2 * H, { alsoBody: true }), task("plain", T0 + 2 * H));
    const tagged = apply(s, done("tagged", T0 + 3 * H));
    const plain = apply(s, done("plain", T0 + 3 * H));
    expect(tagged.gold - plain.gold).toBeCloseTo(10 * (1 + 0.01 + 0.1), 9); // routine gold at the Turtle's 1% and the Warrior's 10%
    expect(tagged.companion.tier).toBe("panda"); // 200 treats promote the Turtle
    expect(tagged.companion.routinesToday).toBe(1);
    expect(tagged.main.paths.body.lastActivityAt).toBe(T0 + 3 * H); // Body activity for the tax
    // Two routines already logged today: the tagged task still counts as activity, but pays no routine.
    const gym = ev("BodyActivityDefined", T0 + 2 * H, { activityId: "gym", name: "Gym", kind: "routine" });
    const capped = apply(s, gym, ev("BodyActivityLogged", T0 + 2 * H, { activityId: "gym" }), ev("BodyActivityLogged", T0 + 2 * H + 1, { activityId: "gym" }));
    const after = apply(capped, done("tagged", T0 + 3 * H));
    expect(after.companion.food).toBe(advanceTo(capped, T0 + 3 * H).companion.food);
    expect(after.companion.routinesToday).toBe(2);
  });

  it("deals one positive task's damage to the chosen demon, with no soul drop roll", () => {
    const s = apply(withClass("bard"), task("tagged", T0 + 2 * H, { alsoSoulDemonId: "d" }));
    const hp = s.soul.demons.d!.hp;
    const after = apply(s, done("tagged", T0 + 3 * H));
    expect(after.soul.demons.d!.hp).toBe(hp - RULES_V1.soul.positiveDamage);
    expect(pendingSoulRolls(after.soul)).toEqual([]);
    expect(after.main.paths.soul.lastActivityAt).toBe(T0 + 3 * H);
  });

  it("earns nothing from work-on, and ignores tags the new class doesn't allow", () => {
    const s = apply(withClass("warrior"), task("tagged", T0 + 2 * H, { alsoBody: true }));
    const changed = apply(rich(s), choose("bard", T0 + 3 * H), done("tagged", T0 + 4 * H));
    expect(changed.companion.routinesToday).toBe(0);
    const recurring = ev("MainTaskDefined", T0 + 2 * H, {
      taskId: "weekly",
      name: "Weekly sparring",
      difficulty: "mid",
      effort: "session",
      schedule: { kind: "recurring", count: 1, per: "week" },
      alsoBody: true,
    });
    const worked = apply(withClass("warrior"), recurring, ev("MainTaskWorkedOn", T0 + 3 * H, { taskId: "weekly" }));
    expect(worked.companion.routinesToday).toBe(0);
  });
});

describe("class drops (rulings 119, 120)", () => {
  const core = (cls: ClassId) => apply(withClass(cls), declare("a", T0 + 2 * H), declare("b", T0 + 2 * H), declare("c", T0 + 2 * H));

  it("earn a second server roll on each passed tribulation, under the same 7-day cooldown", () => {
    let s = apply(core("warrior"), claim("a", T0 + DAY));
    expect(pendingClassDrops(s)).toEqual([{ eventId: expect.any(String), at: T0 + DAY, tribulationId: "a", group: "body", chance: 0.5 }]);
    s = apply(s, claim("b", T0 + 2 * DAY));
    expect(pendingClassDrops(s)).toHaveLength(1); // inside the cooldown
    const eventId = pendingClassDrops(s)[0]!.eventId;
    s = apply(s, ev("ClassDropRolled", T0 + 3 * DAY, { eventId, drop: "pet_keep" }));
    expect(s.inventory.petKeepWearables).toBe(1);
    s = apply(s, ev("ClassDropRolled", T0 + 3 * DAY + H, { eventId, drop: "pet_keep" }));
    expect(s.anomalies.map((a) => a.code)).toEqual(["orphan_class_drop_roll"]);
    // A stored outcome applies at once.
    s = apply(s, claim("c", T0 + 9 * DAY, "pet_halo"));
    expect(s.inventory.petHaloWearables).toBe(1);
  });

  it("raise the 50% by growth soul color (Soul), fitness tier (Body) or the higher of both (Hybrid), never lower", () => {
    const at = (cls: ClassId, color: CultivatorState["soul"]["color"], tier: CultivatorState["companion"]["tier"]) => {
      const s = withClass(cls);
      return classDropChance({ ...s, soul: { ...s.soul, color }, companion: { ...s.companion, tier } })!.chance;
    };
    expect(at("bard", "green", "lion")).toBeCloseTo(0.52, 9);
    expect(at("bard", "black", "lion")).toBe(0.5);
    expect(at("knight", "rainbow", "tiger")).toBeCloseTo(0.56, 9);
    expect(at("knight", "rainbow", "turtle")).toBe(0.5);
    expect(at("acrobat", "rainbow", "panda")).toBeCloseTo(0.62, 9);
    expect(at("acrobat", "violet", "lion")).toBeCloseTo(0.58, 9);
  });

  it("split by group: Body's pet kinds 50/50, Hybrid's soul or pet 50/50, Unique's 2% legendary item", () => {
    expect(classDropOutcome("soul", 0.5, 0.49)).toBe("soul_wearable");
    expect(classDropOutcome("body", 0.5, 0.2)).toBe("pet_keep");
    expect(classDropOutcome("body", 0.5, 0.3)).toBe("pet_halo");
    expect(classDropOutcome("hybrid", 0.5, 0.2)).toBe("soul_wearable");
    expect(classDropOutcome("hybrid", 0.5, 0.3)).toBe("pet_keep");
    expect(classDropOutcome("hybrid", 0.5, 0.4)).toBe("pet_halo");
    expect(classDropOutcome("body", 0.5, 0.5)).toBe("none");
    expect(classDropOutcome("unique", 0.02, 0.019)).toBe("legendary");
    const monk = apply(core("monk"), claim("a", T0 + DAY, "legendary"));
    expect(monk.inventory.legendary).toBe(1);
    expect(classDropChance(monk)).toEqual({ group: "unique", chance: 0.02 });
  });
});

describe("wearables (ruling 118)", () => {
  it("a soul wearable freezes a demon's growth for 7 days", () => {
    const s = flagged(withClass("bard"), { soulWearables: 1 });
    const worn = apply(s, ev("WearableUsed", T0 + 2 * H, { wearable: "soul", demonId: "d" }));
    expect(worn.inventory.soulWearables).toBe(0);
    expect(code(() => applyEvent(flagged(worn, { soulWearables: 1 }), ev("WearableUsed", T0 + 3 * H, { wearable: "soul", demonId: "d" })))).toBe("already_frozen");
    const free = advanceTo(s, T0 + 12 * DAY);
    const frozen = advanceTo(worn, T0 + 12 * DAY);
    // Growth starts after the 3-day grace; the freeze covers days 0-7 of it.
    expect(frozen.soul.demons.d!.hp).toBeLessThan(free.soul.demons.d!.hp);
    expect(code(() => applyEvent(withClass("bard"), ev("WearableUsed", T0 + 2 * H, { wearable: "soul", demonId: "d" })))).toBe("no_wearable");
  });

  it("a keep pet wearable holds the companion's tier for 30 days, at any tier, while promotions still work", () => {
    const base = flagged(withClass("knight"), { petKeepWearables: 2 });
    const panda = { ...base, companion: { ...base.companion, tier: "panda" as const, food: 100 } };
    const worn = apply(panda, ev("WearableUsed", T0 + 2 * H, { wearable: "pet_keep" }));
    expect(code(() => applyEvent(worn, ev("WearableUsed", T0 + 3 * H, { wearable: "pet_keep" })))).toBe("already_active");
    const kept = advanceTo(worn, T0 + 2 * H + 30 * DAY);
    expect([kept.companion.tier, kept.companion.food]).toEqual(["panda", worn.companion.food]); // no food loss, no demotion
    expect(advanceTo(kept, T0 + 40 * DAY).companion.tier).toBe("turtle"); // the effect ended
    expect(advanceTo(panda, T0 + 30 * DAY).companion.tier).toBe("turtle");
    // A routine during the keep still promotes.
    const gym = ev("BodyActivityDefined", T0 + 3 * H, { activityId: "gym", name: "Gym", kind: "routine" });
    const promoted = apply(worn, gym, ...[1, 2, 3, 4].map((d) => ev("BodyActivityLogged", T0 + d * DAY, { activityId: "gym" })));
    expect(promoted.companion.tier).toBe("horse");
  });

  it("a halo pet wearable grants a halo ticket; a class change forfeits the held wearables", () => {
    const s = flagged(withClass("acrobat"), { petHaloWearables: 2, soulWearables: 1 });
    const worn = apply(s, ev("WearableUsed", T0 + 2 * H, { wearable: "pet_halo" }));
    expect(worn.haloTickets).toEqual([{ grantedAt: T0 + 2 * H, expiresAt: T0 + 2 * H + 90 * DAY }]);
    const changed = apply(rich(worn), choose("monk", T0 + 3 * H));
    expect([changed.inventory.petHaloWearables, changed.inventory.soulWearables]).toEqual([0, 0]);
    expect(changed.class.history.at(-1)).toMatchObject({ from: "acrobat", to: "monk", gold: 500, forfeited: 2 });
    expect(changed.haloTickets).toHaveLength(1); // a worn one keeps running
  });
});

describe("class through death and repent (ruling 122)", () => {
  it("keeps the class while dead, but a tagged completion pays nothing", () => {
    const s = apply(withClass("warrior"), task("tagged", T0 + 2 * H, { alsoBody: true }));
    const dead: CultivatorState = { ...s, progress: { ...s.progress, diedAt: T0 + 2 * H } };
    const after = apply(dead, done("tagged", T0 + 3 * H));
    expect([after.class.id, after.gold, after.qi]).toEqual(["warrior", 0, 0]);
  });
});

describe("wearables and repent (ruling 104)", () => {
  it("takes wearables right after gain potions when a repent costs items", () => {
    let s = flagged(withClass("acrobat"), { soulWearables: 1, petHaloWearables: 1, legendaryPotions: 1 });
    s = apply(s, ...overrides(4, T0 + 2 * H)); // Nascent Soul by override
    const repent = (at: number) => ev("Repented", at, { oath: REPENT_OATH, faked: [] });
    s = apply(s, repent(T0 + 3 * H), ...overrides(4, T0 + 4 * H), repent(T0 + 5 * H)); // the second repent costs 1 item
    expect([s.inventory.soulWearables, s.inventory.petHaloWearables, s.inventory.legendaryPotions]).toEqual([0, 1, 1]);
  });
});

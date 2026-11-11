import { describe, expect, it } from "vitest";
import { OATH_TEXT, TRIBULATION_OATH, type GameEvent } from "@cultivation/schema";
import {
  DAY,
  RULES_V1,
  RuleViolation,
  advanceTo,
  applyEvent,
  breakthroughRollOutcome,
  failureQiLoss,
  pendingBreakthroughRolls,
  pendingTribulationRolls,
  realmStatus,
  replay,
  type CultivatorState,
} from "./index.js";

// Day 0 = Monday 2026-11-02 00:00 in Buenos Aires (UTC-3).
const T0 = Date.UTC(2026, 10, 2, 3);
const H = 60 * 60 * 1000;
let seq = 0;
const ev = <T extends GameEvent["type"]>(type: T, at: number, rest: Omit<Extract<GameEvent, { type: T }>, "id" | "userId" | "at" | "type">) =>
  ({ id: `r${++seq}`, userId: "u1", at, type, ...rest }) as unknown as GameEvent;

const created = ev("CultivatorCreated", T0, { name: "Ricardo", tzOffsetMinutes: -180, oath: OATH_TEXT });
const interview = ev("InterviewAnswered", T0, { interests: { main: "Mathematics", body: "BJJ", soul: "Calm" } });
const decide = (path: "main" | "body" | "soul", choice: string, at = T0 + H) => ev("AreaDecided", at, { path, choice });
/** Overrides from Qi Condensation early: 4 reach Foundation, 8 Core Formation, 12 Nascent Soul, 13 Spirit Realm. */
const overrides = (n: number) => Array.from({ length: n }, (_, i) => ev("RealmOverride", T0 + i + 1, {}));
/** A neutral event that lets progression catch up after the test changes balances. */
const poke = (at: number) => ev("BodyActivityDefined", at, { activityId: `poke${++seq}`, name: `Poke ${seq}`, kind: "exercise" });
const declare = (id: string, at: number, days = 30) => ev("TribulationDeclared", at, { tribulationId: id, title: id, criteria: `Pass ${id}`, deadline: at + days * DAY });
const claim = (id: string, at: number, evidence = false, drop?: "gain_potion") =>
  ev("TribulationClaimed", at, {
    tribulationId: id,
    oath: TRIBULATION_OATH,
    llmReview: "skipped",
    ...(evidence ? { evidence: [{ kind: "link", ref: "https://example.com/proof" }] } : {}),
    ...(drop ? { drop } : {}),
  });

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
/** Sets the Qi balance (and enough gold for any deletion). */
const withQi = (s: CultivatorState, qi: number): CultivatorState => ({ ...s, qi, gold: Math.max(s.gold, 1000) });
const where = (s: CultivatorState) => [s.main.realm, s.progress.level];

describe("Qi Condensation (ruling 75)", () => {
  it("raises a level per area decided, then breaks through once all three are chosen and 60 Qi is there", () => {
    expect(code(() => replay([created, decide("main", "Mathematics")]))).toBe("interview_first");
    let s = replay([created, interview, decide("main", "Mathematics")]);
    expect(where(s)).toEqual(["qi_condensation", "mid"]);
    s = apply(s, decide("body", "BJJ"), decide("soul", "Meditation"));
    expect(where(s)).toEqual(["qi_condensation", "great_circle"]);
    expect(realmStatus(s).next).toMatchObject({ kind: "breakthrough", qi: 60, ready: true, waitingForQi: true });
    s = apply(withQi(s, 70), poke(T0 + 2 * H));
    expect(where(s)).toEqual(["foundation_establishment", "early"]);
    expect(s.qi).toBe(10); // the threshold is spent (ruling 74)
    expect(s.progress.steps.map((x) => x.kind)).toEqual(["level", "level", "level", "breakthrough"]);
  });

  it("charges 30 Qi to change a decided area, and rejects a change it can't afford or that changes nothing", () => {
    const s = withQi(replay([created, interview, decide("body", "BJJ")]), 40);
    expect(apply(s, decide("body", "Judo", T0 + 2 * H)).qi).toBe(10);
    expect(code(() => applyEvent(withQi(s, 29), decide("body", "Judo", T0 + 2 * H)))).toBe("insufficient_qi");
    expect(code(() => applyEvent(s, decide("body", "BJJ", T0 + 2 * H)))).toBe("area_unchanged");
    expect(where(apply(s, decide("body", "Judo", T0 + 2 * H)))).toEqual(["qi_condensation", "mid"]); // a change isn't a new decision
  });
});

/** In early Foundation with the three areas decided, 0 Qi left. */
function foundation(): CultivatorState {
  const s = replay([created, interview, decide("main", "Mathematics"), decide("body", "BJJ"), decide("soul", "Calm")]);
  return apply(withQi(s, 60), poke(T0 + 2 * H));
}

describe("Foundation Establishment (rulings 74, 76, 77)", () => {
  it("counts Foundation tribulations in passing order; each level waits for its 250 Qi", () => {
    let s = apply(foundation(), declare("a", T0 + 3 * H), declare("b", T0 + 3 * H), declare("c", T0 + 3 * H), claim("b", T0 + DAY));
    expect(where(s)).toEqual(["foundation_establishment", "early"]);
    expect(realmStatus(s)).toMatchObject({ next: { kind: "level", qi: 250, ready: true, waitingForQi: true }, tribulations: { passed: 1, total: 3 } });
    s = apply(withQi(s, 600), claim("a", T0 + 2 * DAY));
    expect(where(s)).toEqual(["foundation_establishment", "late"]);
    expect(s.qi).toBe(100);
    s = apply(withQi(s, 250), claim("c", T0 + 3 * DAY));
    expect(where(s)).toEqual(["foundation_establishment", "great_circle"]);
    expect(realmStatus(s).next).toMatchObject({ kind: "breakthrough", qi: 300, ready: false, missing: "choice" });
  });

  it("doesn't count tribulations declared before Foundation, deleted ones, or a fourth pass", () => {
    const base = replay([created, interview, decide("main", "Mathematics"), decide("body", "BJJ"), decide("soul", "Calm"), declare("old", T0 + 2 * H)]);
    let s = apply(withQi(base, 1000), poke(T0 + 3 * H), declare("a", T0 + 4 * H), declare("b", T0 + 4 * H), claim("old", T0 + DAY));
    expect(s.tribulations.items.old!.realm).toBe("qi_condensation");
    expect(where(s)).toEqual(["foundation_establishment", "early"]);
    s = apply(s, ev("TribulationDeleted", T0 + DAY + H, { tribulationId: "b" }), claim("a", T0 + 2 * DAY));
    expect(realmStatus(s).tribulations).toEqual({ passed: 1, total: 3 });
  });

  it("waives the thresholds for claims with evidence (fast track) and logs them", () => {
    let s = foundation();
    for (const id of ["a", "b", "c"]) s = apply(s, declare(id, T0 + 3 * H));
    s = apply(s, claim("a", T0 + 4 * H, true), claim("b", T0 + 5 * H, true), claim("c", T0 + 6 * H, true));
    expect(where(s)).toEqual(["foundation_establishment", "great_circle"]);
    expect(s.main.flags.filter((f) => f.code === "fast_track_claim").map((f) => f.id)).toEqual(["a", "b", "c"]);
    s = apply(s, ev("CoreFormed", T0 + 7 * H, {}));
    expect(where(s)).toEqual(["core_formation", "early"]); // all three with evidence: the breakthrough's 300 is waived too
    expect(s.progress.steps.filter((x) => x.waived)).toHaveLength(4);
    expect(s.qi).toBe(0);
  });

  it("forms a core only at the end of Foundation, and breaks through once 300 Qi is there", () => {
    let s = foundation();
    for (const id of ["a", "b", "c"]) s = apply(s, declare(id, T0 + 3 * H));
    expect(code(() => applyEvent(s, ev("CoreFormed", T0 + 4 * H, {})))).toBe("not_end_of_foundation");
    s = apply(withQi(s, 750), claim("a", T0 + DAY), claim("b", T0 + DAY + H), claim("c", T0 + DAY + 2 * H));
    s = apply(s, ev("CoreFormed", T0 + 2 * DAY, {}));
    expect(where(s)).toEqual(["foundation_establishment", "great_circle"]);
    expect(realmStatus(s).next).toMatchObject({ kind: "breakthrough", ready: true, waitingForQi: true });
    expect(code(() => applyEvent(s, ev("CoreFormed", T0 + 2 * DAY + H, {})))).toBe("core_already_chosen");
    s = apply(withQi(s, 300), poke(T0 + 3 * DAY));
    expect(where(s)).toEqual(["core_formation", "early"]);
  });

  it("switches foundation free only at the end, and for 125 Qi any other time; either way Foundation restarts", () => {
    let s = foundation();
    for (const id of ["a", "b", "c"]) s = apply(s, declare(id, T0 + 3 * H));
    s = apply(s, claim("a", T0 + DAY, true));
    expect(where(s)).toEqual(["foundation_establishment", "mid"]);
    expect(code(() => applyEvent(s, decide("main", "Physics", T0 + 2 * DAY)))).toBe("insufficient_qi");
    const paid = apply(withQi(s, 125), decide("main", "Physics", T0 + 2 * DAY));
    expect(paid.qi).toBe(0);
    expect(where(paid)).toEqual(["foundation_establishment", "early"]);
    expect(realmStatus(apply(paid, claim("b", T0 + 3 * DAY, true))).tribulations).toEqual({ passed: 0, total: 3 }); // old tribulations stop counting
    const end = apply(s, claim("b", T0 + 2 * DAY, true), claim("c", T0 + 2 * DAY + H, true));
    expect(where(end)).toEqual(["foundation_establishment", "great_circle"]);
    const free = apply(end, decide("main", "Physics", T0 + 3 * DAY));
    expect(free.qi).toBe(0);
    expect(where(free)).toEqual(["foundation_establishment", "early"]);
    expect(free.progress.epoch).toBe(1);
  });
});

describe("Core Formation (rulings 77-78, 85)", () => {
  const core = () => withQi(replay([created, interview, ...overrides(8)]), 5000);

  it("counts the share once the set holds 5, levels at 30/60/90% for 550 Qi each, and 100% breaks through for 700", () => {
    let s = core();
    for (const id of ["a", "b", "c", "d"]) s = apply(s, declare(id, T0 + H));
    s = apply(s, claim("a", T0 + DAY), claim("b", T0 + DAY + H));
    expect(where(s)).toEqual(["core_formation", "early"]); // 2 of 4, but the set is below 5
    s = apply(s, declare("e", T0 + 2 * DAY));
    expect(where(s)).toEqual(["core_formation", "mid"]); // 2 of 5 = 40%
    s = apply(s, claim("c", T0 + 3 * DAY));
    expect(where(s)).toEqual(["core_formation", "late"]); // 60%
    s = apply(s, claim("d", T0 + 4 * DAY));
    expect(where(s)).toEqual(["core_formation", "late"]); // 80%
    s = apply(s, claim("e", T0 + 5 * DAY));
    expect(where(s)).toEqual(["nascent_soul", null]); // 100%: great circle, then the breakthrough
    expect(s.qi).toBe(5000 - 3 * 550 - 700);
  });

  it("never demotes when a tribulation is added, and drops deleted ones from the set", () => {
    let s = core();
    for (const id of ["a", "b", "c", "d", "e"]) s = apply(s, declare(id, T0 + H));
    s = apply(s, claim("a", T0 + DAY), claim("b", T0 + DAY + H));
    expect(where(s)).toEqual(["core_formation", "mid"]);
    for (const id of ["f", "g", "h", "i", "j"]) s = apply(s, declare(id, T0 + 2 * DAY));
    expect(where(s)).toEqual(["core_formation", "mid"]); // 2 of 10 = 20%, still mid
    s = apply(s, ...["f", "g", "h", "i", "j"].map((id, k) => ev("TribulationDeleted", T0 + 3 * DAY + k, { tribulationId: id })));
    expect(realmStatus(s).tribulations).toEqual({ passed: 2, total: 5 });
  });

  it("charges 275 Qi to change the core discipline, back to early Core Formation with a new set", () => {
    let s = apply(core(), decide("main", "Mathematics", T0 + H));
    for (const id of ["a", "b", "c", "d", "e"]) s = apply(s, declare(id, T0 + 2 * H));
    s = apply(s, claim("a", T0 + DAY), claim("b", T0 + DAY + H));
    expect(where(s)).toEqual(["core_formation", "mid"]);
    const qi = s.qi;
    s = apply(s, decide("main", "Physics", T0 + 2 * DAY));
    expect(s.qi).toBe(qi - 275);
    expect(where(s)).toEqual(["core_formation", "early"]);
    expect(realmStatus(s).tribulations).toEqual({ passed: 0, total: 0 });
  });
});

describe("Nascent Soul (ruling 79)", () => {
  const nascent = () => withQi(replay([created, interview, ...overrides(12)]), 5000);

  it("seals the declared set within 90 days; only claims after sealing count; then transcends for 1,500 Qi", () => {
    let s = nascent();
    expect(code(() => applyEvent(s, ev("NascentSoulSealed", T0 + H, {})))).toBe("empty_set");
    s = apply(s, declare("a", T0 + H, 200), declare("b", T0 + H, 200), declare("early", T0 + H, 200), claim("early", T0 + 2 * H));
    s = apply(s, ev("NascentSoulSealed", T0 + DAY, {}));
    expect(s.progress.sealedSet).toEqual(["a", "b"]); // "early" was claimed before sealing, so it never counts
    s = apply(s, declare("late", T0 + 2 * DAY, 200), claim("a", T0 + 3 * DAY));
    expect(realmStatus(s).tribulations).toEqual({ passed: 1, total: 2 }); // "late" was added after sealing
    s = apply(s, claim("b", T0 + 4 * DAY));
    expect(where(s)).toEqual(["spirit_realm", null]);
    expect(s.qi).toBe(5000 - 1500);
    expect(code(() => applyEvent(s, ev("RealmOverride", T0 + 5 * DAY, {})))).toBe("final_realm");
  });

  it("closes the explicit seal after 90 days and seals what is declared at the next midnight", () => {
    const s = apply(nascent(), declare("a", T0 + H, 300));
    const entered = s.progress.enteredAt;
    expect(code(() => applyEvent(s, ev("NascentSoulSealed", entered + 90 * DAY + H, {})))).toBe("seal_window_closed");
    const sealed = advanceTo(s, T0 + 91 * DAY);
    expect(sealed.progress.sealedSet).toEqual(["a"]);
    expect(sealed.progress.sealedAt).toBe(T0 + 91 * DAY);
    // With nothing declared at the window's end, the window starts again.
    const empty = advanceTo(nascent(), T0 + 91 * DAY);
    expect(empty.progress.sealedAt).toBeNull();
    expect(empty.progress.enteredAt).toBe(T0 + 91 * DAY);
  });

  it("drops a deleted tribulation from the sealed set at the normal price", () => {
    let s = apply(nascent(), declare("a", T0 + H, 200), declare("hard", T0 + H, 200), ev("NascentSoulSealed", T0 + DAY, {}), claim("a", T0 + 2 * DAY));
    const qi = s.qi;
    s = apply(s, ev("TribulationDeleted", T0 + 3 * DAY, { tribulationId: "hard" }));
    expect(s.qi).toBe(qi - 97.5 - 1500); // the deletion, then the transcendence it unblocked
    expect(where(s)).toEqual(["spirit_realm", null]);
  });
});

describe("legendary rolls (ruling 83)", () => {
  it("rolls nothing at 0%, adds the Lion's 2% and one halo ticket, used up", () => {
    const s = replay([created, interview]);
    expect(pendingBreakthroughRolls(apply(s, decide("main", "Mathematics")))).toEqual([]);
    const lion = { ...s, companion: { ...s.companion, tier: "lion" as const }, haloTickets: [{ grantedAt: T0, expiresAt: T0 + 90 * DAY }] };
    const after = apply(lion, decide("main", "Mathematics"), decide("body", "BJJ", T0 + 2 * H));
    const rolls = pendingBreakthroughRolls(after);
    expect(rolls.map((r) => r.step)).toEqual([1, 2]);
    expect(rolls[0]!.chance).toBeCloseTo(0.12, 9);
    expect(rolls[1]!.chance).toBeCloseTo(0.02, 9);
    expect(after.haloTickets).toEqual([]);
  });

  it("stores a legendary item in the inventory and flags an orphan roll", () => {
    const lion = { ...replay([created, interview]), companion: { ...replay([created]).companion, tier: "lion" as const } };
    const s = apply(lion, decide("main", "Mathematics"));
    const rolled = apply(s, ev("BreakthroughRolled", T0 + 2 * H, { step: 1, item: "legendary" }));
    expect(rolled.inventory.legendary).toBe(1);
    expect(rolled.progress.legendaryRolls).toEqual({ none: 0, legendary: 1 });
    expect(apply(rolled, ev("BreakthroughRolled", T0 + 3 * H, { step: 1, item: "legendary" })).anomalies.map((a) => a.code)).toEqual(["orphan_breakthrough_roll"]);
    expect(breakthroughRollOutcome(0.02, 0.0199)).toBe("legendary");
    expect(breakthroughRollOutcome(0.02, 0.02)).toBe("none");
  });
});

describe("tribulation item rolls and failures by realm (rulings 80, 82)", () => {
  it("rolls items only for tribulations that count toward the current realm", () => {
    const qc = apply(replay([created, declare("a", T0 + H)]), claim("a", T0 + DAY));
    expect(pendingTribulationRolls(qc)).toEqual([]);
    let s = foundation();
    for (const id of ["a", "b", "c", "d"]) s = apply(s, declare(id, T0 + 3 * H));
    s = apply(s, claim("a", T0 + DAY));
    expect(pendingTribulationRolls(s)).toHaveLength(1);
    s = apply(s, claim("b", T0 + 8 * DAY), claim("c", T0 + 9 * DAY), claim("d", T0 + 16 * DAY));
    expect(pendingTribulationRolls(s).map((r) => r.tribulationId)).toEqual(["a", "b"]); // c inside the cooldown, d a fourth pass
  });

  it("takes 25% of the current threshold, and down to 75% of it when the balance is above that", () => {
    const core = replay([created, ...overrides(8)]);
    expect(failureQiLoss(withQi(core, 300))).toBeCloseTo(137.5, 9);
    expect(failureQiLoss(withQi(core, 1000))).toBeCloseTo(1000 - 412.5, 9);
    const nascent = replay([created, ...overrides(12)]);
    expect(failureQiLoss(withQi(nascent, 0))).toBe(375);
    const spirit = replay([created, ...overrides(13)]);
    expect(failureQiLoss(withQi(spirit, 1000))).toBe(RULES_V1.tribulations.failure.qi);
  });
});

describe("overrides, levels and closed-door flags (rulings 84-86)", () => {
  it("advances one step for free, logs it, and earns no legendary roll", () => {
    const lion = { ...replay([created]), companion: { ...replay([created]).companion, tier: "lion" as const } };
    const s = apply(lion, ...overrides(2));
    expect(where(s)).toEqual(["qi_condensation", "late"]);
    expect(s.main.flags.map((f) => f.code)).toEqual(["realm_override", "realm_override"]);
    expect(pendingBreakthroughRolls(s)).toEqual([]);
  });

  it("never lowers a level for tax or a failure", () => {
    let s = withQi(replay([created, interview, ...overrides(9)]), 0);
    s = apply(s, declare("a", T0 + H, 2));
    s = advanceTo(s, T0 + 40 * DAY);
    expect(s.tribulations.items.a!.status).toBe("failed");
    expect(s.main.taxPaid.main.idleDays).toBeGreaterThan(0);
    expect(where(s)).toEqual(["core_formation", "mid"]);
  });

  it("logs closed-door rest started within 72 hours of an open tribulation's deadline, never vacation", () => {
    const s = withQi(replay([created, declare("near", T0 + H, 5), declare("far", T0 + H, 20)]), 0);
    const closed = apply(s, ev("RestStarted", T0 + H + 3 * DAY, { kind: "closed_door", until: T0 + 6 * DAY }));
    expect(closed.main.flags.filter((f) => f.code === "rest_near_tribulation").map((f) => f.id)).toEqual(["near"]);
    const vacation = apply({ ...s, gold: 1000 }, ev("RestStarted", T0 + H + 3 * DAY, { kind: "vacation", until: T0 + 6 * DAY }));
    expect(vacation.main.flags.filter((f) => f.code === "rest_near_tribulation")).toEqual([]);
  });
});

import { describe, expect, it } from "vitest";
import { OATH_TEXT, type GameEvent } from "@cultivation/schema";
import {
  DAY,
  RULES_V1,
  RuleViolation,
  advanceTo,
  applyEvent,
  evaluateSoulColor,
  growDemons,
  initialSoul,
  onSoulTaskLogged,
  replay,
  type CultivatorState,
  type HeartDemon,
  type SoulState,
} from "./index.js";

// Day 0 = Monday 2026-11-02 00:00 in Buenos Aires (UTC-3): T0 + k*DAY is always a local midnight.
const T0 = Date.UTC(2026, 10, 2, 3);
const H = 60 * 60_000;
let seq = 0;
const ev = <T extends GameEvent["type"]>(type: T, at: number, rest: Omit<Extract<GameEvent, { type: T }>, "id" | "userId" | "at" | "type">) =>
  ({ id: `e${++seq}`, userId: "u1", at, type, ...rest }) as unknown as GameEvent;

const created = ev("CultivatorCreated", T0, { name: "Ricardo", tzOffsetMinutes: -180, oath: OATH_TEXT });

/** Demon `id` with positive task `${id}+` and negative task `${id}-`. */
const demon = (id: string, at: number) =>
  ev("HeartDemonCreated", at, {
    demonId: id,
    name: id,
    positiveTasks: [{ taskId: `${id}+`, name: "fight" }],
    negativeTasks: [{ taskId: `${id}-`, name: "feed" }],
  });
const pos = (id: string, at: number) => ev("SoulTaskLogged", at, { taskId: `${id}+` });
const neg = (id: string, at: number) => ev("SoulTaskLogged", at, { taskId: `${id}-` });
/** n events one minute apart starting at `at`. */
const times = (n: number, at: number, mk: (at: number) => GameEvent) => Array.from({ length: n }, (_, i) => mk(at + i * 60_000));

function code(fn: () => unknown): string | undefined {
  try {
    fn();
  } catch (e) {
    if (e instanceof RuleViolation) return e.code;
    throw e;
  }
  return undefined;
}

const hp = (s: CultivatorState, id: string) => s.soul.demons[id]?.hp;

describe("creating heart demons", () => {
  it("starts the soul Broken and moves it to White when the first demon is identified", () => {
    expect(replay([created]).soul.color).toBe("broken");
    const s = replay([created, demon("a", T0 + H)]);
    expect(s.soul.color).toBe("white");
    expect(s.soul.colorHistory).toEqual([{ at: T0 + H, from: "broken", to: "white", reason: "first_demon" }]);
  });

  it("starts every demon at 50% HP", () => {
    expect(hp(replay([created, demon("a", T0)]), "a")).toBe(50);
  });

  it("allows at most one new demon per week", () => {
    const s = replay([created, demon("a", T0)]);
    expect(code(() => applyEvent(s, demon("b", T0 + 7 * DAY - 1)))).toBe("demon_weekly_limit");
    expect(Object.keys(applyEvent(s, demon("b", T0 + 7 * DAY)).soul.demons)).toEqual(["a", "b"]);
  });

  it("links each soul task to exactly one demon", () => {
    const s = replay([created, demon("a", T0)]);
    const clash = ev("HeartDemonCreated", T0 + 7 * DAY, {
      demonId: "b",
      name: "b",
      positiveTasks: [{ taskId: "a+", name: "meditate" }],
      negativeTasks: [],
    });
    expect(code(() => applyEvent(s, clash))).toBe("duplicate_task");
    expect(code(() => applyEvent(s, demon("a", T0 + 7 * DAY)))).toBe("duplicate_demon");
    expect(code(() => applyEvent(s, pos("zzz", T0 + 1)))).toBe("unknown_task");
  });
});

describe("fighting heart demons", () => {
  it("removes 5% per positive task and adds 10% per negative task, within 0-100", () => {
    let s = replay([created, demon("a", T0), pos("a", T0 + H)]);
    expect(hp(s, "a")).toBe(45);
    s = applyEvent(s, neg("a", T0 + 2 * H));
    expect(hp(s, "a")).toBe(55);
    s = replay([created, demon("a", T0), ...times(10, T0 + H, (at) => neg("a", at))]);
    expect(hp(s, "a")).toBe(100);
  });

  it("defeats a demon at 0% HP", () => {
    const s = replay([created, demon("a", T0), ...times(10, T0 + H, (at) => pos("a", at))]);
    expect(s.soul.demons.a).toMatchObject({ hp: 0, defeated: true, defeats: 1 });
    expect(s.soul.demonHistory.at(-1)).toMatchObject({ demonId: "a", kind: "defeated" });
    // Fighting a defeated demon keeps it at 0.
    expect(hp(applyEvent(s, pos("a", T0 + 2 * H)), "a")).toBe(0);
  });

  it("revives a defeated demon that climbs back to 50%", () => {
    const beaten = replay([created, demon("a", T0), ...times(10, T0 + H, (at) => pos("a", at))]);
    let s = beaten;
    for (let i = 0; i < 4; i++) s = applyEvent(s, neg("a", T0 + 2 * H + i));
    expect(s.soul.demons.a).toMatchObject({ hp: 40, defeated: true });
    s = applyEvent(s, neg("a", T0 + 3 * H));
    expect(s.soul.demons.a).toMatchObject({ hp: 50, defeated: false, revivals: 1 });
    expect(s.soul.lastRevivalAt).toBe(T0 + 3 * H);
  });
});

describe("passive growth", () => {
  it("heals 1% a day after 3 days without a positive task", () => {
    const s = replay([created, demon("a", T0 + 12 * H)]);
    expect(hp(advanceTo(s, T0 + 3 * DAY + 12 * H), "a")).toBe(50);
    expect(hp(advanceTo(s, T0 + 5 * DAY + 12 * H), "a")).toBeCloseTo(52, 9);
  });

  it("restarts the 3-day grace period on each positive task, but not on negative ones", () => {
    let s = replay([created, demon("a", T0)]);
    s = applyEvent(s, pos("a", T0 + 3 * DAY)); // 45, grace restarts
    expect(hp(advanceTo(s, T0 + 6 * DAY), "a")).toBeCloseTo(45, 9);
    s = applyEvent(s, neg("a", T0 + 4 * DAY)); // 55, grace keeps running
    expect(hp(advanceTo(s, T0 + 7 * DAY), "a")).toBeCloseTo(56, 9);
  });

  it("grows faster at better soul colors, twice as fast at Rainbow", () => {
    const grow = (color: SoulState["color"]) => {
      const soul = soulWith([{ hp: 10, defeated: true, idleMs: 3 * DAY }], { color });
      growDemons(soul, 0, DAY, RULES_V1);
      return soul.demons.d0?.hp;
    };
    expect(grow("white")).toBeCloseTo(11, 9);
    expect(grow("violet")).toBeCloseTo(11, 9);
    expect(grow("green")).toBeCloseTo(11.1, 9);
    expect(grow("rainbow")).toBeCloseTo(12, 9);
  });

  it("keeps defeated demons growing and revives them at 50%", () => {
    const s = replay([created, demon("a", T0), ...times(10, T0, (at) => pos("a", at))]);
    const lastPositive = T0 + 9 * 60_000;
    // Defeated at 0: 3 days of grace, then ~50 days to reach 50% (slightly faster while Green).
    const later = advanceTo(s, T0 + 60 * DAY);
    expect(later.soul.demons.a).toMatchObject({ defeated: false, revivals: 1 });
    const revivedAt = later.soul.lastRevivalAt ?? 0;
    expect(revivedAt).toBeGreaterThan(lastPositive + 3 * DAY + 40 * DAY);
    expect(revivedAt).toBeLessThan(lastPositive + 3 * DAY + 50 * DAY);
    // Revival happens at the crossing instant: just before it the demon is still defeated.
    expect(advanceTo(s, revivedAt - 1).soul.demons.a?.defeated).toBe(true);
    expect(advanceTo(s, revivedAt).soul.demons.a?.defeated).toBe(false);
  });

  it("freezes demon growth during rest, and rest doesn't count toward the grace period", () => {
    const s0 = replay([created, demon("a", T0)]);
    const rested = applyEvent(s0, ev("RestStarted", T0 + DAY, { kind: "closed_door", until: T0 + 11 * DAY }));
    expect(hp(advanceTo(rested, T0 + 11 * DAY), "a")).toBe(50);
    // 1 day before rest + 3 after = 4 idle days: 1 day of growth.
    expect(hp(advanceTo(rested, T0 + 14 * DAY), "a")).toBeCloseTo(51, 9);
    expect(hp(advanceTo(s0, T0 + 14 * DAY), "a")).toBeCloseTo(61, 9);
  });
});

describe("soul color", () => {
  it("is evaluated at the end of the local day, so a demon can be pushed back before the drop", () => {
    const s = replay([created, demon("a", T0), ...times(3, T0 + 10 * H, (at) => neg("a", at))]);
    expect(hp(s, "a")).toBe(80);
    expect(s.soul.color).toBe("white");
    // Pushed back under 70% before midnight: stays White.
    const saved = applyEvent(applyEvent(applyEvent(s, pos("a", T0 + 23 * H)), pos("a", T0 + 23 * H + 1)), pos("a", T0 + 23 * H + 2));
    expect(advanceTo(saved, T0 + DAY).soul.color).toBe("white");
    // Left alone: Violet at midnight, not a moment earlier.
    expect(advanceTo(s, T0 + DAY - 1).soul.color).toBe("white");
    expect(advanceTo(s, T0 + DAY).soul.color).toBe("violet");
  });

  it("weakens on any single demon: Violet above 70%, Black above 80%, Broken above 90%", () => {
    const at = (hps: number[]) => evaluateSoulColor(soulWith(hps.map((h) => ({ hp: h }))), 0, RULES_V1);
    expect(at([70])).toBe("white");
    expect(at([70.5])).toBe("violet");
    expect(at([10, 81])).toBe("black");
    expect(at([10, 20, 91])).toBe("broken");
    expect(evaluateSoulColor(initialSoul(), 0, RULES_V1)).toBe("broken");
  });

  it("climbs the growth ladder by demons created and defeated", () => {
    const at = (created: number, defeated: number) =>
      evaluateSoulColor(
        soulWith(Array.from({ length: created }, (_, i) => (i < defeated ? { hp: 0, defeated: true } : { hp: 50 }))),
        0,
        RULES_V1,
      );
    expect(at(1, 0)).toBe("white");
    expect(at(1, 1)).toBe("green");
    expect(at(3, 2)).toBe("green");
    expect(at(3, 3)).toBe("blue");
    expect(at(6, 6)).toBe("red");
    expect(at(8, 7)).toBe("red"); // Golden needs every demon defeated
  });

  it("lets weakening colors override growth colors", () => {
    const soul = soulWith([...Array.from({ length: 7 }, () => ({ hp: 0, defeated: true })), { hp: 75 }]);
    expect(evaluateSoulColor(soul, 0, RULES_V1)).toBe("violet");
  });

  it("needs all demons defeated (at least 7) and 1 week / 1 month / 1 year without revival for Golden / Translucent / Rainbow", () => {
    const seven = () => Array.from({ length: 7 }, () => ({ hp: 0, defeated: true }));
    const now = 1000 * DAY;
    const since = (days: number) => evaluateSoulColor(soulWith(seven(), { lastRevivalAt: now - days * DAY }), now, RULES_V1);
    expect(since(6)).toBe("red");
    expect(since(7)).toBe("golden");
    expect(since(30)).toBe("translucent");
    expect(since(365)).toBe("rainbow");
    // With no revival ever, the clock runs from the first demon.
    expect(evaluateSoulColor(soulWith(seven(), { firstDemonAt: now - 400 * DAY }), now, RULES_V1)).toBe("rainbow");
  });

  it("resets the Translucent and Rainbow clocks when any defeated demon revives", () => {
    const now = 1000 * DAY;
    const soul = soulWith(
      Array.from({ length: 7 }, () => ({ hp: 0, defeated: true })),
      { firstDemonAt: now - 400 * DAY, color: "rainbow" },
    );
    for (let i = 0; i < 5; i++) onSoulTaskLogged(soul, { ...task("d3-"), at: now + i }, RULES_V1);
    expect(soul.lastRevivalAt).toBe(now + 4);
    for (let i = 0; i < 10; i++) onSoulTaskLogged(soul, { ...task("d3+"), at: now + 10 + i }, RULES_V1);
    expect(evaluateSoulColor(soul, now + DAY, RULES_V1)).toBe("red");
    expect(evaluateSoulColor(soul, now + 8 * DAY, RULES_V1)).toBe("golden");
    expect(evaluateSoulColor(soul, now + 31 * DAY, RULES_V1)).toBe("translucent");
    expect(evaluateSoulColor(soul, now + 366 * DAY, RULES_V1)).toBe("rainbow");
  });

  it("reaches Green the day the first demon is defeated, through the event log", () => {
    const s = replay([created, demon("a", T0), ...times(10, T0 + H, (at) => pos("a", at))], RULES_V1, T0 + DAY);
    expect(s.soul.color).toBe("green");
    expect(s.soul.colorHistory.at(-1)).toEqual({ at: T0 + DAY, from: "white", to: "green", reason: "day_end" });
  });
});

describe("deleting heart demons", () => {
  it("can't delete a demon in its first week", () => {
    const s = replay([created, demon("a", T0), demon("b", T0 + 7 * DAY)]);
    expect(code(() => applyEvent(s, ev("HeartDemonDeleted", T0 + 7 * DAY + H, { demonId: "b" })))).toBe("demon_deletion_locked");
    expect(code(() => applyEvent(s, ev("HeartDemonDeleted", T0 + 7 * DAY + H, { demonId: "zzz" })))).toBe("unknown_demon");
  });

  it("can't delete a defeated demon until it revives", () => {
    // a has grown to ~54% by day 7, so 11 hits defeat it.
    let s = replay([created, demon("a", T0), demon("b", T0 + 7 * DAY), ...times(11, T0 + 7 * DAY + H, (at) => pos("a", at))]);
    expect(s.soul.demons.a?.defeated).toBe(true);
    expect(code(() => applyEvent(s, ev("HeartDemonDeleted", T0 + 8 * DAY, { demonId: "a" })))).toBe("demon_defeated_locked");
    for (let i = 0; i < 5; i++) s = applyEvent(s, neg("a", T0 + 8 * DAY + i));
    expect(applyEvent(s, ev("HeartDemonDeleted", T0 + 8 * DAY + H, { demonId: "a" })).soul.demons.a).toBeUndefined();
  });

  it("at a growth color drops the soul to White until another demon is defeated", () => {
    const fightA = (from: number, to: number) => {
      const out: GameEvent[] = [];
      for (let t = from; t < to; t += 2 * DAY) out.push(pos("a", t));
      return out;
    };
    let s = replay(
      byTime([created, demon("a", T0), ...times(10, T0 + H, (at) => pos("a", at)), demon("b", T0 + 7 * DAY), ...fightA(T0 + 2 * DAY, T0 + 14 * DAY)]),
    );
    s = advanceTo(s, T0 + 14 * DAY);
    expect(s.soul.color).toBe("green");
    s = applyEvent(s, ev("HeartDemonDeleted", T0 + 14 * DAY + H, { demonId: "b" }));
    expect(s.soul.color).toBe("white");
    expect(s.soul.colorHistory.at(-1)?.reason).toBe("deletion");
    // Still White at the next midnights, even though 1 created / 1 defeated would be Green.
    s = applyEvent(s, pos("a", T0 + 15 * DAY + H));
    s = advanceTo(s, T0 + 16 * DAY);
    expect(s.soul.color).toBe("white");
    // A new victory lifts the hold.
    s = replay(
      byTime([
        created,
        demon("a", T0),
        ...times(10, T0 + H, (at) => pos("a", at)),
        demon("b", T0 + 7 * DAY),
        ...fightA(T0 + 2 * DAY, T0 + 14 * DAY),
        ev("HeartDemonDeleted", T0 + 14 * DAY + H, { demonId: "b" }),
        demon("c", T0 + 14 * DAY + 2 * H),
        ...times(10, T0 + 14 * DAY + 3 * H, (at) => pos("c", at)),
      ]),
      RULES_V1,
      T0 + 15 * DAY,
    );
    expect(s.soul.heldAtWhite).toBe(false);
    expect(s.soul.color).toBe("green");
  });

  it("at White is allowed, and with no demon left the soul turns Broken at the end of the day", () => {
    let s = replay([created, demon("a", T0)]);
    s = applyEvent(s, ev("HeartDemonDeleted", T0 + 7 * DAY + H, { demonId: "a" }));
    expect(s.soul.color).toBe("white");
    expect(advanceTo(s, T0 + 8 * DAY).soul.color).toBe("broken");
  });

  it("at a weakening color can't delete the last demon", () => {
    const s = replay([created, demon("a", T0), ...times(3, T0 + H, (at) => neg("a", at))], RULES_V1, T0 + DAY);
    expect(s.soul.color).toBe("violet");
    expect(code(() => applyEvent(s, ev("HeartDemonDeleted", T0 + 7 * DAY, { demonId: "a" })))).toBe("last_demon_locked");
  });

  it("at a weakening color feeds the remaining demons until one is at 80%", () => {
    // a: 50 + 4 days of growth + 2 negatives ~ 74 -> Violet at midnight. b: fresh at 50.
    let s = replay([created, demon("a", T0), demon("b", T0 + 7 * DAY), neg("a", T0 + 7 * DAY + H), neg("a", T0 + 7 * DAY + 2 * H)]);
    s = advanceTo(s, T0 + 8 * DAY);
    expect(s.soul.color).toBe("violet");
    s = applyEvent(s, ev("HeartDemonDeleted", T0 + 8 * DAY + H, { demonId: "a" }));
    expect(hp(s, "b")).toBeCloseTo(80, 9);
  });

  it("feeds every remaining demon by the same amount", () => {
    // At day 14: a ~61 (passive), b ~49, c fresh at 50. Then a is pushed to ~76 (Violet) and b knocked down.
    let s = replay([
      created,
      demon("a", T0),
      demon("b", T0 + 7 * DAY),
      pos("b", T0 + 7 * DAY + H),
      demon("c", T0 + 14 * DAY),
      pos("a", T0 + 14 * DAY + H),
      pos("b", T0 + 14 * DAY + H),
      neg("a", T0 + 14 * DAY + 2 * H),
      neg("a", T0 + 14 * DAY + 2 * H + 1),
    ]);
    s = advanceTo(s, T0 + 15 * DAY);
    expect(s.soul.color).toBe("violet");
    const before = { b: hp(s, "b") ?? 0, c: hp(s, "c") ?? 0 };
    s = applyEvent(s, ev("HeartDemonDeleted", T0 + 15 * DAY + H, { demonId: "a" }));
    const fed = 80 - Math.max(before.b, before.c);
    expect(hp(s, "b")).toBeCloseTo(before.b + fed, 9);
    expect(hp(s, "c")).toBeCloseTo(80, 9);
  });
});

describe("renaming heart demons", () => {
  const rename = (id: string, at: number, suffix = "2") =>
    ev("HeartDemonRenamed", at, {
      demonId: id,
      name: `${id} ${suffix}`,
      positiveTasks: [{ taskId: `${id}+${suffix}`, name: "new fight" }],
      negativeTasks: [],
    });

  it("is allowed in the first week, redefines the tasks, and raises a demon below 50% to 50%", () => {
    let s = replay([created, demon("a", T0), ...times(4, T0 + H, (at) => pos("a", at))]);
    expect(hp(s, "a")).toBe(30);
    s = applyEvent(s, rename("a", T0 + 2 * H));
    expect(s.soul.demons.a).toMatchObject({ name: "a 2", hp: 50 });
    expect(code(() => applyEvent(s, pos("a", T0 + 3 * H)))).toBe("unknown_task");
    expect(hp(applyEvent(s, ev("SoulTaskLogged", T0 + 3 * H, { taskId: "a+2" })), "a")).toBe(45);
  });

  it("keeps the HP of a demon above 50%", () => {
    const s = replay([created, demon("a", T0), neg("a", T0 + H), rename("a", T0 + 2 * H)]);
    expect(hp(s, "a")).toBe(60);
  });

  it("is locked while defeated and allowed again after revival", () => {
    let s = replay([created, demon("a", T0), ...times(10, T0 + H, (at) => pos("a", at))]);
    expect(code(() => applyEvent(s, rename("a", T0 + 2 * H)))).toBe("demon_defeated_locked");
    for (let i = 0; i < 5; i++) s = applyEvent(s, neg("a", T0 + 2 * H + i));
    expect(applyEvent(s, rename("a", T0 + 3 * H)).soul.demons.a?.name).toBe("a 2");
  });
});

describe("soul determinism", () => {
  it("replays to identical state", () => {
    const evs = [created, demon("a", T0), pos("a", T0 + DAY), neg("a", T0 + 5 * DAY), demon("b", T0 + 9 * DAY)];
    expect(replay(evs, RULES_V1, T0 + 90 * DAY)).toEqual(replay(evs, RULES_V1, T0 + 90 * DAY));
  });
});

// ---- Helpers for crafted soul states ---------------------------------------------------

function byTime(events: GameEvent[]): GameEvent[] {
  return [...events].sort((a, b) => a.at - b.at);
}

function task(taskId: string) {
  return { id: "x", userId: "u1", type: "SoulTaskLogged" as const, taskId };
}

function soulWith(demons: { hp: number; defeated?: boolean; idleMs?: number }[], extra: Partial<SoulState> = {}): SoulState {
  const soul: SoulState = { ...initialSoul(), color: "white", firstDemonAt: 0, ...extra };
  demons.forEach((d, i) => {
    const demon: HeartDemon = {
      name: `d${i}`,
      positiveTasks: [{ taskId: `d${i}+`, name: "fight" }],
      negativeTasks: [{ taskId: `d${i}-`, name: "feed" }],
      hp: d.hp,
      defeated: d.defeated ?? false,
      createdAt: 0,
      idleMs: d.idleMs ?? 0,
      defeats: d.defeated ? 1 : 0,
      revivals: 0,
    };
    soul.demons[`d${i}`] = demon;
  });
  return soul;
}

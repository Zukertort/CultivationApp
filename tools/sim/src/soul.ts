/**
 * Soul simulator. Runs synthetic cultivators with different soul habits
 * through the real rules engine and reports how fast each soul color is
 * reached, how often demons revive, how much time is spent weakened, and what
 * the soul drops pay.
 *
 * Output: a summary on stdout and daily CSV rows in tools/sim/out/.
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { OATH_TEXT, type GameEvent } from "@cultivation/schema";
import {
  DAY,
  GROWTH_COLORS,
  RULES_V1,
  SOUL_COLORS,
  advanceTo,
  applyEvent,
  demonCounts,
  initialState,
  isWeakening,
  soulDropOutcome,
  type SoulColor,
} from "@cultivation/rules";

const T0 = Date.UTC(2026, 10, 2, 3); // Monday 00:00 in Buenos Aires
const HOUR = 60 * 60 * 1000;
const WEEKS = 104; // Rainbow needs a year on the Golden clock, so look past the first year.

interface Persona {
  label: string;
  /** Days of the week (0 = Monday) with soul practice. */
  soulDays: number[];
  /**
   * "all": a positive task for every demon, defeated ones included;
   * "undefeated": ignores beaten demons; "quest": one soul quest per session
   * against every demon; "none": no practice.
   */
  fights: "all" | "undefeated" | "quest" | "none";
  /** A new demon every N weeks, up to maxDemons. */
  newEveryWeeks: number;
  maxDemons: number;
  /** Days of the week with a relapse (a negative task on one demon, rotating across demons). */
  relapseDays?: number[];
  /** A closed-door rest of restDays every restEveryWeeks weeks. */
  restEveryWeeks?: number;
  restDays?: number;
}

const PERSONAS: Persona[] = [
  { label: "devoted 4/wk, all demons", soulDays: [0, 2, 4, 6], fights: "all", newEveryWeeks: 1, maxDemons: 8 },
  { label: "steady 2/wk, all demons", soulDays: [1, 4], fights: "all", newEveryWeeks: 2, maxDemons: 7 },
  { label: "steady 2/wk + rests", soulDays: [1, 4], fights: "all", newEveryWeeks: 2, maxDemons: 7, restEveryWeeks: 13, restDays: 14 },
  { label: "quest 2/wk, all demons", soulDays: [1, 4], fights: "quest", newEveryWeeks: 2, maxDemons: 7 },
  { label: "focused 3/wk, ignores beaten", soulDays: [0, 2, 4], fights: "undefeated", newEveryWeeks: 2, maxDemons: 7 },
  { label: "relapsing 3/wk, 2 relapses/wk", soulDays: [0, 2, 4], fights: "all", newEveryWeeks: 2, maxDemons: 7, relapseDays: [5, 6] },
  { label: "relapses only 2/wk, 1 demon", soulDays: [], fights: "none", newEveryWeeks: 999, maxDemons: 1, relapseDays: [5, 6] },
  { label: "weekly 1/wk, all demons", soulDays: [2], fights: "all", newEveryWeeks: 2, maxDemons: 7 },
  { label: "neglect: 1 demon, never fights", soulDays: [], fights: "none", newEveryWeeks: 999, maxDemons: 1 },
];

let seq = 0;
const mk = (type: GameEvent["type"], at: number, rest: object): GameEvent =>
  ({ id: `soul${++seq}`, userId: "sim", at, type, ...rest }) as GameEvent;

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

interface SoulRun {
  persona: Persona;
  firstReached: Partial<Record<SoulColor, number>>;
  final: SoulColor;
  revivals: number;
  weakenedDays: number;
  peakHp: number;
  positives: number;
  negatives: number;
  quests: number;
  /** Net gold and Qi from soul drops. */
  dropGold: number;
  dropQi: number;
  rows: string[];
}

function simulateSoul(p: Persona, weeks = WEEKS): SoulRun {
  let s = applyEvent(initialState(), mk("CultivatorCreated", T0, { name: "sim", tzOffsetMinutes: -180, oath: OATH_TEXT }));
  const apply = (e: GameEvent) => (s = applyEvent(s, e));
  const roll = rng(42);
  const ids: string[] = [];
  const firstReached: Partial<Record<SoulColor, number>> = {};
  const rows: string[] = [];
  let weakenedDays = 0;
  let peakHp = 0;
  let positives = 0;
  let negatives = 0;
  let quests = 0;
  let dropGold = 0;
  let dropQi = 0;

  /** Apply an event carrying a drop rolled at the current color, and tally what it paid. */
  const withDrop = (type: "SoulTaskLogged" | "SoulQuestCompleted", at: number, rest: object) => {
    const gold = s.gold;
    const qi = s.qi;
    apply(mk(type, at, { ...rest, drop: soulDropOutcome(s.soul.color, roll(), RULES_V1) }));
    dropGold += s.gold - gold;
    dropQi += s.qi - qi;
  };

  for (let d = 0; d < weeks * 7; d++) {
    const dayStart = T0 + d * DAY;
    const w = Math.floor(d / 7);
    const dow = d % 7;

    if (p.restEveryWeeks && p.restDays && dow === 0 && w > 0 && w % p.restEveryWeeks === 0) {
      apply(mk("RestStarted", dayStart + HOUR, { kind: "closed_door", until: dayStart + HOUR + p.restDays * DAY }));
    }
    const resting = () => s.rest !== null && s.clock < s.rest.end;

    if (dow === 0 && w % p.newEveryWeeks === 0 && ids.length < p.maxDemons && !resting()) {
      const id = `demon-${ids.length + 1}`;
      ids.push(id);
      apply(
        mk("HeartDemonCreated", dayStart + 9 * HOUR, {
          demonId: id,
          name: id,
          positiveTasks: [{ taskId: `${id}+`, name: "meditate on it" }],
          negativeTasks: [{ taskId: `${id}-`, name: "give in" }],
        }),
      );
    }

    if (p.soulDays.includes(dow) && p.fights !== "none") {
      const at = dayStart + 20 * HOUR;
      s = advanceTo(s, at);
      if (!resting()) {
        const targets = ids.filter((id) => !(p.fights === "undefeated" && s.soul.demons[id]?.defeated));
        if (p.fights === "quest" && targets.length >= 2) {
          // One session against every demon: a soul quest.
          const questId = `quest-${d}`;
          apply(mk("SoulQuestDefined", at, { questId, name: "meditation", demonIds: targets }));
          withDrop("SoulQuestCompleted", at + 1, { questId });
          quests += 1;
        } else {
          targets.forEach((id, i) => {
            withDrop("SoulTaskLogged", at + i, { taskId: `${id}+` });
            positives += 1;
          });
        }
      }
    }

    if (p.relapseDays?.includes(dow) && ids.length > 0) {
      s = advanceTo(s, dayStart + 22 * HOUR);
      if (!resting()) {
        const id = ids[(w + dow) % ids.length] as string;
        apply(mk("SoulTaskLogged", dayStart + 22 * HOUR, { taskId: `${id}-` }));
        negatives += 1;
      }
    }

    // Midnight: the engine evaluates the soul color here (unless resting).
    s = advanceTo(s, dayStart + DAY);
    const color = s.soul.color;
    firstReached[color] ??= (d + 1) / 7;
    if (isWeakening(color)) weakenedDays += 1;
    const hps = Object.values(s.soul.demons).map((dm) => dm.hp);
    const top = hps.length ? Math.max(...hps) : 0;
    peakHp = Math.max(peakHp, top);
    const { created, defeated } = demonCounts(s.soul);
    rows.push([d + 1, color, created, defeated, top.toFixed(2), s.rest ? 1 : 0, s.gold.toFixed(1), s.qi.toFixed(1)].join(","));
  }

  const revivals = Object.values(s.soul.demons).reduce((n, dm) => n + dm.revivals, 0);
  return { persona: p, firstReached, final: s.soul.color, revivals, weakenedDays, peakHp, positives, negatives, quests, dropGold, dropQi, rows };
}

const fmt = (w: number | undefined) => (w === undefined ? "—" : w.toFixed(1));

export function runSoulScenarios(outDir: string): void {
  const runs = PERSONAS.map((p) => simulateSoul(p));
  for (const r of runs) {
    const slug = r.persona.label.split(/[^a-z0-9]+/i).filter(Boolean).join("-").toLowerCase();
    writeFileSync(join(outDir, `soul-${slug}.csv`), ["day,color,demons,defeated,max_hp,resting,gold,qi", ...r.rows].join("\n"));
  }

  const growth: SoulColor[] = ["white", ...GROWTH_COLORS];
  console.log(`\nSoul: weeks to first reach each growth color (${WEEKS}-week horizon)\n`);
  console.log(["persona", ...growth, "final", "revivals"].join("\t"));
  for (const r of runs) {
    console.log([r.persona.label, ...growth.map((c) => fmt(r.firstReached[c])), r.final, r.revivals].join("\t"));
  }

  const weak: SoulColor[] = ["violet", "black", "broken"];
  console.log(`\nSoul: weakening and activity (${WEEKS} weeks)\n`);
  console.log(
    ["persona", ...weak.map((c) => `1st ${c}`), "weakened days", "peak HP", "positive tasks", "negative tasks", "quests", "drop gold", "drop Qi"].join("\t"),
  );
  for (const r of runs) {
    console.log(
      [
        r.persona.label,
        ...weak.map((c) => fmt(r.firstReached[c])),
        r.weakenedDays,
        r.peakHp.toFixed(1),
        r.positives,
        r.negatives,
        r.quests,
        r.dropGold.toFixed(0),
        r.dropQi.toFixed(0),
      ].join("\t"),
    );
  }
  console.log(`\nColors, worst to best: ${SOUL_COLORS.join(" < ")}`);
}

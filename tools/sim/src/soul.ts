/**
 * Soul simulator. Runs synthetic cultivators with different soul habits
 * through the real rules engine and reports how fast each soul color is
 * reached, how often demons revive, and how much time is spent weakened.
 *
 * Output: a summary on stdout and daily CSV rows in tools/sim/out/.
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { OATH_TEXT, type GameEvent } from "@cultivation/schema";
import { DAY, GROWTH_COLORS, SOUL_COLORS, advanceTo, applyEvent, demonCounts, initialState, isWeakening, type SoulColor } from "@cultivation/rules";

const T0 = Date.UTC(2026, 10, 2, 3); // Monday 00:00 in Buenos Aires
const HOUR = 60 * 60 * 1000;
const WEEKS = 104; // Rainbow needs a year without revivals, so look past the first year.

interface Persona {
  label: string;
  /** Days of the week (0 = Monday) with soul practice. */
  soulDays: number[];
  /** "all": a positive task for every demon, defeated ones included; "undefeated": ignores beaten demons. */
  fights: "all" | "undefeated" | "none";
  /** A new demon every N weeks, up to maxDemons. */
  newEveryWeeks: number;
  maxDemons: number;
  /** Days of the week with a relapse (a negative task on one demon, rotating). */
  relapseDays?: number[];
  /** A closed-door rest of restDays every restEveryWeeks weeks. */
  restEveryWeeks?: number;
  restDays?: number;
}

const PERSONAS: Persona[] = [
  { label: "devoted 4/wk, all demons", soulDays: [0, 2, 4, 6], fights: "all", newEveryWeeks: 1, maxDemons: 8 },
  { label: "steady 2/wk, all demons", soulDays: [1, 4], fights: "all", newEveryWeeks: 2, maxDemons: 7 },
  { label: "steady 2/wk + rests", soulDays: [1, 4], fights: "all", newEveryWeeks: 2, maxDemons: 7, restEveryWeeks: 13, restDays: 14 },
  { label: "focused 3/wk, ignores beaten", soulDays: [0, 2, 4], fights: "undefeated", newEveryWeeks: 2, maxDemons: 7 },
  { label: "relapsing 3/wk, 2 relapses/wk", soulDays: [0, 2, 4], fights: "all", newEveryWeeks: 2, maxDemons: 7, relapseDays: [5, 6] },
  { label: "weekly 1/wk, all demons", soulDays: [2], fights: "all", newEveryWeeks: 2, maxDemons: 7 },
  { label: "neglect: 1 demon, never fights", soulDays: [], fights: "none", newEveryWeeks: 999, maxDemons: 1 },
];

let seq = 0;
const mk = (type: GameEvent["type"], at: number, rest: object): GameEvent =>
  ({ id: `soul${++seq}`, userId: "sim", at, type, ...rest }) as GameEvent;

interface SoulRun {
  persona: Persona;
  firstReached: Partial<Record<SoulColor, number>>;
  final: SoulColor;
  revivals: number;
  weakenedDays: number;
  peakHp: number;
  rows: string[];
}

function simulateSoul(p: Persona, weeks = WEEKS): SoulRun {
  let s = applyEvent(initialState(), mk("CultivatorCreated", T0, { name: "sim", tzOffsetMinutes: -180, oath: OATH_TEXT }));
  const apply = (e: GameEvent) => (s = applyEvent(s, e));
  const ids: string[] = [];
  const firstReached: Partial<Record<SoulColor, number>> = {};
  const rows: string[] = [];
  let weakenedDays = 0;
  let peakHp = 0;

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
      s = advanceTo(s, dayStart + 20 * HOUR);
      if (!resting()) {
        ids.forEach((id, i) => {
          if (p.fights === "undefeated" && s.soul.demons[id]?.defeated) return;
          apply(mk("SoulTaskLogged", dayStart + 20 * HOUR + i, { taskId: `${id}+` }));
        });
      }
    }

    if (p.relapseDays?.includes(dow) && ids.length > 0) {
      s = advanceTo(s, dayStart + 22 * HOUR);
      if (!resting()) {
        const id = ids[(w + dow) % ids.length] as string;
        apply(mk("SoulTaskLogged", dayStart + 22 * HOUR, { taskId: `${id}-` }));
      }
    }

    // Midnight: the engine evaluates the soul color here.
    s = advanceTo(s, dayStart + DAY);
    const color = s.soul.color;
    firstReached[color] ??= (d + 1) / 7;
    if (isWeakening(color)) weakenedDays += 1;
    const hps = Object.values(s.soul.demons).map((dm) => dm.hp);
    const top = hps.length ? Math.max(...hps) : 0;
    peakHp = Math.max(peakHp, top);
    const { created, defeated } = demonCounts(s.soul);
    rows.push([d + 1, color, created, defeated, top.toFixed(2), s.rest ? 1 : 0].join(","));
  }

  const revivals = Object.values(s.soul.demons).reduce((n, dm) => n + dm.revivals, 0);
  return { persona: p, firstReached, final: s.soul.color, revivals, weakenedDays, peakHp, rows };
}

export function runSoulScenarios(outDir: string): void {
  const shown: SoulColor[] = ["white", ...GROWTH_COLORS];
  console.log(`\nSoul: weeks to first reach each color (${WEEKS}-week horizon)\n`);
  console.log(["persona", ...shown, "final", "revivals", "weakened days", "peak HP"].join("\t"));
  for (const p of PERSONAS) {
    const r = simulateSoul(p);
    const slug = p.label.split(/[^a-z0-9]+/i).filter(Boolean).join("-").toLowerCase();
    writeFileSync(join(outDir, `soul-${slug}.csv`), ["day,color,demons,defeated,max_hp,resting", ...r.rows].join("\n"));
    console.log(
      [
        p.label,
        ...shown.map((c) => (r.firstReached[c] === undefined ? "—" : r.firstReached[c].toFixed(1))),
        r.final,
        r.revivals,
        r.weakenedDays,
        r.peakHp.toFixed(1),
      ].join("\t"),
    );
  }
  console.log(`\nColors, worst to best: ${SOUL_COLORS.join(" < ")}`);
}

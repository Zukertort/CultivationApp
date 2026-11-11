/**
 * Cadence report: the middle loop (design doc, Progression loops) asks for a
 * level, rank, tier or defeated demon at least every few weeks per active
 * path. This runs consistent cultivators for two years and measures, per
 * path, the gaps between those payoffs, plus when each layer is first
 * reached (the target cadence table).
 *
 * - Main: level-ups and breakthroughs (the realm simulator's honest
 *   tribulation plan: one Foundation tribulation at a time, Core Formation
 *   and Nascent Soul sets).
 * - Body: companion promotions. Skill ranks are the cultivator's own
 *   milestones, not produced by the rules, so they're left out.
 * - Soul: demon defeats. A new demon every 4 weeks up to 7; each practice
 *   session hits the demon with the most HP ("spread"), or the undefeated one
 *   closest to defeat ("focus").
 * - Golden tickets are reported apart: past Lion they are Body's payoff.
 *
 * Output: two tables on stdout and CSV in tools/sim/out/.
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { OATH_TEXT } from "@cultivation/schema";
import { DAY, type CultivatorState, type Realm, type Tier } from "@cultivation/rules";
import { Cultivator, T0, study, tribulationPlan, version, weeklyProject, type Income } from "./realm.js";

const DAYS = 2 * 364;
const WEEK_DAYS = 7;

interface Persona {
  label: string;
  income: Income;
  /** Weekdays (0 = Monday) with a gym routine and with a soul practice session. */
  gym: number[];
  soul: number[];
  /** Which demon a practice session hits: the one with the most HP, or the undefeated one closest to defeat. */
  focus?: boolean;
  /** Each practice session is a soul quest hitting every demon at once (ruling 14). */
  quests?: boolean;
}

const PERSONAS: Persona[] = [
  { label: "consistent: daily study, gym 3x and soul 3x a week", income: study, gym: [0, 2, 4], soul: [1, 3, 5] },
  { label: "minimum: daily study, gym 2x and soul 2x a week", income: study, gym: [1, 4], soul: [2, 6] },
  { label: "consistent, soul focused on one demon at a time", income: study, gym: [0, 2, 4], soul: [1, 3, 5], focus: true },
  { label: "daily soul practice (7x a week), spread", income: study, gym: [0, 2, 4], soul: [0, 1, 2, 3, 4, 5, 6] },
  { label: "soul quests: 3 sessions a week, each hitting every demon", income: study, gym: [0, 2, 4], soul: [1, 3, 5], quests: true },
  { label: "soul quests: 2 sessions a week, each hitting every demon", income: study, gym: [0, 2, 4], soul: [2, 6], quests: true },
  { label: "weekly project, gym 3x and soul 3x a week", income: weeklyProject, gym: [0, 2, 4], soul: [1, 3, 5] },
];

type Path = "main" | "body" | "soul";

function payoffs(s: CultivatorState): Record<Path, number[]> {
  return {
    main: s.progress.steps.filter((x) => x.kind === "level" || x.kind === "breakthrough").map((x) => x.at),
    body: s.tierHistory.filter((x) => x.reason === "promoted").map((x) => x.at),
    soul: s.soul.demonHistory.filter((x) => x.kind === "defeated").map((x) => x.at),
  };
}

/** Gaps in weeks: from the start to the first payoff, between payoffs, and from the last to the end. */
function gaps(times: number[], end: number): number[] {
  const points = [T0, ...times, end];
  return points.slice(1).map((t, i) => (t - points[i]!) / (WEEK_DAYS * DAY));
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  return s.length === 0 ? NaN : s[Math.floor(s.length / 2)]!;
}

function simulate(p: Persona) {
  const c = new Cultivator();
  c.now("CultivatorCreated", T0, { name: "sim", tzOffsetMinutes: -180, oath: OATH_TEXT });
  c.now("InterviewAnswered", T0, { interests: { main: "Mathematics", body: "Gym", soul: "Calm" } });
  const plan = tribulationPlan({});
  const demons: string[] = [];
  for (let day = 0; day < DAYS; day++) {
    if (day % 28 === 0 && demons.length < 7) {
      const id = `d${demons.length}`;
      if (c.now("HeartDemonCreated", c.at(day, 6), { demonId: id, name: `Demon ${id}`, positiveTasks: [{ taskId: `${id}+`, name: "Practice" }], negativeTasks: [] })) demons.push(id);
    }
    p.income(c, day);
    const v = version(day);
    if (day % 28 === 0) c.ev("BodyActivityDefined", c.at(day, 6), { activityId: `gym-${v}`, name: `Gym v${v}`, kind: "routine" });
    if (p.gym.includes(day % 7)) c.ev("BodyActivityLogged", c.at(day, 20), { activityId: `gym-${v}` });
    c.flush();
    if (p.quests && p.soul.includes(day % 7) && demons.length >= 2) {
      // One session against several demons is a soul quest: defined and completed at once (ruling 14).
      const questId = `sq${day}`;
      c.now("SoulQuestDefined", c.at(day, 21), { questId, name: "Practice", demonIds: [...demons] });
      c.now("SoulQuestCompleted", c.at(day, 21), { questId });
    } else if (p.soul.includes(day % 7) && demons.length > 0) {
      const hp = (id: string) => c.s.soul.demons[id]!.hp;
      const open = demons.filter((id) => !c.s.soul.demons[id]!.defeated);
      const target = p.focus && open.length > 0 ? [...open].sort((a, b) => hp(a) - hp(b))[0]! : [...demons].sort((a, b) => hp(b) - hp(a))[0]!;
      c.now("SoulTaskLogged", c.at(day, 21), { taskId: `${target}+` });
    }
    plan(c, day);
  }
  const end = T0 + DAYS * DAY;
  const s = c.s;
  const pay = payoffs(s);
  const firstAt = (t: number | undefined) => (t === undefined ? "—" : ((t - T0) / (WEEK_DAYS * DAY)).toFixed(1));
  const realmAt = (r: Realm) => firstAt(s.progress.steps.find((x) => x.kind === "breakthrough" && x.realm === r)?.at);
  const tierAt = (t: Tier) => firstAt(s.tierHistory.find((x) => x.to === t && x.reason === "promoted")?.at);
  const colorAt = (color: string) => firstAt(s.soul.colorHistory.find((x) => x.to === color)?.at);
  return {
    label: p.label,
    soul: s.soul.color,
    cadence: (["main", "body", "soul"] as Path[]).map((path) => {
      const g = gaps(pay[path], end);
      return { path, count: pay[path].length, median: median(g.slice(0, -1)), longest: Math.max(...g) };
    }),
    goldenTickets: s.goldenTickets,
    targets: {
      realms: (["foundation_establishment", "core_formation", "nascent_soul", "spirit_realm"] as Realm[]).map(realmAt),
      tiers: (["panda", "horse", "tiger", "lion"] as Tier[]).map(tierAt),
      colors: ["green", "blue", "red", "golden"].map(colorAt),
    },
  };
}

export function runCadenceScenarios(outDir: string): void {
  const runs = PERSONAS.map(simulate);
  const h1 = ["persona", "path", "payoffs in 2 years", "median gap (weeks)", "longest gap (weeks)", "note"];
  const rows1 = runs.flatMap((r) =>
    r.cadence.map((c) => [
      r.label,
      c.path,
      String(c.count),
      isNaN(c.median) ? "—" : c.median.toFixed(1),
      c.longest.toFixed(1),
      c.path === "body" ? `${r.goldenTickets} golden tickets` : c.path === "soul" ? `soul ended ${r.soul}` : "",
    ]),
  );
  console.log("\nCadence: the middle loop's payoffs per path over 2 years (level-ups, companion promotions, demon defeats)\n");
  console.log(h1.join("\t"));
  for (const r of rows1) console.log(r.join("\t"));
  const h2 = ["persona", "Foundation", "Core Formation", "Nascent Soul", "Spirit Realm", "Panda", "Horse", "Tiger", "Lion", "Green", "Blue", "Red", "Golden"];
  const rows2 = runs.map((r) => [r.label, ...r.targets.realms, ...r.targets.tiers, ...r.targets.colors]);
  console.log("\nTarget cadence: week each layer is first reached (— = not within 2 years)\n");
  console.log(h2.join("\t"));
  for (const r of rows2) console.log(r.join("\t"));
  const csv = (h: string[], rows: string[][]) => [h.join(","), ...rows.map((r) => r.map((x) => `"${x}"`).join(","))].join("\n");
  writeFileSync(join(outDir, "cadence.csv"), csv(h1, rows1));
  writeFileSync(join(outDir, "cadence-targets.csv"), csv(h2, rows2));
}

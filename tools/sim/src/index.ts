/**
 * Food-economy simulator. Runs synthetic cultivators through the real rules
 * engine (no reimplementation) and reports how long each tier takes to reach,
 * whether each tier holds at its target cadence, and what repetition decay
 * does to a cultivator who never varies their routine.
 *
 * Output: a summary on stdout and weekly CSV rows in tools/sim/out/.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { OATH_TEXT, type GameEvent } from "@cultivation/schema";
import { DAY, RULES_V1, TIERS, WEEK, advanceTo, applyEvent, initialState, type CultivatorState, type Tier } from "@cultivation/rules";

const T0 = Date.UTC(2026, 10, 2, 3); // Monday 00:00 in Buenos Aires
const TRAINING_HOUR = 19 * 60 * 60 * 1000;
const WEEKS = 52;

/** Training days spread across the week for a given cadence. */
const SCHEDULES: Record<number, number[]> = {
  0: [],
  1: [2],
  2: [1, 4],
  3: [0, 2, 4],
  4: [0, 1, 3, 5],
  5: [0, 1, 2, 3, 4],
};

type Variety = "varied" | "same";

interface Run {
  label: string;
  firstReached: Partial<Record<Tier, number>>;
  rows: string[];
  final: CultivatorState;
  demotions: number;
}

let seq = 0;
const mk = (type: GameEvent["type"], at: number, rest: object): GameEvent =>
  ({ id: `s${++seq}`, userId: "sim", at, type, ...rest }) as GameEvent;

/**
 * variety "varied": the cultivator makes a new named version after every 3
 * completions, so repetition decay never bites (best case).
 * variety "same": one routine forever (worst case).
 */
function simulate(perWeek: number, variety: Variety, start: Tier = "turtle", weeks = WEEKS): Run {
  let s = applyEvent(initialState(), mk("CultivatorCreated", T0, { name: "sim", tzOffsetMinutes: -180, oath: OATH_TEXT }));
  if (start !== "turtle") {
    s = { ...s, companion: { ...s.companion, tier: start, food: RULES_V1.tiers[start].capacity * RULES_V1.tierStartFraction } };
  }
  let version = 0;
  let uses = 0;
  const define = (at: number) => {
    version += 1;
    uses = 0;
    s = applyEvent(s, mk("BodyActivityDefined", at, { activityId: `routine-${version}`, name: `Routine ${version}`, kind: "routine" }));
  };
  define(T0);

  const firstReached: Partial<Record<Tier, number>> = { [start]: 0 };
  const rows: string[] = [];
  for (let w = 0; w < weeks; w++) {
    for (const d of SCHEDULES[perWeek] ?? []) {
      const at = T0 + w * WEEK + d * DAY + TRAINING_HOUR;
      if (variety === "varied" && uses >= RULES_V1.repetition.fullValueCompletions) define(at - 1);
      s = applyEvent(s, mk("BodyActivityLogged", at, { activityId: `routine-${version}` }));
      uses += 1;
      firstReached[s.companion.tier] ??= (at - T0) / WEEK;
    }
    s = advanceTo(s, T0 + (w + 1) * WEEK);
    firstReached[s.companion.tier] ??= w + 1;
    rows.push([w + 1, s.companion.tier, s.companion.food.toFixed(1), s.gold.toFixed(1), s.goldenTickets].join(","));
  }
  return {
    label: `${perWeek}/week ${variety} from ${start}`,
    firstReached,
    rows,
    final: s,
    demotions: s.tierHistory.filter((c) => c.reason === "demoted").length,
  };
}

function fmtWeeks(w: number | undefined): string {
  return w === undefined ? "—" : w.toFixed(1);
}

const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "out");
mkdirSync(outDir, { recursive: true });

// 1. Climb: how long from a new Turtle to each tier.
console.log(`\nClimb from a new Turtle (weeks to first reach each tier, ${WEEKS}-week horizon)\n`);
console.log(["cadence", "variety", ...TIERS, "final tier", "demotions", "golden tickets", "gold"].join("\t"));
for (const variety of ["varied", "same"] as const) {
  for (const perWeek of [1, 2, 3, 4, 5]) {
    const r = simulate(perWeek, variety);
    writeFileSync(join(outDir, `climb-${perWeek}pw-${variety}.csv`), ["week,tier,food,gold,golden_tickets", ...r.rows].join("\n"));
    console.log(
      [`${perWeek}/wk`, variety, ...TIERS.map((t) => fmtWeeks(r.firstReached[t])), r.final.companion.tier, r.demotions, r.final.goldenTickets, r.final.gold.toFixed(0)].join("\t"),
    );
  }
}

// 2. Maintenance: start each tier at 50% and train at a fixed cadence for 12 weeks.
console.log(`\nHold test: start at 50% of each tier, 12 weeks, varied routines (tier after 12 weeks)\n`);
console.log(["start", ...[0, 1, 2, 3, 4].map((k) => `${k}/wk`)].join("\t"));
for (const tier of TIERS) {
  const cells = [0, 1, 2, 3, 4].map((k) => {
    const r = simulate(k, "varied", tier, 12);
    const end = r.final.companion.tier;
    const di = TIERS.indexOf(end) - TIERS.indexOf(tier);
    return di === 0 ? "holds" : di > 0 ? `up→${end}` : `down→${end}`;
  });
  console.log([tier, ...cells].join("\t"));
}
console.log(`\nCSV written to ${outDir}`);

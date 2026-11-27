/**
 * Realm simulator (Main part 3): how long honest cultivators take through
 * the Step 1 realms and levels with the provisional Qi thresholds, how long
 * they wait for Qi, what a failure takes, and what repent cycling costs
 * (rulings 62, 73-109).
 *
 * The personas' income and tribulation habits live in @cultivation/scenarios
 * (shared with the app's dev scenarios); each persona also trains twice a
 * week and practices Soul twice a week.
 *
 * Output: a summary on stdout and a CSV row per persona in tools/sim/out/.
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { DAY, conqueredTribulations, realmStatus, type Realm } from "@cultivation/rules";
import { Cultivator, T0, both, routineDay, setupBasic, study, tribulationPlan, weeklyMilestones, weeklyProject, type Habits, type Income } from "@cultivation/scenarios";

const YEARS = 4;
const DAYS = YEARS * 364;
const MONTH = 365.25 / 12;

// ---- Personas ---------------------------------------------------------------

interface Persona {
  label: string;
  income: Income;
  habits: Habits;
}

const PERSONAS: Persona[] = [
  { label: "honest studier (~276 Qi/mo)", income: study, habits: {} },
  { label: "weekly project (~541 Qi/mo)", income: weeklyProject, habits: {} },
  { label: "study + weekly project (~817 Qi/mo)", income: both, habits: {} },
  { label: "studier who fails every tribulation once", income: study, habits: { failFirst: true } },
  { label: "studier who switches foundation at mid", income: study, habits: { switchMidFoundation: true } },
  { label: "studier on the fast track", income: study, habits: { fastTrack: true } },
  { label: "reference: weekly hard milestones (ruling 62)", income: weeklyMilestones, habits: {} },
  { label: "eager studier: tribulations as fast as allowed", income: study, habits: { eager: true } },
  { label: "eager weekly project", income: weeklyProject, habits: { eager: true } },
  { label: "eager study + weekly project", income: both, habits: { eager: true } },
  { label: "eager reference: weekly hard milestones", income: weeklyMilestones, habits: { eager: true } },
  { label: "repent cycler: eager reference, repents at every Nascent Soul entry", income: weeklyMilestones, habits: { eager: true, repentCycle: true } },
  { label: "eternal student: eager reference, changes discipline at every Nascent Soul entry", income: weeklyMilestones, habits: { eager: true, changeDiscipline: true } },
  { label: "eternal student, honest pace: studier, changes discipline at every Nascent Soul entry", income: study, habits: { changeDiscipline: true } },
];

const REALM_ORDER: Realm[] = ["foundation_establishment", "core_formation", "nascent_soul", "spirit_realm"];

function simulate(p: Persona) {
  const c = new Cultivator();
  setupBasic(c);
  const plan = tribulationPlan(p.habits);
  let day = 0;
  for (; day < DAYS && c.s.main.realm !== "spirit_realm"; day++) {
    routineDay(c, { income: p.income }, day);
    plan(c, day);
    // Claims awaiting completion: waiting for the Qi to complete them (ruling 169).
    if ((realmStatus(c.s).tribulations?.awaiting ?? 0) > 0) c.waitingDays += 1;
  }
  const steps = c.s.progress.steps;
  const monthOf = (realm: Realm) => {
    const step = steps.find((x) => x.kind !== "restart" && x.realm === realm && x.level !== "mid" && x.level !== "late" && x.level !== "great_circle");
    return step ? ((step.at - T0) / DAY / MONTH).toFixed(1) : "—";
  };
  return {
    label: p.label,
    reached: REALM_ORDER.map(monthOf),
    end: `${c.s.main.realm}${c.s.progress.level ? ` ${c.s.progress.level}` : ""}`,
    waitingMonths: (c.waitingDays / MONTH).toFixed(1),
    qiSpent: c.s.tribulations.completionQi,
    failures: c.s.tribulations.spent.failures.count,
    failureQi: c.s.tribulations.spent.failures.qi,
    largestFailure: c.s.tribulations.largestFailureQi,
    tribulationRolls: c.s.tribulations.drops.none + c.s.tribulations.drops.gain_potion + c.s.tribulations.drops.legendary_potion,
    legendaryRolls: c.s.progress.legendaryRolls.none + c.s.progress.legendaryRolls.legendary,
    legendaryItems: c.s.progress.legendaryRolls.legendary,
    expectedPerYear: c.expectedLegendary / (day / 364),
    conquered: conqueredTribulations(c.s).length,
    repents: Object.values(c.s.progress.repents).reduce((a, b) => a + b, 0),
    deaths: c.s.progress.deaths,
    cyclingFlags: c.s.main.flags.filter((f) => f.code === "repent_cycling").length,
  };
}

export function runRealmScenarios(outDir: string): void {
  const header = [
    "persona",
    "Foundation (month)",
    "Core Formation",
    "Nascent Soul",
    "Spirit Realm",
    `end (${YEARS} years max)`,
    "months with a claim awaiting completion",
    "Qi spent completing tribulations",
    "failures",
    "Qi lost to failures",
    "largest single failure",
    "tribulation item rolls",
    "legendary rolls",
    "legendary items",
    "expected legendary items/yr",
    "conquered tribulations",
    "repents",
    "deaths",
    "cycling flags",
  ];
  const rows = PERSONAS.map(simulate).map((r) => [
    r.label,
    ...r.reached,
    r.end,
    r.waitingMonths,
    String(Math.round(r.qiSpent)),
    String(r.failures),
    String(Math.round(r.failureQi)),
    String(Math.round(r.largestFailure)),
    String(r.tribulationRolls),
    String(r.legendaryRolls),
    String(r.legendaryItems),
    r.expectedPerYear.toFixed(2),
    String(r.conquered),
    String(r.repents),
    String(r.deaths),
    String(r.cyclingFlags),
  ]);
  console.log(`\nRealms: month each realm was reached, Qi waits and failure losses (up to ${YEARS} years)\n`);
  console.log(header.join("\t"));
  for (const r of rows) console.log(r.join("\t"));
  writeFileSync(join(outDir, "realms.csv"), [header.join(","), ...rows.map((r) => r.map((x) => `"${x}"`).join(","))].join("\n"));
}

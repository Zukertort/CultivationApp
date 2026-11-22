/**
 * Gear report (Roadmap part 2, rulings 137-145): what durability costs each
 * persona, what armor saves on failures, and what a weapon adds.
 *
 * Every persona runs a year through the real engine (via @cultivation/scenarios
 * habits). Gear policies:
 * - "robe only": wears the free robes, repairs an item once it reaches the
 *   95% warning (if the gold allows).
 * - "no gear": takes the robe off, so failures take the full loss.
 * - "buys shop gear": also buys the current realm's shop armor and weapon
 *   when the gold allows (keeping 50 gold back), wears them, repairs at 95%.
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { RULES_V1, TIERS, shopPrice, stash, repairPrice, wornItem, type GearRealm } from "@cultivation/rules";
import { Cultivator, routineDay, setupBasic, study, tribulationPlan, type Habits, type Routine } from "@cultivation/scenarios";

const DAYS = 365;
const MONTH_DAYS = 365 / 12;
const RESERVE = 50;

type Policy = "robe only" | "no gear" | "buys shop gear";

interface Persona {
  label: string;
  routine: Routine;
  habits: Habits;
}

const PERSONAS: Persona[] = [
  { label: "beginner: studier, never trains (Turtle)", routine: { income: study, gym: [] }, habits: {} },
  { label: "beginner who fails each tribulation once (Turtle)", routine: { income: study, gym: [] }, habits: { failFirst: true } },
  { label: "studier, gym 2x a week", routine: { income: study }, habits: {} },
  { label: "physical practice: studier, gym 5x a week", routine: { income: study, gym: [0, 1, 2, 3, 4] }, habits: {} },
];

const isGearRealm = (r: string): r is GearRealm => r !== "qi_condensation";

function gearDay(c: Cultivator, day: number, policy: Policy): void {
  const at = c.at(day, 23);
  if (policy === "no gear") {
    if (wornItem(c.s, "armor")) c.now("GearUnequipped", at, { slot: "armor" });
    return;
  }
  // Repair at the warning line, worn items first.
  for (const slot of ["armor", "weapon"] as const) {
    const item = wornItem(c.s, slot);
    if (item && item.damageBp >= RULES_V1.gear.warnAtBp && c.s.gold >= repairPrice(item)) c.now("GearRepaired", at, { itemId: item.id });
  }
  if (policy !== "buys shop gear") return;
  const realm = c.s.main.realm;
  if (!isGearRealm(realm)) return;
  for (const slot of ["weapon", "armor"] as const) {
    const worn = wornItem(c.s, slot);
    if (worn?.kind === "shop" && worn.realm === realm) continue;
    if (c.s.gold < shopPrice(slot, realm) + RESERVE) continue;
    c.now("GearBought", at, { slot });
    const bought = stash(c.s).find((i) => i.kind === "shop" && i.slot === slot && i.realm === realm);
    if (bought) c.now("GearEquipped", at, { itemId: bought.id });
  }
}

interface Result {
  label: string;
  policy: Policy;
  tierAtEnd: string;
  goldPerMonth: number;
  repairPerMonth: number;
  repairShare: number;
  broken: number;
  boughtGold: number;
  failures: number;
  failureQi: number;
  failureGold: number;
  qiEarned: number;
  realm: string;
}

function simulate(p: Persona, policy: Policy): Result {
  const c = new Cultivator({ idPrefix: "gear", rollAll: true, trackGold: true });
  setupBasic(c);
  const plan = tribulationPlan(p.habits);
  for (let d = 0; d < DAYS; d++) {
    routineDay(c, p.routine, d);
    plan(c, d);
    gearDay(c, d, policy);
  }
  const s = c.s;
  const spentOnSteps = s.progress.steps.reduce((a, x) => a + x.qiSpent, 0);
  return {
    label: p.label,
    policy,
    tierAtEnd: s.companion.tier,
    goldPerMonth: c.goldEarned / (DAYS / MONTH_DAYS),
    repairPerMonth: s.gear.gold.repaired / (DAYS / MONTH_DAYS),
    repairShare: c.goldEarned > 0 ? s.gear.gold.repaired / c.goldEarned : 0,
    broken: s.gear.lost.filter((l) => l.reason === "broken").length,
    boughtGold: s.gear.gold.bought,
    failures: Object.values(s.tribulations.items).reduce((a, t) => a + t.failures, 0),
    failureQi: s.tribulations.spent.failures.qi,
    failureGold: s.tribulations.spent.failures.gold,
    // Qi held plus Qi spent on steps and failures: what the year earned.
    qiEarned: s.qi + spentOnSteps + s.tribulations.spent.failures.qi + s.tribulations.spent.edits.qi + s.tribulations.spent.deletions.qi,
    realm: `${s.main.realm} ${s.progress.level ?? ""}`.trim(),
  };
}

export function runGearScenarios(outDir: string): void {
  console.log("\nGear: days until a worn item breaks from the companion alone (one item worn; two share the damage)\n");
  console.log(["tier", "damage/day", "days to 95% warning", "days to break"].join("\t"));
  for (const t of TIERS) {
    const bp = RULES_V1.gear.companionDamageBp[t];
    console.log([t, `${bp / 100}%`, bp > 0 ? Math.ceil(RULES_V1.gear.warnAtBp / bp) : "never", bp > 0 ? Math.ceil(10_000 / bp) : "never"].join("\t"));
  }

  const header = [
    "persona",
    "policy",
    "tier at end",
    "realm at end",
    "gold earned/mo",
    "repairs gold/mo",
    "repairs % of income",
    "items broken",
    "gear bought (gold)",
    "failures",
    "failure Qi lost",
    "failure gold lost",
    "Qi earned in the year",
  ];
  const results = PERSONAS.flatMap((p) => (["robe only", "no gear", "buys shop gear"] as const).map((policy) => simulate(p, policy)));
  const rows = results.map((r) => [
    r.label,
    r.policy,
    r.tierAtEnd,
    r.realm,
    r.goldPerMonth.toFixed(0),
    r.repairPerMonth.toFixed(1),
    `${(r.repairShare * 100).toFixed(1)}%`,
    String(r.broken),
    r.boughtGold.toFixed(0),
    String(r.failures),
    r.failureQi.toFixed(0),
    r.failureGold.toFixed(0),
    r.qiEarned.toFixed(0),
  ]);
  console.log(`\nGear: durability, armor and weapons over ${DAYS} days (repairs at the 95% warning)\n`);
  console.log(header.join("\t"));
  for (const r of rows) console.log(r.join("\t"));
  writeFileSync(join(outDir, "gear.csv"), [header.join(","), ...rows.map((r) => r.map((x) => `"${x}"`).join(","))].join("\n"));
}

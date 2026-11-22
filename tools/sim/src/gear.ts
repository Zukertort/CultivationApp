/**
 * Gear report (Roadmap part 2, rulings 137-158): what durability costs each
 * persona (armor and weapon apart), what armor saves on failures, what a
 * weapon adds, and a goblin looking for arbitrage.
 *
 * Every persona runs a year through the real engine (via @cultivation/scenarios
 * habits). Gear policies:
 * - "robe only": wears the free robes; each morning (05:00, before the day's
 *   events) repairs the armor at the 95% warning, or when the before-deadline
 *   warning shows (80% with a tribulation due within 72 hours), if the gold
 *   allows.
 * - "no gear": takes the robe off, so failures take the full loss and the
 *   companion takes Qi and gold every day instead of damaging armor (ruling 154).
 * - "buys shop gear": also buys the current realm's shop armor and weapon
 *   when the gold allows (keeping 50 gold back), wears them, and repairs
 *   both the same way (the weapon at 95%).
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { GEAR_REALMS, RULES_V1, TIERS, advanceTo, armorAtRisk, repairPrice, sellPrice, shopPrice, stash, wornItem, type CultivatorState, type GearItem, type GearRealm } from "@cultivation/rules";
import { Cultivator, routineDay, setupBasic, study, tribulationPlan, type Habits, type Routine } from "@cultivation/scenarios";

const DAYS = 365;
const MONTH_DAYS = 365 / 12;
const MONTHS = DAYS / MONTH_DAYS;
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

interface Spend {
  armorRepairs: number;
  weaponRepairs: number;
}

function repairIf(c: Cultivator, now: CultivatorState, item: GearItem | null, at: number, when: boolean, spend: Spend): void {
  if (!item || !when || item.damageBp <= 0) return;
  const price = repairPrice(item);
  if (now.gold < price) return;
  c.now("GearRepaired", at, { itemId: item.id });
  if (item.slot === "armor") spend.armorRepairs += price;
  else spend.weaponRepairs += price;
}

function gearDay(c: Cultivator, day: number, policy: Policy, spend: Spend): void {
  const at = c.at(day, 5);
  if (policy === "no gear") {
    if (wornItem(c.s, "armor")) c.now("GearUnequipped", at, { slot: "armor" });
    return;
  }
  // Decide on the state as it stands this morning: last night's damage applied.
  const warn = RULES_V1.gear.warnAtBp;
  let now = advanceTo(c.s, at);
  const armor = wornItem(now, "armor");
  repairIf(c, now, armor, at, (armor?.damageBp ?? 0) >= warn || armorAtRisk(now) !== null, spend);
  now = advanceTo(c.s, at);
  const weapon = wornItem(now, "weapon");
  repairIf(c, now, weapon, at, (weapon?.damageBp ?? 0) >= warn, spend);
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
  armorRepairPerMonth: number;
  weaponRepairPerMonth: number;
  repairShare: number;
  broken: number;
  boughtGold: number;
  failures: number;
  failureQi: number;
  failureGold: number;
  failureDebt: string;
  unarmoredQi: number;
  unarmoredGold: number;
  qiEarned: number;
  realm: string;
}

function simulate(p: Persona, policy: Policy): Result {
  const c = new Cultivator({ idPrefix: "gear", rollAll: true, trackGold: true });
  setupBasic(c);
  const plan = tribulationPlan(p.habits);
  const spend: Spend = { armorRepairs: 0, weaponRepairs: 0 };
  for (let d = 0; d < DAYS; d++) {
    gearDay(c, d, policy, spend);
    routineDay(c, p.routine, d);
    plan(c, d);
  }
  const s = c.s;
  const spentOnSteps = s.progress.steps.reduce((a, x) => a + x.qiSpent, 0);
  const debt = s.tribulations.spent.debt;
  return {
    label: p.label,
    policy,
    tierAtEnd: s.companion.tier,
    goldPerMonth: c.goldEarned / MONTHS,
    armorRepairPerMonth: spend.armorRepairs / MONTHS,
    weaponRepairPerMonth: spend.weaponRepairs / MONTHS,
    repairShare: c.goldEarned > 0 ? (spend.armorRepairs + spend.weaponRepairs) / c.goldEarned : 0,
    broken: s.gear.lost.filter((l) => l.reason === "broken").length,
    boughtGold: s.gear.gold.bought,
    failures: Object.values(s.tribulations.items).reduce((a, t) => a + t.failures, 0),
    failureQi: s.tribulations.spent.failures.qi,
    failureGold: s.tribulations.spent.failures.gold,
    failureDebt: `${debt.qi.toFixed(0)} Qi / ${debt.gold.toFixed(0)} gold`,
    unarmoredQi: s.gear.unarmored.qi,
    unarmoredGold: s.gear.unarmored.gold,
    // Qi held plus Qi spent on steps and failures: what the year earned.
    qiEarned: s.qi + spentOnSteps + s.tribulations.spent.failures.qi + s.tribulations.spent.edits.qi + s.tribulations.spent.deletions.qi,
    realm: `${s.main.realm} ${s.progress.level ?? ""}`.trim(),
  };
}

// ---- The goblin -----------------------------------------------------------------

type Goblin = "honest" | "sells free robes" | "sells free robes, buys one back" | "goes without armor" | "buy-to-sell loop" | "robe buy-to-sell loop" | "repair then sell";

/**
 * A studier (gym 2x a week) looking for arbitrage in gear. "honest" wears the
 * robes and repairs at 95%. "sells free robes" takes each new robe off,
 * sells it and goes without armor; "sells free robes, buys one back" sells
 * each free robe and buys the realm's robe from the shop to wear (ruling
 * 157). "goes without armor" never wears any. "robe buy-to-sell loop" buys
 * the realm's robe every day it can and sells it straight back. "buy-to-sell loop" buys the realm's shop armor and weapon
 * every day it can and sells them straight back. "repair then sell" buys the
 * shop weapon, wears it until half worn, repairs it, sells it and buys a new
 * one (testing whether a repair adds more sell value than it costs).
 */
function goblin(strategy: Goblin): { gold: number; qi: number; netGearGold: number; robesSold: number; rejected: number; loops: number } {
  const c = new Cultivator({ idPrefix: `gob-${strategy}`, rollAll: true, trackGold: true });
  setupBasic(c);
  const plan = tribulationPlan({});
  const spend: Spend = { armorRepairs: 0, weaponRepairs: 0 };
  let robesSold = 0;
  let rejected = 0;
  let loops = 0;
  for (let d = 0; d < DAYS; d++) {
    if (strategy === "goes without armor" || strategy === "sells free robes") gearDay(c, d, "no gear", spend);
    else gearDay(c, d, "robe only", spend);
    routineDay(c, { income: study }, d);
    plan(c, d);
    const at = c.at(d, 23);
    const realm = c.s.main.realm;
    if (strategy === "sells free robes" || strategy === "sells free robes, buys one back") {
      for (const robe of Object.values(c.s.gear.items).filter((i) => i.id.startsWith("robe:"))) {
        if (c.s.gear.worn.armor === robe.id) c.now("GearUnequipped", at, { slot: "armor" });
        if (c.now("GearSold", at, { itemId: robe.id })) robesSold += 1;
        else rejected += 1;
      }
    }
    if (!isGearRealm(realm)) continue;
    if (strategy === "sells free robes, buys one back" && !wornItem(c.s, "armor") && c.s.gold >= shopPrice("armor", realm, RULES_V1, "robe")) {
      c.now("GearBought", at, { slot: "armor", kind: "robe" });
    }
    if (strategy === "robe buy-to-sell loop" && c.s.gold >= shopPrice("armor", realm, RULES_V1, "robe")) {
      const before = new Set(Object.keys(c.s.gear.items));
      c.now("GearBought", at, { slot: "armor", kind: "robe" });
      const bought = Object.values(c.s.gear.items).find((i) => !before.has(i.id));
      if (bought) {
        if (c.s.gear.worn.armor === bought.id) c.now("GearUnequipped", at, { slot: "armor" });
        if (c.now("GearSold", at, { itemId: bought.id })) loops += 1;
      }
    }
    if (strategy === "buy-to-sell loop") {
      for (const slot of ["armor", "weapon"] as const) {
        if (c.s.gold < shopPrice(slot, realm)) continue;
        c.now("GearBought", at, { slot });
        const bought = stash(c.s).find((i) => i.kind === "shop" && i.slot === slot) ?? wornItem(c.s, slot);
        if (!bought) continue;
        if (c.s.gear.worn[slot] === bought.id) c.now("GearUnequipped", at, { slot });
        if (c.now("GearSold", at, { itemId: bought.id })) loops += 1;
      }
    }
    if (strategy === "repair then sell") {
      const w = wornItem(c.s, "weapon");
      if (w && w.damageBp >= 5000 && c.s.gold >= repairPrice(w)) {
        c.now("GearRepaired", at, { itemId: w.id });
        c.now("GearUnequipped", at, { slot: "weapon" });
        if (c.now("GearSold", at, { itemId: w.id })) loops += 1;
      }
      if (!wornItem(c.s, "weapon") && c.s.gold >= shopPrice("weapon", realm) + RESERVE) c.now("GearBought", at, { slot: "weapon" });
    }
  }
  const g = c.s.gear.gold;
  return { gold: c.s.gold, qi: c.s.qi, netGearGold: g.sold - g.bought - g.repaired, robesSold, rejected, loops };
}

export function runGearScenarios(outDir: string): void {
  console.log("\nGear: days until the worn armor breaks from the companion alone (every armor worn that day is hit; the weapon isn't)\n");
  console.log(["tier", "damage/day", "days to 95% warning", "days to break"].join("\t"));
  for (const t of TIERS) {
    const bp = RULES_V1.gear.companionDamageBp[t];
    console.log([t, `${bp / 100}%`, bp > 0 ? Math.ceil(RULES_V1.gear.warnAtBp / bp) : "never", bp > 0 ? Math.ceil(10_000 / bp) : "never"].join("\t"));
  }
  const wear = RULES_V1.gear.weaponWearBp;
  console.log(`\nWeapon wear per boosted gain: quick ${wear.quick / 100}%, session ${wear.session / 100}%, day ${wear.day / 100}%, project ${wear.project / 100}%, other Qi gains ${wear.other / 100}%`);

  const header = [
    "persona",
    "policy",
    "tier at end",
    "realm at end",
    "gold earned/mo",
    "armor repairs gold/mo",
    "weapon repairs gold/mo",
    "repairs % of income",
    "items broken",
    "gear bought (gold)",
    "failures",
    "failure Qi lost",
    "failure gold lost",
    "failure debt left",
    "unarmored loss Qi",
    "unarmored loss gold",
    "Qi earned in the year",
  ];
  const results = PERSONAS.flatMap((p) => (["robe only", "no gear", "buys shop gear"] as const).map((policy) => simulate(p, policy)));
  const rows = results.map((r) => [
    r.label,
    r.policy,
    r.tierAtEnd,
    r.realm,
    r.goldPerMonth.toFixed(0),
    r.armorRepairPerMonth.toFixed(1),
    r.weaponRepairPerMonth.toFixed(1),
    `${(r.repairShare * 100).toFixed(1)}%`,
    String(r.broken),
    r.boughtGold.toFixed(0),
    String(r.failures),
    r.failureQi.toFixed(0),
    r.failureGold.toFixed(0),
    r.failureDebt,
    r.unarmoredQi.toFixed(0),
    r.unarmoredGold.toFixed(0),
    r.qiEarned.toFixed(0),
  ]);
  console.log(`\nGear: durability, armor and weapons over ${DAYS} days (repairs at the 95% warning or the before-deadline warning)\n`);
  console.log(header.join("\t"));
  for (const r of rows) console.log(r.join("\t"));
  writeFileSync(join(outDir, "gear.csv"), [header.join(","), ...rows.map((r) => r.map((x) => `"${x}"`).join(","))].join("\n"));

  // Loops: can any buyable item be sold for more than it cost, even repaired? And does repairing before selling pay?
  console.log("\nGoblin check, per item: best sale minus buy price (negative = no loop), and a full repair's price vs the sell value it restores\n");
  console.log(["realm", "slot", "kind", "buy", "sell new", "sell - buy", "repair before selling: restored - cost"].join("\t"));
  for (const realm of GEAR_REALMS) {
    for (const slot of ["armor", "weapon"] as const) {
      for (const kind of ["robe", "shop", "legendary"] as const) {
        if (slot === "weapon" && kind === "robe") continue;
        const item: GearItem = { id: "x", slot, kind, realm, damageBp: 10_000, obtainedAt: 0 };
        const fresh = sellPrice({ ...item, damageBp: 0 });
        const buy = kind === "legendary" ? null : shopPrice(slot, realm, RULES_V1, kind);
        const restored = fresh - sellPrice(item);
        console.log([realm, slot, kind, buy ?? "drop", fresh.toFixed(1), buy === null ? "-" : (fresh - buy).toFixed(1), (restored - repairPrice(item)).toFixed(1)].join("\t"));
      }
    }
  }

  console.log(`\nGoblin: a studier (gym 2x a week) hunting arbitrage over ${DAYS} days\n`);
  const honest = goblin("honest");
  console.log(["strategy", "gold at end", "gold vs honest", "Qi at end", "Qi vs honest", "net gold on gear (sold - bought - repaired)", "robes sold", "sales rejected", "loops"].join("\t"));
  for (const strategy of ["honest", "sells free robes", "sells free robes, buys one back", "goes without armor", "buy-to-sell loop", "robe buy-to-sell loop", "repair then sell"] as const) {
    const g = strategy === "honest" ? honest : goblin(strategy);
    console.log([strategy, g.gold.toFixed(0), (g.gold - honest.gold).toFixed(0), g.qi.toFixed(0), (g.qi - honest.qi).toFixed(0), g.netGearGold.toFixed(0), g.robesSold, g.rejected, g.loops].join("\t"));
  }
}

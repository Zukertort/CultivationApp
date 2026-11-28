/**
 * Legendary items simulator (Roadmap part 4; rulings 176-180).
 *
 * 1. Legendary items per year per persona, by source (level-ups and
 *    breakthroughs, the Unique class roll, the roulette, Rainbow soul drops),
 *    the hits the 365-day cap turned into gold, and what selling every
 *    legendary would add to the persona's gold income.
 * 2. The stat ladder per realm, with values, sale prices and repairs.
 * 3. The goblin: sells every legendary on receipt, repairs before selling,
 *    and a repent cycler who sells its breakthrough legendaries before
 *    repenting (the gold is kept, ruling 179).
 * 4. Monk vs Body and Soul classes: what a class wearable is worth in days
 *    of income (worn vs never worn, same seeds), and the Unique legendary
 *    chance that matches it (rulings 120, 178).
 *
 * Every persona runs through @cultivation/scenarios with every roll made, as
 * the server will (rollAll); spins every golden ticket at once; and wears
 * class wearables as soon as they're held.
 *
 * Output: a summary on stdout and CSV in tools/sim/out/.
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { TRIBULATION_OATH, type ClassId } from "@cultivation/schema";
import {
  DAY,
  GEAR_REALMS,
  RULES_V1,
  itemValue,
  legendaryItems,
  repairPrice,
  rouletteOutcome,
  rouletteSlot,
  sellPrice,
  type CultivatorState,
  type GearItem,
  type LegendarySource,
} from "@cultivation/rules";
import { Cultivator, rng, routineDay, setupBasic, study, tribulationPlan, weeklyMilestones, type Habits, type Income } from "@cultivation/scenarios";

const YEARS = 4;
const DAYS = YEARS * 364;
const SOURCES: LegendarySource[] = ["step", "class", "roulette", "soul"];

// ---- Shared habits ------------------------------------------------------------

/** Spin every golden ticket now (the server rolls the prize and, for a legendary, its slot). */
function spinAll(c: Cultivator, at: number, roll: () => number): void {
  for (let guard = 0; guard < 10 && c.s.goldenTickets > 0; guard++) {
    const u = roll();
    const slot = rouletteSlot(u);
    if (!c.now("RouletteSpun", at, { prize: rouletteOutcome(u), ...(slot ? { slot } : {}) })) return;
  }
}

/** Wear every held class wearable: legendary ones first, a soul wearable on the strongest unfrozen demon. */
function wearAll(c: Cultivator, at: number): void {
  const inv = () => c.s.inventory;
  for (const legendary of [true, false]) {
    const soul = legendary ? inv().legendarySoulWearables : inv().soulWearables;
    for (let k = 0; k < soul; k++) {
      const target = Object.entries(c.s.soul.demons)
        .filter(([, d]) => d.frozenUntil === null || d.frozenUntil <= at)
        .sort((a, b) => b[1].hp - a[1].hp)[0];
      if (!target || !c.now("WearableUsed", at, { wearable: "soul", demonId: target[0], ...(legendary ? { legendary } : {}) })) break;
    }
    const halo = legendary ? inv().legendaryPetHaloWearables : inv().petHaloWearables;
    for (let k = 0; k < halo; k++) c.now("WearableUsed", at, { wearable: "pet_halo", ...(legendary ? { legendary } : {}) });
    if ((legendary ? inv().legendaryPetKeepWearables : inv().petKeepWearables) > 0) c.now("WearableUsed", at, { wearable: "pet_keep", ...(legendary ? { legendary } : {}) });
  }
}

/** Soul sessions as soul quests hitting every demon (ruling 14), and a new demon every 4 weeks up to 7. */
function soulQuests(c: Cultivator, day: number, days: readonly number[]): void {
  const demons = Object.keys(c.s.soul.demons);
  if (day % 28 === 0 && day > 0 && demons.length < 7) {
    const id = `demon${day}`;
    c.now("HeartDemonCreated", c.at(day, 22.5), { demonId: id, name: id, positiveTasks: [{ taskId: `${id}+`, name: "Face it" }], negativeTasks: [] });
  }
  const ids = Object.keys(c.s.soul.demons);
  if (days.includes(day % 7) && ids.length >= 2) {
    const q = `sq${day}`;
    if (c.now("SoulQuestDefined", c.at(day, 23), { questId: q, name: "Session", demonIds: ids })) c.now("SoulQuestCompleted", c.at(day, 23.1), { questId: q });
  }
}

/** Sell every legendary held (unequipping it first), repairing a damaged one first since that always pays (ruling 155). */
function sellLegendaries(c: Cultivator, at: number, sold: { gold: number; repaired: number; items: GearItem[] }): void {
  for (const item of legendaryItems(c.s)) {
    for (const slot of ["armor", "weapon"] as const) if (c.s.gear.worn[slot] === item.id) c.now("GearUnequipped", at, { slot });
    if (item.damageBp > 0) {
      const price = repairPrice(item);
      if (c.now("GearRepaired", at, { itemId: item.id })) sold.repaired += price;
    }
    const fresh = c.s.gear.items[item.id];
    if (!fresh) continue;
    const price = sellPrice(fresh);
    if (c.now("GearSold", at, { itemId: item.id })) {
      sold.gold += price;
      sold.items.push(fresh);
    }
  }
}

// ---- 1 and 3. Legendary items per year ------------------------------------------

interface Persona {
  label: string;
  income: Income;
  habits: Habits;
  gym?: readonly number[];
  /** Soul sessions as quests on these days of the week (with a new demon every 4 weeks), instead of the single breathing practice. */
  quests?: readonly number[];
  sell?: boolean;
}

const PERSONAS: Persona[] = [
  { label: "honest studier (Monk)", income: study, habits: {} },
  { label: "honest studier (Warrior)", income: study, habits: { class: "warrior" } },
  { label: "honest studier (Bard)", income: study, habits: { class: "bard" } },
  { label: "Lion trainer: studier, gym 4x a week, spins every ticket (Monk)", income: study, habits: {}, gym: [0, 1, 3, 5] },
  { label: "soul quests 2x a week, up to 7 demons (Bard)", income: study, habits: { class: "bard" }, quests: [2, 6] },
  { label: "all sources: Lion trainer + soul quests (Monk)", income: study, habits: {}, gym: [0, 1, 3, 5], quests: [2, 6] },
  { label: "goblin: all sources, sells every legendary on receipt (Monk)", income: study, habits: {}, gym: [0, 1, 3, 5], quests: [2, 6], sell: true },
  { label: "repent cycler: eager reference, repents at every Nascent Soul entry, sells on receipt", income: weeklyMilestones, habits: { eager: true, repentCycle: true }, sell: true },
];

function simulate(p: Persona) {
  const c = new Cultivator({ rollAll: true, trackGold: true, idPrefix: "leg", seed: 41 });
  const roll = rng(97);
  setupBasic(c);
  const plan = tribulationPlan(p.habits);
  const sold = { gold: 0, repaired: 0, items: [] as GearItem[] };
  for (let day = 0; day < DAYS; day++) {
    routineDay(c, { income: p.income, ...(p.gym ? { gym: p.gym } : {}), ...(p.quests ? { breathe: [] } : {}) }, day);
    plan(c, day);
    if (p.quests) soulQuests(c, day, p.quests);
    spinAll(c, c.at(day, 23.5), roll);
    wearAll(c, c.at(day, 23.6));
    if (p.sell) sellLegendaries(c, c.at(day, 23.7), sold);
  }
  const s = c.s;
  const per = (n: number) => n / YEARS;
  const records = s.gear.legendary;
  const items = (src: LegendarySource) => records.filter((r) => r.source === src && r.itemId !== null).length;
  const capped = (src: LegendarySource) => records.filter((r) => r.source === src && r.itemId === null).length;
  // What selling every legendary on receipt would pay (undamaged), for the personas that keep them.
  const saleValue = records.filter((r) => r.itemId !== null).reduce((sum, r) => sum + RULES_V1.gear.sellShare * itemValue({ kind: "legendary", slot: r.slot, realm: r.realm }), 0);
  const income = c.goldEarned - sold.gold;
  // Repented step legendaries already sold: the gold the repent couldn't take back (accepted, ruling 179).
  const repentedSteps = new Set(s.progress.steps.filter((x) => x.repented).map((x) => x.step));
  const keptBySelling = sold.items.filter((i) => i.source?.kind === "step" && repentedSteps.has(i.source.step!)).reduce((sum, i) => sum + sellPrice(i), 0);
  return {
    label: p.label,
    end: `${s.main.realm}${s.progress.level ? ` ${s.progress.level}` : ""}`,
    perSource: SOURCES.map((src) => per(items(src))),
    total: per(records.filter((r) => r.itemId !== null).length),
    cappedRoulette: per(capped("roulette")),
    cappedSoul: per(capped("soul")),
    cappedGold: per(records.reduce((sum, r) => sum + r.gold, 0)),
    tickets: per(countSpins(c)),
    color: s.soul.color,
    tier: s.companion.tier,
    incomePerYear: per(income),
    salePerYear: per(p.sell ? sold.gold : saleValue),
    repairedPerYear: per(sold.repaired),
    keptBySelling,
    repents: Object.values(s.progress.repents).reduce((a, b) => a + b, 0),
  };
}

function countSpins(c: Cultivator): number {
  return c.log.filter((e) => e.type === "RouletteSpun").length;
}

// ---- 2. The stat ladder -----------------------------------------------------------

function ladderRows(): string[][] {
  const rows: string[][] = [];
  for (const realm of GEAR_REALMS) {
    for (const slot of ["armor", "weapon"] as const) {
      for (const kind of slot === "armor" ? (["robe", "shop", "legendary"] as const) : (["shop", "legendary"] as const)) {
        const item: GearItem = { id: "x", slot, kind, realm, damageBp: 10_000 * 0.5, obtainedAt: 0 };
        const stat = slot === "armor" ? `${RULES_V1.gear.armor[kind][realm].qi} Qi, ${RULES_V1.gear.armor[kind][realm].gold} gold off a failure` : `+${(RULES_V1.gear.weapon[kind as "shop" | "legendary"][realm] * 100).toFixed(0)}% Qi`;
        const value = itemValue(item);
        rows.push([
          realm,
          slot,
          kind,
          stat,
          kind === "legendary" ? "drop only" : value.toFixed(1),
          (RULES_V1.gear.sellShare * value).toFixed(1),
          (2 * repairPrice(item)).toFixed(1),
          // Repairing at 50% damage, then selling: the sale gains 35% of the value, the repair costs 5% of Foundation's.
          (sellPrice({ ...item, damageBp: 0 }) - sellPrice(item) - repairPrice(item)).toFixed(1),
        ]);
      }
    }
  }
  return rows;
}

// ---- 4. Monk vs Body and Soul classes: the Unique chance ---------------------------

const CAL_DAYS = 364;
const CAL_SEEDS = 12;

/**
 * A year in Core Formation (entered by override, the class picked there),
 * the class simulator's routine: a mid study a day, gym twice a week, the
 * breathing practice twice a week, a 4-week tribulation each month passed in
 * week 3 (12 claims, never completed, so no level-ups). Wearables worn as
 * soon as held, or never.
 */
function calibrate(cls: ClassId, wear: boolean, seed: number, struggling = false) {
  const c = new Cultivator({ rollAll: true, trackGold: true, idPrefix: `cal${cls}${wear ? "w" : "n"}`, seed });
  setupBasic(c);
  // Struggling: two more demons, created a week apart (ruling 4), whose practice is never done, so they grow.
  const extra = struggling ? [7, 14] : [];
  for (let i = 1; i <= 8; i++) c.now("RealmOverride", c.at(0, 0) + i, { class: cls });
  // A long-term tribulation keeps the set incomplete, so the persona stays in early Core Formation.
  c.now("TribulationDeclared", c.at(0, 1), { tribulationId: "long-term", title: "Long-term", criteria: "Due after the year", deadline: c.at(0, 1) + 365 * DAY });
  for (let day = 0; day < CAL_DAYS; day++) {
    if (extra.includes(day)) c.ev("HeartDemonCreated", c.at(day, 5), { demonId: `e${day}`, name: `e${day}`, positiveTasks: [{ taskId: `e${day}+`, name: "Face it" }], negativeTasks: [] });
    routineDay(c, { income: study }, day);
    if (day % 28 === 0) c.now("TribulationDeclared", c.at(day, 22), { tribulationId: `t${day}`, title: `t${day}`, criteria: "Pass", deadline: c.at(day, 22) + 28 * DAY });
    if (day % 28 === 20) c.now("TribulationClaimed", c.at(day, 22), { tribulationId: `t${day - 20}`, oath: TRIBULATION_OATH, llmReview: "skipped" });
    if (wear) wearAll(c, c.at(day, 23));
  }
  const s = c.s;
  const net = (x: CultivatorState) => ({ gold: x.gold - x.main.debt.gold, qi: x.qi - x.main.debt.qi });
  const d = s.class.drops;
  return {
    ...net(s),
    goldEarned: c.goldEarned,
    drops: d.soul_wearable + d.pet_keep + d.pet_halo,
    halo: d.pet_halo,
    legendaryHalo: s.class.worn.legendary,
    claims: Object.values(s.tribulations.items).filter((t) => t.passedAt !== null).length,
  };
}

function calibration() {
  // A legendary is worth its sale value at its realm (Core Formation: armor and weapon, 50/50), in days of gold income.
  const legendarySale = (RULES_V1.gear.sellShare * (itemValue({ kind: "legendary", slot: "armor", realm: "core_formation" }) + itemValue({ kind: "legendary", slot: "weapon", realm: "core_formation" }))) / 2;
  const rows: string[][] = [];
  const perClaim: number[] = [];
  const personas: { label: string; cls: ClassId; struggling: boolean }[] = [
    { label: "Bard, one demon kept down", cls: "bard", struggling: false },
    { label: "Bard, three demons, practices one", cls: "bard", struggling: true },
    { label: "Warrior", cls: "warrior", struggling: false },
    { label: "Dancer", cls: "dancer", struggling: false },
  ];
  const byGroup: Record<string, number[]> = {};
  for (const { label, cls, struggling } of personas) {
    let dGold = 0;
    let dQi = 0;
    let gold = 0;
    let qi = 0;
    let drops = 0;
    let halo = 0;
    let claims = 0;
    for (let k = 0; k < CAL_SEEDS; k++) {
      const w = calibrate(cls, true, 100 + k, struggling);
      const n = calibrate(cls, false, 100 + k, struggling);
      dGold += w.gold - n.gold;
      dQi += w.qi - n.qi;
      gold += n.goldEarned;
      qi += Math.max(1, n.qi);
      drops += w.drops;
      halo += w.halo;
      claims += w.claims;
    }
    const goldPerDay = gold / CAL_SEEDS / CAL_DAYS;
    const qiPerDay = qi / CAL_SEEDS / CAL_DAYS;
    // Measured: the soul freeze and the keep (gold and Qi, net of tax). A halo ticket's +10% (+15% legendary) on a
    // later level-up or breakthrough roll is valued at that share of a legendary's sale value (no level-ups here).
    const haloGold = (halo / CAL_SEEDS) * (0.9 * RULES_V1.halo.legendaryBonus + 0.1 * RULES_V1.classes.wearables.legendary.haloBonus) * legendarySale;
    const days = (dGold / CAL_SEEDS + haloGold) / goldPerDay + dQi / CAL_SEEDS / qiPerDay;
    const perDrop = days / (drops / CAL_SEEDS);
    const claimsPerYear = claims / CAL_SEEDS;
    const valuePerClaim = days / claimsPerYear;
    const group = RULES_V1.classes.table[cls].group;
    (byGroup[group] ??= []).push(valuePerClaim);
    rows.push([
      label,
      goldPerDay.toFixed(1),
      qiPerDay.toFixed(1),
      (drops / CAL_SEEDS).toFixed(1),
      (dGold / CAL_SEEDS).toFixed(0),
      (dQi / CAL_SEEDS).toFixed(0),
      haloGold.toFixed(0),
      days.toFixed(1),
      perDrop.toFixed(2),
      valuePerClaim.toFixed(2),
    ]);
  }
  // The Unique chance that matches: a legendary's value in days of gold income times p = the average wearable value per claim.
  const monk = calibrate("monk", false, 100);
  const legendaryDays = legendarySale / (monk.goldEarned / CAL_DAYS);
  // Body and Hybrid only (ruling 178): the Soul group's wearables are worth the soul color, which income doesn't
  // measure, so its 0 is a measurement gap, not a real zero. Each group counts once.
  for (const [group, list] of Object.entries(byGroup)) if (group !== "soul") perClaim.push(list.reduce((a, b) => a + b, 0) / list.length);
  const target = perClaim.reduce((a, b) => a + b, 0) / perClaim.length;
  return { rows, legendarySale, legendaryDays, target, chance: target / legendaryDays };
}

// ---- Output -------------------------------------------------------------------

export function runLegendaryScenarios(outDir: string): void {
  const header = [
    "persona",
    `end (${YEARS} years)`,
    "soul",
    "tier",
    ...SOURCES.map((s) => `${s}/yr`),
    "legendary items/yr",
    "roulette capped/yr",
    "soul capped/yr",
    "gold paid instead/yr",
    "spins/yr",
    "gold income/yr",
    "sale value/yr",
    "sale as % of income",
    "repairs before sale/yr",
    "kept by selling before repents",
    "repents",
  ];
  const rows = PERSONAS.map(simulate).map((r) => [
    r.label,
    r.end,
    r.color,
    r.tier,
    ...r.perSource.map((x) => x.toFixed(2)),
    r.total.toFixed(2),
    r.cappedRoulette.toFixed(2),
    r.cappedSoul.toFixed(2),
    r.cappedGold.toFixed(0),
    r.tickets.toFixed(0),
    r.incomePerYear.toFixed(0),
    r.salePerYear.toFixed(0),
    `${((100 * r.salePerYear) / Math.max(1, r.incomePerYear)).toFixed(1)}%`,
    r.repairedPerYear.toFixed(1),
    r.keptBySelling.toFixed(0),
    String(r.repents),
  ]);
  console.log(`\nLegendary items per year by source over ${YEARS} years (ruling 176: soul drops and the roulette capped at one each per 365 days)\n`);
  console.log(header.join("\t"));
  for (const r of rows) console.log(r.join("\t"));
  writeFileSync(join(outDir, "legendary.csv"), [header.join(","), ...rows.map((r) => r.map((x) => `"${x}"`).join(","))].join("\n"));

  const ladderHeader = ["realm", "slot", "kind", "stat", "price", "sells for (undamaged)", "full repair", "repair at 50% then sell: gain"];
  const ladder = ladderRows();
  console.log(`\nGear ladder (ruling 138): robe(R) < shop(R) < robe(R+1) < legendary(R) < shop(R+1); legendary sells per ruling 155 and repairs per ruling 172\n`);
  console.log(ladderHeader.join("\t"));
  for (const r of ladder) console.log(r.join("\t"));
  writeFileSync(join(outDir, "legendary-ladder.csv"), [ladderHeader.join(","), ...ladder.map((r) => r.map((x) => `"${x}"`).join(","))].join("\n"));

  const cal = calibration();
  const calHeader = ["class", "gold/day", "net Qi/day", "wearable drops/yr", "gold from wearing/yr", "Qi from wearing/yr", "halo tickets' value (gold)/yr", "wearables' value (days of income)/yr", "days per drop", "days per claim"];
  console.log(`\nMonk vs Body and Soul classes: a year in Core Formation, wearables worn vs never worn (${CAL_SEEDS} seeds)\n`);
  console.log(calHeader.join("\t"));
  for (const r of cal.rows) console.log(r.join("\t"));
  console.log(
    `A Core Formation legendary sells for ${cal.legendarySale.toFixed(1)} gold, ${cal.legendaryDays.toFixed(1)} days of a Monk's gold income; matching Body and Hybrid's ${cal.target.toFixed(2)} days per claim needs a Unique chance of ${(100 * cal.chance).toFixed(1)}% (config: ${(100 * RULES_V1.classes.drop.uniqueLegendaryChance).toFixed(1)}%).`,
  );
  writeFileSync(join(outDir, "legendary-unique.csv"), [calHeader.join(","), ...cal.rows.map((r) => r.map((x) => `"${x}"`).join(","))].join("\n"));
}

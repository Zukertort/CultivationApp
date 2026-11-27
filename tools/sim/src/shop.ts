/**
 * Shop report (Roadmap part 3, rulings 159-163): prices in days of
 * physical-practice income per realm, and the personas that test them.
 * Every number comes from runs through the real engine, except the insurer
 * and the extender, which are price arithmetic on the rules' own functions
 * (the cheapest item that absorbs a penalty; an extension's price).
 *
 * Personas (Foundation to Nascent Soul): the Turtle beginner (studies, never
 * trains), the studier with gym twice a week, and physical practice (gym five
 * times a week, Lion). "Realistic failure rate": each tribulation fails once
 * before it passes (the failFirst habit).
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  DAY,
  GEAR_REALMS,
  RULES_V1,
  advanceTo,
  armorAtRisk,
  goldForPoints,
  itemValue,
  potionPrice,
  repairPrice,
  sellPrice,
  shopPrice,
  stash,
  vacationDaysLeft,
  vacationPrice,
  workPoints,
  wornItem,
  type CultivatorState,
  type GearItem,
  type GearRealm,
  type Realm,
  type RulesConfig,
} from "@cultivation/rules";
import { Cultivator, routineDay, setupBasic, study, tribulationPlan, type Habits, type Routine } from "@cultivation/scenarios";
import { goblin, type Goblin } from "./gear.js";

const YEARS3 = 1095;
const YEAR = 365;
const REPORT_REALMS = ["foundation_establishment", "core_formation", "nascent_soul"] as const satisfies readonly GearRealm[];
type ReportRealm = (typeof REPORT_REALMS)[number];
const short = (r: string) => ({ qi_condensation: "QC", foundation_establishment: "F", core_formation: "CF", nascent_soul: "NS", spirit_realm: "SR" })[r] ?? r;

interface Persona {
  key: "turtle" | "studier" | "physical";
  label: string;
  routine: Routine;
}

const PERSONAS: Persona[] = [
  { key: "turtle", label: "Turtle beginner", routine: { income: study, gym: [] } },
  { key: "studier", label: "studier, gym 2x a week", routine: { income: study } },
  { key: "physical", label: "physical practice", routine: { income: study, gym: [0, 1, 2, 3, 4] } },
];

// ---- Running a persona ---------------------------------------------------------

interface Stats {
  days: number;
  gold: number;
  qi: number;
  unarmoredGold: number;
  unarmoredQi: number;
  failureQi: number;
  failureGold: number;
  failures: number;
  repairs: number;
  bought: number;
  shop: number;
  taxGold: number;
  taxQi: number;
}

const zero = (): Stats => ({ days: 0, gold: 0, qi: 0, unarmoredGold: 0, unarmoredQi: 0, failureQi: 0, failureGold: 0, failures: 0, repairs: 0, bought: 0, shop: 0, taxGold: 0, taxQi: 0 });

function snapshot(c: Cultivator): Omit<Stats, "days"> {
  const s = c.s;
  const tax = Object.values(s.main.taxPaid).reduce((a, t) => ({ qi: a.qi + t.qi, gold: a.gold + t.gold }), { qi: 0, gold: 0 });
  return {
    gold: c.goldEarned,
    qi: s.main.earned.qi,
    unarmoredGold: s.gear.unarmored.gold,
    unarmoredQi: s.gear.unarmored.qi,
    failureQi: s.tribulations.spent.failures.qi,
    failureGold: s.tribulations.spent.failures.gold,
    failures: s.tribulations.spent.failures.count,
    repairs: s.gear.gold.repaired,
    bought: s.gear.gold.bought,
    shop: s.shopSpent.potions + s.shopSpent.vacations + s.class.history.reduce((a, x) => a + x.gold, 0),
    taxGold: tax.gold,
    taxQi: tax.qi,
  };
}

interface RunOptions {
  persona: Persona;
  days: number;
  habits?: Habits;
  rules?: RulesConfig;
  /** At 05:00, before the day's routine. */
  morning?: (c: Cultivator, day: number, now: CultivatorState) => void;
  /** At 23:00, after the tribulation plan. */
  evening?: (c: Cultivator, day: number) => void;
  /** Skip the tribulation plan (areas included) before this day: the banker. */
  planFrom?: number;
  id: string;
}

interface Run {
  c: Cultivator;
  per: Partial<Record<Realm, Stats>>;
  /** The day each realm was first entered. */
  entered: Partial<Record<Realm, number>>;
  goldAtEntry: Partial<Record<Realm, number>>;
}

function run(o: RunOptions): Run {
  const c = new Cultivator({ idPrefix: o.id, rollAll: true, trackGold: true, ...(o.rules ? { rules: o.rules } : {}) });
  setupBasic(c);
  const plan = tribulationPlan(o.habits ?? {});
  const per: Partial<Record<Realm, Stats>> = {};
  const entered: Partial<Record<Realm, number>> = { qi_condensation: 0 };
  const goldAtEntry: Partial<Record<Realm, number>> = { qi_condensation: 0 };
  let last = snapshot(c);
  for (let d = 0; d < o.days; d++) {
    if (o.morning) o.morning(c, d, advanceTo(c.s, c.at(d, 5), c.rules));
    routineDay(c, o.persona.routine, d);
    const planFrom = o.planFrom ?? 0;
    if (d === planFrom && planFrom > 0) {
      const at = c.at(d, 22);
      for (const path of ["main", "body", "soul"] as const) c.now("AreaDecided", at, { path, choice: `${path} discipline` });
      c.now("AreasLocked", at, {});
    }
    if (d >= planFrom) plan(c, d);
    if (o.evening) o.evening(c, d);
    const realm = c.s.main.realm;
    if (entered[realm] === undefined) {
      entered[realm] = d;
      goldAtEntry[realm] = c.s.gold;
    }
    const now = snapshot(c);
    const st = (per[realm] ??= zero());
    st.days += 1;
    for (const k of Object.keys(now) as (keyof typeof now)[]) st[k] += now[k] - last[k];
    last = now;
  }
  return { c, per, entered, goldAtEntry };
}

const goldPerDay = (r: Run, realm: Realm) => {
  const st = r.per[realm];
  return st && st.days > 0 ? st.gold / st.days : NaN;
};

// ---- Gear policies -----------------------------------------------------------------

type ArmorPolicy = "none" | "robe" | "shop";

function repairIfDue(c: Cultivator, now: CultivatorState, slot: "armor" | "weapon", at: number): void {
  const item = wornItem(now, slot);
  if (!item || item.damageBp <= 0) return;
  const due = item.damageBp >= RULES_V1.gear.warnAtBp || (slot === "armor" && armorAtRisk(now, c.rules) !== null);
  if (due && now.gold >= repairPrice(item, c.rules)) c.now("GearRepaired", at, { itemId: item.id });
}

function buyAndWear(c: Cultivator, slot: "armor" | "weapon", at: number): void {
  const realm = c.s.main.realm;
  if (realm === "qi_condensation") return;
  const r = realm as GearRealm;
  const worn = wornItem(c.s, slot);
  if (worn?.kind === "shop" && worn.realm === r) return;
  if (c.s.gold < shopPrice(slot, r, c.rules)) return;
  const before = new Set(Object.keys(c.s.gear.items));
  if (!c.now("GearBought", at, { slot })) return;
  const bought = Object.values(c.s.gear.items).find((i) => !before.has(i.id));
  if (bought && c.s.gear.worn[slot] !== bought.id) c.now("GearEquipped", at, { itemId: bought.id });
}

const armorMorning =
  (policy: ArmorPolicy) =>
  (c: Cultivator, d: number, now: CultivatorState): void => {
    const at = c.at(d, 5);
    if (policy === "none") return;
    repairIfDue(c, now, "armor", at);
    if (policy === "shop") buyAndWear(c, "armor", at);
  };

/** Takes off any armor at night (a new robe arrives worn at a breakthrough), so it never wears armor the next day. */
const noArmorEvening = (c: Cultivator, d: number): void => {
  if (c.s.gear.worn.armor !== null) c.now("GearUnequipped", c.at(d, 23), { slot: "armor" });
};

// ---- Formatting --------------------------------------------------------------------

const f0 = (n: number) => (Number.isFinite(n) ? n.toFixed(0) : "-");
const f1 = (n: number) => (Number.isFinite(n) ? n.toFixed(1) : "-");
const pct = (n: number) => (Number.isFinite(n) ? `${(n * 100).toFixed(1)}%` : "-");

function table(title: string, header: string[], rows: (string | number)[][], csv: string[]): void {
  console.log(`\n${title}\n`);
  console.log(header.join("\t"));
  for (const r of rows) console.log(r.join("\t"));
  csv.push(`# ${title}`, header.join(","), ...rows.map((r) => r.map((x) => `"${x}"`).join(",")), "");
}

interface Check {
  name: string;
  pass: boolean;
  detail: string;
}

// ---- The report ----------------------------------------------------------------------

export function runShopScenarios(outDir: string): void {
  const csv: string[] = [];
  const checks: Check[] = [];
  const R = RULES_V1;

  // Baselines: three years each, robe worn and repaired at the warnings.
  const base = Object.fromEntries(PERSONAS.map((p) => [p.key, run({ persona: p, days: YEARS3, morning: armorMorning("robe"), id: `base-${p.key}` })])) as Record<Persona["key"], Run>;
  const D = (realm: Realm) => goldPerDay(base.physical, realm);
  const days = (gold: number, realm: Realm) => gold / D(realm);

  // 1. Income and prices.
  table(
    "Shop: gold income per day by realm (3 years; physical practice is the price unit)",
    ["persona", ...["qi_condensation", ...GEAR_REALMS].map((r) => `${short(r)} gold/day (days there)`)],
    PERSONAS.map((p) => [p.label, ...["qi_condensation", ...GEAR_REALMS].map((r) => `${f1(goldPerDay(base[p.key], r as Realm))} (${base[p.key].per[r as Realm]?.days ?? 0})`)]),
    csv,
  );
  const priceRows = (["qi_condensation", ...GEAR_REALMS] as const).map((realm) => {
    const s = { main: { realm } } as unknown as CultivatorState;
    const gear = realm === "qi_condensation" ? null : realm;
    const cell = (g: number) => `${f0(g)} (${f1(days(g, realm))} d)`;
    return [
      short(realm),
      f1(D(realm)),
      gear ? cell(shopPrice("armor", gear)) : "-",
      gear ? cell(shopPrice("weapon", gear)) : "-",
      gear ? cell(shopPrice("armor", gear, R, "robe")) : "-",
      cell(potionPrice(s)),
      cell(vacationPrice(s, 1)),
      realm === "core_formation" || realm === "nascent_soul" ? cell(R.classes.changeGold) : "-",
    ];
  });
  table("Shop: prices in gold (days of physical-practice income)", ["realm", "income/day", "shop armor", "shop weapon", "robe", "gain potion", "vacation/day", "class change"], priceRows, csv);

  // 2. Unarmored: never wears armor; factor sweep.
  const factors = [1.0, 1.5, 2.0, 2.5, 3.0];
  const sweep: Record<string, Record<number, Partial<Record<ReportRealm, number>>>> = {};
  const sweepRows: (string | number)[][] = [];
  for (const p of PERSONAS) {
    sweep[p.key] = {};
    for (const factor of factors) {
      const rules: RulesConfig = { ...R, gear: { ...R.gear, unarmoredLossFactor: factor } };
      const r = run({ persona: p, days: YEARS3, rules, evening: noArmorEvening, id: `bare-${p.key}-${factor}` });
      const shares = Object.fromEntries(REPORT_REALMS.map((realm) => [realm, (r.per[realm]?.unarmoredGold ?? NaN) / (r.per[realm]?.gold ?? NaN)]));
      sweep[p.key]![factor] = shares;
      sweepRows.push([p.label, factor.toFixed(1), ...REPORT_REALMS.map((realm) => pct(shares[realm]!)), ...REPORT_REALMS.map((realm) => f0(r.per[realm]?.unarmoredQi ?? NaN))]);
    }
  }
  table(
    "Shop: unarmored (never wears armor), the companion's loss as a share of gold income, by factor",
    ["persona", "factor", ...REPORT_REALMS.map((r) => `${short(r)} gold loss %`), ...REPORT_REALMS.map((r) => `${short(r)} Qi lost`)],
    sweepRows,
    csv,
  );
  const current = R.gear.unarmoredLossFactor;
  const turtleShares = REPORT_REALMS.map((realm) => sweep.turtle![current]?.[realm] ?? NaN);
  checks.push({
    name: "An unarmored Turtle loses 10-20% of its gold income",
    pass: turtleShares.every((x) => x >= 0.1 && x <= 0.2),
    detail: `factor ${current}: ${REPORT_REALMS.map((r, i) => `${short(r)} ${pct(turtleShares[i]!)}`).join(", ")}`,
  });

  // 3. Armored at the realistic failure rate: none vs robe vs shop armor.
  const armorRuns = Object.fromEntries(
    PERSONAS.map((p) => [
      p.key,
      {
        none: run({ persona: p, days: YEARS3, habits: { failFirst: true }, evening: noArmorEvening, id: `fail-none-${p.key}` }),
        robe: run({ persona: p, days: YEARS3, habits: { failFirst: true }, morning: armorMorning("robe"), id: `fail-robe-${p.key}` }),
        shop: run({ persona: p, days: YEARS3, habits: { failFirst: true }, morning: armorMorning("shop"), id: `fail-shop-${p.key}` }),
      },
    ]),
  ) as Record<Persona["key"], Record<ArmorPolicy, Run>>;
  const losses = (st: Stats | undefined) => (st ? st.unarmoredGold + st.unarmoredQi + st.failureQi + st.failureGold : NaN);
  const cost = (st: Stats | undefined) => (st ? st.bought + st.repairs : NaN);
  const armorRows: (string | number)[][] = [];
  const physicalPays: string[] = [];
  let physicalPass = true;
  for (const p of PERSONAS) {
    for (const realm of REPORT_REALMS) {
      const n = armorRuns[p.key].none.per[realm];
      const rb = armorRuns[p.key].robe.per[realm];
      const sh = armorRuns[p.key].shop.per[realm];
      const avoidedRobe = losses(n) - losses(rb);
      const avoidedShop = losses(n) - losses(sh);
      armorRows.push([
        p.label,
        short(realm),
        String(sh?.failures ?? "-"),
        f0(losses(n)),
        `${f0(cost(rb))} / ${f0(avoidedRobe)}`,
        `${f0(cost(sh))} / ${f0(avoidedShop)}`,
        f0(avoidedShop - avoidedRobe - (cost(sh) - cost(rb))),
      ]);
      if (p.key === "physical") {
        const pays = avoidedShop >= cost(sh);
        physicalPass &&= pays;
        physicalPays.push(`${short(realm)} cost ${f0(cost(sh))} vs avoided ${f0(avoidedShop)}`);
      }
    }
  }
  table(
    "Shop: armor at the realistic failure rate (each tribulation fails once); losses = unarmored loss + failure Qi and gold (1 Qi counted as 1 gold)",
    ["persona", "realm", "failures", "losses with no armor", "robe: cost / losses avoided", "shop armor: cost / losses avoided", "shop over robe: net"],
    armorRows,
    csv,
  );
  checks.push({ name: "Shop armor pays for itself within its life (physical practice, realistic failure rate)", pass: physicalPass, detail: physicalPays.join("; ") });

  // 4. Weapon buyer vs none.
  const weaponRuns = Object.fromEntries(
    PERSONAS.map((p) => [
      p.key,
      {
        none: base[p.key],
        weapon: run({
          persona: p,
          days: YEARS3,
          morning: (c, d, now) => {
            armorMorning("robe")(c, d, now);
            repairIfDue(c, now, "weapon", c.at(d, 5));
            buyAndWear(c, "weapon", c.at(d, 5));
          },
          id: `weapon-${p.key}`,
        }),
      },
    ]),
  ) as Record<Persona["key"], { none: Run; weapon: Run }>;
  const weaponRows: (string | number)[][] = [];
  const earlier: string[] = [];
  let weaponPass = true;
  for (const p of PERSONAS) {
    for (const realm of REPORT_REALMS) {
      const n = weaponRuns[p.key].none;
      const w = weaponRuns[p.key].weapon;
      const next = GEAR_REALMS[GEAR_REALMS.indexOf(realm) + 1]!;
      const stayN = (n.entered[next] ?? NaN) - (n.entered[realm] ?? NaN);
      const stayW = (w.entered[next] ?? NaN) - (w.entered[realm] ?? NaN);
      const qiYearN = ((n.per[realm]?.qi ?? NaN) / (n.per[realm]?.days ?? NaN)) * YEAR;
      const qiYearW = ((w.per[realm]?.qi ?? NaN) / (w.per[realm]?.days ?? NaN)) * YEAR;
      const st = w.per[realm];
      // The Qi the realm's steps cost (each step counted in the realm it was taken from), at each run's Qi a day.
      const steps = n.c.s.progress.steps;
      const need = steps.reduce((a, x, i) => a + ((steps[i - 1]?.realm ?? "qi_condensation") === realm ? x.qiSpent : 0), 0);
      const paceN = need / (qiYearN / YEAR);
      const paceW = need / (qiYearW / YEAR);
      weaponRows.push([p.label, short(realm), f0(qiYearN), f0(qiYearW), f0(qiYearW - qiYearN), f0(need), f0(paceN), f0(paceN - paceW), f0(stayN), f0(stayN - stayW), f0(st?.bought ?? NaN), f0(st?.repairs ?? NaN)]);
      earlier.push(`${p.key} ${short(realm)} ${f1(paceN - paceW)}`);
      if (!(paceN - paceW >= 3)) weaponPass = false;
    }
  }
  table(
    "Shop: weapon buyer vs none: Main Qi a year in the realm; the days to earn the realm's Qi threshold (its steps' total) and how many fewer with the weapon; the actual stay, which tribulation deadlines set",
    ["persona", "realm", "Qi/yr none", "Qi/yr weapon", "extra Qi/yr", "realm Qi threshold", "days to earn it", "days earlier with weapon", "actual stay", "actual stay shorter by", "weapon bought (gold)", "repairs (gold)"],
    weaponRows,
    csv,
  );
  checks.push({ name: "A weapon reaches the realm's Qi threshold at least a few (3) days earlier", pass: weaponPass, detail: `days earlier: ${earlier.join(", ")}` });

  // 5. Banker: months in Qi Condensation before deciding the areas.
  const bankerRows: (string | number)[][] = [];
  const gearSet = shopPrice("armor", "foundation_establishment") + shopPrice("weapon", "foundation_establishment");
  let bankerPass = true;
  const bankerDetail: string[] = [];
  for (const p of PERSONAS) {
    const honestGold = base[p.key].goldAtEntry.foundation_establishment ?? NaN;
    for (const months of [3, 6, 12]) {
      for (const potions of [false, true]) {
        const planFrom = Math.round(months * 30.4);
        const r = run({
          persona: p,
          days: planFrom + 10,
          planFrom,
          ...(potions && {
            morning: (c: Cultivator, d: number, now: CultivatorState) => {
                if (now.main.realm !== "qi_condensation") return;
                const at = c.at(d, 5);
                const active = now.inventory.gainPotionUntil !== null && at < now.inventory.gainPotionUntil;
                if (!active && c.now("PotionBought", at, { potion: "gain" })) c.now("PotionUsed", at, { potion: "gain" });
              },
            }),
          id: `bank-${p.key}-${months}-${potions}`,
        });
        const head = (r.goldAtEntry.foundation_establishment ?? NaN) - honestGold;
        bankerRows.push([p.label, months, potions ? "yes" : "no", f0(r.goldAtEntry.foundation_establishment ?? NaN), f0(head), f1(days(head, "foundation_establishment")), f1(head / gearSet)]);
        if (months === 12 && !potions) {
          bankerDetail.push(`${p.key} ${f0(head)} gold = ${f1(head / gearSet)} gear sets`);
          if (head > gearSet) bankerPass = false;
        }
      }
    }
  }
  table(
    `Shop: banker (months in Qi Condensation, then Foundation); head start vs entering on day 6, in days of Foundation income; a Foundation gear set is ${gearSet} gold`,
    ["persona", "months", "daily potion", "gold at Foundation", "head start (gold)", "head start (days)", "gear sets"],
    bankerRows,
    csv,
  );
  checks.push({ name: "The 12-month banker's head start is at most one realm gear set (armor plus weapon)", pass: bankerPass, detail: bankerDetail.join("; ") });

  // 6. Vacationer: rests as much as allowed, still doing every task. One year.
  const uncapped: RulesConfig = { ...R, rest: { ...R.rest, vacationMaxDays: YEAR, vacationMaxDaysPerWindow: R.rest.vacationWindowDays + 1 } };
  const vacationRows: (string | number)[][] = [];
  let capPass = true;
  const capDetail: string[] = [];
  for (const p of PERSONAS) {
    for (const mode of ["none", "capped", "uncapped"] as const) {
      const rules = mode === "uncapped" ? uncapped : R;
      const r = run({
        persona: p,
        days: YEAR,
        rules,
        morning: (c, d, now) => {
          armorMorning("robe")(c, d, now);
          if (mode === "none" || now.rest) return;
          const at = c.at(d, 5);
          const left = vacationDaysLeft(now, at, rules);
          const take = Math.min(left, Math.floor(now.gold / vacationPrice(now, 1, rules)));
          if (take >= 1) c.now("RestStarted", at, { kind: "vacation", until: at + take * DAY });
        },
        id: `vac-${p.key}-${mode}`,
      });
      const s = r.c.s;
      const restDays = s.vacationLog.reduce((a, v) => a + (v.end - v.start) / DAY, 0);
      const longest = Math.max(0, ...s.vacationLog.map((v) => (v.end - v.start) / DAY));
      // The most vacation days in any 91-day window, by day.
      let worst = 0;
      for (let d = 0; d < YEAR; d++) {
        const from = r.c.at(d, 0);
        const to = from + R.rest.vacationWindowDays * DAY;
        worst = Math.max(worst, s.vacationLog.reduce((a, v) => a + Math.max(0, Math.min(v.end, to) - Math.max(v.start, from)), 0) / DAY);
      }
      const all = Object.values(r.per).reduce((a, st) => {
        for (const k of Object.keys(st) as (keyof Stats)[]) a[k] += st[k];
        return a;
      }, zero());
      vacationRows.push([p.label, mode, f0(restDays), f0(longest), f1(worst), f0(s.shopSpent.vacations), f0(all.gold), f0(all.qi), f0(all.taxGold), f0(all.repairs), s.companion.tier]);
      if (mode === "capped") {
        capDetail.push(`${p.key}: longest ${f0(longest)} d, most in 91 d ${f1(worst)}`);
        if (longest > R.rest.vacationMaxDays || worst > R.rest.vacationMaxDaysPerWindow + 0.01) capPass = false;
      }
    }
  }
  table(
    "Shop: vacationer (one year; every task still done; tax, food, decay and damage freeze on rest days)",
    ["persona", "vacations", "rest days", "longest", "most in 91 days", "vacation gold", "gold earned", "Main Qi earned", "tax gold paid", "repairs", "tier at end"],
    vacationRows,
    csv,
  );
  checks.push({ name: "The capped vacationer can't freeze decay or tax beyond the cap", pass: capPass, detail: capDetail.join("; ") });

  // 7. Insurer: the cheapest item that absorbs a soul "lose item" or the 2nd and 3rd repent penalties.
  const insurerRows: (string | number)[][] = [];
  let insurerMin = Infinity;
  for (const realm of REPORT_REALMS) {
    const s = { main: { realm } } as unknown as CultivatorState;
    const potion = potionPrice(s);
    const robe = shopPrice("armor", realm, R, "robe");
    const freeRobe: GearItem = { id: "r", slot: "armor", kind: "robe", realm, damageBp: 0, obtainedAt: 0 };
    const forgone = sellPrice(freeRobe);
    const cheapestBought = Math.min(potion, robe);
    insurerMin = Math.min(insurerMin, days(cheapestBought, realm));
    insurerRows.push([short(realm), `${f0(potion)} (${f1(days(potion, realm))} d)`, `${f0(robe)} (${f1(days(robe, realm))} d)`, `${f0(forgone)} (${f1(days(forgone, realm))} d)`, f1(days(cheapestBought, realm)), f1(days(2 * cheapestBought, realm))]);
  }
  table(
    "Shop: insurer (keeps the cheapest items to absorb item penalties; price arithmetic): cost per absorbed item in days of income",
    ["realm", "gain potion", "bought robe", "free robe kept (its sale forgone)", "1 item (soul loss, 2nd repent)", "2 items (3rd repent)"],
    insurerRows,
    csv,
  );
  checks.push({ name: "An absorbed item penalty costs at least about 2 days of income", pass: insurerMin >= 1.9, detail: `cheapest bought absorber ${f1(insurerMin)} days (a free robe kept costs only its forgone sale: see the table)` });

  // 8. Potion buyer: a gain potion every day.
  const potionRows: (string | number)[][] = [];
  let potionLoop = false;
  for (const p of PERSONAS) {
    const n = run({ persona: p, days: YEAR, morning: armorMorning("robe"), id: `pot-none-${p.key}` });
    const b = run({
      persona: p,
      days: YEAR,
      morning: (c, d, now) => {
        armorMorning("robe")(c, d, now);
        const at = c.at(d, 5);
        const active = now.inventory.gainPotionUntil !== null && at < now.inventory.gainPotionUntil;
        if (!active && c.now("PotionBought", at, { potion: "gain" })) c.now("PotionUsed", at, { potion: "gain" });
      },
      id: `pot-daily-${p.key}`,
    });
    const extraGold = b.c.goldEarned - n.c.goldEarned;
    const extraQi = b.c.s.main.earned.qi - n.c.s.main.earned.qi;
    const spent = b.c.s.shopSpent.potions;
    if (extraGold >= spent) potionLoop = true;
    potionRows.push([p.label, f0(spent), f0(extraGold), f1(spent > 0 ? extraGold / spent : NaN), f0(extraQi), f1(spent > 0 ? extraQi / spent : NaN)]);
  }
  table("Shop: potion buyer (a gain potion bought and drunk every day for a year) vs none", ["persona", "potions gold", "extra gold", "gold back per gold", "extra Main Qi", "Qi per gold"], potionRows, csv);

  // 9. Class hopper: changes class every 30 days in Core Formation and Nascent Soul.
  const hopper = run({
    persona: PERSONAS[2]!,
    days: YEARS3,
    morning: (c, d, now) => {
      armorMorning("robe")(c, d, now);
      const realm = now.main.realm;
      if ((realm === "core_formation" || realm === "nascent_soul") && d % 30 === 0 && now.class.id !== null) {
        c.now("ClassChosen", c.at(d, 5), { class: now.class.id === "monk" ? "warrior" : "monk" });
      }
    },
    id: "hopper",
  });
  const changes = hopper.c.s.class.history.filter((x) => x.gold > 0);
  table(
    "Shop: class hopper (physical practice, a change every 30 days in Core Formation and Nascent Soul)",
    ["realm", "changes", "gold spent", "per change in days of income", "gold at end vs honest"],
    (["core_formation", "nascent_soul"] as const).map((realm) => {
      const nsDay = hopper.entered.nascent_soul ?? Infinity;
      const inRealm = changes.filter((x) => (hopper.c.dayOf(x.at) >= nsDay ? "nascent_soul" : "core_formation") === realm);
      return [short(realm), inRealm.length, f0(inRealm.reduce((a, x) => a + x.gold, 0)), f1(days(R.classes.changeGold, realm)), f0(hopper.c.s.gold - base.physical.c.s.gold)];
    }),
    csv,
  );

  // 10. Extender: the price of extending a one-time task (price arithmetic).
  table(
    "Shop: extender (one extension per expired one-time task, priced at its base gold, at least 5), in days of Foundation income",
    ["effort", "trivial", "easy", "mid", "hard", "deadly"],
    (["quick", "session", "day", "project"] as const).map((effort) => [
      effort,
      ...(["trivial", "easy", "mid", "hard", "deadly"] as const).map((d) => {
        const price = Math.max(R.main.extension.minPrice, goldForPoints(workPoints(d, effort)));
        return `${f0(price)} (${f1(days(price, "foundation_establishment"))} d)`;
      }),
    ]),
    csv,
  );

  // 11. No gold loop anywhere: items, potions, the goblin.
  const itemLoops: string[] = [];
  for (const realm of GEAR_REALMS) {
    for (const [slot, kind] of [["armor", "robe"], ["armor", "shop"], ["weapon", "shop"]] as const) {
      const item: GearItem = { id: "x", slot, kind, realm, damageBp: 0, obtainedAt: 0 };
      if (sellPrice(item) >= shopPrice(slot, realm, R, kind)) itemLoops.push(`${short(realm)} ${kind} ${slot}`);
      if (itemValue(item) <= 0) itemLoops.push(`${short(realm)} ${kind} ${slot} has no value`);
    }
  }
  const honest = goblin("honest");
  const goblinRows: (string | number)[][] = [];
  const goblinLoops: string[] = [];
  for (const strategy of ["sells free robes", "sells free robes, buys one back", "goes without armor", "buy-to-sell loop", "robe buy-to-sell loop", "repair then sell"] as const satisfies readonly Goblin[]) {
    const g = goblin(strategy);
    goblinRows.push([strategy, f0(g.gold - honest.gold), f0(g.qi - honest.qi), f0(g.netGearGold), g.loops]);
    // A loop strategy that ends ahead of the honest play would be a gold loop; selling the free robes once is bounded (ruling 158).
    if ((strategy === "buy-to-sell loop" || strategy === "robe buy-to-sell loop" || strategy === "repair then sell") && g.gold > honest.gold) goblinLoops.push(strategy);
  }
  table("Shop: goblin at the final prices (a studier, gym 2x a week, one year) vs the honest play", ["strategy", "gold vs honest", "Qi vs honest", "net gold on gear", "loops"], goblinRows, csv);
  checks.push({
    name: "No persona has a gold loop",
    pass: itemLoops.length === 0 && !potionLoop && goblinLoops.length === 0,
    detail: `items sold at or above price: ${itemLoops.join(", ") || "none"}; potions pay back their price: ${potionLoop ? "yes" : "no"}; goblin loops ahead of honest: ${goblinLoops.join(", ") || "none"}`,
  });

  table(
    "Shop: pass criteria",
    ["criterion", "result", "detail"],
    checks.map((c) => [c.name, c.pass ? "PASS" : "FAIL", c.detail]),
    csv,
  );
  writeFileSync(join(outDir, "shop.csv"), csv.join("\n"));
}

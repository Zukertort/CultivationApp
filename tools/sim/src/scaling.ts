/**
 * Realm scaling (proposal E, not built): a projection of the proposed rules
 * from rates measured by the real engine under the current ones.
 *
 * The proposal: a claimed tribulation waits for its realm's completion cost
 * in Qi (K, 2K, 4K, 8K from Foundation, K = 350); gear stats and one-time
 * prices double per realm; recurring costs stay the same share of income.
 * The engine doesn't implement it yet, so this script runs each persona for
 * three years under the current rules (robe worn, repaired at the warnings)
 * to measure Main Qi a day, the Main Qi multiplier, gold a day and repairs
 * per realm, then applies the proposed numbers to those rates. Once the
 * rules are built, real runs replace every number here.
 *
 * Run: pnpm --filter @cultivation/sim scaling
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { RULES_V1, mainQiMultiplier, sellPrice, shopPrice, type GearItem, type Realm } from "@cultivation/rules";
import { PERSONAS, armorMorning, run, type Persona } from "./shop.js";

const YEARS3 = 1095;
const K = 350;
const REALMS = ["foundation_establishment", "core_formation", "nascent_soul", "spirit_realm"] as const;
type R = (typeof REALMS)[number];
const short: Record<R, string> = { foundation_establishment: "F", core_formation: "CF", nascent_soul: "NS", spirit_realm: "SR" };
const factor: Record<R, number> = { foundation_establishment: 1, core_formation: 2, nascent_soul: 4, spirit_realm: 8 };
/** Tribulations the realm's breakthrough needs: Foundation's three, the honest plan's Core Formation set of 6 and Nascent Soul set of 4; Spirit Realm has none until Step 2 (ruling 109). */
const tribulations: Record<R, number> = { foundation_establishment: 3, core_formation: 6, nascent_soul: 4, spirit_realm: 0 };
/** The honest plan's own pace (deadlines), in days: Foundation's three one after another, Core Formation's last deadline at 350 days, Nascent Soul's at 350. */
const schedule: Record<R, number> = { foundation_establishment: 63, core_formation: 350, nascent_soul: 350, spirit_realm: 0 };
/** Proposed shop weapon bonus (E6): 2, 4, 8, 16%. */
const weapon: Record<R, number> = { foundation_establishment: 0.02, core_formation: 0.04, nascent_soul: 0.08, spirit_realm: 0.16 };
/** Today's thresholds for comparison (ruling 81): the Qi each realm's steps cost. */
const todayCost: Record<R, number> = { foundation_establishment: 1050, core_formation: 2350, nascent_soul: 1500, spirit_realm: 0 };

const f0 = (n: number) => (Number.isFinite(n) ? n.toFixed(0) : "-");
const f1 = (n: number) => (Number.isFinite(n) ? n.toFixed(1) : "-");
const pct = (n: number) => (Number.isFinite(n) ? `${(n * 100).toFixed(1)}%` : "-");
const months = (days: number) => days / 30.4;

const csv: string[] = [];
function table(title: string, header: string[], rows: (string | number)[][]): void {
  console.log(`\n${title}\n`);
  console.log(header.join("\t"));
  for (const r of rows) console.log(r.join("\t"));
  csv.push(`# ${title}`, header.join(","), ...rows.map((r) => r.map((x) => `"${x}"`).join(",")), "");
}

interface Measured {
  qiPerDay: Record<R, number>;
  multiplier: Record<R, number>;
  goldPerDay: Record<R, number>;
  repairsPerDay: Record<R, number>;
}

function measure(p: Persona): Measured {
  const mult: Record<string, { sum: number; n: number }> = {};
  const r = run({
    persona: p,
    days: YEARS3,
    morning: armorMorning("robe"),
    evening: (c) => {
      const m = (mult[c.s.main.realm] ??= { sum: 0, n: 0 });
      m.sum += mainQiMultiplier(c.s);
      m.n += 1;
    },
    id: `scale-${p.key}`,
  });
  const by = (f: (realm: R) => number) => Object.fromEntries(REALMS.map((realm) => [realm, f(realm)])) as Record<R, number>;
  return {
    qiPerDay: by((realm) => (r.per[realm as Realm]?.qi ?? NaN) / (r.per[realm as Realm]?.days ?? NaN)),
    multiplier: by((realm) => (mult[realm] ? mult[realm].sum / mult[realm].n : NaN)),
    goldPerDay: by((realm) => (r.per[realm as Realm]?.gold ?? NaN) / (r.per[realm as Realm]?.days ?? NaN)),
    repairsPerDay: by((realm) => (r.per[realm as Realm]?.repairs ?? NaN) / (r.per[realm as Realm]?.days ?? NaN)),
  };
}

const measured = Object.fromEntries(PERSONAS.map((p) => [p.key, measure(p)])) as Record<Persona["key"], Measured>;
const D = measured.physical.goldPerDay;

// 1. Pace: months per tribulation and per realm.
table(
  `Scaling (projection): completion cost K=${K} doubling per realm; months per tribulation from Main Qi a day; the realm takes the longer of its Qi and its tribulation deadlines`,
  ["persona", "realm", "cost per tribulation", "realm total (today)", "Main Qi/day", "months per tribulation", "realm months by Qi", "realm months by deadlines", "realm months"],
  PERSONAS.flatMap((p) =>
    REALMS.filter((r) => tribulations[r] > 0).map((realm) => {
      const m = measured[p.key];
      const cost = K * factor[realm];
      const perTrib = cost / m.qiPerDay[realm];
      const byQi = tribulations[realm] * perTrib;
      return [p.label, short[realm], cost, `${cost * tribulations[realm]} (${todayCost[realm]})`, f1(m.qiPerDay[realm]), f1(months(perTrib)), f1(months(byQi)), f1(months(schedule[realm])), f1(months(Math.max(byQi, schedule[realm])))];
    }),
  ),
);

// 2. Weapon payback.
table(
  "Scaling (projection): proposed shop weapon (2, 4, 8, 16%) at prices doubling per realm; days saved paying the realm's completion costs",
  ["persona", "realm", "Main multiplier", "weapon", "price (days of income)", "realm days by Qi", "with weapon", "days saved"],
  PERSONAS.flatMap((p) =>
    REALMS.filter((r) => tribulations[r] > 0).map((realm) => {
      const m = measured[p.key];
      const need = K * factor[realm] * tribulations[realm];
      const q = m.qiPerDay[realm];
      const qw = (q * (m.multiplier[realm] + weapon[realm])) / m.multiplier[realm];
      const price = shopPrice("weapon", "foundation_establishment") * factor[realm];
      return [p.label, short[realm], f1(m.multiplier[realm]), pct(weapon[realm]), `${f0(price)} (${f1(price / D[realm])})`, f0(need / q), f0(need / qw), f1(need / q - need / qw)];
    }),
  ),
);

// 3. One-time prices in days of income.
table(
  "Scaling (projection): one-time prices doubling per realm from today's Foundation prices, in days of physical-practice income",
  ["realm", "robe", "shop armor", "shop weapon", "free robe's sale (70%)"],
  REALMS.map((realm) => {
    const f = factor[realm];
    const robe = shopPrice("armor", "foundation_establishment", RULES_V1, "robe") * f;
    const armor = shopPrice("armor", "foundation_establishment") * f;
    const weap = shopPrice("weapon", "foundation_establishment") * f;
    const free: GearItem = { id: "r", slot: "armor", kind: "robe", realm: "foundation_establishment", damageBp: 0, obtainedAt: 0 };
    const sale = sellPrice(free) * f;
    return [short[realm], `${f0(robe)} (${f1(robe / D[realm])} d)`, `${f0(armor)} (${f1(armor / D[realm])} d)`, `${f0(weap)} (${f1(weap / D[realm])} d)`, `${f0(sale)} (${f1(sale / D[realm])} d)`];
  }),
);

// 4. Recurring costs as a share of income: decoupled (the proposal) vs coupled to item value (x2 per realm).
table(
  "Scaling (projection): repairs (robe worn, repaired at the warnings) and the unarmored loss (factor 2) as a share of gold income; decoupled keeps Foundation's prices in every realm, coupled doubles them per realm",
  ["persona", "realm", "repairs decoupled", "repairs coupled", "unarmored decoupled", "unarmored coupled"],
  PERSONAS.flatMap((p) =>
    REALMS.filter((r) => r !== "spirit_realm" || measured[p.key].goldPerDay[r] > 0).map((realm) => {
      const m = measured[p.key];
      const base = m.repairsPerDay.foundation_establishment / m.goldPerDay[realm];
      // Unarmored: today's factor-2 loss per damaging day at Foundation prices, for the persona's tier mix (Turtle 5% a day, the others less).
      const bp = p.key === "turtle" ? 500 : p.key === "studier" ? 100 : 0;
      const loss = (RULES_V1.gear.unarmoredLossFactor * RULES_V1.gear.repairShare * shopPrice("armor", "foundation_establishment") * bp) / 10_000;
      const share = loss / m.goldPerDay[realm];
      return [p.label, short[realm], pct(base), pct(base * factor[realm]), pct(share), pct(share * factor[realm])];
    }),
  ),
);

const free = sellPrice({ id: "r", slot: "armor", kind: "robe", realm: "foundation_establishment", damageBp: 0, obtainedAt: 0 });
console.log(
  `\nScaling (projection): goblin. Buying sells back at 70% in every realm, so buy-to-sell still loses 30% at every price. Selling every free robe once yields ${f0(free * (1 + 2 + 4 + 8))} gold in a lifetime (${f1((free * 15) / D.foundation_establishment)} days of income), up from ${f0(free * 4)} with flat prices.`,
);

const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "out");
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "scaling.csv"), csv.join("\n"));
console.log(`\nCSV written to ${outDir}`);

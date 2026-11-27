/**
 * Realm scaling report (rulings 169-173), from real runs through the engine:
 * per persona and realm, months per completed tribulation and per realm, the
 * weapon's payback in days saved, prices in days of income, repairs and the
 * unarmored loss as a share of income, the goblin, and the closed-door
 * extender against an honest rester.
 *
 * Part of pnpm sim.
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { CLOSED_DOOR_OATH } from "@cultivation/schema";
import { DAY, GEAR_REALMS, RULES_V1, completionCost, shopPrice, vacationDaysLeft, vacationPrice, type CultivatorState, type GearRealm, type Realm } from "@cultivation/rules";
import { goblin, type Goblin } from "./gear.js";
import { PERSONAS, armorMorning, buyAndWear, noArmorEvening, repairIfDue, run, type Persona, type Run } from "./shop.js";

const YEARS4 = 1460;
const REALMS = ["foundation_establishment", "core_formation", "nascent_soul"] as const satisfies readonly GearRealm[];
const short = (r: string) => ({ qi_condensation: "QC", foundation_establishment: "F", core_formation: "CF", nascent_soul: "NS", spirit_realm: "SR" })[r] ?? r;
const f0 = (n: number) => (Number.isFinite(n) ? n.toFixed(0) : "-");
const f1 = (n: number) => (Number.isFinite(n) ? n.toFixed(1) : "-");
const pct = (n: number) => (Number.isFinite(n) ? `${(n * 100).toFixed(1)}%` : "-");
const MONTH = 30.4;

function table(csv: string[], title: string, header: string[], rows: (string | number)[][]): void {
  console.log(`\n${title}\n`);
  console.log(header.join("\t"));
  for (const r of rows) console.log(r.join("\t"));
  csv.push(`# ${title}`, header.join(","), ...rows.map((r) => r.map((x) => `"${x}"`).join(",")), "");
}

const stay = (r: Run, realm: Realm) => {
  const next = GEAR_REALMS[GEAR_REALMS.indexOf(realm as GearRealm) + 1];
  const from = r.entered[realm];
  const to = next ? r.entered[next] : undefined;
  return from === undefined || to === undefined ? NaN : to - from;
};
const completedIn = (s: CultivatorState, realm: Realm) => Object.values(s.tribulations.items).filter((t) => t.realm === realm && t.completedAt !== null).length;

export function runScalingScenarios(outDir: string): void {
  const csv: string[] = [];
  const base = Object.fromEntries(PERSONAS.map((p) => [p.key, run({ persona: p, days: YEARS4, morning: armorMorning("robe"), id: `sc-base-${p.key}` })])) as Record<Persona["key"], Run>;
  const weapon = Object.fromEntries(
    PERSONAS.map((p) => [
      p.key,
      run({
        persona: p,
        days: YEARS4,
        morning: (c, d, now) => {
          armorMorning("robe")(c, d, now);
          repairIfDue(c, now, "weapon", c.at(d, 5));
          buyAndWear(c, "weapon", c.at(d, 5));
        },
        id: `sc-weapon-${p.key}`,
      }),
    ]),
  ) as Record<Persona["key"], Run>;
  const bare = Object.fromEntries(PERSONAS.map((p) => [p.key, run({ persona: p, days: YEARS4, evening: noArmorEvening, id: `sc-bare-${p.key}` })])) as Record<Persona["key"], Run>;
  const D = (realm: Realm) => {
    const st = base.physical.per[realm];
    return st ? st.gold / st.days : NaN;
  };

  // 1. Pace.
  table(
    csv,
    "Scaling: months per completed tribulation and per realm (4 years; completing costs 350, 700, 1,400 Qi; real achievement and Qi both set the pace)",
    ["persona", "realm", "completion cost", "completed there", "months in the realm", "months per tribulation", "Main Qi/day", "entered (month)"],
    PERSONAS.flatMap((p) =>
      REALMS.map((realm) => {
        const r = base[p.key];
        const n = completedIn(r.c.s, realm);
        const days = stay(r, realm);
        const st = r.per[realm];
        return [p.label, short(realm), completionCost(realm), n, f1(days / MONTH), f1(n > 0 ? days / n / MONTH : NaN), f1(st ? st.qi / st.days : NaN), f1((r.entered[realm] ?? NaN) / MONTH)];
      }),
    ),
  );
  console.log(
    `\nEnd of 4 years: ${PERSONAS.map((p) => `${p.label} ${base[p.key].c.s.main.realm}${base[p.key].c.s.progress.level ? ` ${base[p.key].c.s.progress.level}` : ""}`).join("; ")}`,
  );

  // 2. Weapon payback.
  table(
    csv,
    "Scaling: shop weapon (2, 4, 8% bonus; price doubling per realm) vs none: days saved in each realm's stay, and the weapon's price in days of income",
    ["persona", "realm", "stay none (days)", "stay with weapon", "days saved", "weapon price (gold)", "price in days of income", "repairs (gold)"],
    PERSONAS.flatMap((p) =>
      REALMS.map((realm) => {
        const n = stay(base[p.key], realm);
        const w = stay(weapon[p.key], realm);
        const price = shopPrice("weapon", realm);
        return [p.label, short(realm), f0(n), f0(w), f0(n - w), price, f1(price / D(realm)), f0(weapon[p.key].per[realm]?.repairs ?? NaN)];
      }),
    ),
  );

  // 3. Prices in days of income.
  table(
    csv,
    "Scaling: prices in days of physical-practice income (one-time gear doubles per realm; potions and vacations stay flat)",
    ["realm", "income/day", "robe", "shop armor", "shop weapon", "gain potion", "vacation/day", "class change"],
    REALMS.map((realm) => {
      const s = { main: { realm } } as unknown as CultivatorState;
      const cell = (g: number) => `${f0(g)} (${f1(g / D(realm))} d)`;
      return [
        short(realm),
        f1(D(realm)),
        cell(shopPrice("armor", realm, RULES_V1, "robe")),
        cell(shopPrice("armor", realm)),
        cell(shopPrice("weapon", realm)),
        cell(RULES_V1.potions.gain.gold[realm]),
        cell(vacationPrice(s, 1)),
        realm === "foundation_establishment" ? "-" : cell(RULES_V1.classes.changeGold),
      ];
    }),
  );

  // 4. Recurring costs as a share of income.
  table(
    csv,
    "Scaling: repairs (robe worn, repaired at the warnings) and the unarmored loss (never wearing armor) as a share of gold income",
    ["persona", "realm", "repairs share", "unarmored loss share", "unarmored Qi lost per month"],
    PERSONAS.flatMap((p) =>
      REALMS.map((realm) => {
        const rb = base[p.key].per[realm];
        const nb = bare[p.key].per[realm];
        return [p.label, short(realm), pct(rb ? rb.repairs / rb.gold : NaN), pct(nb ? nb.unarmoredGold / nb.gold : NaN), f1(nb ? (nb.unarmoredQi / nb.days) * MONTH : NaN)];
      }),
    ),
  );

  // 5. Goblin.
  const honest = goblin("honest");
  table(
    csv,
    "Scaling: goblin (a studier, gym 2x a week, one year) vs the honest play",
    ["strategy", "gold vs honest", "Qi vs honest", "net gold on gear", "loops"],
    (["sells free robes", "sells free robes, buys one back", "goes without armor", "buy-to-sell loop", "robe buy-to-sell loop", "higher-realm buy-to-sell loop", "repair then sell"] as const satisfies readonly Goblin[]).map((strategy) => {
      const g = goblin(strategy);
      return [strategy, f0(g.gold - honest.gold), f0(g.qi - honest.qi), f0(g.netGearGold), g.loops];
    }),
  );

  // 6. Closed-door extender vs honest rester (ruling 173): one year, every task still done.
  const rester = (extend: boolean) =>
    run({
      persona: PERSONAS[1]!,
      days: 365,
      morning: (c, d, now) => {
        armorMorning("robe")(c, d, now);
        if (now.rest) return;
        const at = c.at(d, 5);
        const left = vacationDaysLeft(now, at);
        const take = Math.min(left, Math.floor(now.gold / vacationPrice(now, 1)));
        if (take >= 1) {
          c.now("RestStarted", at, { kind: "vacation", until: at + take * DAY });
          return;
        }
        // The extender goes straight into closed-door rest once the vacation quota is spent.
        if (extend) c.now("RestStarted", at, { kind: "closed_door", oath: CLOSED_DOOR_OATH, until: at + RULES_V1.rest.closedDoorMaxDays * DAY });
      },
      id: `sc-rest-${extend}`,
    });
  const honestRester = rester(false);
  const extender = rester(true);
  const row = (label: string, r: Run) => {
    const s = r.c.s;
    const vac = s.vacationLog.reduce((a, v) => a + (v.end - v.start) / DAY, 0);
    const closed = s.closedDoorLog.reduce((a, v) => a + (v.end - v.start) / DAY, 0);
    const gold = Object.values(r.per).reduce((a, st) => a + st.gold, 0);
    const tax = Object.values(r.per).reduce((a, st) => a + st.taxGold, 0);
    return [label, f0(vac), f0(closed), s.main.flags.filter((f) => f.code === "closed_door_after_vacation").length, s.companion.tier, f0(gold), f0(tax), f0(s.shopSpent.vacations)];
  };
  table(
    csv,
    "Scaling: closed-door extender (vacation quota, then closed-door rest) vs honest rester (vacations only), a studier with gym 2x a week, one year",
    ["persona", "vacation days", "closed-door days", "integrity flags", "tier at end", "gold earned", "tax gold paid", "vacation gold"],
    [row("honest rester", honestRester), row("closed-door extender", extender)],
  );

  writeFileSync(join(outDir, "scaling.csv"), csv.join("\n"));
}

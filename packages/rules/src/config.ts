/**
 * Every tunable number lives here. A rules version is a frozen config plus
 * the engine code; rebalancing = a new version + replaying the event log.
 *
 * Numbers marked SIM are placeholders the design doc leaves to the economy
 * simulator.
 */

export const TIERS = ["turtle", "panda", "horse", "tiger", "lion"] as const;
export type Tier = (typeof TIERS)[number];

export interface TierRules {
  /** Food meter size in treats. */
  capacity: number;
  /** Treats lost per week while not resting. */
  weeklyLoss: number;
  /** Additive gold bonus on exercises and routines (0.35 = +35%). */
  goldBonus: number;
  /** Additive Qi bonus on core tasks and quests (applied by the Main path). */
  coreQiBonus: number;
  /** Legendary chance added after a breakthrough (applied by the Main path). */
  breakthroughLegendaryChance: number;
}

export interface RulesConfig {
  version: string;
  tiers: Record<Tier, TierRules>;
  treats: { exercise: number; routine: number };
  /** Max routines per local day that pay out. Exercises are uncapped. */
  routinesPerDayCap: number;
  /** A new companion starts at this fraction of its meter, in both directions. */
  tierStartFraction: number;
  /** SIM: base gold before the tier bonus. */
  gold: { exercise: number; routine: number };
  repetition: {
    /** Completions within a tier that pay full value (original + 2 repeats). */
    fullValueCompletions: number;
    /** Value lost per completion beyond that, as a fraction of base. */
    stepLoss: number;
    /** Floor, as a fraction of base. */
    floor: number;
  };
  poses: { name: string; minMastered: number }[];
  halo: { visibleDays: number; ticketDays: number };
  rest: {
    /** SIM: vacation price per day. */
    vacationGoldPerDay: number;
    closedDoorMaxDays: number;
    closedDoorWindowDays: number;
    closedDoorMaxDaysPerWindow: number;
  };
  /** Roulette odds in basis points (sum = 10000). */
  roulette: {
    oddsBp: { gold: number; qi: number; potion: number; legendary: number; scale: number };
    /** SIM: payout for the gold and Qi prizes. */
    goldPrize: number;
    qiPrize: number;
  };
  scales: { goldBonusEach: number; qiBonusEach: number; forWings: number };
  wings: { goldBonus: number; qiBonus: number };
}

export const RULES_V1: RulesConfig = Object.freeze({
  version: "1.0.0",
  tiers: {
    turtle: { capacity: 30, weeklyLoss: 10, goldBonus: 0.01, coreQiBonus: 0, breakthroughLegendaryChance: 0 },
    panda: { capacity: 800, weeklyLoss: 200, goldBonus: 0.1, coreQiBonus: 0, breakthroughLegendaryChance: 0 },
    horse: { capacity: 1600, weeklyLoss: 400, goldBonus: 0.2, coreQiBonus: 0.1, breakthroughLegendaryChance: 0 },
    tiger: { capacity: 3200, weeklyLoss: 500, goldBonus: 0.3, coreQiBonus: 0.15, breakthroughLegendaryChance: 0 },
    lion: { capacity: 5000, weeklyLoss: 600, goldBonus: 0.35, coreQiBonus: 0.15, breakthroughLegendaryChance: 0.02 },
  },
  treats: { exercise: 10, routine: 200 },
  routinesPerDayCap: 2,
  tierStartFraction: 0.5,
  gold: { exercise: 1, routine: 10 },
  repetition: { fullValueCompletions: 3, stepLoss: 0.15, floor: 0.25 },
  poses: [
    { name: "standing", minMastered: 0 },
    { name: "heroic", minMastered: 1 },
    { name: "warrior", minMastered: 3 },
    { name: "knight", minMastered: 6 },
    { name: "king", minMastered: 10 },
  ],
  halo: { visibleDays: 30, ticketDays: 90 },
  rest: {
    vacationGoldPerDay: 20,
    closedDoorMaxDays: 14,
    closedDoorWindowDays: 91,
    closedDoorMaxDaysPerWindow: 30,
  },
  roulette: {
    oddsBp: { gold: 5000, qi: 3000, potion: 1800, legendary: 190, scale: 10 },
    goldPrize: 100,
    qiPrize: 50,
  },
  scales: { goldBonusEach: 0.1, qiBonusEach: 0.05, forWings: 9 },
  wings: { goldBonus: 1.0, qiBonus: 0.5 },
} satisfies RulesConfig);

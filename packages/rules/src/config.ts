/**
 * Every tunable number lives here. A rules version is a frozen config plus
 * the engine code; rebalancing = a new version + replaying the event log.
 *
 * Numbers marked SIM are placeholders the design doc leaves to the economy
 * simulator.
 */

export const TIERS = ["turtle", "panda", "horse", "tiger", "lion"] as const;
export type Tier = (typeof TIERS)[number];

/** Soul colors from worst to best. Broken, Black and Violet are the weakening colors. */
export const SOUL_COLORS = ["broken", "black", "violet", "white", "green", "blue", "red", "golden", "translucent", "rainbow"] as const;
export type SoulColor = (typeof SOUL_COLORS)[number];
export const WEAKENING_COLORS: readonly SoulColor[] = ["broken", "black", "violet"];
export const GROWTH_COLORS: readonly SoulColor[] = ["green", "blue", "red", "golden", "translucent", "rainbow"];

export interface SoulRules {
  /** All HP values are percentages of a demon's maximum (0-100). */
  startHp: number;
  maxHp: number;
  /** HP removed by a completed positive task. */
  positiveDamage: number;
  /** HP added by a logged negative task. */
  negativeHeal: number;
  passive: {
    /** Days without a positive task (rest excluded) before a demon starts healing. */
    graceDays: number;
    /** Base healing per day after the grace period. */
    hpPerDay: number;
    /** SIM: multiplier on hpPerDay by the current soul color (2x at Rainbow per the doc). */
    colorMultiplier: Record<SoulColor, number>;
  };
  /** A defeated demon that climbs back to this HP revives. */
  reviveHp: number;
  /** A demon strictly above these HP values triggers the color at day's end. */
  weakening: { violet: number; black: number; broken: number };
  /** Minimum demons created (existing) and currently defeated for each growth color. */
  growth: {
    green: { created: number; defeated: number };
    blue: { created: number; defeated: number };
    red: { created: number; defeated: number };
    /** Golden and above: every demon defeated, at least this many. */
    goldenMinDemons: number;
    /** Days without any revival needed for Golden, Translucent and Rainbow. */
    noRevivalDays: { golden: number; translucent: number; rainbow: number };
  };
  /** Minimum days between two new demons. */
  newDemonCooldownDays: number;
  /** A demon can't be deleted until it is this many days old. */
  deletionLockDays: number;
  /** Deleting at a weakening color feeds the remaining demons until the strongest is at this HP. */
  deletionFeedToHp: number;
  /** A renamed demon below this HP is raised to it. */
  renameMinHp: number;
}

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
  /**
   * Body repetition decay penalizes stagnation, not consistency: a version of
   * an exercise or routine pays full value for a while after its first
   * completion, however often it is done, then decays week by week until the
   * cultivator levels it up ("BJJ" -> "BJJ II").
   */
  repetition: {
    /** Weeks of full value after a version's first completion. */
    fullValueWeeks: number;
    /** Value lost per week beyond that, as a fraction of base. */
    weeklyLoss: number;
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
  soul: SoulRules;
}

export const RULES_V1: RulesConfig = Object.freeze({
  version: "1.2.0",
  tiers: {
    turtle: { capacity: 30, weeklyLoss: 10, goldBonus: 0.01, coreQiBonus: 0, breakthroughLegendaryChance: 0 },
    panda: { capacity: 800, weeklyLoss: 200, goldBonus: 0.1, coreQiBonus: 0, breakthroughLegendaryChance: 0 },
    horse: { capacity: 1600, weeklyLoss: 300, goldBonus: 0.2, coreQiBonus: 0.1, breakthroughLegendaryChance: 0 },
    tiger: { capacity: 3200, weeklyLoss: 400, goldBonus: 0.3, coreQiBonus: 0.15, breakthroughLegendaryChance: 0 },
    lion: { capacity: 5000, weeklyLoss: 500, goldBonus: 0.35, coreQiBonus: 0.15, breakthroughLegendaryChance: 0.02 },
  },
  treats: { exercise: 10, routine: 200 },
  routinesPerDayCap: 2,
  tierStartFraction: 0.5,
  gold: { exercise: 1, routine: 10 },
  repetition: { fullValueWeeks: 4, weeklyLoss: 0.15, floor: 0.25 },
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
  soul: {
    startHp: 50,
    maxHp: 100,
    positiveDamage: 5,
    negativeHeal: 10,
    passive: {
      graceDays: 3,
      hpPerDay: 1,
      colorMultiplier: {
        broken: 1,
        black: 1,
        violet: 1,
        white: 1,
        green: 1.1,
        blue: 1.2,
        red: 1.3,
        golden: 1.4,
        translucent: 1.6,
        rainbow: 2,
      },
    },
    reviveHp: 50,
    weakening: { violet: 70, black: 80, broken: 90 },
    growth: {
      green: { created: 1, defeated: 1 },
      blue: { created: 3, defeated: 3 },
      red: { created: 6, defeated: 6 },
      goldenMinDemons: 7,
      noRevivalDays: { golden: 7, translucent: 30, rainbow: 365 },
    },
    newDemonCooldownDays: 7,
    deletionLockDays: 7,
    deletionFeedToHp: 80,
    renameMinHp: 50,
  },
} satisfies RulesConfig);

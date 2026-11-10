/**
 * Every tunable number lives here. A rules version is a frozen config plus
 * the engine code; rebalancing = a new version + replaying the event log.
 *
 * Numbers marked SIM are placeholders the design doc leaves to the economy
 * simulator.
 */
import type { Difficulty, Effort } from "@cultivation/schema";

export const TIERS = ["turtle", "panda", "horse", "tiger", "lion"] as const;
export type Tier = (typeof TIERS)[number];

/** Soul colors from worst to best. Broken, Black and Violet are the weakening colors. */
export const SOUL_COLORS = ["broken", "black", "violet", "white", "green", "blue", "red", "golden", "translucent", "rainbow"] as const;
export type SoulColor = (typeof SOUL_COLORS)[number];
export const WEAKENING_COLORS: readonly SoulColor[] = ["broken", "black", "violet"];
export const GROWTH_COLORS: readonly SoulColor[] = ["green", "blue", "red", "golden", "translucent", "rainbow"];

/** Main realms in order. Step 1 holds the first four; Spirit Realm starts Step 2. */
export const REALMS = [
  "qi_condensation",
  "foundation_establishment",
  "core_formation",
  "nascent_soul",
  "spirit_realm",
  "void_god",
  "golden_god",
  "true_god",
  "sovereign",
  "immortal",
] as const;
export type Realm = (typeof REALMS)[number];

export type MainPath = "main" | "body" | "soul";

/** Bands a soul drop roll lands in; the "item" band (a common item) splits into the two potion kinds until gear exists. */
export type SoulDropBand = "gold" | "qi" | "item" | "legendary" | "lose_gold" | "lose_qi" | "lose_item";

/** Age-based repetition decay (Body and Main, rulings 18-19). */
export interface RepetitionRules {
  /** Weeks of full value after a version's first completion (active time only). */
  fullValueWeeks: number;
  /** Value lost per week beyond that, as a fraction of base. */
  weeklyLoss: number;
  /** Floor, as a fraction of base. */
  floor: number;
}

/** Main path: tasks, quests and the procrastination tax. Every number here is a SIM value (ruling 47). */
export interface MainRules {
  /** Work points: difficulty points x effort weight (ruling 38). Each difficulty level is twice the work of the one below. */
  difficultyPoints: Record<Difficulty, number>;
  effortWeight: Record<Effort, number>;
  /**
   * Qi curve: [work points, Qi] anchors, starting at [0, 0], with slopes that
   * never decrease (convex), so one task always pays at least as much as the
   * same work split into pieces. Extrapolated past the last anchor with the
   * last slope.
   */
  qiCurve: readonly (readonly [number, number])[];
  /** Gold per work point, before decay and bonuses. Linear, so splitting never changes gold. */
  goldPerPoint: number;
  /** Simple tasks pay well in the first two realms and taper above (Qi only). */
  simpleDifficulties: readonly Difficulty[];
  simpleTaper: Record<Realm, number>;
  /**
   * A completed quest's bonus is this cap times the members' own Qi (ruling
   * 54). The cap grows with the members' total effort in days of work (each
   * effort weight / dayWeight), piecewise linear through these [days, cap]
   * anchors and flat past the last (ruling 51).
   */
  questBonusCap: readonly (readonly [number, number])[];
  /** Effort weight of one day of work: converts effort weights to days. */
  dayWeight: number;
  /**
   * Item drops from completed quests (ruling 52): the chance by the members'
   * total effort in days, through these [days, chance] anchors (flat past the
   * last); server-rolled; at most maxRollsPerDay per local day. An item is a
   * potion until gear exists.
   */
  questDrops: { chance: readonly (readonly [number, number])[]; maxRollsPerDay: number };
  /**
   * "Work on this task today" (ruling 49): once per task per local day, pays
   * nothing. Total uses per one-time task by effort; efforts missing here
   * can't use it. It postpones Main's idle tax onto the task rather than
   * cancelling it (ruling 59).
   */
  workOn: {
    capByEffort: Partial<Record<Effort, number>>;
    recurringPeriods: readonly ("week" | "month" | "year")[];
  };
  /** Restores of one task within windowDays that flag it in the integrity log (ruling 48). */
  archiveChurn: { restores: number; windowDays: number };
  repetition: RepetitionRules;
  /** Paying completions per task name per local day (ruling 39). */
  maxPaidPerNamePerDay: number;
  maxDeadlineDays: number;
  extension: {
    /** Days after the deadline when the one extension can still be bought. */
    windowDays: number;
    /** Price: the item's base gold (unfinished tasks for a quest), at least this. */
    minPrice: number;
  };
  tax: {
    /** Main's tax for one idle day; a missed occurrence costs this x (period days / count). */
    main: { qi: number; gold: number };
    /** Body and Soul pay this fraction of Main's tax (1/5). */
    sideFraction: number;
    /** Days without activity before the idle tax starts. */
    graceDays: Record<MainPath, number>;
    /**
     * How occurrences owed in a partly active period count: "fractional"
     * charges the exact share (ruling 48); "floor" rounds down, which let
     * nightly archive-and-restore dodge a daily task.
     */
    partialPeriods: "floor" | "fractional";
  };
  debtCap: { qi: number; gold: number };
  comeback: { tasks: number; minDifficulty: Difficulty; windowDays: number };
  /** Push notification lead times before a quest deadline, in hours. */
  questDeadlineAlertHours: readonly number[];
}

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
    /**
     * Days on the Golden clock needed for Golden, Translucent and Rainbow. The
     * clock starts when the Golden condition first holds, pauses during rest,
     * and resets when any defeated demon revives.
     */
    goldenClockDays: { golden: number; translucent: number; rainbow: number };
  };
  /** Minimum days between two new demons. */
  newDemonCooldownDays: number;
  /** A demon can't be deleted until it is this many days old. */
  deletionLockDays: number;
  /** Deleting at a weakening color feeds the remaining demons until the strongest is at this HP. */
  deletionFeedToHp: number;
  /** A renamed demon below this HP is raised to it. */
  renameMinHp: number;
  drops: {
    /**
     * Odds in basis points per soul color; the rest of 10000 is "none".
     * Growth colors hold gains (rolled by positive tasks), weakening colors
     * hold losses (rolled by negative tasks). The doc fixes each color's
     * total; SIM: the split of "gain/loss (items, gold or Qi)".
     */
    oddsBp: Record<SoulColor, Partial<Record<SoulDropBand, number>>>;
    /** Drop rolls earned per local day, across tasks and quests (a quest earns one per demon hit). */
    maxRollsPerDay: number;
    /** SIM: amounts. Gains get the gold/Qi multipliers; losses don't and never go below 0. Gold is about one routine's worth. */
    gold: number;
    qi: number;
    loseGold: number;
    loseQi: number;
  };
  /** Push alerts fire when a demon is within this many HP points of a threshold. */
  alertMargin: number;
}

export interface TierRules {
  /** Food meter size in treats. */
  capacity: number;
  /** Treats lost per week while not resting. */
  weeklyLoss: number;
  /** Additive gold bonus on Body and Main gold only (0.35 = +35%; ruling 35). */
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
  repetition: RepetitionRules;
  /** Poses from Skill; the Qi bonus applies to every Qi gain (ruling 35). */
  poses: { name: string; minMastered: number; qiBonus: number }[];
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
  /**
   * Potions (ruling 58): only obtained, never crafted. Every potion drop (a
   * soul or quest "item", a roulette potion) is a legendary potion with
   * probability `legendaryShare`, else a gain potion; the server rolls it.
   */
  potions: {
    legendaryShare: number;
    /** A gain potion adds this to the additive gold and Qi pool for `hours`; one active at a time. */
    gain: { bonus: number; hours: number };
    /** Stored for now; with gear: + this legendary chance at the next breakthrough, `perBreakthrough` at most. */
    legendary: { chanceBonus: number; perBreakthrough: number };
  };
  soul: SoulRules;
  main: MainRules;
  notifications: {
    /** Push notifications per local day; the most urgent are kept. */
    maxPerDay: number;
    /** How far ahead local notifications are scheduled (rebuilt after every event). */
    horizonDays: number;
    /** Push when the companion is projected to fall to this fraction of its meter. */
    companionHungryFraction: number;
  };
}

export const RULES_V1: RulesConfig = Object.freeze({
  version: "1.9.0",
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
    { name: "standing", minMastered: 0, qiBonus: 0 },
    { name: "heroic", minMastered: 1, qiBonus: 0.01 },
    { name: "warrior", minMastered: 3, qiBonus: 0.02 },
    { name: "knight", minMastered: 6, qiBonus: 0.03 },
    { name: "king", minMastered: 10, qiBonus: 0.05 },
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
  potions: { legendaryShare: 0.5, gain: { bonus: 0.1, hours: 24 }, legendary: { chanceBonus: 0.05, perBreakthrough: 1 } },
  notifications: { maxPerDay: 3, horizonDays: 14, companionHungryFraction: 0.05 },
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
      goldenClockDays: { golden: 7, translucent: 30, rainbow: 365 },
    },
    newDemonCooldownDays: 7,
    deletionLockDays: 7,
    deletionFeedToHp: 80,
    renameMinHp: 50,
    drops: {
      oddsBp: {
        rainbow: { gold: 4000, legendary: 2000 },
        translucent: { gold: 1000 },
        golden: { gold: 300, qi: 300, item: 200 },
        red: { gold: 200, qi: 200, item: 200 },
        blue: { gold: 150, qi: 150, item: 100 },
        green: { gold: 100, qi: 50, item: 50 },
        white: {},
        violet: { lose_gold: 200, lose_qi: 200, lose_item: 100 },
        black: { lose_gold: 1000 },
        broken: { lose_gold: 2000, lose_item: 500 },
      },
      maxRollsPerDay: 3,
      gold: 10,
      qi: 10,
      loseGold: 20,
      loseQi: 10,
    },
    alertMargin: 5,
  },
  main: {
    difficultyPoints: { trivial: 1, easy: 2, mid: 4, hard: 8, deadly: 16 },
    effortWeight: { quick: 0.25, session: 1, day: 4, project: 16 },
    qiCurve: [
      [0, 0],
      [1, 1],
      [2, 3],
      [4, 8],
      [8, 20],
      [16, 50],
    ],
    goldPerPoint: 1.25,
    simpleDifficulties: ["trivial", "easy"],
    simpleTaper: {
      qi_condensation: 1,
      foundation_establishment: 1,
      core_formation: 0.5,
      nascent_soul: 0.25,
      spirit_realm: 0.1,
      void_god: 0.1,
      golden_god: 0.1,
      true_god: 0.1,
      sovereign: 0.1,
      immortal: 0.1,
    },
    // Bands (ruling 51): about a day 2-5%, a week 10-20%, a year 30-50%; SIM: the midpoints.
    questBonusCap: [
      [0, 0],
      [1, 0.035],
      [7, 0.15],
      [365, 0.4],
    ],
    dayWeight: 4,
    // SIM: below any tribulation drop, scaled by the same effort bands.
    questDrops: {
      chance: [
        [0, 0],
        [1, 0.02],
        [7, 0.08],
        [365, 0.25],
      ],
      maxRollsPerDay: 2,
    },
    workOn: { capByEffort: { day: 3, project: 30 }, recurringPeriods: ["week", "month", "year"] },
    archiveChurn: { restores: 3, windowDays: 30 },
    repetition: { fullValueWeeks: 4, weeklyLoss: 0.15, floor: 0.25 },
    maxPaidPerNamePerDay: 2,
    maxDeadlineDays: 365,
    extension: { windowDays: 3, minPrice: 5 },
    tax: {
      main: { qi: 5, gold: 5 },
      sideFraction: 0.2,
      graceDays: { main: 3, body: 7, soul: 7 },
      partialPeriods: "fractional",
    },
    debtCap: { qi: 50, gold: 50 },
    comeback: { tasks: 3, minDifficulty: "easy", windowDays: 3 },
    questDeadlineAlertHours: [72, 48, 24, 1],
  },
} satisfies RulesConfig);

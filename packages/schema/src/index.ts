import { z } from "zod";

/**
 * Event schema. Events are immutable facts; every derived number in the game
 * comes from replaying them through @cultivation/rules.
 *
 * Conventions:
 * - `at` is epoch milliseconds (UTC). The rules engine never reads a clock.
 * - Random outcomes are stored in the event (see RouletteSpun.prize), never
 *   re-rolled on replay.
 * - Ids are client-generated (e.g. UUIDv7) so events can be created offline.
 */

const id = z.string().min(1).max(128);
const epochMs = z.number().int().nonnegative();

const base = {
  id,
  userId: id,
  at: epochMs,
};

// ---- Onboarding -----------------------------------------------------------

export const OATH_TEXT = "I will not fake my achievements and I will cultivate with all my heart.";

export const CultivatorCreated = z.object({
  ...base,
  type: z.literal("CultivatorCreated"),
  name: z.string().min(1).max(64),
  /** Minutes east of UTC; sets the cultivator's day boundary (Buenos Aires = -180). */
  tzOffsetMinutes: z.number().int().min(-14 * 60).max(14 * 60),
  oath: z.literal(OATH_TEXT),
});

// ---- Body: exercises and routines -----------------------------------------

export const BodyActivityKind = z.enum(["exercise", "routine"]);

/**
 * Raising a task's difficulty means defining a new named version
 * ("Squats" -> "Squats II"), which gets a new activityId and restarts the
 * repetition-decay clock.
 */
export const BodyActivityDefined = z.object({
  ...base,
  type: z.literal("BodyActivityDefined"),
  activityId: id,
  name: z.string().min(1).max(80),
  kind: BodyActivityKind,
});

export const BodyActivityLogged = z.object({
  ...base,
  type: z.literal("BodyActivityLogged"),
  activityId: id,
});

// ---- Body: skills and mastery ----------------------------------------------

export const SkillDefined = z.object({
  ...base,
  type: z.literal("SkillDefined"),
  skillId: id,
  name: z.string().min(1).max(80),
  /** Ordered ranks; the last one is what the cultivator defines as mastery. */
  ranks: z.array(z.string().min(1).max(40)).min(1).max(20),
});

export const Evidence = z.object({
  kind: z.enum(["photo", "link"]),
  ref: z.string().min(1).max(2048),
});

export const SkillRankAchieved = z.object({
  ...base,
  type: z.literal("SkillRankAchieved"),
  skillId: id,
  rankIndex: z.number().int().nonnegative(),
  evidence: Evidence.optional(),
});

// ---- Soul: heart demons -------------------------------------------------------

/** A soul task. Its id links it to exactly one demon (ids are unique across demons). */
export const SoulTask = z.object({
  taskId: id,
  name: z.string().min(1).max(80),
});

const demonDefinition = {
  demonId: id,
  /** The thought, feeling, mood or behavior to change. */
  name: z.string().min(1).max(120),
  /** Tasks that counter the demon (damage it). At least one is required. */
  positiveTasks: z.array(SoulTask).min(1).max(20),
  /** Habits that feed the demon (heal it). Optional: not every demon has one. */
  negativeTasks: z.array(SoulTask).max(20).default([]),
};

export const HeartDemonCreated = z.object({
  ...base,
  type: z.literal("HeartDemonCreated"),
  ...demonDefinition,
});

/** Rename an undefeated demon and redefine its tasks (to fight a different demon first). */
export const HeartDemonRenamed = z.object({
  ...base,
  type: z.literal("HeartDemonRenamed"),
  ...demonDefinition,
});

export const HeartDemonDeleted = z.object({
  ...base,
  type: z.literal("HeartDemonDeleted"),
  demonId: id,
});

/**
 * Outcome of a soul drop roll, rolled on the server with
 * `soulDropOutcome(color, polarity, u)`. Positive tasks roll for gains at
 * growth colors; negative tasks roll for losses at weakening colors. Until
 * gear exists, a common item is a potion of either kind (ruling 58);
 * "lose_item" loses a potion.
 */
export const SoulDrop = z.enum(["none", "gold", "qi", "gain_potion", "legendary_potion", "legendary", "lose_gold", "lose_qi", "lose_item"]);

/** A completed positive task or a logged negative task; the polarity comes from the demon's definition. */
export const SoulTaskLogged = z.object({
  ...base,
  type: z.literal("SoulTaskLogged"),
  taskId: id,
  /**
   * The roll's outcome when the server rolled it at logging time. Omitted when
   * logged offline: the server appends a SoulDropRolled on sync instead.
   */
  drop: SoulDrop.optional(),
});

/** A soul quest attacks several demons at once (one meditation session against several demons). */
export const SoulQuestDefined = z.object({
  ...base,
  type: z.literal("SoulQuestDefined"),
  questId: id,
  name: z.string().min(1).max(80),
  demonIds: z.array(id).min(2).max(20),
});

/**
 * Completing a quest damages every linked demon once and rolls once per demon
 * hit, under the daily roll cap. A quest completes once.
 */
export const SoulQuestCompleted = z.object({
  ...base,
  type: z.literal("SoulQuestCompleted"),
  questId: id,
  /** Outcomes when rolled at logging time; omitted when logged offline (see SoulDropRolled). */
  drops: z.array(SoulDrop).max(20).optional(),
});

/**
 * Appended by the server on sync for a task or quest event whose earned rolls
 * have no recorded outcome, so logging offline can't skip a roll.
 */
export const SoulDropRolled = z.object({
  ...base,
  type: z.literal("SoulDropRolled"),
  /** The SoulTaskLogged or SoulQuestCompleted event the rolls belong to. */
  eventId: id,
  drops: z.array(SoulDrop).min(1).max(20),
});

// ---- Main: interview, tasks and quests --------------------------------------

/**
 * The Qi Condensation interview, answered at the early level. It starts the
 * procrastination-tax clocks of all three paths at once (ruling 44). An
 * interest may be empty while the cultivator is still undecided.
 */
export const InterviewAnswered = z.object({
  ...base,
  type: z.literal("InterviewAnswered"),
  interests: z.object({
    main: z.string().max(500),
    body: z.string().max(500),
    soul: z.string().max(500),
  }),
});

/** Self-rated relative to the cultivator's current abilities. */
export const Difficulty = z.enum(["trivial", "easy", "mid", "hard", "deadly"]);
/** Self-rated and locked at creation: quick (<30 min), session (~1-2 h), day, project (several days). */
export const Effort = z.enum(["quick", "session", "day", "project"]);
/** Local day, ISO week (from Monday), calendar month or calendar year. */
export const Period = z.enum(["day", "week", "month", "year"]);

/** Most completions a recurring task can ask for in a period (at most 2 a day). */
export const MAX_PER_PERIOD = { day: 2, week: 14, month: 62, year: 732 } as const;

const OnceSchedule = z.object({
  kind: z.literal("once"),
  deadline: epochMs,
});

const RecurringSchedule = z
  .object({
    kind: z.literal("recurring"),
    /** Completions per period; also the payout cap. */
    count: z.number().int().min(1),
    per: Period,
    /** Optional end date; after it the task counts as archived. */
    endsAt: epochMs.optional(),
  })
  .superRefine((s, ctx) => {
    if (s.count > MAX_PER_PERIOD[s.per]) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `at most ${MAX_PER_PERIOD[s.per]} per ${s.per}` });
    }
  });

/** One-time (deadline, expires, one paid extension) or recurring (frequency, never expires). */
export const TaskSchedule = z.union([OnceSchedule, RecurringSchedule]);

const mainTaskFields = {
  taskId: id,
  /** Repetition is tracked by name: "Math exercise II" starts fresh. */
  name: z.string().min(1).max(120),
  difficulty: Difficulty,
  effort: Effort,
  /** Cross-path tags (rulings 116-117): a paying completion also counts as a Body routine, as the class group allows. */
  alsoBody: z.boolean().optional(),
  /** Cross-path tags: a paying completion also damages this heart demon, as the class group allows. */
  alsoSoulDemonId: id.optional(),
};

export const MainTaskDefined = z.object({
  ...base,
  type: z.literal("MainTaskDefined"),
  ...mainTaskFields,
  schedule: TaskSchedule,
  /**
   * A new version of this recurring task (e.g. "Math exercise II" replacing
   * "Math exercise"). The old task is archived if still open, and the new one
   * takes over its count for the current period (ruling 55).
   */
  replaces: id.optional(),
});

/**
 * A quest bundles 2-52 new one-time tasks (52: weekly milestones for a year;
 * ruling 54). A member without a deadline shares the quest's; one with its
 * own deadline (on or before the quest's) is a milestone (ruling 50).
 */
export const MainQuestDefined = z.object({
  ...base,
  type: z.literal("MainQuestDefined"),
  questId: id,
  name: z.string().min(1).max(120),
  deadline: epochMs,
  tasks: z.array(z.object({ ...mainTaskFields, deadline: epochMs.optional() })).min(2).max(52),
});

/** Outcome of a completed quest's item roll, rolled on the server with `questDropOutcome(chance, u)`. Until gear exists, an item is a potion. */
export const MainQuestDrop = z.enum(["none", "gain_potion", "legendary_potion"]);

export const MainTaskCompleted = z.object({
  ...base,
  type: z.literal("MainTaskCompleted"),
  taskId: id,
  /**
   * When this completion completes a quest: the item roll's outcome, if the
   * server rolled it at logging time. Omitted when logged offline: the server
   * appends a MainQuestDropRolled on sync instead.
   */
  questDrop: MainQuestDrop.optional(),
});

/** Appended by the server on sync for a quest-completing event whose earned roll has no recorded outcome. */
export const MainQuestDropRolled = z.object({
  ...base,
  type: z.literal("MainQuestDropRolled"),
  /** The MainTaskCompleted event that completed the quest. */
  eventId: id,
  drop: MainQuestDrop,
});

/**
 * "Work on this task today" (ruling 49): for one-time tasks of day or project
 * effort and recurring tasks per week or longer. Counts as Main activity for
 * the idle tax and pays nothing.
 */
export const MainTaskWorkedOn = z.object({
  ...base,
  type: z.literal("MainTaskWorkedOn"),
  taskId: id,
});

/** Deleting a one-time task cancels it: it pays nothing, and its name keeps its history. */
export const MainTaskCancelled = z.object({
  ...base,
  type: z.literal("MainTaskCancelled"),
  taskId: id,
});

/** Deleting a recurring task archives it; its decay age pauses until it is restored. */
export const MainTaskArchived = z.object({
  ...base,
  type: z.literal("MainTaskArchived"),
  taskId: id,
});

/** Restores an archived (or ended) task with its history, under a new schedule. */
export const MainTaskRestored = z.object({
  ...base,
  type: z.literal("MainTaskRestored"),
  taskId: id,
  schedule: TaskSchedule,
});

/** The one paid extension of an expired one-time task or quest. */
export const MainItemExtended = z.object({
  ...base,
  type: z.literal("MainItemExtended"),
  item: z.enum(["task", "quest"]),
  itemId: id,
  /** The new deadline. */
  until: epochMs,
});

// ---- Tribulations -----------------------------------------------------------

/** The claim oath (ruling 69). */
export const TRIBULATION_OATH = "I solemnly swear I have passed this tribulation.";

const tribulationText = {
  title: z.string().min(1).max(120),
  /** The specific, checkable result, written before starting. */
  criteria: z.string().min(1).max(2000),
};

/** Declares a tribulation: criteria plus a deadline at least 24 hours and at most 365 days out (ruling 66). */
export const TribulationDeclared = z.object({
  ...base,
  type: z.literal("TribulationDeclared"),
  tribulationId: id,
  ...tribulationText,
  deadline: epochMs,
});

/** Edits the title or criteria (at least one); the deadline is never edited. Priced by ruling 67. */
export const TribulationEdited = z.object({
  ...base,
  type: z.literal("TribulationEdited"),
  tribulationId: id,
  title: tribulationText.title.optional(),
  criteria: tribulationText.criteria.optional(),
});

/** Deletes an open or failed tribulation; priced by ruling 67. */
export const TribulationDeleted = z.object({
  ...base,
  type: z.literal("TribulationDeleted"),
  tribulationId: id,
});

/** Sets a new deadline for a failed tribulation (free; ruling 66). */
export const TribulationRescheduled = z.object({
  ...base,
  type: z.literal("TribulationRescheduled"),
  tribulationId: id,
  deadline: epochMs,
});

/** A reference to claim evidence; the rules engine never reads its content. */
export const ClaimEvidence = z.object({
  kind: z.enum(["file", "link", "photo"]),
  ref: z.string().min(1).max(2048),
});

/**
 * Claims a tribulation as passed, up to its deadline (ruling 69). `drop` is
 * the item roll's outcome when the server rolled it at claim time; offline,
 * the server appends a TribulationDropRolled on sync instead.
 */
export const TribulationClaimed = z.object({
  ...base,
  type: z.literal("TribulationClaimed"),
  tribulationId: id,
  oath: z.literal(TRIBULATION_OATH),
  evidence: z.array(ClaimEvidence).max(10).optional(),
  /** No LLM yet: always "skipped" for now. */
  llmReview: z.enum(["skipped", "done"]),
  drop: MainQuestDrop.optional(),
  /** The class drop's outcome (rulings 119-120), if the server rolled it at logging time. */
  classDrop: z.lazy(() => ClassDrop).optional(),
});

/** Appended by the server on sync for a claim whose earned item roll has no recorded outcome. */
export const TribulationDropRolled = z.object({
  ...base,
  type: z.literal("TribulationDropRolled"),
  /** The TribulationClaimed event the roll belongs to. */
  eventId: id,
  drop: MainQuestDrop,
});

// ---- Realms and levels ------------------------------------------------------

/**
 * Decides (or changes) the Main, Body or Soul area (ruling 75). Each area's
 * first decision raises Qi Condensation one level. Changes are free until
 * Qi Condensation's breakthrough, then cost Qi (rulings 88, 90, 91).
 */
export const AreaDecided = z.object({
  ...base,
  type: z.literal("AreaDecided"),
  path: z.enum(["main", "body", "soul"]),
  choice: z.string().min(1).max(200),
});

// ---- Classes ----------------------------------------------------------------

export const ClassId = z.enum(["bard", "erudite", "warrior", "knight", "dancer", "acrobat", "monk", "sorcerer"]);

/**
 * A passed tribulation's class drop (rulings 119-120): a soul wearable, a pet
 * wearable of either kind, or for Unique classes a legendary item.
 */
export const ClassDrop = z.enum(["none", "soul_wearable", "pet_keep", "pet_halo", "legendary"]);

/** At the end of Foundation, forms a core in the chosen discipline and picks the class, both for free (rulings 74, 90, 113). */
export const CoreFormed = z.object({
  ...base,
  type: z.literal("CoreFormed"),
  choice: z.string().min(1).max(200),
  class: ClassId,
});

/** Picks the class when none was chosen (free), or changes it for gold (rulings 113-114, 123). */
export const ClassChosen = z.object({
  ...base,
  type: z.literal("ClassChosen"),
  class: ClassId,
});

/** Appended by the server on sync for a claim whose earned class drop has no recorded outcome. */
export const ClassDropRolled = z.object({
  ...base,
  type: z.literal("ClassDropRolled"),
  /** The TribulationClaimed event the roll belongs to. */
  eventId: id,
  drop: ClassDrop,
});

/** Wears a class wearable (ruling 118): a soul wearable on a demon, or a pet wearable. */
export const WearableUsed = z.object({
  ...base,
  type: z.literal("WearableUsed"),
  wearable: z.enum(["soul", "pet_keep", "pet_halo"]),
  /** The demon a soul wearable freezes. */
  demonId: id.optional(),
});

/** Locks Nascent Soul's tribulation set, within 90 days of entering (ruling 79). */
export const NascentSoulLocked = z.object({
  ...base,
  type: z.literal("NascentSoulLocked"),
});

export const REPENT_OATH = "I acknowledge that at least one of my tribulations was faked and I solemnly swear I will not do it again.";

/**
 * From Nascent Soul upward, admits that tribulations of the previous realm
 * were faked and drops back to it (rulings 101-107). `faked` may be empty
 * only when the current realm was entered by an override.
 */
export const Repented = z.object({
  ...base,
  type: z.literal("Repented"),
  oath: z.literal(REPENT_OATH),
  faked: z.array(id).max(200),
});

/** Advances one level or realm, ignoring Qi and tribulations; logged (ruling 84). */
export const RealmOverride = z.object({
  /** Required on the override out of Foundation, which picks the class (ruling 113); ignored on the others. */
  class: ClassId.optional(),
  ...base,
  type: z.literal("RealmOverride"),
});

/**
 * Appended by the server for a level-up or breakthrough's legendary-item roll
 * (ruling 83). Level-ups are derived, so the roll names the progression step
 * it belongs to; the server rolls it with `breakthroughRollOutcome(chance, u)`.
 */
export const BreakthroughRolled = z.object({
  ...base,
  type: z.literal("BreakthroughRolled"),
  step: z.number().int().min(1),
  item: z.enum(["none", "legendary"]),
});

// ---- Rest -------------------------------------------------------------------

export const RestStarted = z.object({
  ...base,
  type: z.literal("RestStarted"),
  kind: z.enum(["vacation", "closed_door"]),
  /** Planned end (epoch ms). Rest ends at the earlier of this and RestEnded. */
  until: epochMs,
});

export const RestEnded = z.object({
  ...base,
  type: z.literal("RestEnded"),
});

// ---- Golden ticket roulette -------------------------------------------------

export const RoulettePrize = z.enum(["gold", "qi", "gain_potion", "legendary_potion", "legendary", "scale"]);

/**
 * Drinks a stored potion (ruling 58). Only gain potions are drunk for now: +10%
 * gold and Qi for 24 hours, one active at a time. Legendary potions are
 * stored until gear exists.
 */
export const PotionUsed = z.object({
  ...base,
  type: z.literal("PotionUsed"),
  potion: z.enum(["gain"]),
});

/** Rolled on the server with `rouletteOutcome(u)` and stored here. */
export const RouletteSpun = z.object({
  ...base,
  type: z.literal("RouletteSpun"),
  prize: RoulettePrize,
});

// ---- Union --------------------------------------------------------------------

export const GameEvent = z.discriminatedUnion("type", [
  CultivatorCreated,
  BodyActivityDefined,
  BodyActivityLogged,
  SkillDefined,
  SkillRankAchieved,
  HeartDemonCreated,
  HeartDemonRenamed,
  HeartDemonDeleted,
  SoulTaskLogged,
  SoulQuestDefined,
  SoulQuestCompleted,
  SoulDropRolled,
  RestStarted,
  RestEnded,
  RouletteSpun,
  PotionUsed,
  InterviewAnswered,
  MainTaskDefined,
  MainQuestDefined,
  MainTaskCompleted,
  MainTaskCancelled,
  MainTaskArchived,
  MainTaskRestored,
  MainItemExtended,
  MainTaskWorkedOn,
  MainQuestDropRolled,
  TribulationDeclared,
  TribulationEdited,
  TribulationDeleted,
  TribulationRescheduled,
  TribulationClaimed,
  TribulationDropRolled,
  AreaDecided,
  CoreFormed,
  ClassChosen,
  ClassDropRolled,
  WearableUsed,
  NascentSoulLocked,
  Repented,
  RealmOverride,
  BreakthroughRolled,
]);

export type GameEvent = z.infer<typeof GameEvent>;
export type GameEventType = GameEvent["type"];
export type EventOf<T extends GameEventType> = Extract<GameEvent, { type: T }>;
export type BodyActivityKind = z.infer<typeof BodyActivityKind>;
export type RoulettePrize = z.infer<typeof RoulettePrize>;
export type Evidence = z.infer<typeof Evidence>;
export type SoulTask = z.infer<typeof SoulTask>;
export type SoulDrop = z.infer<typeof SoulDrop>;
export type Difficulty = z.infer<typeof Difficulty>;
export type Effort = z.infer<typeof Effort>;
export type Period = z.infer<typeof Period>;
export type TaskSchedule = z.infer<typeof TaskSchedule>;
export type MainQuestDrop = z.infer<typeof MainQuestDrop>;
export type ClaimEvidence = z.infer<typeof ClaimEvidence>;
export type ClassId = z.infer<typeof ClassId>;
export type ClassDrop = z.infer<typeof ClassDrop>;

/** Validate untrusted input (sync payloads, local DB rows) into a typed event. */
export function parseEvent(input: unknown): GameEvent {
  return GameEvent.parse(input);
}

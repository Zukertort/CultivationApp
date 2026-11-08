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
 * growth colors; negative tasks roll for losses at weakening colors. "item" is
 * a common item (a potion until gear exists).
 */
export const SoulDrop = z.enum(["none", "gold", "qi", "item", "legendary", "lose_gold", "lose_qi", "lose_item"]);

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

export const RoulettePrize = z.enum(["gold", "qi", "potion", "legendary", "scale"]);

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
]);

export type GameEvent = z.infer<typeof GameEvent>;
export type GameEventType = GameEvent["type"];
export type EventOf<T extends GameEventType> = Extract<GameEvent, { type: T }>;
export type BodyActivityKind = z.infer<typeof BodyActivityKind>;
export type RoulettePrize = z.infer<typeof RoulettePrize>;
export type Evidence = z.infer<typeof Evidence>;
export type SoulTask = z.infer<typeof SoulTask>;
export type SoulDrop = z.infer<typeof SoulDrop>;

/** Validate untrusted input (sync payloads, local DB rows) into a typed event. */
export function parseEvent(input: unknown): GameEvent {
  return GameEvent.parse(input);
}

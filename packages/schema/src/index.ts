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

/** Validate untrusted input (sync payloads, local DB rows) into a typed event. */
export function parseEvent(input: unknown): GameEvent {
  return GameEvent.parse(input);
}

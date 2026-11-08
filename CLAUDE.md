# CLAUDE.md

Guidance for Claude Code working in this repository.

## What this is

A xianxia-themed life gamification app (a deeper Habitica). The full game
design is the *Cultivation System — Design To-Do* doc; when code and doc
disagree, ask before changing either. 

The design spec is docs/design.md.

## Non-negotiable architecture rules

1. **Events are the only source of truth.** Never store derived numbers (Qi,
   gold, tier, food, demon HP, soul color, durability). Derive them by
   replaying events through `@cultivation/rules`.
2. **The rules engine is pure and deterministic.** In `packages/rules`:
   no `Date.now()`, no `Math.random()`, no I/O, no dependencies beyond
   `@cultivation/schema`. Time comes from event timestamps or `advanceTo`.
   Random outcomes are rolled by the server and stored inside the event.
3. **One implementation of the game math.** The app, server and simulator all
   import `@cultivation/rules`. Never reimplement a rule elsewhere, including
   in Python analysis code.
4. **Every tunable number lives in `packages/rules/src/config.ts`.** Changing
   the balance means bumping `version` in the config, not editing state.
5. **Every event carries `userId`.** Single-player today, multi-user later.

## Layout

- `packages/schema` — Zod event schemas and types
- `packages/rules` — engine, config, tests
- `tools/sim` — economy simulator (writes CSV to `tools/sim/out/`, gitignored)
- `apps/mobile` — Expo app (not started)
- `apps/server` — Hono on Cloud Run + Postgres (not started)
- `assets/` — art and lore, CC BY-NC 4.0 (code is MIT)

## Commands

```sh
pnpm install
pnpm test        # Vitest in every package
pnpm typecheck
pnpm sim         # run the economy simulator
```

## Conventions

- TypeScript strict mode, ESM, no build step for internal packages (they export `src/index.ts`).
- Rule violations throw `RuleViolation` with a stable `code`; tests assert on the code.
- When adding a rule: add or adjust config, implement it in the engine, add a
  test, and rerun the simulator if it touches the economy.
- Commit messages: imperative subject line, body explaining why.

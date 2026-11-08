# Cultivation

A xianxia-themed life gamification app. The game design lives in the
*Cultivation System — Design To-Do* doc; this repo implements it.

## Layout

| Path | What it is | Status |
| --- | --- | --- |
| `packages/schema` | Event types and Zod validators shared by every consumer | Body path |
| `packages/rules` | Deterministic rules engine: events in, state out | Body path |
| `tools/sim` | Economy simulator that runs the real rules engine | Food economy |
| `apps/mobile` | Expo app (iOS, Android, web) | Not started |
| `apps/server` | Hono API on Cloud Run + Postgres event store | Not started |

## The two rules everything depends on

1. **Events are the only source of truth.** Qi, gold, tiers, demon HP and
   every other number are derived by replaying the event log through
   `packages/rules`. Rebalancing means shipping a new rules version and
   replaying, never migrating balances.
2. **The rules engine is pure.** It never reads the clock and never
   generates randomness. Time arrives as event timestamps (or an explicit
   `advanceTo`), and random outcomes such as roulette prizes are rolled by
   the server and stored *inside* the event. Replaying under new rules
   therefore never re-rolls anyone's drops.

## Commands

```sh
pnpm install
pnpm test        # all packages
pnpm typecheck
pnpm sim         # food-economy simulation, prints a summary and writes CSV to tools/sim/out
```

Requires Node 22+ and pnpm (`corepack enable` installs the version pinned in `package.json`).

## License

Source code: [MIT](LICENSE). Art, animation files and lore in `assets/`:
[CC BY-NC 4.0](assets/LICENSE).

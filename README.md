# Cultivation

A xianxia-themed life gamification app. The game design, and its settled
rulings, live in [docs/design.md](docs/design.md), the source of truth this
repo implements.

## Layout

| Path | What it is | Status |
| --- | --- | --- |
| `packages/schema` | Event types and Zod validators shared by every consumer | Body, Soul, Main, tribulations, realms, classes, gear, the shop, legendary items |
| `packages/rules` | Deterministic rules engine: events in, state out | Step 1 rules through Roadmap part 4 (legendary items) |
| `packages/scenarios` | Persona habits and dev scenarios, shared by the simulator and the app | Used by the simulator and dev builds |
| `tools/sim` | Economy simulator that runs the real rules engine | Food, Soul, Main, tribulations, realms, classes, cadence, gear, shop, scaling and legendary reports |
| `apps/mobile` | Expo app (iOS, Android, web) | Dogfooding screens; dev scenario loader in development builds |
| `apps/server` | Hono API on Cloud Run + Postgres event store | Not started (Roadmap part 6) |

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
pnpm sim         # economy simulation: prints a summary and writes CSV to tools/sim/out
```

Requires Node 22+ and pnpm (`corepack enable` installs the version pinned in `package.json`).

## License

Source code: [MIT](LICENSE). Art, animation files and lore in `assets/`:
[CC BY-NC 4.0](assets/LICENSE).

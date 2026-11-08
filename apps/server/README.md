# apps/server

Small Hono API on Cloud Run with Postgres (Cloud SQL). Not scaffolded yet.

Responsibilities, and nothing more:

- **Event store**: one append-only `events` table; every row carries a user ID.
- **Sync**: push and pull new events after a cursor. Events are immutable, so
  sync never has conflicts.
- **Validation**: replays the user's log through `@cultivation/rules` and
  rejects events that break a rule.
- **Server-side rolls**: roulette spins (and any other roll for a tradeable
  item) are rolled here with `rouletteOutcome(u)` and stored in the event.
- **Weekly job** (Cloud Scheduler): generate the LLM chronicle.

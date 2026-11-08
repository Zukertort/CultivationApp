# apps/mobile

Expo (SDK 58) app for Android and web. Imports `@cultivation/rules` and
`@cultivation/schema` directly from the workspace; it never reimplements a rule.

## Run

```sh
pnpm install                 # from the repo root
cd apps/mobile
npx expo start               # scan the QR code with Expo Go on the phone
npx expo start --web         # Chrome
```

On Windows, Expo needs pnpm on PATH (`corepack enable pnpm`) and, for the
emulator, `ANDROID_HOME` set to `%LOCALAPPDATA%\Android\Sdk`.

## What's here

- `src/app/` — Expo Router screens: oath (onboarding), Cultivator (companion
  meter, soul color, coming losses, notification diagnostics), Body (define and
  log exercises and routines), Soul (demon list with HP and soul color, identify
  a demon, log positive and negative tasks).
- `src/lib/db.ts` — the local event log in SQLite (`expo-sqlite`), on Android
  and on web (WebAssembly; `metro.config.js` adds the `wasm` asset and the
  cross-origin headers it needs). Only raw events are stored.
  The web build keeps its own separate log in the browser until server sync
  exists: events logged on the phone don't appear on web, and the reverse.
- `src/lib/store.tsx` — replays the log through the rules engine; new events
  are checked by the engine before they are written.
- `src/lib/notify.ts` + `notifications-context.tsx` — schedules the rules
  engine's `pushAlertPlan` (built from `companionAlertAt` and `demonAlerts`, at
  most 3 a day) as local notifications, rebuilt after every event, on return to
  the foreground and on the minute tick. Web shows the plan but can't schedule.

## Notifications on Android

- Scheduled with `DATE` triggers on the `close-losses` channel. Without the
  exact-alarm permission Android delivers them "at an approximate time"; these
  are early warnings, so the app doesn't request it.
- Samsung One UI can delay or drop alarms for apps it marks as sleeping. To
  measure it on a device: Cultivator tab → "Test in 10 min", lock the phone,
  then reopen the app; the delivery log shows how late each notification was.
  If delays are large, try Settings → Battery → Background usage limits and
  keep the app (Expo Go during development) out of "Sleeping apps".
- Measured on 2026-11-08 (Galaxy A24, Android 16, One UI 8.5, Expo Go
  58.0.5, unplugged, screen locked, 10-minute test):
  - Battery "Optimized" (default): 7 min 40 s late. One UI's app freezer
    (freecess) deferred the alarm, and it only fired when the phone was
    plugged in, so the real delay could have been longer.
  - Battery "Unrestricted": on time (under 1 s), with the phone in light
    Doze and no deferral.
  The app will ask once for Unrestricted and accept either answer (design
  ruling 17). Remeasure on a development build.
  Deep Doze, which starts after a longer idle, hasn't been measured yet.
- Notification text never includes demon names (lock screens are visible).
- Expo Go 58.0.5 on Android 16 / One UI 8.5 fails to create the `close-losses`
  channel (a NullPointerException inside Expo Go). The app logs a warning and
  uses the default channel; a development build should be checked for this.

## Not yet

Sync with the server (drop rolls stay pending until then), rest, deletion and
rename screens, quests, art (Rive), the daily to-do reminder, a development
build, and the one-time Unrestricted battery request (ruling 17).

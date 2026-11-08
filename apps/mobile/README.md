# apps/mobile

Expo app for iOS, Android and web. Not scaffolded yet.

Planned stack (see the stack diagram in the design doc):

- React Native + Expo Router for UI
- Rive (`@rive-app/react-native`) for the avatar, companion and cinematics; Reanimated for UI motion
- `expo-sqlite` as the local event log on iOS and Android (offline-first)
- `expo-notifications` for **locally scheduled** alerts, computed by projecting
  state forward with `@cultivation/rules` after every event or sync
- The web build runs online against the server instead of local SQLite

Imports `@cultivation/rules` and `@cultivation/schema` directly from the workspace.

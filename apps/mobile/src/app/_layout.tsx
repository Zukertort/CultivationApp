import "../lib/web-alert";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { ActivityIndicator, Platform, View } from "react-native";
import { Tabs } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SQLiteProvider, useSQLiteContext } from "expo-sqlite";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { OATH_TEXT } from "@cultivation/schema";
import { GearWatcher } from "../lib/gear";
import { BreakthroughWatcher } from "../lib/breakthrough";
import { DB_NAME, getMeta, migrate, setMeta } from "../lib/db";
import { OTHER_TAB_TEXT, databaseErrorText } from "../lib/db-errors";
import { acquireTabLock } from "../lib/tab-lock";
import { AreasStep, Interview } from "../lib/onboarding";
import { NotificationsProvider } from "../lib/notifications-context";
import { StoreProvider, useStore } from "../lib/store";
import { Button, C, Card, Field, Note, Screen, T } from "../lib/ui";

/**
 * Dev scenarios and time travel (src/dev), in development builds only. In a
 * release bundle `__DEV__` is false, so this require is dropped with the
 * whole src/dev tree and @cultivation/scenarios (scripts/check-release-bundle.mjs
 * verifies it).
 */
// An import statement would always bundle src/dev; a require under __DEV__ is removed from release builds.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const DevRoot: typeof import("../dev/root").DevRoot | null = __DEV__ ? (require("../dev/root") as typeof import("../dev/root")).DevRoot : null;

/** The app on one database; `overlay` (the dev badge) sits inside its providers. A database that can't open shows why. */
function App({ dbName, overlay }: { dbName: string; overlay?: ReactNode }) {
  const [error, setError] = useState<string | null>(null);
  // SQLiteProvider calls onError while rendering: keep it stable (the provider compares it) and set state after.
  const onError = useCallback((e: Error) => {
    setTimeout(() => setError(databaseErrorText(e)), 0);
  }, []);
  if (error) return <Blocked text={error} />;
  return (
    <SQLiteProvider databaseName={dbName} onInit={migrate} onError={onError}>
      <StoreProvider>
        <Gate />
        {overlay}
      </StoreProvider>
    </SQLiteProvider>
  );
}

/** A full-screen message with a retry (a reload), for a database this tab can't open. */
function Blocked({ text }: { text: string }) {
  const reload = () => {
    const loc = (globalThis as { location?: { reload: () => void } }).location;
    loc?.reload();
  };
  return (
    <View style={{ flex: 1, backgroundColor: C.bg, justifyContent: "center", padding: 24, gap: 12 }}>
      <T>{text}</T>
      {Platform.OS === "web" ? <Button label="Try again" onPress={reload} /> : null}
    </View>
  );
}

export default function RootLayout() {
  // On the web only one tab may hold the database files: take the tab lock before any database opens.
  const [lock, setLock] = useState<"waiting" | "held" | "elsewhere">("waiting");
  useEffect(() => {
    void acquireTabLock().then((ok) => setLock(ok ? "held" : "elsewhere"));
  }, []);
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      {lock === "waiting" ? (
        <View style={{ flex: 1, backgroundColor: C.bg }} />
      ) : lock === "elsewhere" ? (
        <Blocked text={OTHER_TAB_TEXT} />
      ) : DevRoot ? (
        <DevRoot render={(dbName, overlay) => <App dbName={dbName} overlay={overlay} />} />
      ) : (
        <App dbName={DB_NAME} />
      )}
    </SafeAreaProvider>
  );
}

const AREAS_STEP = "onboarding_areas_done";

function Gate() {
  const db = useSQLiteContext();
  const { ready, state } = useStore();
  const [areasDone, setAreasDone] = useState<boolean | null>(null);
  useEffect(() => {
    void getMeta(db, AREAS_STEP).then((v) => setAreasDone(v !== null));
  }, [db]);
  if (!ready || areasDone === null) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, justifyContent: "center" }}>
        <ActivityIndicator color={C.gold} />
      </View>
    );
  }
  if (!state.created) return <Oath />;
  if (state.main.interview === null) return <Interview />;
  // Shown once after the interview; "Continue" or "Decide the rest later" closes it.
  if (!areasDone) {
    return (
      <AreasStep
        onDone={() => {
          void setMeta(db, AREAS_STEP, "1");
          setAreasDone(true);
        }}
      />
    );
  }
  return (
    <NotificationsProvider>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: { backgroundColor: C.card, borderTopColor: C.border },
          tabBarActiveTintColor: C.gold,
          tabBarInactiveTintColor: C.muted,
          tabBarIconStyle: { display: "none" },
          tabBarLabelStyle: { fontSize: 12, fontWeight: "700" },
        }}
      >
        <Tabs.Screen name="index" options={{ title: "Tasks" }} />
        <Tabs.Screen name="realm" options={{ title: "Realm" }} />
        <Tabs.Screen name="trials" options={{ title: "Trials" }} />
        <Tabs.Screen name="body" options={{ title: "Body" }} />
        <Tabs.Screen name="soul" options={{ title: "Soul" }} />
        <Tabs.Screen name="store" options={{ title: "Store" }} />
        <Tabs.Screen name="alerts" options={{ title: "Alerts" }} />
      </Tabs>
      <BreakthroughWatcher />
      <GearWatcher />
    </NotificationsProvider>
  );
}

/** Onboarding: the oath, typed out, creates the cultivator. */
function Oath() {
  const { log } = useStore();
  const [name, setName] = useState("");
  const [oath, setOath] = useState("");
  const [error, setError] = useState<string | null>(null);

  const swear = async () => {
    if (oath.trim() !== OATH_TEXT) {
      setError("Type the oath exactly as written.");
      return;
    }
    // Minutes east of UTC sets the cultivator's day boundary.
    const tzOffsetMinutes = -new Date().getTimezoneOffset();
    const r = await log({ type: "CultivatorCreated", name: name.trim(), tzOffsetMinutes, oath: OATH_TEXT });
    if (!r.ok) setError(r.message);
  };

  return (
    <Screen>
      <Card title="The oath">
        <T>Before the path opens, swear it:</T>
        <T style={{ fontStyle: "italic", color: C.gold }}>{OATH_TEXT}</T>
        <Field label="Cultivator name" value={name} onChangeText={setName} autoCapitalize="words" maxLength={64} />
        <Field label="Type the oath" value={oath} onChangeText={setOath} multiline autoCorrect={false} />
        <Note text={error} error />
        <Button label="I swear it" onPress={swear} disabled={!name.trim()} />
      </Card>
    </Screen>
  );
}

import { useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { Tabs } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SQLiteProvider } from "expo-sqlite";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { OATH_TEXT } from "@cultivation/schema";
import { DB_NAME, migrate } from "../lib/db";
import { NotificationsProvider } from "../lib/notifications-context";
import { StoreProvider, useStore } from "../lib/store";
import { Button, C, Card, Field, Note, Screen, T } from "../lib/ui";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <SQLiteProvider databaseName={DB_NAME} onInit={migrate}>
        <StoreProvider>
          <Gate />
        </StoreProvider>
      </SQLiteProvider>
    </SafeAreaProvider>
  );
}

function Gate() {
  const { ready, state } = useStore();
  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, justifyContent: "center" }}>
        <ActivityIndicator color={C.gold} />
      </View>
    );
  }
  if (!state.created) return <Oath />;
  return (
    <NotificationsProvider>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: { backgroundColor: C.card, borderTopColor: C.border },
          tabBarActiveTintColor: C.gold,
          tabBarInactiveTintColor: C.muted,
          tabBarIconStyle: { display: "none" },
          tabBarLabelStyle: { fontSize: 14, fontWeight: "700" },
        }}
      >
        <Tabs.Screen name="index" options={{ title: "Cultivator" }} />
        <Tabs.Screen name="body" options={{ title: "Body" }} />
        <Tabs.Screen name="soul" options={{ title: "Soul" }} />
      </Tabs>
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

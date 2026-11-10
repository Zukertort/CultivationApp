import { View } from "react-native";
import { RULES_V1, demonCounts, pendingSoulRolls, type PushKind } from "@cultivation/rules";
import { useNotifications } from "../lib/notifications-context";
import { useStore } from "../lib/store";
import { Button, C, Card, Meter, Row, SOUL_HEX, Screen, T, cap, relative } from "../lib/ui";

const ALERT_LABEL: Record<PushKind, string> = {
  tribulation_deadline: "A tribulation deadline is close",
  rest_ending: "The rest ends",
  quest_deadline: "A quest deadline is close",
  soul_broken: "A demon passes 90%: the soul breaks",
  demon_near_revival: "A defeated demon nears revival",
  demon_near_violet: "A demon nears 70%",
  companion_hungry: "The companion nears empty",
};

export default function Cultivator() {
  const { state, now } = useStore();
  const { permission, plan, deliveries, sendTest } = useNotifications();
  const c = state.companion;
  const capacity = RULES_V1.tiers[c.tier].capacity;
  const { created, defeated } = demonCounts(state.soul);
  const pendingRolls = pendingSoulRolls(state.soul).reduce((n, p) => n + p.count, 0);

  return (
    <Screen>
      <View style={{ gap: 4 }}>
        <T style={{ fontSize: 26, fontWeight: "800" }}>{state.name}</T>
        <T muted>Qi Condensation · rules v{state.rulesVersion}</T>
      </View>

      <Card title="Soul" right={<SoulChip color={state.soul.color} />}>
        <T muted>
          {created} demon{created === 1 ? "" : "s"} identified, {defeated} defeated
        </T>
      </Card>

      <Card title="Companion" right={<T>{cap(c.tier)}</T>}>
        <Meter value={c.food / capacity} />
        <T muted>
          {Math.floor(c.food)} / {capacity} treats{state.rest ? " · asleep while you rest" : ""}
        </T>
        <Row gap={16}>
          <T>Gold {state.gold.toFixed(1)}</T>
          <T>Qi {state.qi.toFixed(1)}</T>
          {state.goldenTickets > 0 ? <T>Golden tickets {state.goldenTickets}</T> : null}
        </Row>
        {pendingRolls > 0 ? <T muted>{pendingRolls} soul drop roll(s) wait for the server (rolled on sync).</T> : null}
      </Card>

      <Card title="Coming losses">
        {plan.length === 0 ? <T muted>Nothing close in the next two weeks.</T> : null}
        {plan.map((a) => (
          <Row key={`${a.kind}-${a.demonId ?? ""}-${a.at}`}>
            <T>{ALERT_LABEL[a.kind]}</T>
            <T muted>{relative(a.at, now)}</T>
          </Row>
        ))}
      </Card>

      <Card title="Notifications">
        {permission === "unsupported" ? (
          <T muted>The web build shows coming losses above but can't schedule notifications.</T>
        ) : (
          <>
            <T muted>Permission: {permission}. Losses above are scheduled as local notifications (at most 3 a day).</T>
            <Row>
              <Button label="Test in 1 min" kind="ghost" onPress={() => void sendTest(1)} disabled={permission !== "granted"} />
              <Button label="Test in 10 min" kind="ghost" onPress={() => void sendTest(10)} disabled={permission !== "granted"} />
            </Row>
            <T muted>Lock the phone after scheduling a test to see how late the OS delivers it. Delivery log (late = shown − scheduled):</T>
            {deliveries.length === 0 ? <T muted>No deliveries recorded yet.</T> : null}
            {deliveries.map((d) => (
              <T key={d.id} muted>
                {d.kind} · scheduled {new Date(d.scheduledFor).toLocaleString()} · late {formatDelay(d.deliveredAt - d.scheduledFor)}
              </T>
            ))}
          </>
        )}
      </Card>
    </Screen>
  );
}

function SoulChip({ color }: { color: keyof typeof SOUL_HEX }) {
  return (
    <Row gap={6}>
      <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: SOUL_HEX[color], borderWidth: 1, borderColor: C.border }} />
      <T>{cap(color)}</T>
    </Row>
  );
}

function formatDelay(ms: number): string {
  const s = Math.round(ms / 1000);
  return Math.abs(s) < 120 ? `${s} s` : `${Math.round(s / 60)} min`;
}

import { useEffect, useState } from "react";
import { Linking, Platform } from "react-native";
import { useSQLiteContext } from "expo-sqlite";
import { RULES_V1, type PushKind } from "@cultivation/rules";
import { getMeta, setMeta } from "../lib/db";
import { useNotifications } from "../lib/notifications-context";
import { useStore } from "../lib/store";
import { Button, Card, Field, Note, Row, Screen, T, clock, parseClock, relative, when } from "../lib/ui";

const ALERT_LABEL: Record<PushKind, string> = {
  tribulation_deadline: "A tribulation deadline is close",
  rest_ending: "The rest ends",
  quest_deadline: "A quest deadline is close",
  soul_broken: "A demon passes 90%: the soul breaks",
  demon_near_revival: "A defeated demon nears revival",
  demon_near_violet: "A demon nears 70%",
  companion_hungry: "The companion nears empty",
  daily_reminder: "Daily reminder to check the to-do list",
};

const BATTERY_ASKED = "battery_prompt_answered";

export default function Alerts() {
  const { state, now, log } = useStore();
  const { permission, plan, deliveries, sendTest } = useNotifications();
  const [note, setNote] = useState<{ text: string; error: boolean } | null>(null);
  const reminder = state.prefs.reminderMinutes ?? RULES_V1.notifications.defaultReminderMinutes;
  const quiet = state.prefs.quiet;
  const [reminderText, setReminderText] = useState(clock(reminder));
  const [quietStart, setQuietStart] = useState(quiet ? clock(quiet.start) : "22:00");
  const [quietEnd, setQuietEnd] = useState(quiet ? clock(quiet.end) : "07:00");

  const result = (ok: boolean, text: string) => setNote({ text, error: !ok });

  const setReminder = async () => {
    const minutes = parseClock(reminderText);
    if (minutes === null) return result(false, "Use HH:MM, e.g. 09:00.");
    const r = await log({ type: "DailyReminderSet", minutes });
    result(r.ok, r.ok ? `The daily reminder is at ${clock(minutes)} on days with nothing urgent.` : r.message);
  };
  const setQuiet = async (on: boolean) => {
    const start = parseClock(quietStart);
    const end = parseClock(quietEnd);
    if (on && (start === null || end === null)) return result(false, "Use HH:MM for both ends.");
    const r = await log({ type: "QuietHoursSet", quiet: on ? { start: start!, end: end! } : null });
    result(r.ok, r.ok ? (on ? `Quiet from ${quietStart} to ${quietEnd}: alerts move to just before.` : "Quiet hours off.") : r.message);
  };

  return (
    <Screen>
      <BatteryPrompt />

      <Card title="Coming pushes">
        {plan.length === 0 ? <T muted>Nothing close in the next two weeks.</T> : null}
        {plan.map((a) => (
          <Row key={`${a.kind}-${a.demonId ?? a.questId ?? a.tribulationId ?? ""}-${a.at}`}>
            <T>{ALERT_LABEL[a.kind]}</T>
            <T muted>
              {when(a.at)} · {relative(a.at, now)}
              {a.movedForQuiet ? " · moved out of quiet hours" : ""}
            </T>
          </Row>
        ))}
        <T muted>At most {RULES_V1.notifications.maxPerDay} a day, most urgent first. Rest mutes them (a vacation keeps tribulation deadlines).</T>
      </Card>

      <Card title="Daily reminder">
        <T muted>On a day with nothing urgent, one push at this local time. Now {clock(reminder)}.</T>
        <Field label="Time (HH:MM)" value={reminderText} onChangeText={setReminderText} keyboardType="numbers-and-punctuation" maxLength={5} />
        <Button label="Set the reminder time" onPress={() => void setReminder()} />
      </Card>

      <Card title="Quiet hours">
        <T muted>{quiet ? `On: ${clock(quiet.start)} to ${clock(quiet.end)}.` : "Off."} An alert inside them is sent just before they start, never dropped.</T>
        <Field label="From (HH:MM)" value={quietStart} onChangeText={setQuietStart} keyboardType="numbers-and-punctuation" maxLength={5} />
        <Field label="To (HH:MM)" value={quietEnd} onChangeText={setQuietEnd} keyboardType="numbers-and-punctuation" maxLength={5} />
        <Row>
          <Button label="Set quiet hours" onPress={() => void setQuiet(true)} />
          {quiet ? <Button label="Turn off" kind="ghost" onPress={() => void setQuiet(false)} /> : null}
        </Row>
      </Card>

      <Note text={note?.text ?? null} error={note?.error} />

      <Card title="Delivery check">
        {permission === "unsupported" ? (
          <T muted>The web build lists coming pushes but can&apos;t schedule notifications.</T>
        ) : (
          <>
            <T muted>Permission: {permission}.</T>
            <Row>
              <Button label="Test in 1 min" kind="ghost" onPress={() => void sendTest(1)} disabled={permission !== "granted"} />
              <Button label="Test in 10 min" kind="ghost" onPress={() => void sendTest(10)} disabled={permission !== "granted"} />
            </Row>
            <T muted>Lock the phone after scheduling a test to see how late the OS delivers it (late = shown − scheduled):</T>
            {deliveries.length === 0 ? <T muted>No deliveries recorded yet.</T> : null}
            {deliveries.map((d) => (
              <T key={d.id} muted>
                {d.kind} · scheduled {when(d.scheduledFor)} · late {formatDelay(d.deliveredAt - d.scheduledFor)}
              </T>
            ))}
          </>
        )}
      </Card>
      <T muted>Rules v{state.rulesVersion}</T>
    </Screen>
  );
}

/** Ruling 17: on Android, ask once to set battery usage to Unrestricted; "no" is fine. */
function BatteryPrompt() {
  const db = useSQLiteContext();
  const [answered, setAnswered] = useState<boolean | null>(null);
  useEffect(() => {
    void getMeta(db, BATTERY_ASKED).then((v) => setAnswered(v !== null));
  }, [db]);
  if (Platform.OS !== "android" || answered !== false) return null;
  const answer = (yes: boolean) => {
    void setMeta(db, BATTERY_ASKED, yes ? "yes" : "no");
    setAnswered(true);
    if (yes) void Linking.openSettings();
  };
  return (
    <Card title="Alerts on time">
      <T>
        Android may hold alerts for minutes while the app sleeps (a test on One UI arrived over 7 minutes late). Setting this app&apos;s battery usage to Unrestricted keeps them on
        time. In the settings that open: Battery, then Unrestricted.
      </T>
      <Row>
        <Button label="Open settings" onPress={() => answer(true)} />
        <Button label="Not now" kind="ghost" onPress={() => answer(false)} />
      </Row>
      <T muted>Without it the app works; alerts may just be late.</T>
    </Card>
  );
}

function formatDelay(ms: number): string {
  const s = Math.round(ms / 1000);
  return Math.abs(s) < 120 ? `${s} s` : `${Math.round(s / 60)} min`;
}

/**
 * DEV ONLY. A badge on every screen (DEV, or SCENARIO with the clock offset)
 * that opens the dev panel: load a scenario, go back to my log, and in a
 * scenario move the clock forward. Time travel never touches the event log;
 * it moves the app's clock (lib/clock), and the next event is logged then.
 */
import { useState } from "react";
import { Modal, Pressable, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSQLiteContext } from "expo-sqlite";
import { DAY, MINUTE, RULES_V1, effectiveDeadline, nextLocalMidnight, tribulationStatus, type CultivatorState } from "@cultivation/rules";
import { SCENARIOS, findScenario } from "@cultivation/scenarios";
import { clockOffset, now as clockNow, setClockOffset } from "../lib/clock";
import { useStore } from "../lib/store";
import { Button, C, Card, Note, Row, T, when } from "../lib/ui";
import { saveOffset } from "./loader";
import { useDev } from "./context";

const HOUR = 60 * MINUTE;

/** "+3d 4h" for a clock offset. */
export function offsetLabel(ms: number): string {
  if (ms <= 0) return "now";
  const d = Math.floor(ms / DAY);
  const h = Math.floor((ms % DAY) / HOUR);
  const m = Math.floor((ms % HOUR) / MINUTE);
  return `+${d ? `${d}d ` : ""}${h ? `${h}h ` : ""}${!d && !h ? `${m}m` : ""}`.trim();
}

/** The next deadline after `at`: an open tribulation, a quest or task due date, or the end of a rest. */
function nextDeadline(s: CultivatorState, at: number): { at: number; what: string } | null {
  const found: { at: number; what: string }[] = [];
  for (const [id, t] of Object.entries(s.tribulations.items)) {
    if (t.due && tribulationStatus(s, id) === "open") found.push({ at: effectiveDeadline(t.due, s.rest, at), what: `tribulation "${t.title}"` });
  }
  for (const q of Object.values(s.main.quests)) found.push({ at: effectiveDeadline(q.due, s.rest, at), what: `quest "${q.name}"` });
  for (const t of Object.values(s.main.tasks)) if (t.due) found.push({ at: effectiveDeadline(t.due, s.rest, at), what: `task "${t.name}"` });
  if (s.rest) found.push({ at: s.rest.end, what: "the end of the rest" });
  return found.filter((x) => x.at > at).sort((a, b) => a.at - b.at)[0] ?? null;
}

/**
 * The open log's replay anomalies (ruling 168): events the current rules
 * rejected and skipped, with their reason, plus every other anomaly; and an
 * export of the log as JSON through the share sheet, for the simulator's
 * replay command.
 */
function ReplayLog() {
  const { state, events } = useStore();
  const skipped = state.anomalies.filter((a) => a.code === "replay_skipped");
  const other = state.anomalies.filter((a) => a.code !== "replay_skipped");
  return (
    <Card title={`Replay: ${skipped.length} skipped, ${other.length} other anomalies`}>
      <T muted>{`Events the current rules (${RULES_V1.version}) reject are skipped on replay and listed here; the log itself is never changed.`}</T>
      {[...skipped, ...other].slice(0, 50).map((a, i) => (
        <T key={i} muted>{`${when(a.at)} · ${a.code}${a.detail ? ` · ${a.detail}` : ""}`}</T>
      ))}
      <Button
        label={`Export the log (${events.length} events)`}
        kind="ghost"
        onPress={() => void Share.share({ title: "cultivation-log.json", message: JSON.stringify(events) })}
      />
    </Card>
  );
}

export function DevPanel() {
  const dev = useDev();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  // Subscribes to the store, so the badge follows the clock.
  useStore();
  const offset = clockOffset();
  const scenario = dev.scenarioId ? findScenario(dev.scenarioId) : undefined;
  const badge = `${dev.mode === "scenario" ? `SCENARIO · ${scenario?.title ?? dev.scenarioId ?? "none"} · ${offsetLabel(offset)}` : "DEV"}${dev.admin ? " · ADMIN" : ""}`;
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open the dev panel"
        onPress={() => setOpen(true)}
        style={[s.badge, { top: insets.top + 4 }, dev.mode === "scenario" ? s.scenarioBadge : null]}
      >
        <Text style={s.badgeText} numberOfLines={1}>
          {badge}
        </Text>
      </Pressable>
      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <ScrollView style={{ backgroundColor: C.bg }} contentContainerStyle={{ padding: 16, paddingTop: insets.top + 16, gap: 12 }}>
          <Row>
            <Text style={s.title}>Dev tools</Text>
            <View style={{ flex: 1 }} />
            <Button label="Close" kind="ghost" onPress={() => setOpen(false)} />
          </Row>
          <T muted>Development builds only. Scenarios live in their own database; my log is never touched.</T>
          {dev.mode === "scenario" ? <ScenarioControls /> : <Button label="Open the last scenario" kind="ghost" onPress={() => dev.setMode("scenario")} />}
          {dev.lastLoad ? (
            <Note
              text={
                dev.lastLoad.problems.length === 0
                  ? `Loaded ${dev.lastLoad.id}: ${dev.lastLoad.events} events in ${(dev.lastLoad.ms / 1000).toFixed(1)} s. Checks pass.`
                  : `Loaded ${dev.lastLoad.id}, but: ${dev.lastLoad.problems.join("; ")}`
              }
              error={dev.lastLoad.problems.length > 0}
            />
          ) : null}
          <Card title={`Admin mode: ${dev.admin ? "on" : "off"}`}>
            <T muted>Off is normal play. On shows admin controls that write events no player should (the realm override, ruling 84). Never in release builds.</T>
            <Button label={dev.admin ? "Turn admin mode off" : "Turn admin mode on"} kind={dev.admin ? "primary" : "ghost"} onPress={() => dev.setAdmin(!dev.admin)} />
          </Card>
          <ReplayLog />
          <Card title="Load a scenario">
            <T muted>Built now from simulator personas, ending just before today. Loading replaces the previous scenario.</T>
            {SCENARIOS.map((sc) => (
              <View key={sc.id} style={s.item}>
                <Text style={s.itemTitle}>
                  {sc.title}
                  {sc.heavy ? " (slow to build)" : ""}
                </Text>
                <T muted>{sc.description}</T>
                <Button
                  label={dev.scenarioId === sc.id && dev.mode === "scenario" ? "Reload" : "Load"}
                  kind="ghost"
                  onPress={() => {
                    setOpen(false);
                    dev.load(sc.id);
                  }}
                />
              </View>
            ))}
          </Card>
        </ScrollView>
      </Modal>
    </>
  );
}

function ScenarioControls() {
  const dev = useDev();
  const db = useSQLiteContext();
  const { state } = useStore();
  const [note, setNote] = useState<string | null>(null);
  const at = clockNow();
  const travelTo = (target: number, what: string) => {
    // Forward only: events never go back in time (reload the scenario to rewind).
    const next = Math.max(clockOffset(), target - Date.now());
    setClockOffset(next);
    void saveOffset(db, next).then(() => setNote(`Clock moved to ${when(target)} (${what}).`));
  };
  const deadline = state.created ? nextDeadline(state, at) : null;
  return (
    <Card title="Time travel">
      <T>
        Clock: {when(at)} ({offsetLabel(clockOffset())} ahead of the device)
      </T>
      <T muted>Forward only. Food, demons, tax and deadlines advance as they would; to go back, reload the scenario.</T>
      <Row>
        <Button label="+1 hour" kind="ghost" onPress={() => travelTo(at + HOUR, "1 hour")} />
        <Button label="+1 day" kind="ghost" onPress={() => travelTo(at + DAY, "1 day")} />
        <Button label="+1 week" kind="ghost" onPress={() => travelTo(at + 7 * DAY, "1 week")} />
      </Row>
      <Row>
        <Button label="Next midnight" kind="ghost" onPress={() => travelTo(nextLocalMidnight(at, state.tzOffsetMinutes) + MINUTE, "just past midnight")} />
        {deadline ? <Button label="Past next deadline" kind="ghost" onPress={() => travelTo(deadline.at + MINUTE, `just past ${deadline.what}`)} /> : null}
      </Row>
      <Note text={note} />
      <Button label="Back to my log" onPress={() => dev.setMode("real")} />
      <T muted>Rules version {RULES_V1.version}.</T>
    </Card>
  );
}

const s = StyleSheet.create({
  badge: {
    position: "absolute",
    right: 8,
    maxWidth: "70%",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: C.border,
    opacity: 0.9,
  },
  scenarioBadge: { backgroundColor: "#7c2d12" },
  badgeText: { color: C.text, fontSize: 11, fontWeight: "700" },
  title: { color: C.gold, fontSize: 20, fontWeight: "800" },
  item: { gap: 4, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border },
  itemTitle: { color: C.text, fontSize: 15, fontWeight: "700" },
});

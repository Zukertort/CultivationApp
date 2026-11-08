import { useState } from "react";
import * as Crypto from "expo-crypto";
import { RULES_V1 } from "@cultivation/rules";
import type { BodyActivityKind } from "@cultivation/schema";
import { useStore, type LogResult } from "../lib/store";
import { Button, Card, Field, Meter, Note, Row, Screen, Segmented, T, cap } from "../lib/ui";

export default function Body() {
  const { state, log } = useStore();
  const [name, setName] = useState("");
  const [kind, setKind] = useState<BodyActivityKind>("routine");
  const [note, setNote] = useState<{ text: string; error: boolean } | null>(null);
  const c = state.companion;
  const capacity = RULES_V1.tiers[c.tier].capacity;
  const activities = Object.entries(state.activities);

  const define = async () => {
    const r = await log({ type: "BodyActivityDefined", activityId: Crypto.randomUUID(), name: name.trim(), kind });
    if (r.ok) setName("");
    setNote(r.ok ? { text: `Defined ${name.trim()}.`, error: false } : { text: r.message, error: true });
  };

  const logActivity = async (activityId: string, label: string) => {
    const r = await log({ type: "BodyActivityLogged", activityId });
    setNote(r.ok ? { text: `${label}: ${describe(r)}`, error: false } : { text: r.message, error: true });
  };

  return (
    <Screen>
      <Card title="Companion" right={<T>{cap(c.tier)}</T>}>
        <Meter value={c.food / capacity} />
        <T muted>
          {Math.floor(c.food)} / {capacity} treats · full promotes, empty demotes{c.tier === "turtle" ? " (the Turtle never leaves)" : ""}
        </T>
      </Card>

      <Card title="Log training">
        {activities.length === 0 ? <T muted>Define an exercise or a routine below first.</T> : null}
        {activities.map(([id, a]) => (
          <Row key={id}>
            <Button label={`Log ${a.name}`} onPress={() => void logActivity(id, a.name)} />
            <T muted>{a.kind}</T>
          </Row>
        ))}
        <Note text={note?.text ?? null} error={note?.error} />
      </Card>

      <Card title="New exercise or routine">
        <T muted>Exercises give 10 treats; routines 200 (at most 2 count per day). To make one harder, define a new version, e.g. "BJJ II".</T>
        <Segmented
          value={kind}
          onChange={setKind}
          options={[
            { value: "routine", label: "Routine" },
            { value: "exercise", label: "Exercise" },
          ]}
        />
        <Field label="Name" value={name} onChangeText={setName} maxLength={80} placeholder="BJJ class" />
        <Button label="Define" onPress={() => void define()} disabled={!name.trim()} />
      </Card>
    </Screen>
  );
}

/** System message for a logged activity, from the state before and after. */
function describe(r: Extract<LogResult, { ok: true }>): string {
  const gold = r.after.gold - r.before.gold;
  const parts = [gold > 0 ? `+${gold.toFixed(1)} gold` : "no payout (daily routine cap reached)"];
  if (r.after.companion.tier !== r.before.companion.tier) parts.push(`the companion is now a ${cap(r.after.companion.tier)}!`);
  else parts.push(`${Math.floor(r.after.companion.food)} treats`);
  return parts.join(", ");
}

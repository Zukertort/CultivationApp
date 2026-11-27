/**
 * Completing claimed tribulations (ruling 169): a claim waits until the
 * cultivator confirms spending its realm's completion cost in Qi. The order of
 * completion is the order that counts. Shown on the Realm and Trials screens;
 * "Ready to complete" whenever the balance covers a waiting claim.
 */
import { useState } from "react";
import { Alert, View } from "react-native";
import { awaitingCompletion } from "@cultivation/rules";
import { useStore } from "./store";
import { Button, C, Card, Note, T } from "./ui";

export function CompletionCard() {
  const { state, log } = useStore();
  const [note, setNote] = useState<{ text: string; error: boolean } | null>(null);
  const waiting = awaitingCompletion(state);
  if (waiting.length === 0) return note ? <Note text={note.text} error={note.error} /> : null;
  const dead = state.progress.diedAt !== null;
  const ready = waiting.filter((w) => w.ready).length;
  const confirm = (w: (typeof waiting)[number]) =>
    Alert.alert("Complete tribulation?", `Spend ${w.cost} Qi to complete "${w.title}". The order you complete them in is the order that counts.`, [
      { text: "Not yet", style: "cancel" },
      {
        text: `Spend ${w.cost} Qi`,
        onPress: () =>
          void log({ type: "TribulationCompleted", tribulationId: w.tribulationId }).then((r) =>
            setNote(r.ok ? { text: `Completed "${w.title}".`, error: false } : { text: r.message, error: true }),
          ),
      },
    ]);
  return (
    <Card title={ready > 0 && !dead ? "Ready to complete" : "Passed, awaiting completion"}>
      <T muted>{`A claimed tribulation counts once completed, by spending its realm's cost in Qi from the balance (debt can't pay).`}</T>
      {dead ? <T style={{ color: C.danger }}>While dead nothing can be bought, a completion included.</T> : null}
      {waiting.map((w) => (
        <View key={w.tribulationId} style={{ gap: 4 }}>
          <T style={{ fontWeight: "700" }}>{w.title}</T>
          <Button
            label={w.ready ? `Complete (${w.cost} Qi)` : `Needs ${w.cost} Qi (${Math.ceil(w.cost - state.qi)} more)`}
            kind={w.ready ? "primary" : "ghost"}
            disabled={!w.ready}
            onPress={() => confirm(w)}
          />
        </View>
      ))}
      <Note text={note?.text ?? null} error={note?.error} />
    </Card>
  );
}

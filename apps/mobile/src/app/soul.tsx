import { useState } from "react";
import { View } from "react-native";
import * as Crypto from "expo-crypto";
import { DAY, RULES_V1, demonCounts, type HeartDemon } from "@cultivation/rules";
import { useStore } from "../lib/store";
import { Button, C, Card, Field, Meter, Note, Row, SOUL_HEX, Screen, T, cap, relative } from "../lib/ui";

const W = RULES_V1.soul.weakening;

export default function Soul() {
  const { state, now, log } = useStore();
  const soul = state.soul;
  const [note, setNote] = useState<{ text: string; error: boolean } | null>(null);
  const { created, defeated } = demonCounts(soul);
  const demons = Object.entries(soul.demons).sort(([, a], [, b]) => Number(a.defeated) - Number(b.defeated) || b.hp - a.hp);

  const logTask = async (taskId: string, label: string) => {
    const r = await log({ type: "SoulTaskLogged", taskId });
    setNote(r.ok ? { text: label, error: false } : { text: r.message, error: true });
  };

  return (
    <Screen>
      <Card title="Soul color">
        <Row gap={10}>
          <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: SOUL_HEX[soul.color], borderWidth: 1, borderColor: C.border }} />
          <T style={{ fontSize: 20, fontWeight: "800" }}>{cap(soul.color)}</T>
        </Row>
        <T muted>
          Judged at midnight. Any demon above 70% weakens the soul. {created} identified, {defeated} defeated.
          {soul.heldAtWhite ? " Held at White after a deletion until the next victory." : ""}
        </T>
      </Card>

      <Note text={note?.text ?? null} error={note?.error} />

      {demons.map(([id, d]) => (
        <DemonCard key={id} demon={d} onTask={(taskId, label) => void logTask(taskId, label)} />
      ))}

      <NewDemon nextAllowed={soul.lastDemonCreatedAt === null ? null : soul.lastDemonCreatedAt + RULES_V1.soul.newDemonCooldownDays * DAY} now={now} />
    </Screen>
  );
}

function hpColor(d: HeartDemon): string {
  if (d.defeated) return C.good;
  if (d.hp > W.broken) return SOUL_HEX.broken;
  if (d.hp > W.violet) return SOUL_HEX.violet;
  return C.gold;
}

function DemonCard({ demon: d, onTask }: { demon: HeartDemon; onTask: (taskId: string, label: string) => void }) {
  return (
    <Card title={d.name} right={<T>{d.defeated ? "Defeated" : `${d.hp.toFixed(1)}%`}</T>}>
      <Meter value={d.hp / 100} color={hpColor(d)} ticks={[W.violet / 100, W.black / 100, W.broken / 100]} />
      {d.defeated ? <T muted>Keeps growing if neglected; revives at 50%. {d.hp > 0 ? `Now ${d.hp.toFixed(1)}%.` : ""}</T> : null}
      <Row>
        {d.positiveTasks.map((t) => (
          <Button key={t.taskId} label={`✓ ${t.name}`} onPress={() => onTask(t.taskId, `${t.name}: −5% to ${d.name}`)} />
        ))}
      </Row>
      {d.negativeTasks.length > 0 ? (
        <Row>
          {d.negativeTasks.map((t) => (
            <Button key={t.taskId} kind="danger" label={`✗ ${t.name}`} onPress={() => onTask(t.taskId, `${t.name}: +10% to ${d.name}`)} />
          ))}
        </Row>
      ) : null}
    </Card>
  );
}

const splitTasks = (s: string) =>
  s
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
    .map((name) => ({ taskId: Crypto.randomUUID(), name }));

function NewDemon({ nextAllowed, now }: { nextAllowed: number | null; now: number }) {
  const { log } = useStore();
  const [name, setName] = useState("");
  const [positive, setPositive] = useState("");
  const [negative, setNegative] = useState("");
  const [error, setError] = useState<string | null>(null);
  const locked = nextAllowed !== null && now < nextAllowed;

  const create = async () => {
    const r = await log({
      type: "HeartDemonCreated",
      demonId: Crypto.randomUUID(),
      name: name.trim(),
      positiveTasks: splitTasks(positive),
      negativeTasks: splitTasks(negative),
    });
    if (r.ok) {
      setName("");
      setPositive("");
      setNegative("");
    }
    setError(r.ok ? null : r.message);
  };

  return (
    <Card title="Identify a heart demon">
      <T muted>A thought, feeling, mood or behavior you want to change. It starts at 50%. Make sure you want to fight it: deleting a demon has a cost.</T>
      {locked && nextAllowed !== null ? <T muted>One new demon per week: the next one can be identified {relative(nextAllowed, now)}.</T> : null}
      <Field label="The demon" value={name} onChangeText={setName} maxLength={120} placeholder="Doomscrolling at night" />
      <Field label="Tasks that fight it (comma separated, at least one)" value={positive} onChangeText={setPositive} placeholder="Journal before bed, 10 min meditation" />
      <Field label="Habits that feed it (comma separated, optional)" value={negative} onChangeText={setNegative} placeholder="Phone in bed" />
      <Note text={error} error />
      <Button label="Identify" onPress={() => void create()} disabled={locked || !name.trim() || splitTasks(positive).length === 0} />
    </Card>
  );
}

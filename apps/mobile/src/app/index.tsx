import { useState } from "react";
import { Alert, View } from "react-native";
import * as Crypto from "expo-crypto";
import type { Difficulty, Effort, Period } from "@cultivation/schema";
import {
  RULES_V1,
  classCovers,
  cultivationStreak,
  deviationStatus,
  effectiveDeadline,
  mainQuestStatus,
  mainTaskStatus,
  periodProgress,
  staleTasks,
  taxForecast,
  type MainQuest,
  type MainTask,
} from "@cultivation/rules";
import { useStore } from "../lib/store";
import { Button, C, Card, Chip, Field, Note, Row, Screen, Segmented, T, endOfDayIn, relative, when, wholeNumber, words } from "../lib/ui";

const DIFFICULTIES: Difficulty[] = ["trivial", "easy", "mid", "hard", "deadly"];
const EFFORTS: Effort[] = ["quick", "session", "day", "project"];
const PERIODS: Period[] = ["day", "week", "month", "year"];

type Feedback = { text: string; error: boolean } | null;

export default function Tasks() {
  const { state, now, log } = useStore();
  const [note, setNote] = useState<Feedback>(null);
  const m = state.main;

  const act = async (input: Parameters<typeof log>[0], done: string) => {
    const r = await log(input);
    if (!r.ok) return setNote({ text: r.message, error: true });
    const qi = r.after.qi - r.before.qi;
    const gold = r.after.gold - r.before.gold;
    const gains = [qi ? `${qi > 0 ? "+" : ""}${qi.toFixed(1)} Qi` : "", gold ? `${gold > 0 ? "+" : ""}${gold.toFixed(1)} gold` : ""].filter(Boolean).join(", ");
    setNote({ text: gains ? `${done}: ${gains}` : done, error: false });
  };

  const status = (id: string) => mainTaskStatus(state, id);
  const tasks = Object.entries(m.tasks).filter(([id, t]) => t.questId === null && (status(id) === "open" || status(id) === "expired"));
  const recurring = tasks.filter(([, t]) => t.recurring);
  const once = tasks.filter(([, t]) => !t.recurring).sort(([, a], [, b]) => (a.due?.deadline ?? 0) - (b.due?.deadline ?? 0));
  const archived = Object.entries(m.tasks).filter(([id, t]) => t.recurring && status(id) === "archived");
  const quests = Object.entries(m.quests).filter(([id]) => {
    const st = mainQuestStatus(state, id);
    return st === "open" || st === "expired";
  });
  const deviation = deviationStatus(state);
  const streak = cultivationStreak(state);
  const stale = staleTasks(state);
  const tax = taxForecast(state);

  return (
    <Screen>
      <Row gap={16}>
        <T style={{ fontSize: 20, fontWeight: "800" }}>Qi {state.qi.toFixed(1)}</T>
        <T style={{ fontSize: 20, fontWeight: "800" }}>Gold {state.gold.toFixed(1)}</T>
        <T muted>
          Streak {streak.current} (best {streak.best})
        </T>
      </Row>
      <Note text={note?.text ?? null} error={note?.error} />

      {deviation ? (
        <Card title="Qi deviation">
          <T>
            Debt {deviation.debt.qi.toFixed(0)} Qi and {deviation.debt.gold.toFixed(0)} gold. Comeback: {deviation.done} of {deviation.needed} tasks by {when(deviation.windowEndsAt)}.
          </T>
        </Card>
      ) : null}

      <Card title="Recurring">
        {recurring.length === 0 ? <T muted>No recurring tasks.</T> : null}
        {recurring.map(([id, t]) => (
          <TaskRow key={id} id={id} t={t} onAct={act} />
        ))}
      </Card>

      <Card title="To do">
        {once.length === 0 ? <T muted>No one-time tasks.</T> : null}
        {once.map(([id, t]) => (
          <TaskRow key={id} id={id} t={t} onAct={act} />
        ))}
      </Card>

      {quests.map(([id, q]) => (
        <QuestCard key={id} id={id} q={q} onAct={act} />
      ))}

      <Card title="Coming tax">
        {tax.length === 0 ? <T muted>Nothing due: no path has been idle past its grace.</T> : null}
        {tax.map((c, i) => (
          <T key={i} muted>
            {c.kind === "postponed"
              ? `Postponed on "${m.tasks[c.taskId!]?.name}": ${c.qi.toFixed(0)} Qi, ${c.gold.toFixed(0)} gold, ${c.at === null ? "charged only if cancelled" : `charged ${when(c.at)} if it fails`}; completing it cancels it`
              : c.kind === "missed"
                ? `Missed occurrences of "${m.tasks[c.taskId!]?.name}": ${c.qi.toFixed(0)} Qi, ${c.gold.toFixed(0)} gold at ${when(c.at!)}`
                : `${words(c.path)} idle: ${c.qi.toFixed(0)} Qi, ${c.gold.toFixed(0)} gold at ${when(c.at!)} (${relative(c.at!, now)})`}
          </T>
        ))}
      </Card>

      {stale.length > 0 ? (
        <Card title="Repetition">
          {stale.map((s) => (
            <T key={s.taskId}>
              I&apos;ve completed &quot;{s.name}&quot; too many times; it pays {Math.round(s.multiplier * 100)}% now. A harder version (&quot;{s.name} II&quot;) starts fresh.
            </T>
          ))}
        </Card>
      ) : null}

      <NewTask onAct={act} />
      <NewQuest onAct={act} />

      {archived.length > 0 ? (
        <Card title="Archived">
          {archived.map(([id, t]) => (
            <Row key={id}>
              <T>{t.name}</T>
              <Button
                label="Restore"
                kind="ghost"
                onPress={() => void act({ type: "MainTaskRestored", taskId: id, schedule: { kind: "recurring", count: t.recurring!.count, per: t.recurring!.per } }, `Restored ${t.name}`)}
              />
            </Row>
          ))}
        </Card>
      ) : null}
    </Screen>
  );
}

type Act = (input: Parameters<ReturnType<typeof useStore>["log"]>[0], done: string) => Promise<void>;

function canWorkOn(t: MainTask): boolean {
  const w = RULES_V1.main.workOn;
  if (t.recurring) return (w.recurringPeriods as readonly Period[]).includes(t.recurring.per);
  return w.capByEffort[t.effort] !== undefined;
}

function TaskRow({ id, t, onAct }: { id: string; t: MainTask; onAct: Act }) {
  const { state, now } = useStore();
  const st = mainTaskStatus(state, id);
  const progress = periodProgress(state, id);
  const due = t.due ?? (t.questId ? state.main.quests[t.questId]!.due : null);
  const tags = [t.crossBody ? "also Body" : "", t.crossSoulDemonId ? `also hits ${state.soul.demons[t.crossSoulDemonId]?.name ?? "a demon"}` : ""].filter(Boolean);
  const line = progress
    ? `${progress.done} of ${progress.count} this ${progress.per}`
    : due
      ? st === "expired"
        ? `Expired ${relative(effectiveDeadline(due, state.rest, now), now)}: one extension left within ${RULES_V1.main.extension.windowDays} days`
        : `Due ${when(effectiveDeadline(due, state.rest, now))} (${relative(effectiveDeadline(due, state.rest, now), now)})`
      : "";
  return (
    <View style={{ gap: 6, borderTopWidth: 1, borderTopColor: C.border, paddingTop: 8 }}>
      <T style={{ fontWeight: "700" }}>{t.name}</T>
      <T muted>
        {words(t.difficulty)} · {t.effort}
        {line ? ` · ${line}` : ""}
        {tags.length ? ` · ${tags.join(", ")}` : ""}
        {t.postponed.days > 0 ? ` · ${t.postponed.days} day(s) of tax postponed` : ""}
      </T>
      <Row>
        {st === "open" ? <Button label="Done" onPress={() => void onAct({ type: "MainTaskCompleted", taskId: id }, `Completed ${t.name}`)} /> : null}
        {st === "open" && canWorkOn(t) ? <Button label="Worked on it" kind="ghost" onPress={() => void onAct({ type: "MainTaskWorkedOn", taskId: id }, `Worked on ${t.name} today`)} /> : null}
        {st === "expired" && t.due ? (
          <Button
            label="Extend"
            kind="ghost"
            onPress={() => void onAct({ type: "MainItemExtended", item: "task", itemId: id, until: Date.now() + t.due!.originalMs }, `Extended ${t.name}`)}
          />
        ) : null}
        {t.recurring ? (
          <Button label="Archive" kind="ghost" onPress={() => void onAct({ type: "MainTaskArchived", taskId: id }, `Archived ${t.name}`)} />
        ) : t.questId === null ? (
          <Button
            label="Cancel"
            kind="danger"
            onPress={() =>
              Alert.alert("Cancel this task?", "Any tax postponed onto it is charged now.", [
                { text: "Keep it", style: "cancel" },
                { text: "Cancel task", style: "destructive", onPress: () => void onAct({ type: "MainTaskCancelled", taskId: id }, `Cancelled ${t.name}`) },
              ])
            }
          />
        ) : null}
      </Row>
    </View>
  );
}

function QuestCard({ id, q, onAct }: { id: string; q: MainQuest; onAct: Act }) {
  const { state, now } = useStore();
  const st = mainQuestStatus(state, id);
  const deadline = effectiveDeadline(q.due, state.rest, now);
  const prep = q.preparesFor ? state.tribulations.items[q.preparesFor] : undefined;
  return (
    <Card title={q.name} right={<T muted>{st === "expired" ? "Expired" : relative(deadline, now)}</T>}>
      <T muted>
        Due {when(deadline)}
        {prep ? ` · prepares for "${prep.title}"` : ""}
      </T>
      {q.taskIds.map((tid) => {
        const t = state.main.tasks[tid]!;
        const ts = mainTaskStatus(state, tid);
        return ts === "open" || ts === "expired" ? <TaskRow key={tid} id={tid} t={t} onAct={onAct} /> : <T key={tid} muted>{`${t.name}: ${ts}`}</T>;
      })}
      {st === "expired" ? (
        <Button label="Extend the quest" kind="ghost" onPress={() => void onAct({ type: "MainItemExtended", item: "quest", itemId: id, until: Date.now() + q.due.originalMs }, `Extended ${q.name}`)} />
      ) : null}
    </Card>
  );
}

function CrossTags({ body, demon, onBody, onDemon }: { body: boolean; demon: string | null; onBody: (v: boolean) => void; onDemon: (v: string | null) => void }) {
  const { state } = useStore();
  const covers = classCovers(state);
  if (!covers.body && !covers.soul) return null;
  return (
    <View style={{ gap: 6 }}>
      <T muted>Your class lets this task also count (session effort or longer):</T>
      <Row>
        {covers.body ? <Chip label="Also a Body routine" on={body} onPress={() => onBody(!body)} /> : null}
        {covers.soul
          ? Object.entries(state.soul.demons).map(([did, d]) => <Chip key={did} label={`Hits ${d.name}`} on={demon === did} onPress={() => onDemon(demon === did ? null : did)} />)
          : null}
      </Row>
    </View>
  );
}

function NewTask({ onAct }: { onAct: Act }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("mid");
  const [effort, setEffort] = useState<Effort>("session");
  const [kind, setKind] = useState<"once" | "recurring">("once");
  const [days, setDays] = useState("1");
  const [count, setCount] = useState("1");
  const [per, setPer] = useState<Period>("day");
  const [body, setBody] = useState(false);
  const [demon, setDemon] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!open) return <Button label="New task" kind="ghost" onPress={() => setOpen(true)} />;

  const create = async () => {
    const d = wholeNumber(days);
    const c = wholeNumber(count);
    if (kind === "once" && d === null) return setError("Days must be a whole number.");
    if (kind === "recurring" && c === null) return setError("The count must be a whole number.");
    setError(null);
    const schedule = kind === "once" ? { kind: "once" as const, deadline: endOfDayIn(d!) } : { kind: "recurring" as const, count: c!, per };
    await onAct(
      {
        type: "MainTaskDefined",
        taskId: Crypto.randomUUID(),
        name: name.trim(),
        difficulty,
        effort,
        schedule,
        ...(body ? { alsoBody: true } : {}),
        ...(demon ? { alsoSoulDemonId: demon } : {}),
      },
      `Added ${name.trim()}`,
    );
    setName("");
    setBody(false);
    setDemon(null);
  };

  return (
    <Card title="New task">
      <Field label="Name (a harder version gets a new name: Math exercise II)" value={name} onChangeText={setName} maxLength={120} />
      <T muted>Difficulty, relative to your current abilities</T>
      <Segmented value={difficulty} options={DIFFICULTIES.map((v) => ({ value: v, label: v }))} onChange={setDifficulty} />
      <T muted>Effort</T>
      <Segmented value={effort} options={EFFORTS.map((v) => ({ value: v, label: v }))} onChange={setEffort} />
      <Segmented
        value={kind}
        options={[
          { value: "once", label: "One time" },
          { value: "recurring", label: "Recurring" },
        ]}
        onChange={setKind}
      />
      {kind === "once" ? (
        <Field label="Due at the end of the day, in how many days?" value={days} onChangeText={setDays} keyboardType="number-pad" maxLength={3} />
      ) : (
        <>
          <Field label="How many times" value={count} onChangeText={setCount} keyboardType="number-pad" maxLength={3} />
          <Segmented value={per} options={PERIODS.map((v) => ({ value: v, label: `per ${v}` }))} onChange={setPer} />
        </>
      )}
      <CrossTags body={body} demon={demon} onBody={setBody} onDemon={setDemon} />
      <Note text={error} error />
      <Row>
        <Button label="Add task" onPress={() => void create()} disabled={!name.trim()} />
        <Button label="Close" kind="ghost" onPress={() => setOpen(false)} />
      </Row>
    </Card>
  );
}

function NewQuest({ onAct }: { onAct: Act }) {
  const { state } = useStore();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [members, setMembers] = useState("");
  const [days, setDays] = useState("7");
  const [difficulty, setDifficulty] = useState<Difficulty>("mid");
  const [effort, setEffort] = useState<Effort>("session");
  const [prep, setPrep] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!open) return <Button label="New quest" kind="ghost" onPress={() => setOpen(true)} />;

  const tribulations = Object.entries(state.tribulations.items).filter(([, t]) => t.status === "open" || t.status === "failed");
  const names = members
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);

  const create = async () => {
    const d = wholeNumber(days);
    if (d === null) return setError("Days must be a whole number.");
    if (names.length < 2) return setError("A quest bundles at least 2 tasks.");
    setError(null);
    await onAct(
      {
        type: "MainQuestDefined",
        questId: Crypto.randomUUID(),
        name: name.trim(),
        deadline: endOfDayIn(d),
        tasks: names.map((n) => ({ taskId: Crypto.randomUUID(), name: n, difficulty, effort })),
        ...(prep ? { tribulationId: prep } : {}),
      },
      `Quest ${name.trim()} begins`,
    );
    setName("");
    setMembers("");
    setPrep(null);
  };

  return (
    <Card title="New quest">
      <T muted>Quests are only for related tasks (related by time or topic). The bonus grows with the members&apos; total work.</T>
      <Field label="Quest name" value={name} onChangeText={setName} maxLength={120} />
      <Field label="Tasks, one per line (2 to 52)" value={members} onChangeText={setMembers} multiline />
      <T muted>Every task&apos;s difficulty and effort</T>
      <Segmented value={difficulty} options={DIFFICULTIES.map((v) => ({ value: v, label: v }))} onChange={setDifficulty} />
      <Segmented value={effort} options={EFFORTS.map((v) => ({ value: v, label: v }))} onChange={setEffort} />
      <Field label="Due at the end of the day, in how many days?" value={days} onChangeText={setDays} keyboardType="number-pad" maxLength={3} />
      {tribulations.length > 0 ? (
        <>
          <T muted>Prepares for a tribulation (display only)</T>
          <Row>
            {tribulations.map(([tid, t]) => (
              <Chip key={tid} label={t.title} on={prep === tid} onPress={() => setPrep(prep === tid ? null : tid)} />
            ))}
          </Row>
        </>
      ) : null}
      <Note text={error} error />
      <Row>
        <Button label="Start quest" onPress={() => void create()} disabled={!name.trim()} />
        <Button label="Close" kind="ghost" onPress={() => setOpen(false)} />
      </Row>
    </Card>
  );
}

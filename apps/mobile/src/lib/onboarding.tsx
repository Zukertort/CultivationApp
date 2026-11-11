/**
 * Onboarding after the oath: the Qi Condensation interview, then a first look
 * at the three area decisions (ruling 75). Deciding is optional here; the
 * Realm tab keeps the same decisions for later.
 */
import { useState } from "react";
import type { MainPath } from "@cultivation/rules";
import { useStore } from "./store";
import { Button, C, Card, Field, Note, Screen, T } from "./ui";

export function Interview() {
  const { log } = useStore();
  const [main, setMain] = useState("");
  const [body, setBody] = useState("");
  const [soul, setSoul] = useState("");
  const [error, setError] = useState<string | null>(null);

  const answer = async () => {
    const r = await log({ type: "InterviewAnswered", interests: { main: main.trim(), body: body.trim(), soul: soul.trim() } });
    if (!r.ok) setError(r.message);
  };

  return (
    <Screen>
      <Card title="Qi Condensation">
        <T>Before choosing a path, the System asks what draws you. Answer freely; nothing here is a commitment.</T>
        <Field label="Main: what do you want to master? (study, work, research, a craft)" value={main} onChangeText={setMain} multiline maxLength={500} />
        <Field label="Body: how do you like to move? (a sport, a practice, the gym)" value={body} onChangeText={setBody} multiline maxLength={500} />
        <Field label="Soul: how do you explore yourself? (meditation, journaling, art, therapy)" value={soul} onChangeText={setSoul} multiline maxLength={500} />
        <Note text={error} error />
        <Button label="Answer" onPress={() => void answer()} disabled={!main.trim() && !body.trim() && !soul.trim()} />
      </Card>
    </Screen>
  );
}

const AREAS: { path: MainPath; label: string; hint: string }[] = [
  { path: "main", label: "Main discipline", hint: "Mathematics, BJJ, writing..." },
  { path: "body", label: "Body practice", hint: "Gym, running, dance..." },
  { path: "soul", label: "Soul practice", hint: "Meditation, journaling..." },
];

/** The three areas. Each first decision raises Qi Condensation a level; changes are free until its breakthrough (ruling 88). */
export function AreaDecisions({ onDone }: { onDone?: () => void }) {
  const { state, log } = useStore();
  const areas = state.progress.areas;
  const [draft, setDraft] = useState<Record<MainPath, string>>({ main: areas.main ?? "", body: areas.body ?? "", soul: areas.soul ?? "" });
  const [note, setNote] = useState<{ text: string; error: boolean } | null>(null);

  const decide = async (path: MainPath) => {
    const r = await log({ type: "AreaDecided", path, choice: draft[path].trim() });
    setNote(r.ok ? { text: `${path === "main" ? "Main" : path === "body" ? "Body" : "Soul"} decided: ${draft[path].trim()}`, error: false } : { text: r.message, error: true });
  };

  return (
    <Card title="Choose your three areas">
      <T muted>
        Choosing all three is Qi Condensation&apos;s tribulation: each first decision raises a level, and the breakthrough to Foundation follows once all three are chosen and 60 Qi
        is there. Changing an area is free until that breakthrough.
      </T>
      {AREAS.map((a) => (
        <Field
          key={a.path}
          label={`${a.label}${areas[a.path] ? ` (now: ${areas[a.path]})` : ""}`}
          value={draft[a.path]}
          onChangeText={(v) => setDraft({ ...draft, [a.path]: v })}
          placeholder={a.hint}
          maxLength={200}
          onSubmitEditing={() => void decide(a.path)}
        />
      ))}
      <ButtonsFor areas={areas} draft={draft} onDecide={(p) => void decide(p)} />
      <Note text={note?.text ?? null} error={note?.error} />
      {onDone ? <Button label={Object.values(areas).every((x) => x !== null) ? "Continue" : "Decide the rest later"} kind="ghost" onPress={onDone} /> : null}
    </Card>
  );
}

function ButtonsFor({ areas, draft, onDecide }: { areas: Record<MainPath, string | null>; draft: Record<MainPath, string>; onDecide: (p: MainPath) => void }) {
  return (
    <>
      {AREAS.map((a) => {
        const text = draft[a.path].trim();
        const same = text === (areas[a.path] ?? "");
        return <Button key={a.path} label={`${areas[a.path] ? "Change" : "Decide"} ${a.label.toLowerCase()}`} kind="ghost" onPress={() => onDecide(a.path)} disabled={!text || same} />;
      })}
    </>
  );
}

/** The onboarding's area step, shown once after the interview. */
export function AreasStep({ onDone }: { onDone: () => void }) {
  return (
    <Screen>
      <T style={{ fontSize: 22, fontWeight: "800", color: C.gold }}>Your path</T>
      <AreaDecisions onDone={onDone} />
    </Screen>
  );
}

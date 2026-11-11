import { useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { Alert, View } from "react-native";
import * as Crypto from "expo-crypto";
import { REPENT_OATH, TRIBULATION_OATH } from "@cultivation/schema";
import {
  DAY,
  RULES_V1,
  REALM_TRIBULATION_PURPOSE,
  TRIBULATION_TASKS_NOTE,
  effectiveDeadline,
  tribulationDeletePrice,
  tribulationEditPrice,
  tribulationStatus,
  type StepOneRealm,
  type Tribulation,
} from "@cultivation/rules";
import { DateField, dayIn, daysLeft, endOfLocalDay } from "../lib/fields";
import { useStore } from "../lib/store";
import { Button, C, Card, Chip, Field, Note, Row, Screen, T, when, words } from "../lib/ui";

type Result = (ok: boolean, text: string) => void;

/** What to do next in each realm and its self-check question, shown after a breakthrough (the realm intro). */
const REALM_INTRO: Record<string, { next: string; question: string }> = {
  foundation_establishment: {
    next: "Declare tribulations to conquer. The first three you pass raise you to mid, late and great circle (each level also needs 250 Qi). Then form your core: pick the core discipline and your class.",
    question: "Is this the field I want to pursue?",
  },
  core_formation: {
    next: "Declare the tribulations that would make you a professional. Levels come at 30, 60 and 90% of them passed (counted from 5), the breakthrough at 100%.",
    question: "Am I a professional yet, or what is missing?",
  },
  nascent_soul: {
    next: "Define the achievements that would make you an expert, then lock the set within 90 days. Claims open after the lock; passing every one transcends to Spirit Realm.",
    question: "Am I an expert, or am I lacking something?",
  },
  spirit_realm: { next: "Progression continues with Step 2.", question: "What would I combine into my own dao?" },
};

const PREVIOUS: Record<string, string> = { nascent_soul: "core_formation", spirit_realm: "nascent_soul" };

export default function Trials() {
  const { state, now, log } = useStore();
  const [note, setNote] = useState<{ text: string; error: boolean } | null>(null);
  const realm = state.main.realm;
  const purpose = REALM_TRIBULATION_PURPOSE[realm as StepOneRealm];
  const p = state.progress;
  const result: Result = (ok, text) => setNote({ text, error: !ok });

  const items = Object.entries(state.tribulations.items).map(([id, t]) => ({ id, t, st: tribulationStatus(state, id)! }));
  const active = items.filter((x) => x.st === "open" || x.st === "failed");
  const passed = items.filter((x) => x.st === "passed" && x.t.realm === realm && x.t.closedAt === null);
  const past = items.filter((x) => !active.includes(x) && !passed.includes(x));
  const declarable = realm !== "qi_condensation" && realm !== "spirit_realm";
  const { entered } = useLocalSearchParams<{ entered?: string }>();
  const intro = REALM_INTRO[realm];

  return (
    <Screen>
      {entered === realm && intro ? (
        <Card title={`Breakthrough: ${words(realm)}`}>
          <T>{intro.next}</T>
          <T muted>Ask yourself: {intro.question}</T>
          <Button label="Got it" kind="ghost" onPress={() => router.setParams({ entered: undefined })} />
        </Card>
      ) : null}
      <Card title={`${words(realm)} tribulations`}>
        {purpose ? (
          <>
            <T>{purpose.purpose}</T>
            {purpose.good.length ? <T muted>Good: {purpose.good.join("; ")}.</T> : null}
            {purpose.bad.length ? <T muted>Not tribulations: {purpose.bad.join("; ")}.</T> : null}
            <T muted>{TRIBULATION_TASKS_NOTE}</T>
          </>
        ) : (
          <T muted>Spirit Realm&apos;s tribulations come with Step 2.</T>
        )}
      </Card>

      <Note text={note?.text ?? null} error={note?.error} />

      {realm === "nascent_soul" && p.lockedAt === null ? (
        <Card title="Lock the set">
          <T muted>
            Until the lock, edits and deletions are free and claims wait. Lock by {when(p.enteredAt + RULES_V1.realms.lockWithinDays * DAY)}, or the set locks as it stands. After
            it, adding stays free and edits and deletions cost the normal prices.
          </T>
          <Button
            label="Lock the set"
            onPress={() =>
              Alert.alert("Lock Nascent Soul's set?", "Claims open; edits and deletions start to cost.", [
                { text: "Not yet", style: "cancel" },
                { text: "Lock", onPress: () => void log({ type: "NascentSoulLocked" }).then((r) => result(r.ok, r.ok ? "The set is locked." : r.message)) },
              ])
            }
          />
        </Card>
      ) : null}

      {active.map(({ id, t, st }) => (
        <TribulationCard key={id} id={id} t={t} st={st} onResult={result} />
      ))}
      {passed.length > 0 ? (
        <Card title="Passed in this realm">
          {passed.map(({ id, t }) => (
            <PassedRow key={id} id={id} t={t} onResult={result} />
          ))}
        </Card>
      ) : null}

      {declarable ? <Declare onResult={result} /> : null}
      {PREVIOUS[realm] ? <Repent previous={PREVIOUS[realm]!} onResult={result} /> : null}

      {past.length > 0 ? (
        <Card title="Record">
          {past.map(({ id, t, st }) => (
            <T key={id} muted>
              {t.title} · {words(t.realm)} · {st}
              {t.passedAt ? ` ${when(t.passedAt)}` : ""}
            </T>
          ))}
        </Card>
      ) : null}
      <T muted>{when(now)}</T>
    </Screen>
  );
}

function Declare({ onResult }: { onResult: Result }) {
  const { log } = useStore();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [criteria, setCriteria] = useState("");
  const [due, setDue] = useState(() => dayIn(30));
  if (!open) return <Button label="Declare a tribulation" onPress={() => setOpen(true)} />;
  const declare = async () => {
    const r = await log({ type: "TribulationDeclared", tribulationId: Crypto.randomUUID(), title: title.trim(), criteria: criteria.trim(), deadline: endOfLocalDay(due) });
    onResult(r.ok, r.ok ? `Declared: ${title.trim()}. The criteria are locked now; edits cost Qi after the first hour.` : r.message);
    if (r.ok) {
      setTitle("");
      setCriteria("");
      setOpen(false);
    }
  };
  return (
    <Card title="Declare a tribulation">
      <T muted>A specific, checkable result and a deadline, written before you start. There are no extensions: a missed deadline fails and costs Qi and gold.</T>
      <Field label="Title" value={title} onChangeText={setTitle} maxLength={120} />
      <Field label="Criteria: what exactly counts as passing" value={criteria} onChangeText={setCriteria} multiline maxLength={2000} />
      <DateField title="Deadline (at least 24 hours out, at most a year)" value={due} onChange={setDue} minDays={1} />
      <Row>
        <Button label="Declare" onPress={() => void declare()} disabled={!title.trim() || !criteria.trim()} />
        <Button label="Close" kind="ghost" onPress={() => setOpen(false)} />
      </Row>
    </Card>
  );
}

const price = (p: { qi: number; gold: number }) => (p.qi === 0 && p.gold === 0 ? "free" : `${p.qi.toFixed(1)} Qi${p.gold ? ` and ${p.gold.toFixed(1)} gold` : ""}`);

function TribulationCard({ id, t, st, onResult }: { id: string; t: Tribulation; st: string; onResult: Result }) {
  const { state, now, log } = useStore();
  const [mode, setMode] = useState<"none" | "claim" | "edit" | "reschedule">("none");
  const [evidence, setEvidence] = useState("");
  const [title, setTitle] = useState(t.title);
  const [criteria, setCriteria] = useState(t.criteria);
  const [due, setDue] = useState(() => dayIn(14));
  const deadline = t.due ? effectiveDeadline(t.due, state.rest, now) : null;

  const claim = async () => {
    const ref = evidence.trim();
    const r = await log({
      type: "TribulationClaimed",
      tribulationId: id,
      oath: TRIBULATION_OATH,
      llmReview: "skipped",
      ...(ref ? { evidence: [{ kind: "link" as const, ref }] } : {}),
    });
    onResult(r.ok, r.ok ? `Passed: ${t.title}.` : r.message);
    if (r.ok) setMode("none");
  };
  const edit = async () => {
    const changes = { ...(title.trim() !== t.title ? { title: title.trim() } : {}), ...(criteria.trim() !== t.criteria ? { criteria: criteria.trim() } : {}) };
    const r = await log({ type: "TribulationEdited", tribulationId: id, ...changes });
    onResult(r.ok, r.ok ? "Edited (logged in the integrity log)." : r.message);
    if (r.ok) setMode("none");
  };
  const reschedule = async () => {
    const r = await log({ type: "TribulationRescheduled", tribulationId: id, deadline: endOfLocalDay(due) });
    onResult(r.ok, r.ok ? "A new date is set; the attempt starts over." : r.message);
    if (r.ok) setMode("none");
  };
  const del = () => {
    const pr = tribulationDeletePrice(state, id, Date.now());
    Alert.alert("Delete this tribulation?", `It costs ${price(pr)}${pr.kind === "open" ? " (taken like a failure, more than failing)" : ""} and is logged in the integrity log.`, [
      { text: "Keep it", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => void log({ type: "TribulationDeleted", tribulationId: id }).then((r) => onResult(r.ok, r.ok ? "Deleted (logged)." : r.message)) },
    ]);
  };

  const editPrice = tribulationEditPrice(state, id, now);
  return (
    <Card title={t.title} right={<T style={{ color: st === "failed" ? C.danger : C.gold }}>{st}</T>}>
      <T>{t.criteria}</T>
      <T muted>
        {words(t.realm)}
        {deadline ? ` · due ${when(deadline)} · ${daysLeft(deadline, now)}` : " · no date: set a new one"}
        {t.failures ? ` · failed ${t.failures}x` : ""}
        {t.edits ? ` · edited ${t.edits}x` : ""}
      </T>
      {mode === "claim" ? (
        <View style={{ gap: 8 }}>
          <Field label="Evidence link (optional)" value={evidence} onChangeText={setEvidence} autoCapitalize="none" keyboardType="url" maxLength={500} />
          <T style={{ fontStyle: "italic", color: C.gold }}>{TRIBULATION_OATH}</T>
          <Row>
            <Button label="I swear it" onPress={() => void claim()} />
            <Button label="Back" kind="ghost" onPress={() => setMode("none")} />
          </Row>
        </View>
      ) : mode === "edit" ? (
        <View style={{ gap: 8 }}>
          <Field label="Title" value={title} onChangeText={setTitle} maxLength={120} />
          <Field label="Criteria" value={criteria} onChangeText={setCriteria} multiline maxLength={2000} />
          <T muted>
            This edit costs {price(editPrice)}
            {editPrice.kind === "late" ? " (last quarter: the cost of a failure)" : ""}.
          </T>
          <Row>
            <Button label="Save edit" onPress={() => void edit()} disabled={title.trim() === t.title && criteria.trim() === t.criteria} />
            <Button label="Back" kind="ghost" onPress={() => setMode("none")} />
          </Row>
        </View>
      ) : mode === "reschedule" ? (
        <View style={{ gap: 8 }}>
          <DateField title="New deadline" value={due} onChange={setDue} minDays={1} />
          <Row>
            <Button label="Set the date" onPress={() => void reschedule()} />
            <Button label="Back" kind="ghost" onPress={() => setMode("none")} />
          </Row>
        </View>
      ) : (
        <Row>
          {st === "open" ? <Button label="Claim" onPress={() => setMode("claim")} /> : null}
          {st === "failed" ? <Button label="New date" onPress={() => setMode("reschedule")} /> : null}
          <Button label="Edit" kind="ghost" onPress={() => setMode("edit")} />
          <Button label="Delete" kind="danger" onPress={del} />
        </Row>
      )}
    </Card>
  );
}

/** A pass of the current realm can be deleted as faked (ruling 126). */
function PassedRow({ id, t, onResult }: { id: string; t: Tribulation; onResult: Result }) {
  const { state, log } = useStore();
  const fake = () => {
    const pr = tribulationDeletePrice(state, id, Date.now());
    Alert.alert(
      "Was this pass faked?",
      `Deleting it costs ${price(pr)} and logs it as faked. Your level stays; the count toward the next step drops until another pass replaces it.`,
      [
        { text: "Keep it", style: "cancel" },
        { text: "It was faked", style: "destructive", onPress: () => void log({ type: "TribulationDeleted", tribulationId: id }).then((r) => onResult(r.ok, r.ok ? "Deleted as faked (logged)." : r.message)) },
      ],
    );
  };
  return (
    <Row>
      <T>{t.title}</T>
      <T muted>{t.passedAt ? when(t.passedAt) : ""}</T>
      <Button label="It was faked" kind="danger" onPress={fake} />
    </Row>
  );
}

/** Rulings 101-107: admit faked tribulations of the previous realm and drop back to it. */
function Repent({ previous, onResult }: { previous: string; onResult: Result }) {
  const { state, log } = useStore();
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const candidates = Object.entries(state.tribulations.items).filter(([, t]) => t.realm === previous && t.status === "passed" && t.closedAt === null);
  const count = state.progress.repents[state.main.realm] ?? 0;
  if (!open) return <Button label="Repent…" kind="ghost" onPress={() => setOpen(true)} />;
  const toggle = (id: string) => setPicked(picked.includes(id) ? picked.filter((x) => x !== id) : [...picked, id]);
  const repent = () =>
    Alert.alert(
      "Repent?",
      `You drop to ${words(previous)}; the marked tribulations fail and need new dates, with no Qi refund. This would be repent ${count + 1} in this realm; from the 2nd on it costs items, gold and Qi, and the 5th kills the avatar.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Repent",
          style: "destructive",
          onPress: () =>
            void log({ type: "Repented", oath: REPENT_OATH, faked: picked }).then((r) => {
              onResult(r.ok, r.ok ? `Repented. Back to ${words(previous)}.` : r.message);
              if (r.ok) setOpen(false);
            }),
        },
      ],
    );
  return (
    <Card title="Repent">
      <T muted>For tribulations of {words(previous)} you passed by faking them. Mark them (none only if you entered this realm by override).</T>
      <Row>
        {candidates.map(([id, t]) => (
          <Chip key={id} label={t.title} on={picked.includes(id)} onPress={() => toggle(id)} />
        ))}
      </Row>
      <T style={{ fontStyle: "italic", color: C.gold }}>{REPENT_OATH}</T>
      <Row>
        <Button label="I swear it" kind="danger" onPress={repent} />
        <Button label="Close" kind="ghost" onPress={() => setOpen(false)} />
      </Row>
    </Card>
  );
}

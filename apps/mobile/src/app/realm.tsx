import { useState } from "react";
import { Alert, View } from "react-native";
import type { ClassId } from "@cultivation/schema";
import { DAY, RULES_V1, conqueredTribulations, foundationPasses, realmStatus, type Realm } from "@cultivation/rules";
import { ClassPicker } from "../lib/classes";
import { AreaDecisions } from "../lib/onboarding";
import { useStore } from "../lib/store";
import { Button, C, Card, Field, Meter, Note, Row, SOUL_HEX, Screen, T, cap, when, words } from "../lib/ui";

const MISSING: Record<string, string> = {
  areas: "Decide your three areas.",
  lock_areas: "All three areas are decided: lock them below to break through.",
  tribulations: "Pass the realm's tribulations.",
  choice: "Make the end-of-Foundation choice: form your core and pick a class.",
  lock: "Lock Nascent Soul's set (Trials tab).",
};

export default function RealmScreen() {
  const { state, now } = useStore();
  const [note, setNote] = useState<{ text: string; error: boolean } | null>(null);
  const status = realmStatus(state);
  const p = state.progress;
  const next = status.next;
  const realm = state.main.realm;
  const c = state.companion;
  const capacity = RULES_V1.tiers[c.tier].capacity;

  const result = (ok: boolean, text: string) => setNote({ text, error: !ok });

  return (
    <Screen>
      <View style={{ gap: 4 }}>
        <T style={{ fontSize: 26, fontWeight: "800" }}>{state.name}</T>
        <T style={{ color: C.gold, fontSize: 18, fontWeight: "700" }}>
          {words(realm)}
          {status.level ? ` · ${words(status.level)}` : ""}
        </T>
        <Row gap={16}>
          <T>Qi {state.qi.toFixed(1)}</T>
          <T>Gold {state.gold.toFixed(1)}</T>
          <T muted>{state.class.id ? `Class: ${cap(state.class.id)}` : "No class yet"}</T>
        </Row>
        {status.dead ? <T style={{ color: C.danger }}>The avatar is dead: nothing pays until a revival quest of a week of work is completed.</T> : null}
      </View>

      <Card title="Next step">
        {next ? (
          <>
            <T>
              {next.kind === "level" ? "Level-up" : "Breakthrough"}: {next.waived ? "Qi waived (fast track)" : `${next.qi} Qi`}
            </T>
            {next.qi > 0 && !next.waived ? <Meter value={state.qi / next.qi} /> : null}
            {next.ready ? (
              <T style={{ color: next.waitingForQi ? C.gold : C.good }}>{next.waitingForQi ? "Passed, waiting for Qi." : "Ready."}</T>
            ) : (
              <T muted>{MISSING[next.missing ?? ""] ?? ""}</T>
            )}
            {status.tribulations ? (
              <T muted>
                Tribulations: {status.tribulations.passed} of {status.tribulations.total} passed
                {realm === "core_formation" ? " (the percentage counts from 5; levels at 30, 60 and 90%, the breakthrough at 100%)" : ""}
              </T>
            ) : null}
          </>
        ) : (
          <T muted>Spirit Realm: progression continues with Step 2.</T>
        )}
      </Card>

      <Note text={note?.text ?? null} error={note?.error} />

      {realm === "qi_condensation" ? <AreaDecisions /> : <AreasLater onResult={result} />}

      {realm === "foundation_establishment" && status.level === "great_circle" && foundationPasses(state).length === 3 && !p.coreChosen ? <FormCore onResult={result} /> : null}

      {realm === "nascent_soul" && p.lockedAt === null ? (
        <Card title="Nascent Soul's set">
          <T muted>Define the set in the Trials tab, then lock it there by {when(p.enteredAt + RULES_V1.realms.lockWithinDays * DAY)} (or it locks as it stands).</T>
        </Card>
      ) : null}

      <Card title="Companion and soul">
        <Row gap={10}>
          <T>{cap(c.tier)}</T>
          <View style={{ flex: 1 }}>
            <Meter value={c.food / capacity} />
          </View>
        </Row>
        <Row gap={8}>
          <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: SOUL_HEX[state.soul.color], borderWidth: 1, borderColor: C.border }} />
          <T>Soul {cap(state.soul.color)}</T>
        </Row>
      </Card>

      <History />
      <HallOfFame />
      <Override realm={realm} onResult={result} />
      <T muted>{when(now)}</T>
    </Screen>
  );
}

/** Area changes after Qi Condensation cost Qi; a Main change is a discipline change (rulings 88, 90, 91). */
function AreasLater({ onResult }: { onResult: (ok: boolean, text: string) => void }) {
  const { state, log } = useStore();
  const [open, setOpen] = useState(false);
  const [path, setPath] = useState<"main" | "body" | "soul">("main");
  const [choice, setChoice] = useState("");
  const areas = state.progress.areas;
  const prices = RULES_V1.realms.prices;
  const realm = state.main.realm;
  const price =
    path !== "main" ? `${prices.areaChangeQi} Qi` : realm === "foundation_establishment" ? `${prices.foundationSwitchQi} Qi (Foundation keeps its tribulations)` : realm === "spirit_realm" ? "not allowed until Step 2" : `${prices.coreChangeQi} Qi, closes the old discipline's tribulations and returns to early Core Formation`;
  return (
    <Card title="Areas">
      <T muted>
        Main: {areas.main ?? "—"} · Body: {areas.body ?? "—"} · Soul: {areas.soul ?? "—"}
      </T>
      {open ? (
        <>
          <Row>
            {(["main", "body", "soul"] as const).map((x) => (
              <Button key={x} label={cap(x)} kind={x === path ? "primary" : "ghost"} onPress={() => setPath(x)} />
            ))}
          </Row>
          <Field label="New choice" value={choice} onChangeText={setChoice} maxLength={200} />
          <T muted>Costs {price}.</T>
          <Row>
            <Button
              label="Change"
              kind="danger"
              disabled={!choice.trim()}
              onPress={() =>
                Alert.alert(`Change ${path}?`, `This costs ${price}.`, [
                  { text: "Keep it", style: "cancel" },
                  {
                    text: "Change",
                    style: "destructive",
                    onPress: () =>
                      void log({ type: "AreaDecided", path, choice: choice.trim() }).then((r) => onResult(r.ok, r.ok ? `${cap(path)} is now ${choice.trim()}` : r.message)),
                  },
                ])
              }
            />
            <Button label="Close" kind="ghost" onPress={() => setOpen(false)} />
          </Row>
        </>
      ) : (
        <Button label="Change an area" kind="ghost" onPress={() => setOpen(true)} />
      )}
    </Card>
  );
}

/** The end-of-Foundation choice: the core discipline and the class, both free (rulings 74, 90, 113). */
function FormCore({ onResult }: { onResult: (ok: boolean, text: string) => void }) {
  const { state, log } = useStore();
  const [discipline, setDiscipline] = useState(state.progress.areas.main ?? "");
  const [cls, setCls] = useState<ClassId | null>(null);
  return (
    <Card title="Form your core">
      <T>Foundation&apos;s three tribulations are passed. Pick the core discipline and your class; both are free now.</T>
      <Field label="Core discipline" value={discipline} onChangeText={setDiscipline} maxLength={200} />
      <ClassPicker value={cls} onChange={setCls} />
      <Button
        label="Form the core"
        disabled={!discipline.trim() || cls === null}
        onPress={() =>
          void log({ type: "CoreFormed", choice: discipline.trim(), class: cls! }).then((r) => onResult(r.ok, r.ok ? `Core formed in ${discipline.trim()} as a ${cls}.` : r.message))
        }
      />
    </Card>
  );
}

function History() {
  const { state } = useStore();
  const steps = [...state.progress.steps].reverse().slice(0, 12);
  if (steps.length === 0) return null;
  return (
    <Card title="Steps">
      {steps.map((x) => (
        <T key={x.step} muted>
          {when(x.at)} · {x.kind}
          {x.repented ? " (repented)" : ""} · {words(x.realm)}
          {x.level ? ` ${words(x.level)}` : ""}
          {x.qiSpent ? ` · ${x.qiSpent} Qi` : ""}
          {x.waived ? " · fast track" : ""}
          {x.legendary ? " · legendary item" : ""}
        </T>
      ))}
    </Card>
  );
}

function HallOfFame() {
  const { state } = useStore();
  const conquered = conqueredTribulations(state);
  if (conquered.length === 0) return null;
  return (
    <Card title="Conquered tribulations">
      {conquered.map((t) => (
        <T key={`${t.step}-${t.tribulationId}`}>
          {t.title} <T muted>· {words(t.realm)} · {when(t.passedAt)}</T>
        </T>
      ))}
    </Card>
  );
}

/** Ruling 84: advance one step for free, logged; out of Foundation it must pick the class (ruling 113). */
function Override({ realm, onResult }: { realm: Realm; onResult: (ok: boolean, text: string) => void }) {
  const { state, log } = useStore();
  const [open, setOpen] = useState(false);
  const [cls, setCls] = useState<ClassId | null>(null);
  const status = realmStatus(state);
  if (!status.next) return null;
  const leavingFoundation = realm === "foundation_establishment" && status.next.kind === "breakthrough" && state.class.id === null;
  if (!open) return <Button label="Manual override…" kind="ghost" onPress={() => setOpen(true)} />;
  return (
    <Card title="Manual override">
      <T muted>Advances one level or realm, ignoring Qi and tribulations. It costs nothing and earns no legendary roll, but it stays in your integrity log.</T>
      {leavingFoundation ? <ClassPicker value={cls} onChange={setCls} /> : null}
      <Row>
        <Button
          label="Override"
          kind="danger"
          disabled={leavingFoundation && cls === null}
          onPress={() =>
            Alert.alert("Advance by override?", "It is logged in the integrity log.", [
              { text: "Cancel", style: "cancel" },
              {
                text: "Override",
                style: "destructive",
                onPress: () =>
                  void log({ type: "RealmOverride", ...(cls ? { class: cls } : {}) }).then((r) => {
                    onResult(r.ok, r.ok ? "Advanced by override (logged)." : r.message);
                    if (r.ok) setOpen(false);
                  }),
              },
            ])
          }
        />
        <Button label="Close" kind="ghost" onPress={() => setOpen(false)} />
      </Row>
    </Card>
  );
}

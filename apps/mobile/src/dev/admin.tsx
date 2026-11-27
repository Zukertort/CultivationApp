/**
 * DEV ONLY. Admin controls, shown only while the dev panel's admin mode is on
 * (lib/admin). They write events that are not a player option: the game stays
 * finishable through fixes, not self-overrides (ruling 84).
 */
import { useState } from "react";
import { Alert } from "react-native";
import type { ClassId } from "@cultivation/schema";
import { realmStatus, type Realm } from "@cultivation/rules";
import type { AdminControls, Result } from "../lib/admin";
import { ClassPicker } from "../lib/classes";
import { useStore } from "../lib/store";
import { Button, Card, Row, T } from "../lib/ui";

/** Ruling 84: advance one step for free, logged; out of Foundation it must pick the class (ruling 113). */
function RealmOverride({ realm, onResult }: { realm: Realm; onResult: Result }) {
  const { state, log } = useStore();
  const [open, setOpen] = useState(false);
  const [cls, setCls] = useState<ClassId | null>(null);
  const status = realmStatus(state);
  if (!status.next) return null;
  const leavingFoundation = realm === "foundation_establishment" && status.next.kind === "breakthrough" && state.class.id === null;
  if (!open) return <Button label="Admin: manual override…" kind="ghost" onPress={() => setOpen(true)} />;
  return (
    <Card title="Admin: manual override">
      <T muted>Admin tool, not a player option. Advances one level or realm, ignoring Qi and tribulations. It costs nothing and earns no legendary roll, but it stays in the integrity log.</T>
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

export const ADMIN_CONTROLS: AdminControls = { RealmOverride };

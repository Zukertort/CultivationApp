/**
 * Gear names, stat lines and the two gear messages: the avatar's warning when
 * an item is close to breaking, and the System message when one breaks
 * (rulings 137-145). Numbers come from @cultivation/rules.
 */
import { useEffect } from "react";
import { Alert } from "react-native";
import { useSQLiteContext } from "expo-sqlite";
import { FULL_DURABILITY_BP, RULES_V1, gearWarnings, type CultivatorState, type GearItem, type GearRealm } from "@cultivation/rules";
import { getMeta, setMeta } from "./db";
import { useStore } from "./store";
import { words } from "./ui";

const ROBE_COLOR: Record<GearRealm, string> = {
  foundation_establishment: "White",
  core_formation: "Yellow",
  nascent_soul: "Blue",
  spirit_realm: "Green",
};

export function gearName(i: Pick<GearItem, "kind" | "slot" | "realm">): string {
  if (i.kind === "robe") return `${ROBE_COLOR[i.realm]} robe`;
  const what = `${words(i.realm)} ${i.slot}`;
  return i.kind === "legendary" ? `Legendary ${what.toLowerCase()}` : what;
}

/** "Failures take 8 Qi and 4 gold less" / "+2% Qi on every gain". */
export function gearStats(i: Pick<GearItem, "kind" | "slot" | "realm">): string {
  if (i.slot === "armor") {
    const a = RULES_V1.gear.armor[i.kind][i.realm];
    return `A failed tribulation takes ${a.qi} Qi and ${a.gold} gold less`;
  }
  if (i.kind === "robe") return "";
  return `+${Math.round(RULES_V1.gear.weapon[i.kind][i.realm] * 100)}% Qi on every gain`;
}

export const durability = (i: GearItem) => 1 - i.damageBp / FULL_DURABILITY_BP;

/** The avatar's warning (design: "My equipment is almost broken; I should repair it before it's lost"). */
export function gearWarning(state: CultivatorState): string | null {
  const w = gearWarnings(state);
  if (w.length === 0) return null;
  return `My equipment is almost broken; I should repair it before it's lost. (${w.map(gearName).join(", ")})`;
}

const LOST_SEEN = "gear_lost_seen";

/** The System message when gear is lost: broken at 100%, or taken by a repent or death. Each loss is shown once. */
export function GearWatcher() {
  const db = useSQLiteContext();
  const { state } = useStore();
  const lost = state.gear.lost;
  const count = lost.length;

  useEffect(() => {
    let cancelled = false;
    void getMeta(db, LOST_SEEN).then((seen) => {
      if (cancelled) return;
      // First run on this database: start from what's already there.
      if (seen === null) {
        void setMeta(db, LOST_SEEN, String(count));
        return;
      }
      const fresh = lost.slice(Number(seen));
      if (fresh.length === 0) return;
      void setMeta(db, LOST_SEEN, String(count));
      const lines = fresh.map((l) => `${gearName(l.item)}: ${l.reason === "broken" ? "broke and was lost" : l.reason === "repent" ? "taken by the repent" : "lost with the avatar's death"}.`);
      Alert.alert("System", lines.join("\n"));
    });
    return () => {
      cancelled = true;
    };
  }, [db, count, lost]);

  return null;
}

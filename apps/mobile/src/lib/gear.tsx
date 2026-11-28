/**
 * Gear names, stat lines, the gear warnings with their one-tap actions, and
 * the System messages: an item lost, a new robe put in the stash (rulings
 * 137-158), and "Legendary!" on every legendary roll (rulings 176-177).
 * Numbers come from @cultivation/rules.
 */
import { useEffect, useState } from "react";
import { Alert, View } from "react-native";
import { useSQLiteContext } from "expo-sqlite";
import {
  FULL_DURABILITY_BP,
  RULES_V1,
  armorAtRisk,
  armorCare,
  bestStashArmor,
  gearWarnings,
  repairPrice,
  stash,
  wearable,
  wornItem,
  type CultivatorState,
  type GearItem,
  type GearRealm,
} from "@cultivation/rules";
import { getMeta, setMeta } from "./db";
import { useStore, type EventInput } from "./store";
import { Button, C, Note, Row, T, words } from "./ui";

const ROBE_COLOR: Record<GearRealm, string> = {
  foundation_establishment: "White",
  core_formation: "Yellow",
  nascent_soul: "Blue",
  spirit_realm: "Green",
};

export function gearName(i: Pick<GearItem, "kind" | "slot" | "realm"> & { name?: string | undefined }): string {
  if (i.kind === "robe") return `${ROBE_COLOR[i.realm]} robe`;
  const what = `${words(i.realm)} ${i.slot}`;
  // A legendary item carries its pool name (cosmetic; ruling 176).
  return i.kind === "legendary" ? `${i.name ?? "Legendary"} (legendary ${what.toLowerCase()})` : what;
}

/** Legendary items and wearables are marked in gold. */
export const LEGENDARY_COLOR = C.gold;

/** "A failed tribulation takes 8 Qi and 4 gold less" / "+2% Qi on every gain". */
export function gearStats(i: Pick<GearItem, "kind" | "slot" | "realm">): string {
  if (i.slot === "armor") {
    const a = RULES_V1.gear.armor[i.kind][i.realm];
    return `A failed tribulation takes ${a.qi} Qi and ${a.gold} gold less`;
  }
  if (i.kind === "robe") return "";
  return `+${Math.round(RULES_V1.gear.weapon[i.kind][i.realm] * 100)}% Qi on every gain`;
}

export const durability = (i: GearItem) => 1 - i.damageBp / FULL_DURABILITY_BP;

export const isDead = (state: CultivatorState) => state.progress.diedAt !== null;

/** The avatar's warning (design: "My equipment is almost broken; I should repair it before it's lost"). */
export function gearWarning(state: CultivatorState): string | null {
  const w = gearWarnings(state);
  if (w.length === 0) return null;
  return `My equipment is almost broken; I should repair it before it's lost. (${w.map(gearName).join(", ")})`;
}

/** The avatar's in-app line from 50% damage, never pushed (ruling 153). */
export function careLine(state: CultivatorState): string | null {
  return armorCare(state) ? "My armor is getting damaged; I should take care of it." : null;
}

/** The before-deadline warning (ruling 153). */
export function riskWarning(state: CultivatorState): string | null {
  const r = armorAtRisk(state);
  if (!r) return null;
  const t = state.tribulations.items[r.tribulationId];
  const fix = r.item.slot === "armor" ? "repair it or wear other armor" : "repair it or take it off";
  return `My ${gearName(r.item).toLowerCase()} would break if I fail "${t?.title ?? "a tribulation"}". I should ${fix} before the deadline.`;
}

/** The two one-tap armor actions (ruling 149): never applied on their own, always tapped. */
export type ArmorAction = "swap" | "repair";

export function armorActionInput(state: CultivatorState, action: ArmorAction): { input: EventInput; done: string } | { error: string } {
  if (isDead(state)) return { error: "Nothing can be repaired or swapped while the avatar is dead." };
  const armor = wornItem(state, "armor");
  if (action === "swap") {
    const best = bestStashArmor(state);
    if (!best) return { error: "No armor in the stash is wearable and safe from a failure." };
    return { input: { type: "GearEquipped", itemId: best.id }, done: `Wearing the ${gearName(best)}.` };
  }
  // Repair what is at risk (armor or weapon, ruling 166), else the worn armor.
  const target = armorAtRisk(state)?.item ?? armor;
  if (!target || target.damageBp <= 0) return { error: "No worn gear to repair." };
  const price = repairPrice(target);
  if (state.gold < price) return { error: `A repair costs ${Math.ceil(price)} gold.` };
  return { input: { type: "GearRepaired", itemId: target.id }, done: `Repaired the ${gearName(target)}.` };
}

/** The warnings, each with the two one-tap actions; used on the Realm and Store screens. */
export function GearWarnings() {
  const { state, log } = useStore();
  const [note, setNote] = useState<{ text: string; error: boolean } | null>(null);
  const breaking = gearWarning(state);
  const risk = riskWarning(state);
  const care = breaking || risk ? null : careLine(state);
  if (care) return <T style={{ color: C.gold, fontStyle: "italic" }}>{care}</T>;
  if (!breaking && !risk) return note ? <Note text={note.text} error={note.error} /> : null;
  const armor = wornItem(state, "armor");
  const atRisk = armorAtRisk(state)?.item ?? null;
  // Repair targets the item at risk (armor or weapon), else the worn armor at the warning line.
  const target = atRisk ?? (armor && armor.damageBp >= RULES_V1.gear.warnAtBp ? armor : null);
  const best = bestStashArmor(state);
  const run = async (action: ArmorAction) => {
    const a = armorActionInput(state, action);
    if ("error" in a) return setNote({ text: a.error, error: true });
    const r = await log(a.input);
    setNote(r.ok ? { text: a.done, error: false } : { text: r.message, error: true });
  };
  return (
    <View style={{ gap: 6 }}>
      {risk ? <T style={{ color: C.danger, fontStyle: "italic" }}>{risk}</T> : null}
      {breaking ? <T style={{ color: C.danger, fontStyle: "italic" }}>{breaking}</T> : null}
      {target && !isDead(state) ? (
        <Row>
          {target.slot === "armor" ? (
            <Button label={best ? `Swap with the ${gearName(best).toLowerCase()}` : "No armor to swap"} kind="ghost" disabled={!best} onPress={() => void run("swap")} />
          ) : null}
          <Button label={`Repair the ${gearName(target).toLowerCase()} (${Math.ceil(repairPrice(target))} gold)`} kind="ghost" disabled={state.gold < repairPrice(target)} onPress={() => void run("repair")} />
        </Row>
      ) : null}
      <Note text={note?.text ?? null} error={note?.error} />
    </View>
  );
}

const LOST_SEEN = "gear_lost_seen";
const ROBES_SEEN = "gear_robes_seen";
const LEGENDARY_SEEN = "gear_legendary_seen";
const LEGENDARY_WEARABLES_SEEN = "class_legendary_wearables_seen";

const SOURCE_TEXT = { step: "the level-up or breakthrough", class: "the class drop", roulette: "the golden ticket", soul: "a soul drop" } as const;

const LOST_TEXT = { broken: "broke and was lost", repent: "taken by the repent", soul: "lost to a heart demon", death: "lost with the avatar's death" } as const;

/** Show each new entry of a growing list once, starting from what's there on first run. */
function useOnce(key: string, count: number, show: (from: number) => void) {
  const db = useSQLiteContext();
  useEffect(() => {
    let cancelled = false;
    void getMeta(db, key).then((seen) => {
      if (cancelled) return;
      if (seen === null || Number(seen) > count) {
        void setMeta(db, key, String(count));
        return;
      }
      if (Number(seen) === count) return;
      void setMeta(db, key, String(count));
      show(Number(seen));
    });
    return () => {
      cancelled = true;
    };
    // `show` reads the latest state through the closure; the count drives it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, key, count]);
}

/**
 * The System messages: gear lost (broken at 100%, or taken by a repent, a
 * soul drop or death), and a new realm's robe put in the stash because armor
 * was worn, offered with "Wear" (ruling 149). Each is shown once.
 */
export function GearWatcher() {
  const { state, log } = useStore();
  const lost = state.gear.lost;
  useOnce(LOST_SEEN, lost.length, (from) => {
    const lines = lost.slice(from).map((l) => `${gearName(l.item)}: ${LOST_TEXT[l.reason]}.`);
    Alert.alert("System", lines.join("\n"));
  });

  // "Legendary!" on every legendary roll: the item, where it went, or the gold the 365-day cap paid instead (ruling 176).
  const legendary = state.gear.legendary;
  useOnce(LEGENDARY_SEEN, legendary.length, (from) => {
    for (const r of legendary.slice(from)) {
      const item = r.itemId === null ? null : state.gear.items[r.itemId];
      if (r.itemId === null) {
        const per = r.source === "roulette" ? "The golden ticket gives" : "Soul drops give";
        Alert.alert("Legendary!", `${per} one legendary item every ${RULES_V1.gear.legendaryCapDays} days, and one came less than ${RULES_V1.gear.legendaryCapDays} days ago: ${r.gold.toFixed(0)} gold instead.`);
        continue;
      }
      if (!item) continue;
      const isWorn = state.gear.worn[item.slot] === item.id;
      const where = isWorn ? "I wear it now." : wearable(state, item) ? "It's in the stash." : `It's in the stash, worn from ${words(item.realm)} on.`;
      const worn = wornItem(state, item.slot);
      const buttons = !isWorn && wearable(state, item)
        ? [
            { text: "Keep it in the stash", style: "cancel" as const },
            { text: "Wear", onPress: () => void log({ type: "GearEquipped", itemId: item.id }) },
          ]
        : undefined;
      Alert.alert("Legendary!", `From ${SOURCE_TEXT[r.source]}: the ${gearName(item)}. ${gearStats(item)}. ${where}${worn && !isWorn ? ` (The ${gearName(worn).toLowerCase()} I wear: ${gearStats(worn).toLowerCase()}.)` : ""}`, buttons);
    }
  });
  useOnce(LEGENDARY_WEARABLES_SEEN, state.class.legendaryWearables, () => {
    Alert.alert("Legendary!", "A legendary class wearable: it's held with the others in the Stash.");
  });

  const robes = state.gear.robesGranted;
  useOnce(ROBES_SEEN, robes.length, (from) => {
    const worn = wornItem(state, "armor");
    for (const realm of robes.slice(from)) {
      const robe = stash(state).find((i) => i.id === `robe:${realm}`);
      if (!robe || !worn || !wearable(state, robe)) continue;
      Alert.alert("System", `A ${gearName(robe).toLowerCase()} is in the stash. ${gearStats(robe)}; the ${gearName(worn).toLowerCase()} I wear: ${gearStats(worn).toLowerCase()}.`, [
        { text: "Keep it in the stash", style: "cancel" },
        { text: "Wear", onPress: () => void log({ type: "GearEquipped", itemId: robe.id }) },
      ]);
    }
  });
  return null;
}

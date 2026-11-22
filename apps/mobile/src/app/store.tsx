/**
 * The Store (ruling 137): what is worn, with durability and repairs, then two
 * tabs: the Shop (the current realm's gear, provisional prices until Roadmap
 * part 3) and the Stash (gear not worn: wear, repair or sell it; and potions,
 * drunk from here). While dead nothing is bought, sold or repaired (ruling 150).
 */
import { useState, type ReactNode } from "react";
import { Alert, View } from "react-native";
import type { GearSlot } from "@cultivation/schema";
import { GEAR_REALMS, repairPrice, sellPrice, shopPrice, stash, wearable, wornItem, type GearItem, type GearRealm } from "@cultivation/rules";
import { GearWarnings, durability, gearName, gearStats, isDead } from "../lib/gear";
import { useStore } from "../lib/store";
import { Button, C, Card, Meter, Note, Row, Screen, Segmented, T, words } from "../lib/ui";

const SLOTS: readonly GearSlot[] = ["armor", "weapon"];
const gold = (n: number) => `${Math.ceil(n)} gold`;

export default function StoreScreen() {
  const { state, log } = useStore();
  const [tab, setTab] = useState<"shop" | "stash">("shop");
  const [note, setNote] = useState<{ text: string; error: boolean } | null>(null);
  const realm = state.main.realm;
  const gearRealm = (GEAR_REALMS as readonly string[]).includes(realm) ? (realm as GearRealm) : null;
  const dead = isDead(state);
  const inv = state.inventory;
  const gainActive = inv.gainPotionUntil !== null && state.clock < inv.gainPotionUntil;

  const act = async (input: Parameters<typeof log>[0], ok: string) => {
    const r = await log(input);
    setNote(r.ok ? { text: ok, error: false } : { text: r.message, error: true });
  };

  return (
    <Screen>
      <Row gap={16}>
        <T style={{ fontSize: 22, fontWeight: "800" }}>Store</T>
        <T style={{ color: C.gold }}>Gold {state.gold.toFixed(1)}</T>
      </Row>
      <GearWarnings />
      {dead ? <T muted>While dead nothing can be bought, sold or repaired, and nothing pays.</T> : null}

      <Card title="Wearing">
        {gearRealm === null ? <T muted>Ordinary clothes. Gear is worn from Foundation Establishment on, starting with a free white robe.</T> : null}
        {SLOTS.map((slot) => {
          const item = wornItem(state, slot);
          return (
            <View key={slot} style={{ gap: 4 }}>
              <T muted>{words(slot)}</T>
              {item ? (
                <ItemView item={item}>
                  <Row>
                    {item.damageBp > 0 ? <Button label={`Repair (${gold(repairPrice(item))})`} kind="ghost" disabled={dead} onPress={() => void act({ type: "GearRepaired", itemId: item.id }, `Repaired the ${gearName(item)}.`)} /> : null}
                    <Button label="Take off" kind="ghost" onPress={() => void act({ type: "GearUnequipped", slot }, `The ${gearName(item)} is in the stash.`)} />
                  </Row>
                </ItemView>
              ) : (
                <T muted>Nothing worn.</T>
              )}
            </View>
          );
        })}
        <T muted>{`Armor takes the damage: each night the companion damages every armor worn that day (the Lion never does), and a failed tribulation damages the armor worn at its deadline by 20%. With no armor worn all day, the companion takes Qi and gold instead, more than a repair would cost. The weapon wears a little with each Qi gain it boosts. At 100% an item is lost; damage never weakens it before that. A full repair costs a tenth of the item's value.`}</T>
      </Card>

      <Note text={note?.text ?? null} error={note?.error} />

      <Segmented
        value={tab}
        options={[
          { value: "shop", label: "Shop" },
          { value: "stash", label: `Stash (${stash(state).length})` },
        ]}
        onChange={setTab}
      />

      {tab === "shop" ? (
        <Card title={gearRealm ? `${words(gearRealm)} gear` : "Shop"}>
          {gearRealm === null ? (
            <T muted>The shop opens in Foundation Establishment.</T>
          ) : (
            SLOTS.map((slot) => {
              const item = { kind: "shop" as const, slot, realm: gearRealm };
              const price = shopPrice(slot, gearRealm);
              return (
                <View key={slot} style={{ gap: 4 }}>
                  <T style={{ fontWeight: "700" }}>{gearName(item)}</T>
                  <T muted>{gearStats(item)}</T>
                  <Button
                    label={`Buy (${gold(price)})`}
                    disabled={dead || state.gold < price}
                    onPress={() => void act({ type: "GearBought", slot }, wornItem(state, slot) ? `Bought the ${gearName(item)}: it's in the stash.` : `Bought and wearing the ${gearName(item)}.`)}
                  />
                </View>
              );
            })
          )}
          <T muted>{`Provisional prices. Gear sells for 70% of its value less damage; free robes can't be sold. Legendary gear and class wearables only drop.`}</T>
        </Card>
      ) : (
        <Card title="Stash">
          {stash(state).length === 0 ? <T muted>Empty.</T> : null}
          {stash(state).map((item) => (
            <ItemView key={item.id} item={item}>
              {wearable(state, item) ? null : <T muted>{`A higher realm's gear: it can be worn again on reaching ${words(item.realm)}.`}</T>}
              <Row>
                {wearable(state, item) ? <Button label="Wear" kind="ghost" onPress={() => void act({ type: "GearEquipped", itemId: item.id }, `Wearing the ${gearName(item)}.`)} /> : null}
                {item.damageBp > 0 ? <Button label={`Repair (${gold(repairPrice(item))})`} kind="ghost" disabled={dead} onPress={() => void act({ type: "GearRepaired", itemId: item.id }, `Repaired the ${gearName(item)}.`)} /> : null}
                {item.kind === "robe" ? null : (
                  <Button
                    label={`Sell (${Math.floor(sellPrice(item))} gold)`}
                    kind="danger"
                    disabled={dead}
                    onPress={() =>
                      Alert.alert(`Sell the ${gearName(item)}?`, `It sells for ${sellPrice(item).toFixed(1)} gold.`, [
                        { text: "Keep it", style: "cancel" },
                        { text: "Sell", style: "destructive", onPress: () => void act({ type: "GearSold", itemId: item.id }, `Sold the ${gearName(item)}.`) },
                      ])
                    }
                  />
                )}
              </Row>
            </ItemView>
          ))}
          <T style={{ fontWeight: "700" }}>Potions</T>
          <T muted>{`Gain potions: ${inv.gainPotions}${gainActive ? " (one active)" : ""}. +10% gold and Qi for 24 hours.`}</T>
          <Button label="Drink a gain potion" kind="ghost" disabled={inv.gainPotions < 1 || gainActive} onPress={() => void act({ type: "PotionUsed", potion: "gain" }, "The gain potion is active for 24 hours.")} />
          <T muted>{`Legendary potions: ${inv.legendaryPotions}${inv.legendaryPotionArmed ? " (one armed)" : ""}. Drunk, it adds 5% to the next realm breakthrough's legendary roll; one armed at a time.`}</T>
          <Button
            label="Drink a legendary potion"
            kind="ghost"
            disabled={inv.legendaryPotions < 1 || inv.legendaryPotionArmed}
            onPress={() => void act({ type: "PotionUsed", potion: "legendary" }, "Armed for the next realm breakthrough.")}
          />
        </Card>
      )}
    </Screen>
  );
}

function ItemView({ item, children }: { item: GearItem; children?: ReactNode }) {
  const left = durability(item);
  return (
    <View style={{ gap: 4 }}>
      <T style={{ fontWeight: "700" }}>{gearName(item)}</T>
      {gearStats(item) ? <T muted>{gearStats(item)}</T> : null}
      <Meter value={left} color={left <= 0.05 ? C.danger : left <= 0.25 ? C.gold : C.good} />
      <T muted>Durability {Math.round(left * 100)}%</T>
      {children}
    </View>
  );
}

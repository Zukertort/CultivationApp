/**
 * The Store (ruling 137): what is worn, with durability and repairs, then two
 * tabs: the Shop (the current realm's gear, provisional prices until Roadmap
 * part 3) and the Stash (gear not worn: wear, repair or sell it).
 */
import { useState, type ReactNode } from "react";
import { Alert, View } from "react-native";
import type { GearSlot } from "@cultivation/schema";
import { GEAR_REALMS, repairPrice, sellPrice, shopPrice, stash, wearable, wornItem, type GearItem, type GearRealm } from "@cultivation/rules";
import { durability, gearName, gearStats, gearWarning } from "../lib/gear";
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
  const warning = gearWarning(state);

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
      {warning ? <T style={{ color: C.danger, fontStyle: "italic" }}>{warning}</T> : null}

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
                    {item.damageBp > 0 ? <Button label={`Repair (${gold(repairPrice(item))})`} kind="ghost" onPress={() => void act({ type: "GearRepaired", itemId: item.id }, `Repaired the ${gearName(item)}.`)} /> : null}
                    <Button label="Take off" kind="ghost" onPress={() => void act({ type: "GearUnequipped", slot }, `The ${gearName(item)} is in the stash.`)} />
                  </Row>
                </ItemView>
              ) : (
                <T muted>Nothing worn.</T>
              )}
            </View>
          );
        })}
        <T muted>The companion damages one worn item each day (the Lion never does), and a failed tribulation damages one by 20%. At 100% the item is lost. Damage never weakens it before that.</T>
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
                    disabled={state.gold < price}
                    onPress={() => void act({ type: "GearBought", slot }, wornItem(state, slot) ? `Bought the ${gearName(item)}: it's in the stash.` : `Bought and wearing the ${gearName(item)}.`)}
                  />
                </View>
              );
            })
          )}
          <T muted>Provisional prices. Legendary gear and class wearables only drop.</T>
        </Card>
      ) : (
        <Card title="Stash">
          {stash(state).length === 0 ? <T muted>Empty.</T> : null}
          {stash(state).map((item) => (
            <ItemView key={item.id} item={item}>
              {wearable(state, item) ? null : <T muted>{`A higher realm's gear: it can be worn again on reaching ${words(item.realm)}.`}</T>}
              <Row>
                {wearable(state, item) ? <Button label="Wear" kind="ghost" onPress={() => void act({ type: "GearEquipped", itemId: item.id }, `Wearing the ${gearName(item)}.`)} /> : null}
                {item.damageBp > 0 ? <Button label={`Repair (${gold(repairPrice(item))})`} kind="ghost" onPress={() => void act({ type: "GearRepaired", itemId: item.id }, `Repaired the ${gearName(item)}.`)} /> : null}
                <Button
                  label={`Sell (${Math.floor(sellPrice(item))} gold)`}
                  kind="danger"
                  onPress={() =>
                    Alert.alert(`Sell the ${gearName(item)}?`, `It sells for ${sellPrice(item).toFixed(1)} gold.${item.kind === "robe" ? " A free robe is given only once." : ""}`, [
                      { text: "Keep it", style: "cancel" },
                      { text: "Sell", style: "destructive", onPress: () => void act({ type: "GearSold", itemId: item.id }, `Sold the ${gearName(item)}.`) },
                    ])
                  }
                />
              </Row>
            </ItemView>
          ))}
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

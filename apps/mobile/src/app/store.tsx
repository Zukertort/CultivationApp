/**
 * The Store (ruling 137): what is worn, with durability and repairs, then two
 * tabs: the Shop (the current realm's gear, provisional prices until Roadmap
 * part 3) and the Stash (gear not worn: wear, repair or sell it; and potions,
 * drunk from here), plus Services: vacations, class change and extensions
 * (rulings 159-163). While dead no gear or potion is bought, sold or
 * repaired (ruling 150).
 */
import { useEffect, useState, type ReactNode } from "react";
import { Alert, View } from "react-native";
import type { GearSlot } from "@cultivation/schema";
import { DAY, GEAR_REALMS, RULES_V1, potionPrice, potionStatus, vacationDaysLeft, vacationPrice, repairPrice, sellPrice, shopPrice, stash, wearable, wornItem, type GearItem, type GearRealm } from "@cultivation/rules";
import { GearWarnings, durability, gearName, gearStats, isDead } from "../lib/gear";
import { now as clockNow } from "../lib/clock";
import { useStore, type EventInput } from "../lib/store";
import { Button, C, Card, Field, Meter, Note, Row, Screen, Segmented, T, when, wholeNumber, words } from "../lib/ui";

const SLOTS: readonly GearSlot[] = ["armor", "weapon"];
const OFFERS: readonly { slot: GearSlot; kind: "robe" | "shop" }[] = [
  { slot: "armor", kind: "robe" },
  { slot: "armor", kind: "shop" },
  { slot: "weapon", kind: "shop" },
];
const gold = (n: number) => `${Math.ceil(n)} gold`;

export default function StoreScreen() {
  const { state, log, now: storeNow } = useStore();
  const now = Math.max(storeNow, clockNow());
  const [tab, setTab] = useState<"shop" | "stash" | "services">("shop");
  const [vacationDays, setVacationDays] = useState("3");
  const [note, setNote] = useState<{ text: string; error: boolean } | null>(null);
  const realm = state.main.realm;
  const gearRealm = (GEAR_REALMS as readonly string[]).includes(realm) ? (realm as GearRealm) : null;
  const dead = isDead(state);
  // Potions as they stand on the app's clock (lib/clock), re-rendered at the gain potion's expiry.
  const potions = potionStatus(state, now);
  const gainActive = potions.gainActiveUntil !== null;
  const [, rerender] = useState(0);
  useEffect(() => {
    if (potions.gainActiveUntil === null) return;
    const t = setTimeout(() => rerender((n) => n + 1), Math.max(0, potions.gainActiveUntil - clockNow()) + 50);
    return () => clearTimeout(t);
  }, [potions.gainActiveUntil, now]);

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
          { value: "services", label: "Services" },
        ]}
        onChange={setTab}
      />

      {tab === "shop" ? (
        <Card title={gearRealm ? `${words(gearRealm)} gear` : "Shop"}>
          {gearRealm === null ? (
            <T muted>The shop opens in Foundation Establishment.</T>
          ) : (
            // The realm's robe is the cheap way back into armor (ruling 157).
            OFFERS.map(({ slot, kind }) => {
              const item = { kind, slot, realm: gearRealm };
              const price = shopPrice(slot, gearRealm, RULES_V1, kind);
              return (
                <View key={`${kind}-${slot}`} style={{ gap: 4 }}>
                  <T style={{ fontWeight: "700" }}>{gearName(item)}</T>
                  <T muted>{gearStats(item)}</T>
                  <Button
                    label={`Buy (${gold(price)})`}
                    disabled={dead || state.gold < price}
                    onPress={() => void act({ type: "GearBought", slot, kind }, wornItem(state, slot) ? `Bought the ${gearName(item)}: it's in the stash.` : `Bought and wearing the ${gearName(item)}.`)}
                  />
                </View>
              );
            })
          )}
          <View style={{ gap: 4 }}>
            <T style={{ fontWeight: "700" }}>Gain potion</T>
            <T muted>+10% gold and Qi for 24 hours once drunk (from the Stash). Legendary potions are never sold.</T>
            <Button
              label={`Buy (${gold(potionPrice(state))})`}
              disabled={dead || state.gold < potionPrice(state)}
              onPress={() => void act({ type: "PotionBought", potion: "gain" }, "Bought a gain potion: it's in the Stash.")}
            />
          </View>
          <T muted>{`Provisional prices. Gear sells for 70% of its value less damage, robes included. Legendary gear and class wearables only drop.`}</T>
        </Card>
      ) : tab === "services" ? (
        <Services days={vacationDays} setDays={setVacationDays} act={act} />
      ) : (
        <Card title="Stash">
          {stash(state).length === 0 ? <T muted>Empty.</T> : null}
          {stash(state).map((item) => (
            <ItemView key={item.id} item={item}>
              {wearable(state, item) ? null : <T muted>{`A higher realm's gear: it can be worn again on reaching ${words(item.realm)}.`}</T>}
              <Row>
                {wearable(state, item) ? <Button label="Wear" kind="ghost" onPress={() => void act({ type: "GearEquipped", itemId: item.id }, `Wearing the ${gearName(item)}.`)} /> : null}
                {item.damageBp > 0 ? <Button label={`Repair (${gold(repairPrice(item))})`} kind="ghost" disabled={dead} onPress={() => void act({ type: "GearRepaired", itemId: item.id }, `Repaired the ${gearName(item)}.`)} /> : null}
                <Button
                  label={`Sell (${Math.floor(sellPrice(item))} gold)`}
                  kind="danger"
                  disabled={dead}
                  onPress={() =>
                    Alert.alert(`Sell the ${gearName(item)}?`, `It sells for ${sellPrice(item).toFixed(1)} gold.${item.kind === "robe" ? " A free robe is given only once per realm; the shop sells robes." : ""}`, [
                      { text: "Keep it", style: "cancel" },
                      { text: "Sell", style: "destructive", onPress: () => void act({ type: "GearSold", itemId: item.id }, `Sold the ${gearName(item)}.`) },
                    ])
                  }
                />
              </Row>
            </ItemView>
          ))}
          <T style={{ fontWeight: "700" }}>Potions</T>
          <T muted>{`Gain potions: ${potions.gainHeld}${gainActive ? ` (one active until ${new Date(potions.gainActiveUntil!).toLocaleTimeString()})` : ""}. +10% gold and Qi for 24 hours.`}</T>
          <Button label="Drink a gain potion" kind="ghost" disabled={potions.gainHeld < 1 || gainActive} onPress={() => void act({ type: "PotionUsed", potion: "gain" }, "The gain potion is active for 24 hours.")} />
          <T muted>{`Legendary potions: ${potions.legendaryHeld}${potions.legendaryArmed ? " (one armed)" : ""}. Drunk, it adds 5% to the next realm breakthrough's legendary roll; one armed at a time.`}</T>
          <Button
            label="Drink a legendary potion"
            kind="ghost"
            disabled={potions.legendaryHeld < 1 || potions.legendaryArmed}
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

/** Services (rulings 159-163): a vacation bought here; class change and extensions, priced here, are bought where they're used. */
function Services({ days, setDays, act }: { days: string; setDays: (d: string) => void; act: (input: EventInput, ok: string) => Promise<void> }) {
  const { state, now } = useStore();
  const r = RULES_V1.rest;
  const n = wholeNumber(days) ?? 0;
  const left = vacationDaysLeft(state, now);
  const price = vacationPrice(state, Math.max(1, n));
  const resting = state.rest !== null && now < state.rest.end;
  return (
    <>
      <Card title="Vacation">
        <T muted>{`The avatar travels to visit the Nine Marvels: no tax, the companion sleeps and the soul is frozen, while tasks still pay. Tribulation deadlines keep their dates. At most ${r.vacationMaxDays} days at a time and ${r.vacationMaxDaysPerWindow} days in any ${r.vacationWindowDays}.`}</T>
        {resting ? (
          <>
            <T>{`${state.rest!.kind === "vacation" ? "On vacation" : "In closed-door cultivation"} until ${when(state.rest!.end)}.`}</T>
            <Button label="End the rest now" kind="ghost" onPress={() => void act({ type: "RestEnded" }, "Back to cultivation.")} />
          </>
        ) : (
          <>
            <T muted>{`${vacationPrice(state, 1)} gold a day here. ${left} vacation days available now.`}</T>
            <Field label="Days" value={days} onChangeText={setDays} keyboardType="number-pad" maxLength={2} />
            <Button
              label={n >= 1 ? `Start a ${n}-day vacation (${Math.ceil(price)} gold)` : "Start a vacation"}
              disabled={n < 1 || n > left || state.gold < price}
              onPress={() => void act({ type: "RestStarted", kind: "vacation", until: now + n * DAY }, `On vacation for ${n} days.`)}
            />
          </>
        )}
      </Card>
      <Card title="Class change">
        <T muted>{`Changing class costs ${RULES_V1.classes.changeGold} gold and forfeits held class wearables. It is chosen on the Realm screen, from Core Formation until Spirit Realm locks it.`}</T>
      </Card>
      <Card title="Extensions">
        <T muted>{`An expired one-time task or quest can be extended once, within ${RULES_V1.main.extension.windowDays} days, for its base gold (at least ${RULES_V1.main.extension.minPrice}), no longer than its original duration. It is bought on the Tasks tab.`}</T>
      </Card>
    </>
  );
}

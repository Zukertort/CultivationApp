/** Small shared UI kit: a dark ink-and-gold look until the real art arrives. */
import type { ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { SoulColor } from "@cultivation/rules";

export const C = {
  bg: "#14121c",
  card: "#1f1c2b",
  border: "#34304a",
  text: "#ece8f5",
  muted: "#9a94b0",
  gold: "#c9a227",
  danger: "#e06666",
  good: "#6fcf97",
};

export const SOUL_HEX: Record<SoulColor, string> = {
  broken: "#5b5664",
  black: "#0b0a0f",
  violet: "#8b5cf6",
  white: "#f4f1fa",
  green: "#22c55e",
  blue: "#3b82f6",
  red: "#ef4444",
  golden: "#eab308",
  translucent: "#b8e6f0",
  rainbow: "#f472b6",
};

export function Screen({ children }: { children: ReactNode }) {
  return (
    <SafeAreaView style={s.safe} edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function Card({ title, children, right }: { title?: string; children: ReactNode; right?: ReactNode }) {
  return (
    <View style={s.card}>
      {title ? (
        <View style={s.cardHead}>
          <Text style={s.cardTitle}>{title}</Text>
          {right}
        </View>
      ) : null}
      {children}
    </View>
  );
}

export function T({ children, muted, style }: { children: ReactNode; muted?: boolean; style?: object }) {
  return <Text style={[s.text, muted && s.muted, style]}>{children}</Text>;
}

/** A horizontal meter, 0..1, with optional threshold ticks (also 0..1). */
export function Meter({ value, color = C.gold, ticks = [] }: { value: number; color?: string; ticks?: number[] }) {
  const pct = `${Math.max(0, Math.min(1, value)) * 100}%` as const;
  return (
    <View style={s.meter}>
      <View style={[s.meterFill, { width: pct, backgroundColor: color }]} />
      {ticks.map((t) => (
        <View key={t} style={[s.tick, { left: `${t * 100}%` as const }]} />
      ))}
    </View>
  );
}

export function Button({ label, onPress, kind = "primary", disabled }: { label: string; onPress: () => void; kind?: "primary" | "ghost" | "danger"; disabled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [s.btn, kind === "ghost" && s.btnGhost, kind === "danger" && s.btnDanger, (pressed || disabled) && { opacity: 0.6 }]}
    >
      <Text style={[s.btnText, kind !== "primary" && { color: kind === "danger" ? C.danger : C.text }]}>{label}</Text>
    </Pressable>
  );
}

export function Field(props: TextInputProps & { label: string }) {
  const { label, ...rest } = props;
  return (
    <View style={{ gap: 4 }}>
      <Text style={s.label}>{label}</Text>
      <TextInput placeholderTextColor={C.muted} style={s.input} {...rest} />
    </View>
  );
}

export function Segmented<V extends string>({ value, options, onChange }: { value: V; options: { value: V; label: string }[]; onChange: (v: V) => void }) {
  return (
    <View style={s.seg}>
      {options.map((o) => (
        <Pressable key={o.value} onPress={() => onChange(o.value)} style={[s.segItem, o.value === value && s.segActive]}>
          <Text style={[s.btnText, { color: o.value === value ? C.bg : C.text }]}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

/** One-line feedback after an action (System message or a rule violation). */
export function Note({ text, error }: { text: string | null; error?: boolean }) {
  if (!text) return null;
  return <Text style={[s.text, { color: error ? C.danger : C.good }]}>{text}</Text>;
}

export function Row({ children, gap = 8 }: { children: ReactNode; gap?: number }) {
  return <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap }}>{children}</View>;
}

/** "in 3 h", "in 2 days", "5 min ago". */
export function relative(at: number, now: number): string {
  const d = at - now;
  const abs = Math.abs(d);
  const unit = abs < 3_600_000 ? [60_000, "min"] : abs < 172_800_000 ? [3_600_000, "h"] : [86_400_000, "days"];
  const n = Math.round(abs / (unit[0] as number));
  return d >= 0 ? `in ${n} ${unit[1]}` : `${n} ${unit[1]} ago`;
}

export const cap = (w: string) => w.charAt(0).toUpperCase() + w.slice(1);

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  scroll: { padding: 16, gap: 14, maxWidth: 640, width: "100%", alignSelf: "center" },
  card: { backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.border, padding: 14, gap: 10 },
  cardHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardTitle: { color: C.gold, fontSize: 13, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase" },
  text: { color: C.text, fontSize: 15, lineHeight: 21 },
  muted: { color: C.muted, fontSize: 13 },
  label: { color: C.muted, fontSize: 12 },
  meter: { height: 10, borderRadius: 5, backgroundColor: C.border, overflow: "hidden" },
  meterFill: { height: "100%", borderRadius: 5 },
  tick: { position: "absolute", top: 0, bottom: 0, width: 1, backgroundColor: C.bg },
  btn: { backgroundColor: C.gold, borderRadius: 10, paddingVertical: 9, paddingHorizontal: 14, alignItems: "center" },
  btnGhost: { backgroundColor: "transparent", borderWidth: 1, borderColor: C.border },
  btnDanger: { backgroundColor: "transparent", borderWidth: 1, borderColor: C.danger },
  btnText: { color: C.bg, fontWeight: "700", fontSize: 14 },
  input: { color: C.text, backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 10, fontSize: 15 },
  seg: { flexDirection: "row", borderWidth: 1, borderColor: C.border, borderRadius: 10, overflow: "hidden" },
  segItem: { flex: 1, paddingVertical: 8, alignItems: "center" },
  segActive: { backgroundColor: C.gold },
});

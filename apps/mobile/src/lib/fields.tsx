/**
 * Form fields shared by the task, quest and tribulation forms: the due date
 * (a calendar day; the deadline is that local day's 23:59) and effort with
 * its meaning under each option (ruling 135).
 */
import { useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import type { Effort } from "@cultivation/schema";
import { C, Field, T } from "./ui";

const DAY_MS = 24 * 60 * 60 * 1000;

/** The deadline for a chosen calendar day: 23:59 local time that day. */
export function endOfLocalDay(day: Date): number {
  const d = new Date(day);
  d.setHours(23, 59, 0, 0);
  return d.getTime();
}

/** Whole calendar days from today to the deadline's day: "today", "1 day left", "N days left". */
export function daysLeft(deadline: number, now = Date.now()): string {
  const start = (t: number) => {
    const d = new Date(t);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  };
  const n = Math.round((start(deadline) - start(now)) / DAY_MS);
  if (n < 0) return `${-n} day${n === -1 ? "" : "s"} late`;
  if (n === 0) return "today";
  return `${n} day${n === 1 ? "" : "s"} left`;
}

/** A calendar day `days` from today. */
export function dayIn(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

const label = (d: Date) => d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" });

function parseIsoDay(text: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text.trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** "Due date": a calendar day, shown with the days left. Android opens the system picker; the web build takes YYYY-MM-DD. */
export function DateField({ title = "Due date", value, onChange, minDays = 0 }: { title?: string; value: Date; onChange: (d: Date) => void; minDays?: number }) {
  const [text, setText] = useState(iso(value));
  const deadline = endOfLocalDay(value);
  return (
    <View style={{ gap: 6 }}>
      <Text style={s.section}>{title}</Text>
      {Platform.OS === "web" ? (
        <Field
          label="YYYY-MM-DD"
          value={text}
          onChangeText={(t) => {
            setText(t);
            const d = parseIsoDay(t);
            if (d) onChange(d);
          }}
          maxLength={10}
        />
      ) : (
        <Pressable
          accessibilityRole="button"
          style={s.date}
          onPress={() =>
            DateTimePickerAndroid.open({
              value,
              mode: "date",
              minimumDate: dayIn(minDays),
              onChange: (event, d) => {
                if (event.type === "set" && d) onChange(d);
              },
            })
          }
        >
          <Text style={s.dateText}>{label(value)}</Text>
        </Pressable>
      )}
      <T muted>
        Due at 23:59 · {daysLeft(deadline)}
      </T>
    </View>
  );
}

export const EFFORT_OPTIONS: { value: Effort; label: string; hint: string }[] = [
  { value: "quick", label: "Quick", hint: "under 30 min" },
  { value: "session", label: "Session", hint: "1-2 h" },
  { value: "day", label: "Full day", hint: "a day's work" },
  { value: "project", label: "Project", hint: "several days of work" },
];

export const effortLabel = (e: Effort) => EFFORT_OPTIONS.find((o) => o.value === e)!.label;

/** "Effort: how much work this takes", locked at creation (ruling 25). */
export function EffortField({ value, onChange }: { value: Effort; onChange: (e: Effort) => void }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={s.section}>Effort: how much work this takes</Text>
      <View style={s.grid}>
        {EFFORT_OPTIONS.map((o) => {
          const on = o.value === value;
          return (
            <Pressable key={o.value} accessibilityRole="button" onPress={() => onChange(o.value)} style={[s.option, on && s.optionOn]}>
              <Text style={[s.optionLabel, on && { color: C.bg }]}>{o.label}</Text>
              <Text style={[s.optionHint, on && { color: C.bg }]}>{o.hint}</Text>
            </Pressable>
          );
        })}
      </View>
      <T muted>Locked once created; a different amount of work is a new task.</T>
    </View>
  );
}

const s = StyleSheet.create({
  section: { color: C.gold, fontSize: 12, fontWeight: "700", letterSpacing: 0.5, textTransform: "uppercase" },
  date: { borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 10, backgroundColor: C.bg },
  dateText: { color: C.text, fontSize: 15 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  option: { flexGrow: 1, flexBasis: "45%", borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 8, gap: 2 },
  optionOn: { backgroundColor: C.gold, borderColor: C.gold },
  optionLabel: { color: C.text, fontWeight: "700", fontSize: 14 },
  optionHint: { color: C.muted, fontSize: 12 },
});

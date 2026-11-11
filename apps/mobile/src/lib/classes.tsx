/** The class picker shared by the end of Foundation and an override out of it (a class is mandatory to enter Core Formation; ruling 113). */
import type { ClassId } from "@cultivation/schema";
import { RULES_V1 } from "@cultivation/rules";
import { Chip, Row, T } from "./ui";

export const CLASS_IDS = Object.keys(RULES_V1.classes.table) as ClassId[];

const COVERS = {
  soul: "core tasks can also hit a heart demon",
  body: "core tasks can also count as a Body routine",
  hybrid: "core tasks can also count for Body and Soul",
  unique: "core only: the biggest bonus, and a 2% legendary roll per tribulation",
} as const;

export function ClassPicker({ value, onChange }: { value: ClassId | null; onChange: (c: ClassId) => void }) {
  const picked = value ? RULES_V1.classes.table[value] : null;
  return (
    <>
      <Row>
        {CLASS_IDS.map((c) => (
          <Chip key={c} label={c.charAt(0).toUpperCase() + c.slice(1)} on={value === c} onPress={() => onChange(c)} />
        ))}
      </Row>
      {picked ? (
        <T muted>
          {picked.group.charAt(0).toUpperCase() + picked.group.slice(1)} class: +{Math.round(picked.gold * 100)}% gold, +{Math.round(picked.qi * 100)}% Qi; {COVERS[picked.group]}.
          Changing it later costs {RULES_V1.classes.changeGold} gold.
        </T>
      ) : (
        <T muted>Pick a class; it doesn&apos;t depend on the discipline.</T>
      )}
    </>
  );
}

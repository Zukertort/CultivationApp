/**
 * Replay an exported event log (the dev panel's "Export the log", a JSON
 * array of events) under the current rules and print what was skipped and
 * every other anomaly (ruling 168). The log file is never changed.
 *
 * Run: pnpm --filter @cultivation/sim replay <path/to/log.json>
 */
import { readFileSync } from "node:fs";
import { parseEvent, type GameEvent } from "@cultivation/schema";
import { RULES_V1, realmStatus, replay } from "@cultivation/rules";

const path = process.argv[2];
if (!path) {
  console.error("Usage: pnpm --filter @cultivation/sim replay <log.json>");
  process.exit(1);
}
const raw = JSON.parse(readFileSync(path, "utf8")) as unknown[];
const events: GameEvent[] = [];
const unparsed: string[] = [];
for (const [i, e] of raw.entries()) {
  try {
    events.push(parseEvent(e));
  } catch (err) {
    unparsed.push(`#${i} ${(e as { type?: string }).type ?? "?"}: ${err instanceof Error ? err.message.split("\n")[0] : String(err)}`);
  }
}
const s = replay(events, RULES_V1, Date.now());
const status = realmStatus(s);
console.log(`Rules ${RULES_V1.version}: ${events.length} events replayed${unparsed.length ? `, ${unparsed.length} failed the schema` : ""}.`);
console.log(`State: ${status.realm}${status.level ? ` ${status.level}` : ""}, Qi ${s.qi.toFixed(1)}, gold ${s.gold.toFixed(1)}, tribulations ${JSON.stringify(status.tribulations)}`);
for (const u of unparsed) console.log(`schema: ${u}`);
const byCode = new Map<string, typeof s.anomalies>();
for (const a of s.anomalies) byCode.set(a.code, [...(byCode.get(a.code) ?? []), a]);
for (const [code, list] of byCode) {
  console.log(`\n${code} (${list.length})`);
  for (const a of list) console.log(`  ${new Date(a.at).toISOString()}${a.detail ? `  ${a.detail}` : ""}`);
}
if (s.anomalies.length === 0) console.log("No anomalies.");

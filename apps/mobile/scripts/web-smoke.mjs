// Web smoke test: loads the app in headless Chromium with a fresh profile,
// reloads it, and opens a second tab, failing on any uncaught error (or a
// console error) in the first tab. The second tab must show the readable
// "open in another tab" message, never crash.
//
//   node scripts/web-smoke.mjs <url> [--reloads N] [--headed]
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";

const url = process.argv[2];
if (!url) {
  console.error("Usage: node scripts/web-smoke.mjs <url> [--reloads N]");
  process.exit(2);
}
const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const reloads = Number(arg("--reloads", "3"));
const headed = process.argv.includes("--headed");

/** Text the app shows once it has opened its database: the oath screen (fresh profile) or a tab bar. */
const READY = /Before the path opens, swear it|Tasks|Realm/;
/** The message a second tab must show instead of crashing. */
const OTHER_TAB = /open in another tab/i;
/** Console noise that isn't an app error. */
const IGNORED = [/Download the React DevTools/, /favicon/i];

const profile = mkdtempSync(join(tmpdir(), "cultivation-web-smoke-"));
const failures = [];
const context = await chromium.launchPersistentContext(profile, { headless: !headed });
try {
  const watch = (page, label) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(`${label}: uncaught ${e.message}`));
    page.on("console", (m) => {
      if (m.type() === "error" && !IGNORED.some((r) => r.test(m.text()))) errors.push(`${label}: console error ${m.text()}`);
    });
    return errors;
  };
  const ready = async (page, label, pattern = READY) => {
    try {
      await page.getByText(pattern).first().waitFor({ timeout: 60_000 });
    } catch {
      failures.push(`${label}: never showed ${pattern} (body: ${(await page.locator("body").innerText()).slice(0, 300)})`);
    }
  };

  const page = context.pages()[0] ?? (await context.newPage());
  const errors = watch(page, "tab 1");
  await page.goto(url);
  await ready(page, "fresh load");
  for (let i = 1; i <= reloads; i++) {
    await page.reload();
    await ready(page, `reload ${i}`);
  }
  failures.push(...errors);

  // A second tab: the first holds the database, so it must say so, not crash.
  const second = await context.newPage();
  const secondErrors = watch(second, "tab 2");
  await second.goto(url);
  await ready(second, "second tab", OTHER_TAB);
  failures.push(...secondErrors.filter((e) => e.includes("uncaught")));

  // Closing the first tab frees the database: a reload of the second opens it.
  await page.close();
  await second.reload();
  await ready(second, "second tab after the first closed");
  failures.push(...secondErrors.slice(0).filter((e) => e.includes("uncaught")));
} finally {
  await context.close();
  rmSync(profile, { recursive: true, force: true });
}

const unique = [...new Set(failures)];
if (unique.length > 0) {
  console.error(`web smoke: ${unique.length} problem(s)\n${unique.map((f) => `  - ${f}`).join("\n")}`);
  process.exit(1);
}
console.log(`web smoke: fresh load, ${reloads} reloads and a second tab, no uncaught errors`);

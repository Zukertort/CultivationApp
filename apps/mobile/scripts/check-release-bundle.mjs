// Release-bundle check: the dev scenario loader and admin controls (src/dev) and
// @cultivation/scenarios must not ship. Exports production bundles (web and
// Android) into a temporary folder and fails if any dev-only marker is in
// them. A marker from the app itself must be there, so an empty or unreadable
// bundle can't pass.
//
//   pnpm --filter @cultivation/mobile check:release [-- --platform web]
import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const app = join(dirname(fileURLToPath(import.meta.url)), "..");
const arg = process.argv.indexOf("--platform");
const platforms = arg > 0 ? [process.argv[arg + 1]] : ["web", "android"];

/** Strings only dev code contains: the scenario database's name, a scenario title, the dev panel's heading, the admin override (ruling 84). */
const DEV_MARKERS = ["cultivation-scenario.db", "Dead avatar (repent cycler)", "Open the dev panel", "Admin: manual override"];
/** A string the release app must contain (the oath). */
const APP_MARKER = "I will not fake my achievements";

function files(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : [p];
  });
}

let failed = false;
for (const platform of platforms) {
  const out = mkdtempSync(join(tmpdir(), `cultivation-release-${platform}-`));
  try {
    execFileSync("pnpm", ["exec", "expo", "export", "--platform", platform, "--output-dir", out], { cwd: app, stdio: "inherit", shell: process.platform === "win32" });
    const bundles = files(out).filter((f) => /\.(js|hbc)$/.test(f));
    // Hermes bytecode keeps its strings readable; latin1 keeps every byte.
    const text = bundles.map((f) => readFileSync(f, "latin1")).join("\n");
    const found = DEV_MARKERS.filter((m) => text.includes(m));
    if (!text.includes(APP_MARKER)) {
      console.error(`${platform}: the app marker isn't in the bundle (${bundles.length} files); the check can't be trusted`);
      failed = true;
    } else if (found.length > 0) {
      console.error(`${platform}: dev-only code is in the release bundle: ${found.join(", ")}`);
      failed = true;
    } else {
      console.log(`${platform}: release bundle has no dev scenario code (${bundles.length} bundle files checked)`);
    }
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
}
process.exit(failed ? 1 : 0);

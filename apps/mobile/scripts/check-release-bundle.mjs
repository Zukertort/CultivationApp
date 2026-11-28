// Release-bundle check: the dev scenario loader and admin controls (src/dev) and
// @cultivation/scenarios must not ship. Exports production bundles (web and
// Android) into a temporary folder and fails if any dev-only marker is in
// them. A marker from the app itself must be there, so an empty or unreadable
// bundle can't pass. The web bundle is then served (with the cross-origin
// isolation headers expo-sqlite needs) and loaded in headless Chromium by
// scripts/web-smoke.mjs: a fresh profile, reloads and a second tab, failing
// on any uncaught error.
//
//   pnpm --filter @cultivation/mobile check:release [-- --platform web]
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { createServer } from "node:http";
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

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".wasm": "application/wasm", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".ico": "image/x-icon", ".ttf": "font/ttf" };

/** Serve an exported web build as the app's single page, with the headers expo-sqlite's worker needs. */
function serve(dir) {
  const server = createServer((req, res) => {
    const path = decodeURIComponent(new URL(req.url, "http://x").pathname);
    let file = join(dir, path);
    if (!file.startsWith(dir) || !existsSync(file) || statSync(file).isDirectory()) file = join(dir, "index.html");
    res.setHeader("Cross-Origin-Embedder-Policy", "credentialless");
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
    res.setHeader("Content-Type", TYPES[file.slice(file.lastIndexOf("."))] ?? "application/octet-stream");
    res.end(readFileSync(file));
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}

/** Run the web smoke test against a served build; resolves its exit code. */
async function smoke(dir) {
  const server = await serve(dir);
  const url = `http://127.0.0.1:${server.address().port}/`;
  try {
    return await new Promise((resolve) => {
      const child = spawn(process.execPath, [join(app, "scripts", "web-smoke.mjs"), url], { cwd: app, stdio: "inherit" });
      child.on("exit", (code) => resolve(code ?? 1));
    });
  } finally {
    server.close();
  }
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
      if (platform === "web" && (await smoke(out)) !== 0) {
        console.error("web: the smoke test failed");
        failed = true;
      }
    }
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
}
process.exit(failed ? 1 : 0);

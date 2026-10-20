#!/usr/bin/env node
// detect-capabilities.js — probe this machine for useful CLIs/runtimes and
// write results to machine.json under a "capabilities" key. Merge, never clobber.
//
// Usage (direct):    node scripts/detect-capabilities.js
//         (wrapper): node scripts/run-claude-entry.js scripts/detect-capabilities.js

const { spawnSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { getClaudeHome } = require("./claude-paths");

const IS_WIN = os.platform() === "win32";

// Extract the first clean semver-ish string (e.g. "2.48.1" not "2.48.1.windows.1").
// \d+\.\d+(?:\.\d+)* requires numeric-only segments, so it stops before ".windows".
const ver = (s) => (s ?? "").match(/\d+\.\d+(?:\.\d+)*/)?.[0] ?? null;

// [logicalName, executable, versionArgs, versionParser(stdout, stderr) => string|null]
// Python: py -3 on Windows, python3 on macOS/Linux (avoids the Windows Store stub).
// ffmpeg uses single-dash flag; everything else uses --version.
const PROBES = [
  ["git",    "git",     ["--version"], (o)    => ver(o)],
  ["node",   "node",    ["--version"], (o)    => ver(o)],
  ["npm",    "npm",     ["--version"], (o)    => ver(o)],
  ["gh",     "gh",      ["--version"], (o)    => ver(o)],
  ["gws",    "gws",     ["--version"], (o)    => ver(o)],       // "gws 0.22.5"
  ["gcloud", "gcloud",  ["--version"], (o)    => ver(o)],
  ["docker", "docker",  ["--version"], (o)    => ver(o)],
  IS_WIN
    ? ["python", "py",      ["-3", "--version"], (o, e) => ver(o || e)]
    : ["python", "python3", ["--version"],        (o, e) => ver(o || e)],
  ["rg",     "rg",      ["--version"], (o)    => ver(o)],
  ["jq",     "jq",      ["--version"], (o)    => ver(o)],       // "jq-1.7.1"
  ["ffmpeg", "ffmpeg",  ["-version"],  (o)    => ver(o)],
  ["code",   "code",    ["--version"], (o)    => ver(o)],
  // --- Phase-one additions: clean drop-ins (simple where/which + --version). ---
  ["uv",      "uv",      ["--version"], (o)    => ver(o)],       // "uv 0.4.18"
  ["duckdb",  "duckdb",  ["--version"], (o)    => ver(o)],       // "v1.1.3 ..."
  ["sqlite3", "sqlite3", ["--version"], (o)    => ver(o)],       // "3.45.1 2024-..."
  ["pandoc",  "pandoc",  ["--version"], (o)    => ver(o)],       // "pandoc 3.1.11"
  // qpdf was listed as a skill dependency in health-check.js but never probed here,
  // so the check silently passed on every machine. Probe it. (2026-08)
  ["qpdf",    "qpdf",    ["--version"], (o)    => ver(o)],       // "qpdf version 11.9.0"
  // Bitwarden CLI — backs the "bitwarden" secrets backend in resolve-secret.js.
  ["bw",      "bw",      ["--version"], (o)    => ver(o)],       // "2026.8.0"
  // Skill-backing CLIs added 2026-10 (youtube, video-edit, pre-commit-wiring, animate).
  ["yt-dlp",      "yt-dlp",      ["--version"], (o) => ver(o)],  // "2026.06.09"
  ["auto-editor", "auto-editor", ["--version"], (o) => ver(o)],  // "29.3.1"
  ["pre-commit",  "pre-commit",  ["--version"], (o) => ver(o)],  // "pre-commit 4.7.0"
  ["gitleaks",    "gitleaks",    ["version"],   (o) => ver(o)],  // "gitleaks version 8.30.1"
  ["playwright",  "playwright",  ["--version"], (o) => ver(o)],  // "Version 1.64.1"
  // ArtCraft CLIs (photocraft/filmcraft/pdfcraft skills). On Windows they sit off PATH in
  // C:\\Program Files\\<App>\\ — the skills resolve that themselves; this probes PATH only.
  ["photocraft-cli", "photocraft-cli", ["--version"], (o) => ver(o)],  // "photocraft-cli 0.10.0 (...)"
  ["filmcraft-cli",  "filmcraft-cli",  ["--version"], (o) => ver(o)],  // "filmcraft-cli 0.9.0"
  ["pdfcraft-cli",   "pdfcraft-cli",   ["--version"], (o) => ver(o)],  // "pdfcraft-cli 0.9.0"
  // tesseract emits version on stdout OR stderr depending on build — read both.
  ["tesseract", "tesseract", ["--version"], (o, e) => ver(o || e)],
  // claude: presence only. run-routine.js must still verify it's authenticated
  // enough to run unattended — a present binary is NOT a ready binary.
  ["claude",  "claude",  ["--version"], (o)    => ver(o)],
];

// Phase-two probes — these need per-OS logic the simple tuple format can't express
// (alternate binary names, off-PATH fallbacks, non-UTF-8 output, platform gating),
// so each is a descriptor object resolved by probeSpecial():
//   candidates    — executable names to try on PATH, in order
//   fallbackPaths — absolute paths to test when nothing is on PATH (LibreOffice)
//   args/parse    — version command + parser (parse reads stdout OR stderr)
//   encoding      — decode override for tools that don't emit UTF-8 (wsl → utf16le)
//   platform      — restrict the probe to one os.platform() value (wsl → win32)
const SOFFICE_FALLBACKS = IS_WIN
  ? ["C:\\Program Files\\LibreOffice\\program\\soffice.com",
     "C:\\Program Files (x86)\\LibreOffice\\program\\soffice.com"]
  : os.platform() === "darwin"
    ? ["/Applications/LibreOffice.app/Contents/MacOS/soffice"]
    : [];
const SPECIAL_PROBES = [
  // LibreOffice — drives docx/pptx/xlsx PDF conversion; commonly off PATH on Windows.
  { name: "soffice",  candidates: ["soffice"], fallbackPaths: SOFFICE_FALLBACKS,
    args: ["--version"], parse: (o, e) => ver(o || e) },
  // Poppler sentinel — pdftoppm prints version on stderr via -v and may exit non-zero.
  { name: "pdftoppm", candidates: ["pdftoppm"], args: ["-v"],        parse: (o, e) => ver(o || e) },
  // qpdf — pdf skill merge/split/rotate/encrypt.
  { name: "qpdf",     candidates: ["qpdf"],     args: ["--version"], parse: (o, e) => ver(o || e) },
  // fd — named `fdfind` on Debian/Ubuntu.
  { name: "fd",       candidates: ["fd", "fdfind"], args: ["--version"], parse: (o)    => ver(o) },
  // yq — mikefarah (Go) and python yq both answer --version; ver() grabs the semver.
  { name: "yq",       candidates: ["yq"],       args: ["--version"], parse: (o, e) => ver(o || e) },
  // wsl — Windows-only; `wsl --version` is UTF-16LE and absent on old builds.
  { name: "wsl",      candidates: ["wsl"],      args: ["--version"], parse: (o, e) => ver(o || e),
    encoding: "utf16le", platform: "win32" },
];

/** Resolve the full path to a binary. Returns null if not found. */
function findPath(cmd) {
  const r = IS_WIN
    ? spawnSync("where.exe", [cmd], { encoding: "utf8", timeout: 4000 })
    : spawnSync("which",     [cmd], { encoding: "utf8", timeout: 4000 });
  if (r.error || r.status !== 0) return null;
  const first = r.stdout.trim().split(/\r?\n/)[0];
  return first || null;
}

/**
 * Run a tool's version command and parse the output. Returns null on any failure.
 * opts.shell    — override the shell flag (default: IS_WIN, so .cmd wrappers resolve).
 *                 Pass false when running a resolved absolute path (avoids quoting).
 * opts.encoding — decode override for tools that don't emit UTF-8 (e.g. wsl → utf16le).
 */
function getVersion(cmd, args, parse, opts = {}) {
  const useShell = opts.shell ?? IS_WIN;
  const enc = opts.encoding;
  const r = spawnSync(cmd, args, {
    encoding: enc ? "buffer" : "utf8",
    timeout: 8000,
    shell: useShell,
  });
  if (r.error) return null;
  const dec = (b) => (enc ? Buffer.from(b ?? []).toString(enc) : (b || ""));
  const out = dec(r.stdout).trim();
  const err = dec(r.stderr).trim();
  try {
    return parse(out, err) ?? null;
  } catch (_) {
    return null;
  }
}

/** Resolve a phase-two descriptor: try each candidate on PATH, then any fallback paths. */
function probeSpecial(d) {
  // Platform-gated probes (e.g. wsl) are simply "absent" off their platform.
  if (d.platform && os.platform() !== d.platform) {
    return { present: false, version: null, path: null };
  }
  let binPath = null;
  for (const c of d.candidates) {
    binPath = findPath(c);
    if (binPath) break;
  }
  if (!binPath) {
    for (const fp of d.fallbackPaths || []) {
      if (fs.existsSync(fp)) { binPath = fp; break; }
    }
  }
  if (!binPath) return { present: false, version: null, path: null };
  // Run the resolved absolute path with shell:false — avoids quoting issues for
  // fallback paths under "Program Files" and keeps the encoding override clean.
  const version = getVersion(binPath, d.args, d.parse, {
    shell: false,
    encoding: d.encoding,
  });
  return { present: true, version, path: binPath };
}

function probeAll() {
  const tools = {};
  for (const [name, cmd, args, parse] of PROBES) {
    const binPath = findPath(cmd);
    tools[name] = binPath
      ? { present: true,  version: getVersion(cmd, args, parse), path: binPath }
      : { present: false, version: null, path: null };
  }
  for (const d of SPECIAL_PROBES) {
    tools[d.name] = probeSpecial(d);
  }
  return tools;
}

function printSummary(tools) {
  const present = [], missing = [];
  for (const [name, info] of Object.entries(tools)) {
    if (info.present) {
      present.push(`  ok  ${name.padEnd(8)} ${info.version ?? "(version unknown)"}`);
    } else {
      missing.push(`  --  ${name}`);
    }
  }
  console.log("\nCapability manifest — " + new Date().toLocaleString());
  if (present.length) {
    console.log("Present:");
    for (const l of present) console.log(l);
  }
  if (missing.length) {
    console.log("Missing:");
    for (const l of missing) console.log(l);
  }
  console.log("");
}

function writeMachineJson(tools) {
  const machineJsonPath = path.join(getClaudeHome(), "machine.json");
  let existing = {};
  try {
    existing = JSON.parse(fs.readFileSync(machineJsonPath, "utf8"));
  } catch (_) {
    // machine.json absent or malformed — start fresh (bootstrap will create it).
  }
  existing.capabilities = {
    detectedAt: new Date().toISOString(),
    tools,
  };
  fs.writeFileSync(machineJsonPath, JSON.stringify(existing, null, 2) + "\n", "utf8");
  console.log("Wrote: " + machineJsonPath);
}

// Top-level: never throw — a broken probe must not break a session.
try {
  const tools = probeAll();
  printSummary(tools);
  writeMachineJson(tools);
} catch (err) {
  console.error("detect-capabilities: unexpected error:", err.message);
  process.exit(0); // exit 0 so callers (bootstrap) don't fail
}

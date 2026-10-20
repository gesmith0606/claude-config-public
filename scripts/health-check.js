#!/usr/bin/env node
/**
 * health-check.js — drift detector for the agentic OS. Diffs documented policy
 * against observed machine state, because documentation != deployment.
 *
 * Usage:  node scripts/health-check.js          (human-readable report)
 * Exit:   0 = healthy or warnings only, 1 = at least one FAIL.
 *
 * Checks (all local, no network, read-only, best-effort):
 *   1. git hygiene        — dirty tracked files / unpushed commits in ~/.claude
 *   2. manifest freshness — capabilities.detectedAt age; CLIs skills depend on
 *   3. routines policy    — user decided NO standing claude-* scheduled tasks (2026-07-05)
 *   4. secret hygiene     — raw webhook/token strings in machine.json (should be *Secret names)
 *   5. context weight     — CLAUDE.md + skill/agent description bytes vs budget
 *   6. wiring             — hooks, statusline, settings parse
 *   7. memory pulse       — vault reachable + not stale; harness MEMORY.md non-empty
 *   8. local MCP deps     — mcp-servers/<x>/node_modules present where package.json exists
 *
 * NOT checkable locally: claude.ai connector toggles — reported as a manual item.
 */

"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const { getClaudeHome, getKnowledgeVaultPath, getPythonPath } = require("./claude-paths");

const HOME = getClaudeHome();
const DAY = 24 * 60 * 60 * 1000;

// Budgets (bytes) — alarms fire above these. Tuned 2026-07-05 post-trim:
// CLAUDE.md ~13.8k, skill descriptions ~19k, agents ~6k.
const BUDGET = {
  claudeMd: 16000,
  skillDescriptions: 24000,
  agentFrontmatter: 10000,
  manifestMaxAgeDays: 30,
  vaultStaleDays: 21,
};

// Shared dependency manifest — the one place a dep is declared.
const DEPS = (() => {
  try { return JSON.parse(fs.readFileSync(path.join(__dirname, "dependencies.json"), "utf8")); }
  catch { return { clis: [], python: [] }; }
})();
function installHint(dep) {
  const i = dep.install || {};
  return i[process.platform] || i.default || "see dependencies.json";
}

// `--missing-installs`: machine-readable feed for bootstrap.sh / bootstrap.ps1, so neither
// keeps its own tool list. One "auto|manual<TAB>name<TAB>hint" line per declared CLI the
// manifest marks absent (run detect-capabilities.js first). "auto" = the hint is a bare
// package-manager command bootstrap may run after asking; prose, arrows, parens stay manual.
if (process.argv.includes("--missing-installs")) {
  let tools = {};
  try { tools = JSON.parse(readIf(path.join(HOME, "machine.json"))).capabilities.tools || {}; } catch { /* none */ }
  for (const dep of DEPS.clis) {
    if (!tools[dep.name] || tools[dep.name].present) continue;
    const hint = installHint(dep);
    const auto = /^(brew|winget|uv tool|npm) [^;()<>|]*$/.test(hint);
    console.log(`${auto ? "auto" : "manual"}\t${dep.name}\t${hint}`);
  }
  process.exit(0);
}

let failures = 0;
let warnings = 0;
const lines = [];
function ok(msg) { lines.push(`  ok    ${msg}`); }
function warn(msg) { warnings++; lines.push(`  WARN  ${msg}`); }
function fail(msg) { failures++; lines.push(`  FAIL  ${msg}`); }
function section(title) { lines.push(`\n${title}`); }
function run(cmd, args, opts = {}) {
  try {
    const r = spawnSync(cmd, args, { encoding: "utf8", timeout: 15000, ...opts });
    return r.status === 0 ? (r.stdout || "").trim() : null;
  } catch { return null; }
}
function readIf(p) { try { return fs.readFileSync(p, "utf8"); } catch { return null; } }

// 1. git hygiene ------------------------------------------------------------
section("git (~/.claude)");
const dirty = run("git", ["status", "--porcelain"], { cwd: HOME });
if (dirty === null) warn("git status failed — is git on PATH?");
else if (dirty.length) warn(`${dirty.split("\n").length} uncommitted change(s) — review & commit so the other machine gets them`);
else ok("working tree clean");
const upstream = run("git", ["rev-list", "--count", "@{u}..HEAD"], { cwd: HOME });
if (upstream === null) warn("no upstream configured (or fetch needed) — cross-machine sync depends on push/pull");
else if (parseInt(upstream, 10) > 0) warn(`${upstream} unpushed commit(s)`);
else ok("in sync with upstream");

// 2. capability manifest ----------------------------------------------------
section("capability manifest (machine.json)");
let machine = {};
try { machine = JSON.parse(readIf(path.join(HOME, "machine.json")) || "{}"); } catch { fail("machine.json is not valid JSON"); }
const detectedAt = machine.capabilities && machine.capabilities.detectedAt;
if (!detectedAt) fail("no capabilities.detectedAt — run: node scripts/detect-capabilities.js");
else {
  const ageDays = Math.floor((Date.now() - Date.parse(detectedAt)) / DAY);
  if (ageDays > BUDGET.manifestMaxAgeDays) warn(`manifest is ${ageDays}d old — re-run detect-capabilities.js`);
  else ok(`manifest fresh (${ageDays}d old)`);
  const tools = (machine.capabilities && machine.capabilities.tools) || {};
  // Dependency list is shared with detect-capabilities.js + bootstrap.sh via
  // scripts/dependencies.json. Previously this array was hardcoded here and drifted:
  // it named qpdf, which detect-capabilities never probed, and the `tools[t] &&`
  // guard turned that into a silent pass. Unprobed deps are now reported, not skipped.
  const missing = [], unprobed = [];
  for (const dep of DEPS.clis) {
    const probe = tools[dep.name];
    if (!probe) { unprobed.push(dep.name); continue; }
    if (!probe.present) missing.push(dep);
  }
  const req = missing.filter((d) => d.required).map((d) => d.name);
  const opt = missing.filter((d) => !d.required);
  if (req.length) fail(`required CLIs absent: ${req.join(", ")}`);
  if (opt.length) {
    warn(`optional skill-backing CLIs absent: ${opt.map((d) => d.name).join(", ")}`);
    for (const d of opt) lines.push(`          ${d.name} — ${d.why}; ${installHint(d)}`);
  }
  if (unprobed.length) warn(`declared but never probed (add to detect-capabilities.js PROBES): ${unprobed.join(", ")}`);
  if (!req.length && !opt.length && !unprobed.length) ok("all declared CLIs present");
}

// 2b. python runtime for bundled skill scripts --------------------------------
section("python (bundled skill scripts)");
{
  const py = getPythonPath();
  const usingVenv = py.includes(path.join(".venv", ""));
  const mods = DEPS.python.map((m) => m.module);
  // NB: `import importlib` alone does not bind importlib.util — import the submodule.
  const probe = run(py, ["-c", `import importlib.util
missing=[m for m in ${JSON.stringify(mods)} if importlib.util.find_spec(m) is None]
print("MISSING:" + ",".join(missing))`]);
  if (probe === null) {
    fail(`python not runnable at '${py}' — run bootstrap.sh, or set pythonPath in machine.json`);
  } else {
    ok(`interpreter: ${py}${usingVenv ? " (bootstrap venv)" : " (system)"}`);
    const absent = (probe.split("MISSING:")[1] || "").split(",").filter(Boolean);
    if (absent.length) {
      const pkgs = DEPS.python.filter((m) => absent.includes(m.module));
      fail(`python packages missing: ${pkgs.map((m) => m.package).join(", ")} — the xlsx/pdf/image skills will fail at run time`);
      lines.push(`          fix: sh bootstrap.sh   (creates ${path.join(HOME, ".venv")} and installs them)`);
      if (!usingVenv) lines.push("          note: a Homebrew/system python is PEP 668 managed — plain 'pip install' is refused, hence the venv");
    } else {
      ok(`packages present: ${mods.join(", ")}`);
    }
  }
}

// 3. routines policy ----------------------------------------------------------
section("scheduled routines (policy: none)");
if (process.platform === "win32") {
  const tasks = run("schtasks", ["/query", "/fo", "csv"]) || "";
  const found = tasks.split("\n").filter((l) => /claude/i.test(l));
  if (found.length) fail(`${found.length} claude-* scheduled task(s) exist but user policy is NO routines (decided 2026-07-05)`);
  else ok("no claude scheduled tasks (matches policy)");
} else {
  const jobs = run("launchctl", ["list"]) || "";
  const found = jobs.split("\n").filter((l) => /claude/i.test(l) && !/com\.anthropic/i.test(l));
  if (found.length) warn(`launchd entries mentioning claude: ${found.length} — verify intentional`);
  else ok("no claude launchd jobs (matches policy)");
}

// 4. secret hygiene -----------------------------------------------------------
section("secret hygiene (machine.json)");
const machineRaw = readIf(path.join(HOME, "machine.json")) || "";
const leakPatterns = [
  [/https:\/\/discord\.com\/api\/webhooks\/\S+/, "raw Discord webhook"],
  [/https:\/\/hooks\.slack\.com\/\S+/, "raw Slack webhook"],
  [/"token"\s*:\s*"[^"P][^"]{20,}"/, "raw token"],
];
const leaks = leakPatterns.filter(([re]) => re.test(machineRaw)).map(([, name]) => name);
if (leaks.length) fail(`${leaks.join(", ")} hardcoded in machine.json — move behind resolve-secret.js (*Secret name)`);
else ok("no raw webhooks/tokens (uses *Secret indirection)");

// 4b. secrets backend reachability --------------------------------------------
section("secrets backend");
{
  const backend = (machine.secrets && machine.secrets.backend) || "auto";
  ok(`backend: ${backend}`);
  const bwInChain = backend === "auto" || backend === "bitwarden";
  const bwPresent = !!((machine.capabilities && machine.capabilities.tools || {}).bw || {}).present;
  if (bwInChain && bwPresent) {
    const out = run("bw", ["status"]);
    let state = null;
    try { state = (JSON.parse(out || "{}") || {}).status || null; } catch { /* ignore */ }
    if (!state) warn("bitwarden: could not read `bw status`");
    else if (state === "unauthenticated") fail("bitwarden: not logged in — run: bw login");
    // "locked" is the normal resting state between shells, NOT a problem: warning on it
    // every run is the kind of permanent noise that trains people to ignore warnings.
    else if (state === "locked") ok("bitwarden: logged in, vault locked (unlock per shell with `bwu`)");
    else ok(`bitwarden: ${state}`);
  } else if (bwInChain && !bwPresent) {
    warn("bitwarden is in the backend chain but `bw` is not installed");
  }
}

// 5. context weight -----------------------------------------------------------
section("per-session context weight");
const claudeMdBytes = (readIf(path.join(HOME, "CLAUDE.md")) || "").length;
(claudeMdBytes > BUDGET.claudeMd ? warn : ok)(`CLAUDE.md ${claudeMdBytes} bytes (budget ${BUDGET.claudeMd})`);
function frontmatterDescBytes(file) {
  let text = readIf(file);
  if (!text) return 0;
  text = text.replace(/\r\n/g, "\n"); // CRLF-safe on Windows checkouts
  const m = text.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return 0;
  // Walk lines: from "description:" through indented continuation lines.
  let inDesc = false, bytes = 0;
  for (const line of m[1].split("\n")) {
    if (/^description:/.test(line)) { inDesc = true; bytes += line.length; continue; }
    if (inDesc && /^[ \t]/.test(line)) { bytes += line.length; continue; }
    if (inDesc) break;
  }
  return bytes;
}
let skillBytes = 0, skillCount = 0;
try {
  for (const d of fs.readdirSync(path.join(HOME, "skills"))) {
    const f = path.join(HOME, "skills", d, "SKILL.md");
    if (fs.existsSync(f)) { skillCount++; skillBytes += frontmatterDescBytes(f); }
  }
} catch { /* no skills dir */ }
(skillBytes > BUDGET.skillDescriptions ? warn : ok)(`${skillCount} skills, ${skillBytes} description bytes (budget ${BUDGET.skillDescriptions})`);
let agentBytes = 0, agentCount = 0;
try {
  for (const f of fs.readdirSync(path.join(HOME, "agents"))) {
    if (f.endsWith(".md")) { agentCount++; agentBytes += frontmatterDescBytes(path.join(HOME, "agents", f)); }
  }
} catch { /* no agents dir */ }
(agentBytes > BUDGET.agentFrontmatter ? warn : ok)(`${agentCount} agents, ${agentBytes} description bytes (budget ${BUDGET.agentFrontmatter})`);

// 6. wiring -------------------------------------------------------------------
section("wiring (settings.json)");
let settings = null;
try { settings = JSON.parse(readIf(path.join(HOME, "settings.json")) || ""); } catch { /* handled below */ }
if (!settings) fail("settings.json missing or invalid JSON");
else {
  const hooks = settings.hooks || {};
  (hooks.SessionStart ? ok : warn)("SessionStart hook (session-handoff) " + (hooks.SessionStart ? "wired" : "MISSING"));
  (hooks.PreCompact ? ok : warn)("PreCompact hook (save-reminder) " + (hooks.PreCompact ? "wired" : "MISSING"));
  (hooks.PostToolUse ? ok : warn)("PostToolUse hook (on-git-push) " + (hooks.PostToolUse ? "wired" : "MISSING"));
  (settings.statusLine ? ok : warn)("statusline " + (settings.statusLine ? "wired" : "MISSING"));
  const plugins = Object.entries(settings.enabledPlugins || {}).filter(([, v]) => v).map(([k]) => k.split("@")[0]);
  if (plugins.length) warn(`plugins always-on: ${plugins.join(", ")} — each loads its skills/agents into every session`);
  else ok("no always-on plugins");
}

// 7. memory pulse -------------------------------------------------------------
section("memory");
const vault = getKnowledgeVaultPath();
if (!fs.existsSync(vault)) fail(`knowledge-vault unreachable at ${vault}`);
else {
  ok(`vault reachable (${vault})`);
  const logStat = (() => { try { return fs.statSync(path.join(vault, "log.md")); } catch { return null; } })();
  if (!logStat) warn("vault log.md missing");
  else {
    const staleDays = Math.floor((Date.now() - logStat.mtimeMs) / DAY);
    (staleDays > BUDGET.vaultStaleDays ? warn : ok)(`vault last written ${staleDays}d ago${staleDays > BUDGET.vaultStaleDays ? " — going stale; save learnings or prune the layer" : ""}`);
  }
}
// Harness memory lives under projects/<slugified-cwd>/memory — the slug is per-machine and
// per-repo, so aggregate across every project dir instead of hardcoding one path.
const mem = (() => {
  let dirs = [];
  try { dirs = fs.readdirSync(path.join(HOME, "projects")); } catch { return null; }
  let projects = 0, lines = 0;
  for (const d of dirs) {
    const c = readIf(path.join(HOME, "projects", d, "memory", "MEMORY.md"));
    if (!c || !c.trim()) continue;
    projects++;
    lines += c.trim().split("\n").filter((l) => l.trim().startsWith("-")).length;
  }
  return { projects, lines };
})();
if (!mem || !mem.projects) warn("no harness memory MEMORY.md found — session-level facts aren't being captured");
else ok(`harness memory: ${mem.lines} entr(ies) across ${mem.projects} project(s)`);

// 8. local MCP deps -----------------------------------------------------------
section("local MCP servers");
try {
  for (const d of fs.readdirSync(path.join(HOME, "mcp-servers"))) {
    const dir = path.join(HOME, "mcp-servers", d);
    const pkgPath = path.join(dir, "package.json");
    if (!fs.existsSync(pkgPath)) continue;
    // A server may declare the platforms it can run on (claudeHarness.platforms).
    // Nagging about missing deps for a server this machine can never run is noise,
    // and a check that always warns is a check people learn to ignore.
    let pkg = {};
    try { pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8")); } catch { /* treat as unrestricted */ }
    const platforms = (pkg.claudeHarness && pkg.claudeHarness.platforms) || null;
    if (platforms && !platforms.includes(process.platform)) {
      ok(`${d}: n/a on ${process.platform} (needs ${platforms.join("/")}) — skipped`);
      continue;
    }
    const installed = fs.existsSync(path.join(dir, "node_modules"));
    (installed ? ok : warn)(`${d}: deps ${installed ? "installed" : "MISSING — run npm install"}`);
  }
} catch { ok("no local MCP servers"); }

// manual items ----------------------------------------------------------------
section("manual (cannot verify locally)");
lines.push("  -     claude.ai connectors: confirm ALL disabled at claude.ai → Settings → Connectors (policy: dormant by default)");

// report ------------------------------------------------------------------
console.log("agentic-OS health check — " + new Date().toISOString());
console.log(lines.join("\n"));
console.log(`\nresult: ${failures} fail, ${warnings} warn`);
process.exit(failures > 0 ? 1 : 0);

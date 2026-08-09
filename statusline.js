#!/usr/bin/env node
/**
 * Global Claude Code status line (applies to every repo via ~/.claude/settings.json).
 * Reads the session JSON from stdin and prints a single colored line:
 *
 *   <git branch + dirty/ahead-behind>  |  <model>  |  <ctx used/total>  |  <cost>
 *
 * Colorful, no icons. Every segment degrades gracefully when data is missing
 * (e.g. outside a git repo, or before any tokens are used).
 */

const { execSync } = require("child_process");
const fs = require("fs");

// --- ANSI helpers ---------------------------------------------------------
const C = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
};
const paint = (s, color) => `${color}${s}${C.reset}`;

// --- read stdin -----------------------------------------------------------
function readStdin() {
  try {
    return fs.readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

let data = {};
try {
  data = JSON.parse(readStdin() || "{}");
} catch {
  data = {};
}

const cwd = data.workspace?.current_dir || data.cwd || process.cwd();

// --- git segment ----------------------------------------------------------
function gitSegment() {
  const run = (cmd) =>
    execSync(cmd, {
      cwd,
      stdio: ["ignore", "pipe", "ignore"],
      encoding: "utf8",
    }).trim();
  try {
    // `git branch --show-current` works even in a repo with no commits yet,
    // unlike `rev-parse --abbrev-ref HEAD` which errors before the first commit.
    const branch = run("git branch --show-current") || "HEAD";
    let dirty = false;
    try {
      dirty = run("git status --porcelain") !== "";
    } catch {}

    // ahead/behind vs upstream, if any
    let ab = "";
    try {
      const counts = run("git rev-list --left-right --count HEAD...@{u}");
      const [ahead, behind] = counts.split(/\s+/).map(Number);
      if (ahead) ab += paint(`↑${ahead}`, C.cyan);
      if (behind) ab += paint(`↓${behind}`, C.red);
    } catch {}

    const mark = dirty ? paint("*", C.yellow) : "";
    const color = dirty ? C.yellow : C.green;
    return `${paint(branch, color)}${mark}${ab ? " " + ab : ""}`;
  } catch {
    return null; // not a git repo
  }
}

// --- model segment --------------------------------------------------------
// Model name, with the reasoning effort level appended when the harness
// reports one (e.g. "Opus 4.8·high").
function modelSegment() {
  const name = data.model?.display_name || data.model?.id;
  if (!name) return null;
  const effort = data.effort?.level;
  const label = effort ? `${name}${paint("·" + effort, C.dim)}` : name;
  return paint(label, C.blue);
}

// --- context segment ------------------------------------------------------
// Prefer the harness-provided context_window; fall back to parsing the
// transcript on older clients that don't send it.
const CONTEXT_LIMIT = 200000;
function pctColor(pct) {
  return pct >= 90 ? C.red : pct >= 70 ? C.yellow : C.green;
}
// 15500 -> "16k", 1000000 -> "1M". Coarse on purpose — it's a status line.
function fmtTokens(n) {
  if (n >= 1e6) return `${+(n / 1e6).toFixed(1)}M`;
  if (n >= 1000) return `${Math.round(n / 1000)}k`;
  return String(n);
}
function contextSegment() {
  const cw = data.context_window;
  if (cw && (cw.total_input_tokens != null || cw.used_percentage != null)) {
    const total = cw.context_window_size || CONTEXT_LIMIT;
    // total_*_tokens = tokens currently in context (v2.1.132+); fall back to
    // deriving from the percentage on older clients.
    const used =
      cw.total_input_tokens != null
        ? (cw.total_input_tokens || 0) + (cw.total_output_tokens || 0)
        : Math.round(((cw.used_percentage || 0) / 100) * total);
    const pct = Math.round((used / total) * 100);
    return paint(`${fmtTokens(used)}/${fmtTokens(total)} ctx`, pctColor(pct));
  }
  const path = data.transcript_path;
  if (!path || !fs.existsSync(path)) {
    // Fall back to the coarse flag the harness provides.
    if (data.exceeds_200k_tokens) return paint(">200k ctx", C.red);
    return null;
  }
  try {
    const lines = fs.readFileSync(path, "utf8").trim().split(/\r?\n/);
    let usage = null;
    for (let i = lines.length - 1; i >= 0; i--) {
      if (!lines[i]) continue;
      let obj;
      try {
        obj = JSON.parse(lines[i]);
      } catch {
        continue;
      }
      const u = obj.message?.usage;
      if (u && (u.input_tokens != null || u.output_tokens != null)) {
        usage = u;
        break;
      }
    }
    if (!usage) return null;
    const used =
      (usage.input_tokens || 0) +
      (usage.cache_read_input_tokens || 0) +
      (usage.cache_creation_input_tokens || 0) +
      (usage.output_tokens || 0);
    const pct = Math.min(100, Math.round((used / CONTEXT_LIMIT) * 100));
    return paint(`~${fmtTokens(used)}/${fmtTokens(CONTEXT_LIMIT)} ctx`, pctColor(pct));
  } catch {
    return null;
  }
}

// --- session-limit segment ------------------------------------------------
// Subscription (Pro/Max) usage windows. Present only for Claude.ai
// subscribers, and only after the first API response in a session.
// When a window gets close to full, append a countdown to its reset.
function fmtReset(epochSec) {
  if (!epochSec) return "";
  const secs = epochSec - Math.floor(Date.now() / 1000);
  if (secs <= 0) return "";
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return h > 0 ? `${h}h${m}m` : `${m}m`;
}
function windowPart(label, win) {
  if (!win || win.used_percentage == null) return null;
  const pct = Math.round(win.used_percentage);
  let txt = `${label} ${pct}%`;
  // Once you're getting close, show how long until it frees up.
  if (pct >= 80) {
    const reset = fmtReset(win.resets_at);
    if (reset) txt += ` (${reset})`;
  }
  return paint(txt, pctColor(pct));
}
function limitSegment() {
  const rl = data.rate_limits;
  if (!rl) return null; // not a Pro/Max subscriber, or before first response
  const parts = [
    windowPart("5h", rl.five_hour),
    windowPart("wk", rl.seven_day),
  ].filter(Boolean);
  return parts.length ? parts.join(" ") : null;
}

// --- cost segment ---------------------------------------------------------
function costSegment() {
  const usd = data.cost?.total_cost_usd;
  if (usd == null) return null;
  return paint(`$${usd.toFixed(2)}`, C.magenta);
}

// --- assemble -------------------------------------------------------------
const sep = paint(" | ", C.gray);
const segments = [
  gitSegment(),
  modelSegment(),
  contextSegment(),
  limitSegment(),
  costSegment(),
].filter(Boolean);

process.stdout.write(segments.join(sep));

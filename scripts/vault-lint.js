#!/usr/bin/env node
/**
 * vault-lint.js — health check for the knowledge-vault (the declarative-memory layer).
 *
 * The knowledge-vault skill has always documented a "lint" operation (orphans, dead
 * wikilinks, stale frontmatter) but nothing ever ran it, so the vault drifted: as of
 * 2026-08 roughly 60% of concepts/ notes were missing from index.md. This is that
 * operation, mechanized.
 *
 * Usage:  node scripts/vault-lint.js              (report)
 *         node scripts/vault-lint.js --fix-index  (append missing notes to index.md)
 * Exit:   0 = clean or warnings only, 1 = vault unreachable.
 *
 * Checks (all local, read-only unless --fix-index):
 *   1. forward links    — [[target]] with no note yet (informational: the vault convention
 *                         blesses these, so they're reported for typo-spotting only)
 *   2. cross-layer      — [[target]] that resolves in the HARNESS memory layer instead
 *   3. index coverage   — notes absent from index.md, the documented master catalog
 *   4. true orphans     — notes with zero inbound links from anywhere
 *   5. frontmatter      — missing block, or missing title/type
 *   6. noise            — .md files outside the note dirs (stray agent worktrees etc.)
 */

"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { getClaudeHome, getKnowledgeVaultPath } = require("./claude-paths");

const VAULT = getKnowledgeVaultPath();
const NOTE_DIRS = ["concepts", "entities", "sources", "sessions"];
const HUBS = ["index.md", "hot.md", "log.md", "README.md"];
const FIX_INDEX = process.argv.includes("--fix-index");

let warnings = 0;
const lines = [];
function ok(msg) { lines.push(`  ok    ${msg}`); }
function warn(msg) { warnings++; lines.push(`  WARN  ${msg}`); }
function fail(msg) { lines.push(`  FAIL  ${msg}`); }
function section(t) { lines.push(`\n${t}`); }
function readIf(p) { try { return fs.readFileSync(p, "utf8"); } catch { return null; } }
function listMd(dir) {
  try {
    return fs.readdirSync(path.join(VAULT, dir))
      .filter((f) => f.endsWith(".md"))
      .map((f) => ({ slug: f.slice(0, -3), dir, abs: path.join(VAULT, dir, f) }));
  } catch { return []; }
}

// Wikilinks inside fenced code blocks are shell `[[ ]]` tests, not links — strip first.
function stripCode(text) {
  return text.replace(/```[\s\S]*?```/g, "").replace(/`[^`\n]*`/g, "");
}
function wikilinks(text) {
  const out = [];
  for (const m of stripCode(text).matchAll(/\[\[([^\]|#]+)(?:[|#][^\]]*)?\]\]/g)) {
    out.push(m[1].trim());
  }
  return out;
}

if (!fs.existsSync(VAULT)) {
  console.log(`\nvault-lint\n  FAIL  vault not found at ${VAULT} — set knowledgeVaultPath in machine.json\n`);
  process.exit(1);
}

const notes = NOTE_DIRS.flatMap(listMd);
const bySlug = new Map(notes.map((n) => [n.slug, n]));

// Every file that can hold a link: notes + the root hub files.
const sources = [
  ...notes,
  ...HUBS.map((h) => ({ slug: h.slice(0, -3), dir: ".", abs: path.join(VAULT, h) })),
].filter((s) => fs.existsSync(s.abs));

// Harness memory — the OTHER memory layer. Notes cross-link to it but wikilinks can't resolve there.
const harnessSlugs = new Set();
try {
  const projects = path.join(getClaudeHome(), "projects");
  for (const p of fs.readdirSync(projects)) {
    const memDir = path.join(projects, p, "memory");
    try {
      for (const f of fs.readdirSync(memDir)) {
        if (f.endsWith(".md") && f !== "MEMORY.md") harnessSlugs.add(f.slice(0, -3));
      }
    } catch { /* no memory dir for this project */ }
  }
} catch { /* no projects dir */ }

// 1-2. link resolution --------------------------------------------------------
section(`vault (${VAULT})`);
ok(`${notes.length} note(s) across ${NOTE_DIRS.join("/")}`);

const inbound = new Map();
const dead = new Map();      // slug -> [referencing files]
const crossLayer = new Map();
for (const src of sources) {
  const text = readIf(src.abs);
  if (!text) continue;
  for (const target of new Set(wikilinks(text))) {
    if (bySlug.has(target)) {
      if (!inbound.has(target)) inbound.set(target, new Set());
      // A note listing itself doesn't count as an inbound link.
      if (target !== src.slug) inbound.get(target).add(src.slug);
      continue;
    }
    // Unresolved: does it live in the harness memory layer, or nowhere?
    const bucket = [...harnessSlugs].some((h) => h === target || h.startsWith(`${target}-`))
      ? crossLayer : dead;
    if (!bucket.has(target)) bucket.set(target, []);
    bucket.get(target).push(`${src.dir === "." ? "" : src.dir + "/"}${src.slug}`);
  }
}

section("links");
// The vault convention blesses links to not-yet-written notes ("it marks something worth
// writing later"), so these are informational — scan them for typos, don't chase them to zero.
if (!dead.size) ok("no unresolved wikilinks");
else {
  ok(`${dead.size} forward link(s) to unwritten notes (fine per convention — check for typos):`);
  for (const [t, refs] of dead) lines.push(`          [[${t}]]  <- ${refs.join(", ")}`);
}
if (crossLayer.size) {
  warn(`${crossLayer.size} link(s) point at the HARNESS memory layer, not the vault:`);
  for (const [t, refs] of crossLayer) lines.push(`          [[${t}]]  <- ${refs.join(", ")}`);
  lines.push("          fix: copy the note into the vault, or write the reference as prose");
}

// 3. index coverage -----------------------------------------------------------
section("index.md coverage");
const indexPath = path.join(VAULT, "index.md");
const indexText = readIf(indexPath) || "";
const indexed = new Set(wikilinks(indexText));
const missing = notes.filter((n) => !indexed.has(n.slug));
if (!missing.length) ok(`all ${notes.length} note(s) catalogued`);
else warn(`${missing.length}/${notes.length} note(s) missing from index.md${FIX_INDEX ? " — appending" : " (run with --fix-index)"}`);

// 4. true orphans -------------------------------------------------------------
const orphans = notes.filter((n) => !(inbound.get(n.slug) || new Set()).size);
section("orphans");
if (!orphans.length) ok("every note has at least one inbound link");
else warn(`${orphans.length} note(s) with zero inbound links: ${orphans.map((n) => n.slug).join(", ")}`);

// 5. frontmatter --------------------------------------------------------------
section("frontmatter");
const bad = [];
for (const n of notes) {
  const text = readIf(n.abs) || "";
  if (!text.startsWith("---")) { bad.push(`${n.slug} (no frontmatter)`); continue; }
  const fm = text.slice(3, text.indexOf("\n---", 3));
  for (const key of ["title", "type"]) {
    if (!new RegExp(`^${key}:`, "m").test(fm)) bad.push(`${n.slug} (no ${key})`);
  }
  // An unquoted value containing ": " is invalid YAML — this exact trap has silently
  // broken frontmatter before, and a broken block reads as "no frontmatter" to tools.
  for (const line of fm.split("\n")) {
    const m = line.match(/^(\w+):\s+(.+?)\s*$/);
    if (!m) continue;
    const v = m[2];
    const quoted = /^(["']).*\1$/.test(v) || v.startsWith("[") || v.startsWith(">") || v.startsWith("|");
    if (!quoted && /:\s/.test(v)) bad.push(`${n.slug} (unquoted ':' in ${m[1]})`);
  }
}
if (!bad.length) ok("all notes have title + type");
else warn(`${bad.length} frontmatter issue(s): ${bad.slice(0, 8).join(", ")}${bad.length > 8 ? ", …" : ""}`);

// 6. noise --------------------------------------------------------------------
section("noise");
let stray = 0, strayRoot = null;
(function walk(dir, depth) {
  if (depth > 6) return;
  let entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if ([".git", "node_modules", ...NOTE_DIRS, "graphify"].includes(e.name)) continue;
      walk(full, depth + 1);
    } else if (e.name.endsWith(".md") && !HUBS.includes(e.name)) {
      stray++;
      if (!strayRoot) strayRoot = path.relative(VAULT, dir);
    }
  }
})(VAULT, 0);
if (!stray) ok("no stray .md files outside the note dirs");
else warn(`${stray} .md file(s) outside note dirs (first: ${strayRoot}) — likely an abandoned agent worktree; \`git worktree list\` then \`git worktree remove\``);

// --fix-index -----------------------------------------------------------------
if (FIX_INDEX && missing.length) {
  const SECTION = { concepts: "## Concepts", entities: "## Entities", sources: "## Sources", sessions: "## Sessions" };
  let text = indexText;
  for (const dir of NOTE_DIRS) {
    const add = missing.filter((n) => n.dir === dir);
    if (!add.length) continue;
    const heading = SECTION[dir];
    const at = text.indexOf(heading);
    if (at === -1) continue;
    // Insert after the last existing bullet in this section (before the next ## heading).
    const nextHeading = text.indexOf("\n## ", at + heading.length);
    const end = nextHeading === -1 ? text.length : nextHeading;
    const block = add.map((n) => {
      const fm = readIf(n.abs) || "";
      const title = (fm.match(/^title:\s*(.+)$/m) || [])[1] || n.slug;
      return `- [[${n.slug}]] — ${title.trim()}`;
    }).join("\n");
    text = `${text.slice(0, end).replace(/\s*$/, "")}\n${block}\n${text.slice(end)}`;
  }
  fs.writeFileSync(indexPath, text);
  lines.push(`\n  fixed  appended ${missing.length} entry(ies) to index.md — review wording, then commit`);
}

console.log(lines.join("\n"));
console.log(`\nresult: ${warnings} warn\n`);
process.exit(0);

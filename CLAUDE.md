# Machines & contexts

This config is shared (via the `claude-config` git repo) across a personal Windows gaming PC and a
MacBook Pro. It is a general-purpose setup for engineering work and daily use — there is no
work/employer context, and nothing here should assume one.

- **Project specifics belong in the project.** Keep warehouse schemas, data dictionaries,
  ingestion→transform→publish DAGs, and source-of-truth notes in a *project-scoped* `CLAUDE.md`
  inside that repo (e.g. the NFL data-engineering website), not here.

# Memory system (cross-project)

The user keeps persistent memory in two layers. Use them across **every** repo. These live in
global `~/.claude/` so they load no matter which single repo is opened.

- **knowledge-vault** — the shared "second brain" of durable Markdown notes at
  the path configured by `KNOWLEDGE_VAULT_PATH` or `~/.claude/machine.json`.
  Skill:
  `~/.claude/skills/knowledge-vault/SKILL.md`.
  Consult it BEFORE non-trivial work ("what do I already know about X?") and save learnings
  AFTER meaningful work. There is ONE vault, shared by every project.
- **graphify** (`~/.claude/skills/graphify/SKILL.md`) — turns any codebase/input into a
  queryable knowledge graph. Trigger: `/graphify`. Query the graph instead of re-reading
  files. When the user types `/graphify`, invoke the Skill tool with `skill: "graphify"`
  before doing anything else.
- **memory-orchestrator** agent (`~/.claude/agents/memory-orchestrator.md`) — drives both
  layers together to load context at the start of substantial work and consolidate it at the
  end. Spawn it for cross-project context management, not one-off lookups.

# Coding disposition

- **Minimal-code first (ponytail).** Default to the laziest solution that actually works: ask if
  it needs to exist at all (YAGNI), reuse what already lives in the codebase, prefer stdlib/native
  over new dependencies, one line over fifty. Never simplify away validation, security,
  accessibility, error handling, or — above all — understanding the problem first (read the real
  flow before picking the small diff). Full guidance: `~/.claude/skills/ponytail/SKILL.md`.
- **Terse output is opt-in (caveman).** Don't compress prose by default — clear explanation
  matters for decisions. Switch to terse mode only when the user asks ("be brief", `/caveman`).

# Google Workspace (`gws`)

`gws` (the Google Workspace CLI, `@googleworkspace/cli`) is installed globally and
allowlisted (`Bash(gws:*)` in `settings.json`), so it runs without a prompt in every repo.
Use it to read/write **Docs, Sheets, Slides, Drive, Gmail, Calendar, Tasks**. The `gws-*`
skills are per-service command maps; run `gws schema <service.resource.method>` for exact
params before building a call. NotebookLM is **not** supported (no public API) — don't offer it.

- **Confirm before any write/send/delete.** `gws` can send email and delete Drive files —
  outward-facing and irreversible. Always confirm with the user before a `create`, `update`,
  `patch`, `batchUpdate`, `send`, `insert`, or `delete` call; prefer `--dry-run` first. (The
  `Bash(gws:*)` allowlist suppresses the harness prompt, so this judgment is on you.)
- **Auth is per-machine via gcloud:** `gcloud auth login` → `gws auth setup`; verify with
  `gws auth status`. Use `gws auth login --readonly` to hold read-only scopes.
- **gcloud PATH gotcha:** ensure the gcloud SDK `bin` is on PATH — re-open the terminal after
  installing, since sessions launched before install won't see it. Put any machine-specific SDK
  path in that machine's gitignored `machine.json`, not here (it differs per OS: e.g.
  `/opt/homebrew` or `~/google-cloud-sdk` on macOS, `…\AppData\Local\Google\Cloud SDK\…` on Windows).

# Local tooling

- **Status line** (`~/.claude/statusline.js`, wired via `settings.json` → `statusLine`):
  shows git branch+status · model·effort · context% · subscription 5h/weekly usage · cost.
  Edit that script to change segments; it already exists, so don't recreate it.
- **Machine-local overrides** live in `~/.claude/machine.json` (ignored by git). Use it for
  paths that should differ per computer, especially `knowledgeVaultPath` and optional
  browser-harness overrides.

## Skill triggering convention

A skill's frontmatter `description:` is its trigger — it's what tells the agent when to use it
(hooks are NOT for skill discovery; don't add reminder-injection hooks). Audited 2026-08: all
skills conform. Keep it that way:

- Every skill description states **what it does + when to use it** ("Use when…"/"Trigger on…"),
  plus negative triggers where skills overlap ("local .xlsx → xlsx skill; NOT for X, use Y").
- New or edited skills (including third-party installs) get the same treatment before landing.
- Exceptions: slash commands in `commands/` and skills with `disable-model-invocation: true`
  are user-invoked (terse is fine — do NOT add cues; quote-nesting in YAML descriptions has
  broken frontmatter before); plugin-provided skills are upstream files — don't edit them.

## Plugins are on-demand, not always-on

`skill-creator` and `plugin-dev` sit disabled in `settings.json` → `enabledPlugins` (decided
2026-08-08; they were loading ~10 skills + 3 agents into every session). Plugins only load at
session START, so the workflow when a task actually needs one: flip its flag to `true`, have the
user start a fresh session for the work, then flip it back to `false` when the job is done. Don't
re-enable them permanently.

## Tooling adoption

Adopted defaults (prefer these when the need arises):

- **anydoc** (`firecrawl/anydoc`) — local Rust doc→Markdown converter (docx/pptx/xlsx/PDF).
  Installed (vetted clean 2026-08) as the single-file skill
  `~/.claude/skills/convert-documents-to-markdown/SKILL.md`, so it syncs with this repo — no
  per-machine install. Runtime pinned to `@firecrawl/anydoc@0.2.4`; fully local (no egress),
  but it has **no OCR** — scanned PDFs go through the local `pdf` skill, never the hosted
  Firecrawl Parse API.
- **Playwright** — the local browser-automation engine. Prefer the **Playwright CLI**
  (`npm install -g @playwright/cli@latest`, command `playwright-cli`) over the Playwright MCP
  server — token-efficient, CLI-over-MCP. It reuses system Chrome (no browser download) but
  writes session snapshots to `.playwright-cli/` in the cwd — delete or gitignore that folder;
  never commit it.
- **`gh` CLI via Bash** — instead of the GitHub MCP server, following the same CLI-over-MCP
  principle.

Worth trying — verify on our own workloads before adopting as defaults:

- **Browser-Use** — open-source LLM-driven browser agent; candidate for open-ended tasks against
  internal web apps that have no API.
- **Crawl4AI** — local scraping (chosen over hosted Firecrawl since we're staying local-only);
  watch for Chromium/GPU contention with other local GPU workloads.

# Cross-platform / setup notes

This folder must run identically on Windows + macOS. Keep it portable:

- Machinery (hooks, statusline) runs through `scripts/run-claude-entry.js`, which resolves paths via
  `os.homedir()` — never hardcode `C:\Users\...` or absolute paths in tracked config. Requires
  `node` on PATH in the *non-interactive* hook environment (verify on macOS where nvm/Homebrew may
  not export it to non-login shells).
- Bundled skill scripts (docx/pptx/xlsx/pdf, image skills) need **Python 3** *plus* third-party
  packages (`openpyxl`, `pypdf`, `Pillow`). `bootstrap.sh` provisions a venv at `~/.claude/.venv`
  and records it as `pythonPath` in `machine.json` — macOS/Homebrew pythons are PEP 668
  "externally managed" and refuse `pip install`, so the venv is not optional there. Resolve the
  interpreter via `scripts/claude-paths.js` → `getPythonPath()` rather than assuming `python3`;
  on Windows it falls back to `py -3`, never the Microsoft Store `python` stub (which no-ops).
- Machine dependencies are declared once in `scripts/dependencies.json` and consumed by
  `detect-capabilities.js` (probes) and `health-check.js` (reports). Add a dependency there —
  a dep listed in only one consumer is one that silently never gets checked.
- Per-machine paths (vault, browser, gcloud SDK) belong in gitignored `machine.json`. A fresh clone
  becomes functional via the per-machine setup in `README.md` (copy `machine.example.json` →
  `machine.json`, set `knowledgeVaultPath`, confirm `node`/`gws`/`gcloud`).

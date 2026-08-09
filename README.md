# ~/.claude — git-synced Claude Code config

This repo **is** the `~/.claude` directory, version-controlled and synced across a Windows gaming PC and a MacBook Pro. It holds the hand-authored machinery: `CLAUDE.md`, `settings.json`,
`skills/`, `agents/`, `hooks/`, `scripts/`, `commands/`, `statusline.js`, `keybindings.json`. Secrets,
runtime state, caches, transcripts, and externally-managed plugins are **not** tracked.

Goal: a fresh clone is **one command** to working — run `bootstrap.sh` (POSIX) or `bootstrap.ps1`
(Windows) and follow the printed next steps.

## Lean activation model

This config is meant to behave like a **lean agentic OS**:

- The agent should be **aware of the available capability layers**: `commands/`, `skills/`,
   `agents/`, `scripts/`, local CLIs, connectors, and MCPs.
- **Awareness does not mean eager activation.** MCPs/connectors stay disabled until a live task needs
   them; they are not startup defaults.
- The normal routing order is: local command/skill/script → local CLI → subagent → connector/MCP.
- If a task truly needs an external connector or MCP, the agent should name the exact thing to enable,
   why it is needed, and any data-egress implications.

Authoritative local inventories live in the folder names themselves:

- `commands/` — reusable slash commands
- `skills/` — on-demand workflows
- `agents/` — context-isolated specialists
- `scripts/` — machine primitives and OS helpers
- `machine.json` — per-machine capability manifest and local overrides

## The sync model: allowlist `.gitignore`

`.gitignore` ignores **everything** at the top level (`/*`) and then re-includes only the paths we
author with `!` lines. This is deliberate — it defaults to *not* leaking secrets/state, at the cost
of one gotcha:

> **Adding a new top-level dir or file? It will NOT sync until you add a `!/your-thing/` line to
> `.gitignore`.** New `skills/`, `agents/`, etc. *inside* an already-allowlisted dir sync fine; only
> brand-new top-level paths need the explicit re-include. `commands/`, `output-styles/`, and the two
> bootstrap scripts are pre-allowlisted for exactly this reason.

Belt-and-suspenders rules at the bottom of `.gitignore` (`__pycache__`, `node_modules`, `*.log`,
`.credentials.json`) keep junk out even inside tracked dirs.

## Per-machine setup checklist

1. **Clone into `~/.claude`** (back up any existing one first):
   `git clone <repo> ~/.claude`
2. **Run the bootstrap** from inside `~/.claude`:
   - macOS/Linux: `sh bootstrap.sh`
   - Windows: `pwsh -File bootstrap.ps1` (or `powershell -File bootstrap.ps1`)
3. **Create `machine.json`** — bootstrap copies `machine.example.json` → `machine.json` if absent.
   This file is git-ignored and holds **per-machine paths**. Set at minimum `knowledgeVaultPath` to
   the absolute path of your knowledge-vault clone on *this* box. Optional: `preferredImageSaveDir`,
   `browserHarnessBrowserPath`, `browserHarnessProfileDir`.
4. **Ensure these are on `PATH`** (bootstrap warns if missing):
   - **node** — skills/scripts and the statusline run on it.
   - **gws** — `npm i -g @googleworkspace/cli`; auth via `gcloud auth login` → `gws auth setup`.
   - **gcloud** — Google Cloud SDK. On Windows it installs to the *user* PATH at
     `…\Google\Cloud SDK\google-cloud-sdk\bin`; terminals opened *before* install won't see it —
     open a fresh one or prepend it.
   - **Optional CLIs** (not required; `scripts/detect-capabilities.js` probes them and skills
     degrade gracefully when absent): **uv** (Python runtime/tooling), **duckdb** + **sqlite3**
     (local analytical SQL), **pandoc** + **tesseract** (document/OCR skills). Install the ones a
     workflow needs, then re-run `node scripts/detect-capabilities.js` to refresh the manifest.
5. **Windows `python` gotcha:** the bare `python` command is often the MS-Store *stub* that opens the
   Store instead of running Python. Use **`py -3`** (Windows) or **`python3`** (cross-platform);
   never assume bare `python`.
6. **Verify it loaded:** start a Claude Code session in any repo and confirm:
   - the **statusline** appears (branch · model · context% · usage · cost), and
   - there is **no surprise connector/MCP startup activity**; external capability layers should stay
     dormant until a task calls for them.
   If the statusline is missing, re-check `settings.json` is the cloned one and `node` resolves.

## Global vs. project `CLAUDE.md`

Keep this repo **general-purpose and broadly reusable**. It loads in *every* repo, so it must not
carry the weight of any single project.

- **Global (`~/.claude/CLAUDE.md`, here):** cross-project memory system, coding disposition, shared
  tooling (gws), reusable skills. Examples stay generic (finance/sports only as illustration).
- **Project (in *that* repo's `CLAUDE.md` / `.claude/`):** anything specific to one project — e.g. an
  NFL data project's schema, data dictionary, niche data-source skills, project-only commands. These
  do **not** belong in global; they'd pollute every other repo's context.

Rule of thumb: if it only helps one project, it lives in that project's repo.

## Per-machine overrides

Need different permissions or env on one machine? Drop a gitignored `settings.local.json` next to
`settings.json` — it deep-merges over the tracked config without forking it. Keep machine-specific
*paths* in `machine.json`, machine-specific *harness settings* in `settings.local.json`.

## Public mirror

This repo (`origin`, **private**) keeps the full history. A **squashed, single-commit public
mirror** lives at [`gesmith0606/claude-config-public`](https://github.com/gesmith0606/claude-config-public)
on the `public` remote. History is deliberately *not* shared — early commits carry personal and
employer detail that was later scrubbed, and squashing is what keeps it out of the public tree.

Refresh the mirror after landing changes on `main`:

```sh
git checkout public-main
git checkout main -- .        # take main's tree wholesale
git add -A && git commit -m "Sync public snapshot"
git push public public-main:main
git checkout main
```

**Before each sync**, re-check nothing personal crept in:

```sh
git grep -inE "private[- ]equity|PE[- ]work|portfolio[- ]compan|Users.smith|C--Users"
```

Machine-specific and secret paths are excluded by the `.gitignore` allowlist either way, but that
allowlist protects *files*, not *prose* — the grep is what catches employer detail written into a
skill or a comment.

## License & attribution

The configuration, hooks, scripts, commands, agents, and skills authored here are MIT-licensed
(see `LICENSE`). Bundled third-party material keeps its own license and is **not** covered by it:

| Path | Origin | License |
|---|---|---|
| `skills/docx`, `skills/pdf`, `skills/pptx`, `skills/xlsx`, `skills/mcp-builder`, `skills/web-artifacts-builder` | Anthropic ([anthropics/skills](https://github.com/anthropics/skills)) | © Anthropic, PBC — see each skill's `LICENSE.txt` |
| `skills/codebase-design`, `skills/domain-modeling`, `skills/grilling`, `commands/grill-me`, `commands/grill-with-docs` | [mattpocock/skills](https://github.com/mattpocock/skills) | per upstream repo |
| `skills/emil-design-eng` | Emil Kowalski's design-engineering writing/course material | per author |
| Skills carrying `origin: ECC` or `origin: community` in frontmatter | community-sourced | per upstream source |
| `skills/convert-documents-to-markdown` | thin wrapper; the converter itself is [firecrawl/anydoc](https://github.com/firecrawl/anydoc), invoked via `npx` | wrapper MIT; anydoc per upstream |

If you own any of the above and want attribution changed or content removed, open an issue.

Nothing here is intended as, or a substitute for, an employer's own tooling policy — the
confidentiality rules in `CLAUDE.md` are one person's personal defaults, not a compliance standard.

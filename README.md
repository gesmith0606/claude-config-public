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

The goal is **clone → bootstrap → log in**, and every skill works. Bootstrap is idempotent: re-run
it any time; on a machine that is already set up it reports everything present and changes nothing.

0. **Prerequisites:** `git` and **node** (bootstrap's helpers run on it), plus the platform package
   manager — **Homebrew** on macOS, **winget** on Windows.
1. **Clone into `~/.claude`** (back up any existing one first):
   `git clone <repo> ~/.claude`
2. **Run the bootstrap** from inside `~/.claude`:
   - macOS/Linux: `sh bootstrap.sh`
   - Windows: `pwsh -File bootstrap.ps1` (or `powershell -File bootstrap.ps1`)

   It does, in order:
   - **`machine.json`** — copies `machine.example.json` → `machine.json` if absent and prompts for
     `knowledgeVaultPath`. The file is git-ignored and holds **per-machine paths** (optional:
     `preferredImageSaveDir`, `browserHarnessBrowserPath`, `browserHarnessProfileDir`).
   - **Python venv** (macOS/Linux) — `~/.claude/.venv` with the `python` packages from
     `scripts/dependencies.json`, recorded as `pythonPath`.
   - **`PATH` + repo CLIs** — puts `~/.local/bin` on `PATH` for login shells (macOS: a guarded
     `case ":$PATH:"` line appended once to `~/.zprofile`) and links `~/.local/bin/yt` and
     `~/.local/bin/reddit` to `skills/youtube/bin/yt` and `skills/reddit/bin/reddit`. Windows adds
     `~\.local\bin`, `skills\youtube\bin` and `skills\reddit\bin` (the `.cmd` wrappers) to the
     *user* PATH. Existing files that are not those links are left alone.
   - **Missing CLIs** — probes everything in `scripts/dependencies.json` (`detect-capabilities.js`)
     and lists what is absent. Hints that are a plain `brew` / `winget` / `uv tool` / `npm` command
     are offered in **one y/N prompt**; the rest (e.g. Xcode CLT, gcloud and poppler on Windows) are
     printed as manual steps. Add a dependency in `dependencies.json`, never in the bootstrap.
   - **ArtCraft CLIs** (optional) — macOS: if `photocraft-cli` / `filmcraft-cli` / `pdfcraft-cli`
     are missing and `gh` is logged in, a separate y/N downloads each
     `<app>-cli-<ver>-macos-universal.zip` from the `storytold/<app>` latest release, checks it
     against the release's sha256 digest, and installs it to `~/.local/bin`; with
     `/Applications/PdfCraft.app` present it links `~/.local/share/pdfcraft/models` to the app's
     models. Windows: reports whether `C:\Program Files\<App>\<app>-cli.exe` exists (the ArtCraft
     Launcher / MSI installs them; the skills find them there).
   - **Health check** (`scripts/health-check.js`), then a checklist of what it cannot do for you.
3. **Log in** (per machine, by hand — bootstrap prints this list):
   - `gh auth login` (then re-run bootstrap if you skipped ArtCraft for lack of it)
   - `gcloud auth login` → `gws auth setup` → `gws auth status`. On Windows gcloud lands on the
     *user* PATH at `…\Google\Cloud SDK\google-cloud-sdk\bin`; terminals opened *before* install
     won't see it.
   - `bw login`, then per shell `bwu` (or `export BW_SESSION="$(bw unlock --raw)"`; PowerShell:
     `$env:BW_SESSION = (bw unlock --raw)`). API keys and PATs live only in Bitwarden and are
     resolved at run time by `scripts/resolve-secret.js` — see the `bitwarden` skill.
   - Optional, macOS: a Keychain copy of `GEMINI_API_KEY` so `yt` works without unlocking the vault
     (bootstrap prints the `security -i` command; the key goes over stdin, never argv).
   - Open a **new terminal** so the `PATH` changes apply.
4. **Optional CLIs degrade gracefully** — skills that need an absent CLI say so. Install later
   and re-run bootstrap (or `node scripts/detect-capabilities.js`) to refresh the manifest.
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

## Adopting this on a machine that already has a ~/.claude

**This repo is the source of truth.** Adoption overwrites whatever the machine had; nothing from
the old config is migrated forward. Take a backup for recovery, not for merging.

`git clone` refuses a non-empty directory, so the repo is adopted in place:

```sh
mv ~/.claude ~/.claude.bak                     # full recovery copy
mkdir ~/.claude && cd ~/.claude
git clone <repo-url> .
# bring back ONLY live runtime state — history, transcripts, installed plugins:
for d in projects sessions history.jsonl plugins shell-snapshots; do
  [ -e ~/.claude.bak/$d ] && cp -R ~/.claude.bak/$d ~/.claude/$d
done
sh bootstrap.sh
```

Everything restored in that loop is ignored by the `/*` allowlist, so it never enters git. Anything
*not* in the loop — old `settings.json`, loose `agents/`, stray `skills/`, an old statusline — is
deliberately left behind. If a machine had something worth keeping, the fix is to add it to this
repo so every machine gets it, not to preserve it locally.

Expect the harness to change on a machine that had its own setup: model, permission mode, enabled
plugins, hooks, and statusline all become whatever `settings.json` here says. That is the point.
Genuinely per-machine values (paths, an override you want on one box only) go in the gitignored
`machine.json` / `settings.local.json` **after** adoption.

## Secret-read guards

`settings.json` → `permissions.deny` blocks the **Read** tool against `.env`, SSH/AWS/GCloud
credentials, keys, and browser cookie stores, and pairs each with `Bash(<reader> <target>)` rules
covering `cat`/`head`/`tail`/`less`/`strings`.

Treat the Bash half as a **speed bump, not a boundary.** Read rules are exact; shell rules can only
match command strings, and a shell has unlimited ways to read a file (`grep`, `<`, `python -c`,
`base64`, a subshell). The rules stop the obvious accidental path. They do not contain a determined
one — that is what the deny-list on the Read tool, and not routing secrets through the agent in the
first place, are for.

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

`LICENSE` (MIT) covers **only** the configuration, hooks, scripts, commands, agents, and skills
authored here. Bundled third-party material keeps its own license and is **not** covered by it:

| Path | Origin | License |
|---|---|---|
| `skills/docx`, `skills/pdf`, `skills/pptx`, `skills/xlsx`, `skills/mcp-builder`, `skills/web-artifacts-builder` | Anthropic ([anthropics/skills](https://github.com/anthropics/skills)) | © Anthropic, PBC — see each skill's `LICENSE.txt` |
| `skills/codebase-design`, `skills/domain-modeling`, `skills/grilling`, `commands/grill-me`, `commands/grill-with-docs` | [mattpocock/skills](https://github.com/mattpocock/skills) | per upstream repo |
| `skills/emil-design-eng` | Emil Kowalski's design-engineering writing/course material | per author |
| Skills carrying `origin: ECC` or `origin: community` in frontmatter | community-sourced | per upstream source |
| `skills/convert-documents-to-markdown` | thin wrapper; the converter itself is [firecrawl/anydoc](https://github.com/firecrawl/anydoc), invoked via `npx` | wrapper MIT; anydoc per upstream |

If you own any of the above and want attribution changed or content removed, open an issue.

Nothing here is a policy document — the conventions in `CLAUDE.md` are one person's personal
defaults for their own machines, not a standard for anyone else.

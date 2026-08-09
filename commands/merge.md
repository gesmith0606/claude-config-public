---
description: Scan-gated merge — secret scan + targeted review + tests on the branch diff, then merge to main or open a PR. Blocks on failures.
argument-hint: "[base branch] [pr]  (default base: main; add 'pr' to open a PR instead of merging locally)"
allowed-tools: Bash(git status:*), Bash(git branch:*), Bash(git log:*), Bash(git diff:*), Bash(git merge-base:*), Bash(gitleaks:*)
---

Scan-gated merge of the current feature branch. Args: **$ARGUMENTS** (default base `main`;
if the word `pr` appears, finish by opening a PR instead of merging locally).

**1. Preflight** (abort with a clear message if any fails):
- !`git branch --show-current` — must NOT be the base branch.
- !`git status --short` — working tree must be clean (no uncommitted/untracked work).
- !`git log --oneline "$(git merge-base HEAD ${ARGUMENTS%% *})"..HEAD 2>/dev/null || git log --oneline main..HEAD`

**2. Scan gate** — run all three against the branch diff; collect findings instead of stopping
at the first:
- **Secrets:** `gitleaks detect --no-banner --log-opts="$(git merge-base HEAD main)..HEAD"` if
  gitleaks is installed; otherwise Grep the diff for obvious credential patterns and say the
  check was degraded.
- **Review:** spawn the reviewer that matches the diff — `data-pipeline-reviewer` for SQL / dbt /
  pandas / pipeline changes, `mle-reviewer` for ML code, `silent-failure-hunter` otherwise (or
  additionally for mixed diffs). Small diffs (< ~50 lines): review inline instead of spawning.
- **Tests:** run the repo's suite if one exists (pytest / npm test / make test — detect, don't
  guess). No suite → say so; don't invent one.

**3. Verdict:**
- Any gate fails → **STOP. Do not merge.** List the findings ranked by severity, each with
  file:line and the concrete fix; end with what to rerun after fixing.
- All green → state what passed in one line each.

**4. Land it:**
- `pr` mode (or the repo's workflow is PR-based — e.g. protected main): draft with `/pr`
  conventions and hand the actual `gh` calls to the **github-ops** skill.
- Local mode: `git merge --no-ff <branch>` into the base, then show `git log --oneline -3`.
  **Confirm with the user before pushing** the merged base anywhere — the push is the
  irreversible, outward step. Offer branch deletion only after the merge is pushed and verified.

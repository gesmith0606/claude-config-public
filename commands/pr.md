---
description: Draft a PR title + body from the current diff; hand off the actual gh push to the github-ops skill.
argument-hint: "[base branch | extra context]  (default base: main)"
allowed-tools: Bash(git diff:*), Bash(git log:*), Bash(git branch:*), Bash(git merge-base:*)
---

Draft a pull request from the current branch's changes. Base/context: **$ARGUMENTS** (default base `main`).

Gather (read-only):
- !`git branch --show-current`
- !`git log --oneline "$(git merge-base HEAD ${ARGUMENTS:-main})"..HEAD`
- !`git diff --stat "$(git merge-base HEAD ${ARGUMENTS:-main})"...HEAD`
- !`git diff "$(git merge-base HEAD ${ARGUMENTS:-main})"...HEAD`

Produce, ready to paste:

**Title** — one line, imperative mood, ≤72 chars, conventional-commit prefix if the repo uses them.

**Body** —
- *What & why* — 1-3 sentences: the problem and the change.
- *Changes* — bullet list of the substantive edits (skip noise like lockfile churn).
- *Testing* — how it was/should be verified; call out anything untested.
- *Notes* — migrations, breaking changes, follow-ups, screenshots if UI.

Infer everything from the diff and commits; only ask if the *why* is genuinely unrecoverable.

**Do NOT run `gh` yourself.** This command only writes the draft. For the actual push — creating the
branch, opening/updating the PR, labels, reviewers, enterprise vs public host — invoke the
**github-ops** skill and pass it this title + body.

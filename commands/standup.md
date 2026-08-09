---
description: Summarize recent git activity in this repo into standup bullets (shipped / in progress / next).
argument-hint: "[since e.g. '1 day ago' | yesterday | 3.days | 2026-06-20]  (default: 1 day)"
allowed-tools: Bash(git log:*), Bash(git status:*), Bash(git diff:*), Bash(git branch:*)
---

Build a standup from git history in the current repo. Time window: **$ARGUMENTS** (default `1 day ago`).

Gather (read-only):
- !`git log --since="${ARGUMENTS:-1 day ago}" --pretty=format:'%h %an %ad %s' --date=short --all`
- !`git log --since="${ARGUMENTS:-1 day ago}" --pretty=format:'%h %s' --stat`
- !`git status --short --branch`

Then write three terse sections — no fluff, one bullet per real change:

- **Shipped** — merged/committed work that's done (group related commits; describe outcome, not commit text).
- **In progress** — uncommitted/staged changes from `git status`, and branches with WIP commits.
- **Next** — concrete next steps implied by the above (TODOs, half-finished threads, follow-ups).

Attribute by author only if more than one shows up. Keep it skimmable for a standup.

**Widen to multiple repos:** this command is scoped to the current repo. To cover several, run it
per repo, or from a parent dir loop the same window:
`for d in */; do (cd "$d" && git log --since="${ARGUMENTS:-1 day ago}" --oneline --all 2>/dev/null | sed "s|^|$d |"); done`
then summarize the combined output the same way, grouped by repo.

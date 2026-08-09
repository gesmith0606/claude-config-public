---
description: End-of-day wrap — summarize today's changes, save to the vault, and list open threads / next-session starts.
argument-hint: "[since e.g. 'today' | '1 day ago']  (default: today)"
allowed-tools: Bash(git log:*), Bash(git status:*), Bash(git diff:*), Bash(git stash:*)
---

End-of-day wrap-up. Window: **$ARGUMENTS** (default `today` — i.e. since midnight / `1 day ago`).

**1. What changed today** — gather and summarize (read-only):
- !`git log --since="${ARGUMENTS:-1 day ago}" --pretty=format:'%h %s' --all`
- !`git status --short`
- !`git stash list`

Group into a short "today I…" summary across repos you touched (if running from a parent dir, loop
per subdir as in `/standup`).

**2. Save to the vault** — run the same consolidation as `/save`: add/update an atomic `concepts/`
note, refresh `hot.md`, append a dated `log.md` line. Use the **knowledge-vault** skill for paths
and frontmatter; don't hardcode the location.

**3. Handoff block** — this is what the SessionStart hook injects into the next session, so make
it self-contained for an agent with ZERO memory of today. Write it into `hot.md`'s
`## Current state` (top bullet) and `## Next actions` (replace stale entries), covering:
- **State:** repo + branch, last commit, anything uncommitted/stashed and why.
- **Open threads:** half-finished work, failing tests, decisions pending — with file paths, not
  codenames invented today.
- **First action:** the single command or file the next session should start with.

Keep it tight: a wrap a tired person can read in 30 seconds. If today produced nothing durable,
say so and leave hot.md alone.

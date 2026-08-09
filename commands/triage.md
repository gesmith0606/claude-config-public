---
description: Triage failing tests / CI / errors from pasted or gathered output into a ranked next-action plan.
argument-hint: "[paste errors / CI log / test output, or a hint at where to look]"
allowed-tools: Bash(git log:*), Bash(git diff:*), Bash(git status:*)
---

Triage failures and propose ranked next actions. Input: **$ARGUMENTS**.

**1. Get the signal.** Prefer what the user pasted in `$ARGUMENTS`. If none, gather it: re-run the
failing test/build command they name, read the CI log file, or inspect the error output available.
Don't guess at failures you can't see — ask for the log if it's missing.

**2. Cluster.** Group raw output into distinct failures (one root cause may explain many lines).
For each: the failing test/job, the actual error (exact message), and the most likely cause.
Cross-reference recent changes if relevant: !`git log --oneline -10` and `git diff` of suspect files.

**3. Rank.** Order failures by a quick **impact × effort × confidence** read:
- Blockers / cascading root causes first (one fix that clears many).
- Flaky / environmental / pre-existing noise last — label them as such.

**4. Propose.** For each, give one concrete next action (the command to run, file:line to open, or
fix to try). Lead with the single highest-value move.

Output: a short ranked table or list — failure → likely cause → next action. No essays.
For *deep* root-causing of one stubborn bug, hand off to the **systematic-debugging** skill.

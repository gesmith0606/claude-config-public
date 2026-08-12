---
description: Drift check for the agentic OS — diffs documented policy against actual machine state. Read-only.
allowed-tools: Bash(node:*)
---

Run the drift detectors and interpret the results for the user:

- !`node ~/.claude/scripts/health-check.js`
- !`node ~/.claude/scripts/vault-lint.js`

Rules for interpreting:

1. Report FAILs first, each with the one-line fix (the script's output usually names it).
2. Summarize WARNs in a sentence or two — they're advisory, not urgent.
3. Remind about the manual item (claude.ai connector toggles) only if the user hasn't confirmed it recently.
4. If everything is ok, say so in one line — no padding.
5. Offer to apply mechanical fixes (re-run detect-capabilities, npm install, commit) but do NOT auto-commit or change policy files without confirmation.
6. `vault-lint` covers the memory layer: index.md gaps are fixable with `node ~/.claude/scripts/vault-lint.js --fix-index`. Forward links to unwritten notes are reported as `ok` on purpose — the vault convention blesses them; only chase them if one looks like a typo.

This check embodies the lesson of the 2026-07 audit: documentation drifts from deployment. Run it after config changes, after installing/removing tools, or whenever the setup "feels off."

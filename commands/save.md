---
description: Manually consolidate the session into the knowledge-vault (atomic note + hot.md + dated log line).
argument-hint: "[topic / what to capture]  (optional — defaults to this session's work)"
---

Trigger a knowledge-vault **Save** now, on demand. (This is the same consolidation that otherwise
auto-fires on git push or pre-compact — run it manually when a chunk of work is worth recording.)

Focus: **$ARGUMENTS** (if empty, capture the meaningful learnings/decisions from this session).

Use the **knowledge-vault** skill for exact paths, layout, and frontmatter — don't hardcode the
vault location; resolve it from `KNOWLEDGE_VAULT_PATH` or `~/.claude/machine.json`. Then:

1. **Atomic note** — add or update the relevant `concepts/` (or `entities/`) note: one idea per
   note, kebab-case filename, required frontmatter, `[[wikilinks]]` (≥2) to related notes. Update
   `updated:` if it already exists. Link it from `index.md` if new.
2. **Refresh `hot.md`** — fold in what's now top-of-mind; keep it ~500 words, drop stale lines.
3. **Append `log.md`** — one dated line: `- YYYY-MM-DD — <what changed / was decided>`.
4. **Refresh graphify** — only if this repo already has a graph (`graphify-out/` exists) AND code
   changed this session: `graphify extract --update` per the **graphify** skill. No graph or
   docs-only session → skip silently; never build a graph from scratch here.

Skip anything already captured. End by listing the note(s) touched so it's clear what was saved.
For a heavier start/end-of-session pass across both memory layers, the **memory-orchestrator**
agent is the bigger hammer; this command is the quick manual save.

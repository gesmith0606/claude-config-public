---
name: knowledge-vault
description: >-
  Read from and write to the shared cross-project knowledge vault (the user's persistent
  "second brain" of Markdown notes). Use BEFORE implementing anything non-trivial ("what do I
  already know about X?") and AFTER meaningful work to save what was learned or decided —
  also whenever the user mentions the vault, remembering, or persisting knowledge across
  sessions or projects.
---

# Knowledge Vault

> **Routing:** for heavyweight start/end-of-session context loading and consolidation across BOTH memory layers (vault + graphify), spawn the `memory-orchestrator` agent instead of this skill.

A single shared Markdown vault that serves as durable memory across **all** repos. It is the
declarative-memory half of the system; [graphify](../graphify/SKILL.md) is the
code-structure half. Notes here outlive any one session or project and cross-link, so the
graph surfaces connections you'd otherwise forget.

## Vault location

```
<path from KNOWLEDGE_VAULT_PATH or ~/.claude/machine.json>
```

This path is the same regardless of which repo the session is running in — there is **one**
vault, shared. On a new machine, set `KNOWLEDGE_VAULT_PATH` or `~/.claude/machine.json` if the
vault is not in a standard location. Read/write notes with absolute paths.

## Layout

| Path | Holds |
|------|-------|
| `index.md` | Master catalog — the entry point; every note is linked here |
| `hot.md` | Recent-context cache — read FIRST, keep ~500 words |
| `log.md` | Append-only record of changes |
| `concepts/` | Atomic knowledge units — one idea per note |
| `entities/` | People, tools, orgs, services, datasets |
| `sources/` | Raw ingested material (articles, docs, papers) |
| `sessions/` | Work-session snapshots |
| `graphify/<repo>/` | Per-repo code knowledge graph (built by `/graphify`) |

## Note conventions

- Filenames `kebab-case.md`.
- Link with wikilinks `[[note-name]]`, not Markdown links. Aim for ≥2 links per note — dense
  linking is what makes the vault valuable. A `[[link]]` to a note that doesn't exist yet is
  fine; it marks something worth writing later.
- One concept per note in `concepts/`.
- Every note carries frontmatter:

  ```yaml
  ---
  title: Note Title
  tags: [project-name, topic]
  created: YYYY-MM-DD
  updated: YYYY-MM-DD
  type: concept | entity | source | session
  ---
  ```

## Operations

The skill supports four operations. Pick based on what the user is doing.

### 1. Query — "what do I already know about X?"

Run before implementing anything non-trivial, so you build on prior knowledge instead of
starting cold.

1. Read `hot.md` first (cheap, recent context).
2. Grep the vault for the topic across `concepts/ entities/ sources/ sessions/`.
3. Read the most relevant notes and follow their `[[wikilinks]]`.
4. Answer with citations to the note filenames. If nothing exists, say so plainly — that's a
   signal this is new territory worth a note once the work is done.

### 2. Save — record what was learned/decided

Run after meaningful work. Keep notes atomic and link them.

1. Decide the type (concept / entity / source / session) and the right folder.
2. Write the note with frontmatter + body, adding `[[wikilinks]]` to related notes.
3. Link the new note into `index.md` under the right section.
4. Update `hot.md` (add to "Now", let stale items drop) and append a dated line to `log.md`.
5. Before creating a new note, grep for an existing one on the same topic and update it
   instead of duplicating.

### 3. Ingest — pull an external source into the vault

For an article, doc, or paper the user wants captured:

1. Save the raw material under `sources/` (or use `graphify add <url>` for web content).
2. Extract the key concepts and entities into their own atomic notes, cross-linked back to
   the source note.
3. Update `index.md`, `hot.md`, `log.md`.

### 4. Lint — keep the vault healthy

On request ("lint the vault" / "check the brain"):

- Find orphan notes (not linked from `index.md` or any other note).
- Find dead `[[wikilinks]]` (point at non-existent notes).
- Flag notes missing frontmatter or with stale `updated` dates.
- Report findings; fix with the user's OK.

## Relationship to graphify

- **Code structure** (what calls what, where a function lives, architecture) → use
  `/graphify`, query the graph under `graphify/<repo>/`.
- **Durable knowledge** (decisions, lessons, domain facts, why something was done) → this
  vault.
- When graphify reveals something worth remembering (a surprising dependency, a "god node"),
  save a `concepts/` note about it so the insight survives even if the graph is rebuilt.

## Keep it lean

Don't over-record. Save what was non-obvious and worth recalling later — not things already
captured in code, git history, or a project's own docs. A vault full of low-value notes is
worse than a small one of sharp ones.

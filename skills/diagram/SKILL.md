---
name: diagram
description: >-
  Create technical diagrams-as-code (Mermaid by default) — architecture, flowcharts,
  sequence/state/ER/class/data-flow diagrams, mind maps, Gantt, C4 — embeddable in Markdown and
  exportable to SVG/PNG. Use whenever the user wants to visualize, draw, sketch, or illustrate a
  system, flow, process, schema, or set of relationships, even without the word "diagram."
---

# Diagram

> **Routing:** this is for HAND-AUTHORED diagrams of something described. For an auto-generated graph of an existing codebase use `graphify`; for visual UI design use `design`; for data charts use `dashboard`.

Produce clear technical diagrams as **text** (diagrams-as-code), not by drawing in a GUI. Text
diagrams are what an agent is genuinely good at, and they're versionable, diffable, and embed
directly in Markdown — they render natively in **Obsidian, GitHub, GitLab, VS Code, and most
Markdown viewers** with zero tooling. Default to **Mermaid**.

## Why Mermaid-first

- **Zero-dependency by default.** A Mermaid code block *is* the deliverable — it renders
  wherever Markdown renders. No install, no binary. (This pairs perfectly with the
  knowledge-vault: Obsidian renders Mermaid inline, so diagrams live inside notes.)
- **Agent-native.** You express structure as text; that's your strength. No pixel-dragging.
- **Reviewable.** It diffs cleanly in git, unlike a binary `.drawio`/`.png`.

Reach for an alternative only when Mermaid genuinely can't do the job — see *When to use
something else*.

## Workflow

1. **Pick the right diagram type** for what the user actually wants to show (table below). The
   most common mistake is forcing everything into a flowchart. Match the type to the intent.
2. **Write clean Mermaid.** Follow the conventions below — clarity beats completeness.
3. **Deliver the code block** by default. The user can paste it into Obsidian/GitHub/a `.md`
   and see it immediately.
4. **Export to a file only if asked** or if a standalone image is clearly needed (see
   *Rendering to SVG/PNG*).

## Choosing the diagram type

| Intent | Mermaid type |
|--------|-------------|
| Steps, decisions, a process or pipeline | `flowchart` (TD/LR) |
| Interactions/messages between actors over time | `sequenceDiagram` |
| System components and how they connect | `flowchart` with `subgraph` groups, or `C4Context` |
| Data model / database schema | `erDiagram` |
| Object model / types and relationships | `classDiagram` |
| Lifecycle / modes / a state machine | `stateDiagram-v2` |
| Project timeline / schedule | `gantt` |
| Hierarchy of ideas / brainstorm | `mindmap` |
| Quantities/proportions over categories | `pie`, `xychart-beta` |
| Git branch/merge history | `gitGraph` |
| User journey / steps with sentiment | `journey` |

Full per-type syntax and examples: **`references/mermaid-cheatsheet.md`** — read it when you
need the exact syntax for a type, or for less common features.

## Conventions for diagrams that read well

The difference between a clear diagram and a tangle is discipline, not detail:

- **Choose a direction deliberately.** `flowchart TD` (top-down) for processes/hierarchies;
  `LR` (left-right) for pipelines and timelines. Don't let it sprawl in a default direction.
- **Limit nodes.** If a diagram exceeds ~15–20 nodes it stops communicating. Group with
  `subgraph`, or split into multiple focused diagrams, rather than one giant mess.
- **Label edges** when the relationship isn't obvious (`A -->|publishes event| B`), not
  everywhere — only where it adds meaning.
- **Use shape to convey meaning** consistently — e.g. `{decision}` rhombus for branches,
  `[(database)]` for stores, `([rounded])` for start/end. Keep the vocabulary consistent
  within a diagram.
- **Group related nodes** in `subgraph` blocks with clear titles to show boundaries
  (services, layers, domains).
- **Order matters.** Lay out the flow in reading order (left→right / top→bottom) so arrows
  mostly point forward, not back across the diagram.
- **Name things in the user's domain**, not "Node1/Step2." A diagram should be self-explanatory.
- Keep styling light. A diagram earns clarity from structure, not from heavy colors. Add a
  little color (`classDef`) only to distinguish meaningful categories.

## Rendering to SVG/PNG (only when a file is needed)

The Mermaid code block is usually enough. When the user explicitly wants a standalone image
(a slide, a README asset, a PDF), render with Mermaid's official CLI — it's Node-based
(no `rsvg-convert`):

```bash
# write the diagram to diagram.mmd, then:
npx -y @mermaid-js/mermaid-cli -i diagram.mmd -o diagram.svg   # vector, preferred
npx -y @mermaid-js/mermaid-cli -i diagram.mmd -o diagram.png -s 2   # raster @2x
```

First run downloads a headless Chromium (one-time, ~heavy). Prefer **SVG** — it's crisp,
small, and embeds in Markdown/Obsidian. Only produce PNG when a raster is specifically
required. Validate the diagram renders without error before handing it over.

## When to use something else

Mermaid covers the vast majority of cases. Switch only when it genuinely falls short — see
`references/mermaid-cheatsheet.md` for details, but briefly:

- **Graphviz (DOT)** — large/dense graphs, dependency graphs, or when you need precise
  automatic layout control Mermaid can't give. Render with `dot -Tsvg`.
- **D2** — when you want a more polished modern look and are willing to install the `d2` tool.
- **PlantUML** — deep UML (component, deployment, detailed class) beyond Mermaid's UML subset.

Don't reach for these reflexively — the cost is tooling and lost portability. Mermaid's
in-Markdown rendering is worth a lot.

## Keep it about communication

A diagram exists to make something *understood faster than prose could*. If a diagram is
getting complicated enough that it no longer does that, that's the signal to split it,
simplify it, or step back and ask what single thing it needs to convey.

---
name: design
description: >-
  Create, redesign, audit, or polish the visual design of frontend UI — components, pages,
  dashboards, landing pages, artifacts, posters — so they look distinctive rather than generic
  "AI slop." Trigger when the user asks to build or improve how an interface looks, or calls a
  design generic, cheap, templated, bland, or AI-made. Entry points: craft, redesign, teach.
---

# Design

> **Routing:** visual/aesthetic quality only — not code-correctness review, backend/API/"system" design, or logo/brand-identity work. Deep animation/motion craft → `emil-design-eng`.

Build interfaces that look like a person with taste made deliberate choices — not like a model
emitted a safe default. The enemy is "AI slop": the centered hero, the three equal cards, the
purple-blue gradient, Inter everywhere, everything in a rounded box. This skill encodes the
principles and concrete rules that avoid that and produce work that feels intentional and
expensive.

## Modes

Pick based on the task (the user may name one, or infer it):

- **`craft`** — greenfield. Build a new component/page/app from scratch. → start at *Direction*.
- **`redesign`** — existing code. Audit what's there and fix it without breaking it. → jump to
  *Redesign mode* near the end.
- **`teach`** — capture design context before building. → see *Direction → context*.

## The one rule behind all the others

**Commit to a point of view.** Generic output comes from refusing to choose — hedging toward
the safe middle on every axis. Good design picks a direction (editorial? brutalist? soft and
expensive? technical and dense?) and pushes it consistently through type, color, space, and
motion. Before writing any CSS, decide what this should *feel* like, and let that decision
cascade. When in doubt, be more opinionated, not less.

A quick gut check before shipping — the **AI Slop Test**: *would someone look at this and
immediately assume an AI made it?* If yes, find the tells and kill them (see *Absolute bans*).

---

## Direction (do this first in `craft`/`teach`)

You cannot design well for a context you don't understand. Don't infer the audience or brand
from the code — ask. Get three things before committing to an aesthetic:

1. **Who/what** — the product, the audience, the one feeling it should evoke.
2. **Three brand words** — adjectives the user picks (e.g. "calm, precise, trustworthy"). These
   drive type and color far better than a generic "make it modern."
3. **Viewing context** — where it's used (dev tool at night → dark; wedding site → light/airy).
   *Derive* the theme from this rather than defaulting to dark mode reflexively.

In `teach` mode, write these into a `.design-context.md` at the project root so future sessions
inherit the decisions. If the user is impatient ("just make it look good"), pick a bold,
defensible direction yourself and state the call you made in one line.

---

## Typography

Type is the highest-leverage design decision and the most common AI tell.

- **Font choice = brand expression, not a default.** Translate the three brand words into a
  pairing. Don't reflexively reach for the current monoculture — **Inter, Geist, Space Grotesk,
  DM Sans, Roboto, Open Sans, Arial, Helvetica** and the like are not *wrong*, but they're so
  overused they read as "default." If you use one, do it deliberately and vary across projects.
  Prefer a pairing with a distinct display face for headings + a clean text face for body.
- **Scale with contrast.** Timid type (everything 14–18px) is slop. Use a real type scale with a
  decisive jump between body and headings (display can be 2–4× body). Set `line-height` tighter
  on headings (~1.05–1.2), looser on body (~1.5–1.6).
- **Body measure 65–75ch.** Wider is unreadable; full-width text is a tell.
- **Tighten tracking on large text**, leave body alone. Use real typographic characters
  (curly quotes, en/em dashes, × not x).

---

## Color & theme

- **Use OKLCH, not HSL.** It keeps perceived lightness consistent across hues. Reduce chroma at
  the extremes (very light/very dark) or colors turn neon or muddy.
- **Never pure `#000` or `#fff`.** Use a near-black tinted toward the brand hue and an off-white;
  pure black/white on screen is harsh and flat.
- **One accent, used sparingly.** A single saturated accent (desaturate it below ~80% so it
  isn't garish) carries more weight than a rainbow. **60-30-10** by *visual weight*: dominant
  neutral, secondary tone, 10% accent.
- **Tint your neutrals** toward the brand hue (a warm gray under a warm brand, etc.) — pure gray
  scales feel sterile.
- **Tint shadows** toward the background hue rather than using black-with-opacity.
- **Avoid the AI palette:** the purple→blue gradient ("Lila"), teal-on-dark, and the generic
  SaaS-violet. If you reach for purple-blue, stop and choose something the brand words justify.

---

## Layout & space

- **4pt spacing system with semantic tokens.** Define `--space-xs/sm/md/lg/...` on a 4px base and
  reference *those*, not magic numbers. Prefer `gap` on flex/grid over per-element margins.
- **Generous, intentional whitespace.** Cramped UIs feel cheap; let things breathe, but vary
  density so it's not uniform mush.
- **Break the grid.** Symmetry and dead-center everything is the slop default. Use asymmetry,
  off-center focal points, and deliberate alignment. A 12-col grid you actually break beats a
  3-equal-card row.
- **Don't box everything.** Cards are for when elevation communicates real hierarchy — not a
  reflex wrapper around every element. Use whitespace, dividers, and type to group instead.
- **Modern CSS for real layout:** `grid-template-columns: repeat(auto-fit, minmax(...))` for
  responsive grids, container queries so components adapt to their container (not just the
  viewport), `min-h-[100dvh]` not `100vh` (mobile browser chrome), `clamp()` for fluid type/space.

For named layout archetypes (Bento, editorial split, Z-axis cascade, etc.), see
`references/effect-catalog.md`.

---

## Surface & materiality

This is where "expensive" lives — the details most output skips.

- **Real glassmorphism** = `backdrop-blur` + a 1px inner border (subtle top-light) + a soft inner
  shadow. Just blur with no border looks cheap. Apply blur only on `fixed`/`sticky` elements,
  never on scrolling content (it thrashes performance).
- **Nested enclosures (the "double-bezel"):** an outer shell + an inner core with concentric
  radii — inner radius = outer radius − padding (`rounded-[calc(1.5rem-0.375rem)]`). This reads as
  crafted hardware. Pairs with "button-in-button" (a trailing icon chip inside a button).
- **Grain/noise**, if used, goes on one `fixed`, `pointer-events-none` overlay at low opacity —
  not per-component.
- **Depth through layering** (shadow + border + subtle background shift), not heavy drop shadows.

---

## Motion

Motion makes UI feel alive — but it's also where things go wrong fastest. The headline rules:

- **Animate `transform` and `opacity` only.** Never animate `top/left/width/height` — it's janky
  and non-composited. (This is the single most-violated rule in AI output.)
- **Custom easing, never the defaults.** No `linear`/`ease`/`ease-in-out`. Use an ease-out curve
  (fast start, soft landing) like `cubic-bezier(0.23, 1, 0.32, 1)` for most UI; springs for
  playful/physical motion.
- **`scale(0.97)` / `translateY(1px)` on `:active`** for tactile press feedback. Never enter from
  `scale(0)`.
- **Stagger** list/grid entries 30–80ms for a sense of choreography.
- **Respect `prefers-reduced-motion`** — reduce, don't necessarily remove.

**For anything beyond these basics — easing decision trees, gesture/drag physics, durations,
interruptible springs, clip-path techniques, building components like Sonner — defer to the
`emil-design-eng` skill.** It's the deep motion reference; don't reinvent it here.

---

## States & content

Half-built UIs skip these. Don't.

- **Every async surface needs loading / empty / error states.** Use skeletons that match the real
  layout, not centered spinners. Empty states should guide, not just say "no data."
- **Interactive elements need hover / focus-visible / active / disabled.** `:focus-visible` is not
  optional — it's accessibility.
- **Realistic content, never lorem/placeholder tells.** No "John Doe," "Acme Inc," "99.99%,"
  "Lorem ipsum," or buzzword copy ("Elevate," "Seamless," "Unlock"). Plausible names, real-looking
  numbers, copy a human would write. Fake content makes the whole thing read as a demo.
- **Clear CTA hierarchy** — one primary action per view, secondaries visibly subordinate.

---

## Absolute bans (match-and-refuse)

These specific patterns are AI tells. If you're about to emit one, stop and do it differently:

- **Side-stripe accent borders** — `border-left`/`border-right` thicker than 1px as a colored
  accent stripe on cards/alerts. Classic Bootstrap-era tell.
- **Gradient text** via `background-clip: text` — the purple→blue clipped-gradient headline is the
  single most recognizable AI-slop signature.
- **The generic three-equal-card feature row**, centered hero + subhead + two buttons, and
  everything-in-a-rounded-box. Not banned outright, but treat them as smells to justify or avoid.

---

## Dials (optional parametric control)

When the user wants to tune intensity, expose three dials (1–10); pick sensible defaults and let
them adjust:

- **VARIANCE** (default ~7) — how far from convention. Low = safe/corporate; high = experimental.
- **MOTION** (default ~5) — amount/intensity of animation. Low = subtle; high = lively.
- **DENSITY** (default ~4) — information per screen. Low = airy/editorial; high = dashboard-dense.

State the values you chose so the user can nudge them.

---

## Redesign mode (existing code)

When fixing existing UI, **work with the current stack — never rewrite from scratch.** Scan →
Diagnose → Fix.

1. **Scan** the existing design: fonts, colors, spacing, components, states, motion.
2. **Diagnose** against everything above — list the specific AI tells and gaps you find.
3. **Fix in priority order** (highest visual ROI first):
   1. Font swap (biggest single lever)
   2. Color/surface correction (kill #000, the AI gradient, untinted grays)
   3. Interactive states (hover/focus/active/loading/empty/error)
   4. Layout (break symmetry, fix spacing rhythm, de-box)
   5. Component polish (glass recipe, depth, nesting)
   6. Type polish (scale, measure, tracking)
   7. Motion (transform/opacity, custom easing)

Also check the **strategic omissions** that signal an unfinished product — these are easy wins
others miss: a real 404 page, skip-to-content link, `:focus-visible` everywhere, legal/footer
links, sensible `<title>`/meta tags, alt text, semantic HTML. Report findings as **before → after**
problem/fix pairs.

A full audit checklist and an upgrade-techniques catalog live in `references/effect-catalog.md`.

---

## References (load when relevant)

- `references/effect-catalog.md` — the named-effect arsenal (Bento, magnetic buttons, marquees,
  etc.), layout/vibe archetypes with concrete palettes, and the redesign audit checklist +
  upgrade techniques. Pull from here when you want specific named techniques rather than
  principles.
- `references/stack-engineering.md` — React/Next/Tailwind/Framer-specific engineering rules
  (RSC `'use client'` boundaries, Tailwind v3-vs-v4 guards, dependency verification before
  importing, icon-library policy, hardware-acceleration gotchas). **Only relevant for that stack**
  — ignore for vanilla CSS, Svelte, etc.
- The `emil-design-eng` skill — deep motion/animation/gesture craft. Defer to it for non-trivial
  motion.

## Keep it lean and intentional

Don't apply every rule mechanically — that's just a different kind of generic. Read the context,
commit to a direction, and let these principles serve *that* direction. The goal is work that
looks like a specific person made specific choices, not a checklist executed.

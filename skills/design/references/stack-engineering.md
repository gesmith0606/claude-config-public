# Stack Engineering Rules — React / Next / Tailwind / Framer Motion

> **APPLICABILITY: This file is ONLY relevant for React / Next.js / Tailwind / Framer Motion projects.** If the project is vanilla CSS, a non-React framework, or no JS framework at all, ignore this file — none of these mandates apply. These are concrete engineering rules, not general design principles. (For design technique/effect specifics see `effect-catalog.md`.)

Reference material loaded on-demand by the `design` skill. Extracted and deduped from `taste-skill` and `soft-skill`. This is a checklist an engineer would actually use — concrete class names, hooks, and gotchas preserved.

---

## Table of Contents

1. [Dependency Verification (do this first)](#1-dependency-verification-do-this-first)
2. [RSC / `'use client'` Boundary Rules](#2-rsc--use-client-boundary-rules)
3. [Tailwind v3-vs-v4 Detection & Config Guard](#3-tailwind-v3-vs-v4-detection--config-guard)
4. [Icon-Library Policy (and the conflict)](#4-icon-library-policy-and-the-conflict)
5. [Hardware Acceleration & Performance Gotchas](#5-hardware-acceleration--performance-gotchas)
6. [Scroll: IntersectionObserver / whileInView, never scroll listeners](#6-scroll-intersectionobserver--whileinview-never-scroll-listeners)
7. [Framer Motion Mandates](#7-framer-motion-mandates)
8. [Animation-Engine Choice & Isolation (Framer vs GSAP vs ThreeJS)](#8-animation-engine-choice--isolation)
9. [Layout / Responsiveness Engineering Mandates](#9-layout--responsiveness-engineering-mandates)
10. [Font conflict note (cross-skill)](#10-font-conflict-note-cross-skill)
11. [Pre-Flight Engineering Checklist](#11-pre-flight-engineering-checklist)

---

## 1. Dependency Verification (do this first)

**[MANDATORY]** Before importing ANY 3rd-party library (e.g. `framer-motion`, `lucide-react`, `zustand`), you MUST check `package.json`. If the package is missing, output the installation command (e.g. `npm install package-name`) **before** providing the code. **Never** assume a library exists.

- This applies to icon libraries, animation libraries, state libraries, and `shadcn/ui` alike.
- Corollary (from redesign audit): **no import hallucinations** — every import must exist in `package.json` / project dependencies.

---

## 2. RSC / `'use client'` Boundary Rules

Default to React Server Components (RSC). Next.js App Router assumed.

- **Global state works ONLY in Client Components.** In Next.js, wrap providers in a `"use client"` component.
- **Interactivity isolation:** If any Motion or Liquid-Glass interactive feature is active, the specific interactive UI component MUST be extracted as an **isolated leaf component with `'use client'` at the very top**. Server Components must exclusively render static layouts.
- **State management:** local `useState`/`useReducer` for isolated UI; global state strictly to avoid deep prop-drilling — not arbitrarily.
- **Stagger boundary trap:** For Framer `staggerChildren`, the Parent (`variants`) and Children MUST reside in the **identical Client Component tree**. If data is fetched asynchronously, pass the data as props into a centralized Parent Motion wrapper. (A server/client split between parent and child silently breaks stagger orchestration.)
- **Perpetual-motion isolation:** Any infinite/perpetual animation MUST be memoized (`React.memo`) and isolated in its own microscopic Client Component. Never trigger re-renders in the parent layout.

---

## 3. Tailwind v3-vs-v4 Detection & Config Guard

Use Tailwind CSS for ~90% of styling.

- **TAILWIND VERSION LOCK:** Check `package.json` FIRST. Do **not** use v4 syntax in a v3 project (and vice versa).
- **T4 CONFIG GUARD (v4 only):** Do NOT use the `tailwindcss` plugin in `postcss.config.js`. Use `@tailwindcss/postcss` or the Vite plugin instead.
- Redesign corollary: if upgrading an existing project that uses Tailwind, check the version before modifying any config.

---

## 4. Icon-Library Policy (and the conflict)

**Hard mandate (taste-skill):** You MUST use exactly `@phosphor-icons/react` or `@radix-ui/react-icons` as the import paths (check the installed version). Standardize `strokeWidth` globally (e.g., exclusively `1.5` or `2.0`).

**Banned / discouraged icon sets:**
- taste-skill: do NOT use standard "egg"/Lucide user icons for avatars.
- soft-skill: **banned** standard thick-stroked Lucide, FontAwesome, or Material Icons — use only ultra-light precise lines (Phosphor Light, Remix Line).
- redesign-skill: Lucide or Feather "exclusively" is the default AI choice — differentiate with Phosphor, Heroicons, or a custom set; standardize stroke widths; replace cliché metaphors (rocketship/shield).

**⚠ Conflict to be aware of:** The skills agree to avoid **Lucide / Feather / FontAwesome / Material** as defaults, but their *approved* lists differ:
- taste-skill is strict: ONLY Phosphor or Radix.
- soft-skill: Phosphor Light or Remix Line.
- redesign-skill: Phosphor, Heroicons, or custom.

Resolution guidance: **Phosphor is the common denominator across all three** — prefer it. Radix icons are the secondary safe choice (taste-skill). Heroicons/Remix are acceptable per soft/redesign but are NOT on taste-skill's strict allowlist, so use them only when taste-skill's strictness isn't in force. Whatever you pick, always verify it's in `package.json` first (§1) and standardize stroke width globally.

**Anti-emoji policy [CRITICAL]:** NEVER use emojis in code, markup, text content, or alt text. Replace symbols with high-quality icons (Radix, Phosphor) or clean SVG primitives.

---

## 5. Hardware Acceleration & Performance Gotchas

- **Animate only `transform` and `opacity`.** NEVER animate `top`, `left`, `width`, or `height` — they trigger layout/reflow and are not GPU-accelerated.
  - For height animations specifically, prefer `grid-template-rows` transitions over animating `height` directly.
- **Framer `x`/`y` caveat:** Framer Motion's `x`/`y` motion props map to `transform` and ARE accelerated — but animating `width`/`height`/`top`/`left` through any means is not. Stay on `transform`/`opacity`.
- **`will-change: transform`** — use sparingly, and only on elements that are actively animating. Over-applying it wastes GPU memory.
- **CSS variable inheritance trap:** CSS custom properties inherit down the tree — animating a CSS var on a parent re-resolves it on every descendant that consumes it, which can cause wide repaints. Scope animated CSS vars tightly to the element that uses them; don't animate an inherited var high in the tree.
- **`backdrop-blur` constraints:** Apply `backdrop-blur` ONLY to fixed or sticky elements (navbars, overlays, modals, tooltips). NEVER apply blur filters to scrolling containers or large content areas — it causes continuous GPU repaints and severe mobile frame drops.
- **Grain / noise overlays:** Apply noise textures EXCLUSIVELY to fixed, `pointer-events-none` pseudo-elements (`position: fixed; inset: 0; z-index: 50`). NEVER attach them to scrolling containers (continuous GPU repaint).
- **Z-index discipline:** Do NOT spam arbitrary `z-50` or `z-[9999]`. Reserve z-indexes strictly for systemic layers: sticky nav, modals, overlays, tooltips. Establish a clean scale rather than ad-hoc values.

---

## 6. Scroll: IntersectionObserver / whileInView, never scroll listeners

- **NEVER use `window.addEventListener('scroll')`** for reveals/parallax — it causes continuous reflows and kills mobile performance.
- For JS-driven scroll reveals, use **`IntersectionObserver`** or **Framer Motion's `whileInView`**.
- For advanced choreography (MOTION_INTENSITY 8–10 in taste-skill terms): complex scroll-triggered reveals/parallax use Framer Motion hooks — still never raw scroll listeners.

---

## 7. Framer Motion Mandates

- **Magnetic hover / continuous animations:** NEVER use React `useState` (it re-renders every frame and collapses mobile performance). Use EXCLUSIVELY Framer Motion's `useMotionValue` and `useTransform`, kept **outside the React render cycle**.
- **Spring physics everywhere:** No linear easing on interactive elements. Use `type: "spring", stiffness: 100, damping: 20` for a premium, weighty feel.
- **Layout transitions:** Use the `layout` and `layoutId` props for smooth re-ordering, resizing, and shared-element transitions across state changes.
- **Staggered orchestration:** Don't mount lists/grids instantly. Use `staggerChildren` (Framer) or a CSS cascade (`animation-delay: calc(var(--index) * 100ms)`). See the §2 boundary trap — parent variants + children must be in the same Client Component tree.
- **`<AnimatePresence>`:** Wrap dynamic lists/exiting elements in `<AnimatePresence>`; optimize for 60fps.
- **Easing (CSS-side, soft-skill):** For non-Framer transitions, use custom cubic-beziers (e.g. `transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)]`), never `linear`/`ease-in-out`. (Note: impeccable's general guidance additionally warns against bounce/elastic easing as dated — real objects decelerate smoothly.)

---

## 8. Animation-Engine Choice & Isolation

- **Default engine:** Framer Motion for UI / Bento / component interactions.
- **GSAP (ScrollTrigger / Parallax):** use for complex scrolltelling.
- **ThreeJS / WebGL:** use for 3D / canvas backgrounds.
- **CRITICAL — never mix engines in one component tree:** Do NOT mix GSAP/ThreeJS with Framer Motion in the same component tree. Use GSAP/ThreeJS EXCLUSIVELY for isolated full-page scrolltelling or canvas backgrounds.
- **Cleanup:** Wrap all GSAP/ThreeJS work in strict `useEffect` cleanup blocks (return a teardown function — kill timelines, dispose geometries/materials, remove listeners).

---

## 9. Layout / Responsiveness Engineering Mandates

- **Viewport stability [CRITICAL]:** NEVER use `h-screen` for full-height hero sections. ALWAYS use `min-h-[100dvh]` to prevent catastrophic layout jumping on mobile browsers (iOS Safari).
- **Grid over flex-math:** NEVER use complex flexbox percentage math (`w-[calc(33%-1rem)]`). ALWAYS use CSS Grid (`grid grid-cols-1 md:grid-cols-3 gap-6`) for reliable structures.
- **Container constraint:** Contain page layouts with `max-w-[1400px] mx-auto` or `max-w-7xl`.
- **Standardized breakpoints:** `sm`, `md`, `lg`, `xl`.
- **Mobile collapse for high-variance layouts:** Any asymmetric layout above `md:` MUST aggressively fall back to single-column (`w-full`, `px-4`, `py-8`) below `768px`. Remove rotations/negative-margin overlaps on mobile (they cause touch-target conflicts).
- **shadcn/ui:** You may use it, but NEVER in its generic default state — customize radii, colors, and shadows to match the project aesthetic.
- **Placeholders:** Never use Unsplash (links break). Use reliable sources like `https://picsum.photos/seed/{random_string}/800/600` or SVG UI Avatars.

---

## 10. Font conflict note (cross-skill)

This is an engineering-relevant note because the chosen font stack drives `@font-face`/`next/font` loading. The source skills **conflict** on which fonts to use — surface this rather than picking silently:

- **taste-skill / redesign-skill:** ban `Inter`; recommend `Geist`, `Outfit`, `Cabinet Grotesk`, `Satoshi`. Technical/dashboard UIs use Sans pairings like `Geist` + `Geist Mono` or `Satoshi` + `JetBrains Mono`. Serif banned on dashboards.
- **soft-skill:** bans `Inter`, `Roboto`, `Arial`, `Open Sans`, **and `Helvetica`**; assumes `Geist`, `Clash Display`, `PP Editorial New`, or `Plus Jakarta Sans`.
- **impeccable (the primary skill):** explicitly **rejects the Geist-family, `Outfit`, and `Plus Jakarta Sans`** (among others) as overused reflex defaults, and runs a font-selection *procedure* instead of a fixed allowlist.

**⚠ Direct contradiction:** taste-skill/soft-skill *recommend* `Geist`/`Outfit`/`Plus Jakarta Sans`; impeccable *bans* them. When the consolidated `design` skill is driving (impeccable-primary), impeccable's procedure and ban list win — treat the taste/soft font recommendations as "not Inter, but also not these specific fallbacks." Do not silently default to Geist.

---

## 11. Pre-Flight Engineering Checklist

Run before outputting code (merged from taste-skill §10 and soft-skill §8, engineering items only):

- [ ] Every imported library is verified present in `package.json` (or an install command was emitted).
- [ ] Tailwind version (v3 vs v4) was checked; no v4 syntax in v3; v4 uses `@tailwindcss/postcss` not the `tailwindcss` postcss plugin.
- [ ] Interactive/Motion/glass components are isolated leaf Client Components (`'use client'` at top); Server Components render static layouts only.
- [ ] Global state used only to avoid deep prop-drilling — not arbitrarily — and only in Client Components.
- [ ] `staggerChildren` parent variants + children live in the same Client Component tree.
- [ ] Full-height sections use `min-h-[100dvh]`, never `h-screen`.
- [ ] All animations use only `transform` and `opacity` — no `top`/`left`/`width`/`height`.
- [ ] No `window.addEventListener('scroll')` — uses `IntersectionObserver` or `whileInView`.
- [ ] Magnetic/continuous animations use `useMotionValue`/`useTransform`, never `useState`.
- [ ] `backdrop-blur` only on fixed/sticky elements; noise overlays only on fixed `pointer-events-none` pseudo-elements.
- [ ] CPU-heavy perpetual animations are `React.memo`-isolated in their own Client Components.
- [ ] All `useEffect` animations (esp. GSAP/ThreeJS) have strict cleanup functions.
- [ ] GSAP/ThreeJS and Framer Motion are NOT mixed in the same component tree.
- [ ] Icons come from Phosphor (or Radix) — verified in `package.json`, stroke width standardized globally; no emojis.
- [ ] Empty, loading (skeleton, not spinner), and error (inline, not `alert()`) states are present.
- [ ] z-index used only for systemic layers; no arbitrary `z-[9999]`.

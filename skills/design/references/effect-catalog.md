# Effect Catalog — Named Techniques, Archetypes & Audit Reference

Reference material loaded on-demand by the `design` skill. This is the "reach-for-it" catalog of **concrete, named design techniques** — the specific effects, archetypes, structural patterns, and audit checklists a designer pulls from when general principles aren't enough. Concrete values (hex codes, Tailwind class names, timings, easing curves) are preserved exactly. Do not water them down.

Consolidated and deduped from: `taste-skill`, `soft-skill`, `redesign-skill`.

> **Stack note:** Many techniques below reference React / Tailwind / Framer Motion / GSAP. The *idea* of each effect is stack-agnostic, but the implementation specifics assume that stack. For the engineering rules (RSC boundaries, Tailwind version guards, dependency verification, hardware acceleration), see the companion file `stack-engineering.md`.

---

## Table of Contents

1. [Named Effect Arsenal](#1-named-effect-arsenal)
   - 1.1 [Navigation & Menus](#11-navigation--menus)
   - 1.2 [Layout & Grids](#12-layout--grids)
   - 1.3 [Cards & Containers](#13-cards--containers)
   - 1.4 [Scroll Animations](#14-scroll-animations)
   - 1.5 [Galleries & Media](#15-galleries--media)
   - 1.6 [Typography & Text](#16-typography--text)
   - 1.7 [Micro-Interactions & Effects](#17-micro-interactions--effects)
2. [Vibe & Layout Archetypes](#2-vibe--layout-archetypes)
   - 2.1 [Vibe & Texture Archetypes (with hex palettes)](#21-vibe--texture-archetypes)
   - 2.2 [Layout Archetypes (with mobile-collapse rules)](#22-layout-archetypes)
   - 2.3 [Universal mobile override](#23-universal-mobile-override)
3. [Nested-Enclosure Techniques](#3-nested-enclosure-techniques)
   - 3.1 [The Double-Bezel (Doppelrand)](#31-the-double-bezel-doppelrand)
   - 3.2 [Button-in-Button / Island CTA](#32-button-in-button--island-cta)
   - 3.3 [Spatial rhythm details (eyebrow tags, whitespace)](#33-spatial-rhythm-details)
4. [The Motion-Engine Bento Paradigm](#4-the-motion-engine-bento-paradigm)
5. [Redesign Audit Checklist (AI Tells by Category)](#5-redesign-audit-checklist-ai-tells-by-category)
6. [Upgrade Techniques Library](#6-upgrade-techniques-library)
7. [Fix Priority Order](#7-fix-priority-order)

---

## 1. Named Effect Arsenal

The library of advanced, named concepts to pull from instead of defaulting to generic UI. Each entry: what it is + when to reach for it.

**Engine guidance (from taste-skill):** Default to Framer Motion for UI/Bento interactions. Use **GSAP (ScrollTrigger/Parallax)** for complex scrolltelling and **ThreeJS/WebGL** for 3D/canvas backgrounds. **CRITICAL:** Never mix GSAP/ThreeJS with Framer Motion in the same component tree. Use GSAP/ThreeJS EXCLUSIVELY for isolated full-page scrolltelling or canvas backgrounds, wrapped in strict `useEffect` cleanup blocks.

### 1.1 Navigation & Menus

| Effect | What it is / when to use |
|--------|--------------------------|
| **Mac OS Dock Magnification** | Nav-bar at the edge; icons scale fluidly on hover. Use for icon-heavy toolbars/docks. |
| **Magnetic Button** | A button that physically pulls toward the cursor. Premium CTA accent — use sparingly on hero/primary actions. |
| **Gooey Menu** | Sub-items detach from a main button like a viscous liquid. Playful FAB/menu reveal. |
| **Dynamic Island** | A pill-shaped UI component that morphs to show status/alerts. Status surface that consolidates notifications. |
| **Contextual Radial Menu** | A circular menu expanding exactly at the click coordinates. Right-click / long-press context actions. |
| **Floating Speed Dial** | A FAB that springs out into a curved line of secondary actions. Mobile primary-action clusters. |
| **Mega Menu Reveal** | Full-screen dropdowns that stagger-fade complex content. Large-IA marketing/commerce nav. |
| **Fluid Island Nav + Hamburger Morph** | Floating glass pill nav detached from top (`mt-6 mx-auto w-max rounded-full`); on click the hamburger lines fluidly rotate/translate into an `X` (`rotate-45`/`-rotate-45`), opening a screen-filling glass overlay (`backdrop-blur-3xl bg-black/80` or `bg-white/80`). |

### 1.2 Layout & Grids

| Effect | What it is / when to use |
|--------|--------------------------|
| **Bento Grid** | Asymmetric, tile-based grouping (e.g., Apple Control Center). Default for modern SaaS feature sections. See §4. |
| **Masonry Layout** | Staggered grid without fixed row heights (e.g., Pinterest). Variable-length content (galleries, cards). |
| **Chroma Grid** | Grid borders/tiles showing subtle, continuously animating color gradients. Decorative grids that need life. |
| **Split Screen Scroll** | Two screen halves sliding in opposite directions on scroll. High-impact editorial transitions. |
| **Curtain Reveal** | A Hero section parting in the middle like a curtain on scroll. Cinematic intro. |

### 1.3 Cards & Containers

| Effect | What it is / when to use |
|--------|--------------------------|
| **Parallax Tilt Card** | A 3D-tilting card tracking mouse coordinates. Feature/product highlight cards. |
| **Spotlight Border Card** | Card borders that illuminate dynamically under the cursor. Grids of cards on dark backgrounds. |
| **Glassmorphism Panel** | True frosted glass with inner refraction borders (see §3 / Surface Upgrades). Overlays, nav, floating panels. |
| **Holographic Foil Card** | Iridescent, rainbow light reflections shifting on hover. Collectible/premium "special" items. |
| **Tinder Swipe Stack** | A physical stack of cards the user can swipe away. Decision/triage UIs. |
| **Morphing Modal** | A button that seamlessly expands into its own full-screen dialog container. Replaces jarring modal pop-ins. |

### 1.4 Scroll Animations

| Effect | What it is / when to use |
|--------|--------------------------|
| **Sticky Scroll Stack** | Cards that stick to the top and physically stack over each other. Process/story sections. |
| **Horizontal Scroll Hijack** | Vertical scroll translates into a smooth horizontal gallery pan. Galleries, timelines. |
| **Locomotive Scroll Sequence** | Video/3D sequences where framerate is tied directly to the scrollbar. Product reveals (use GSAP/canvas). |
| **Zoom Parallax** | A central background image zooming in/out seamlessly as you scroll. Hero-to-content transitions. |
| **Scroll Progress Path** | SVG vector lines/routes that draw themselves as the user scrolls. Journey/roadmap storytelling. |
| **Liquid Swipe Transition** | Page transitions wiping the screen like a viscous liquid. App-like page changes. |

### 1.5 Galleries & Media

| Effect | What it is / when to use |
|--------|--------------------------|
| **Dome Gallery** | A 3D gallery feeling like a panoramic dome. Immersive portfolio/showcase. |
| **Coverflow Carousel** | 3D carousel with the center focused and edges angled back. Media browsing (albums, covers). |
| **Drag-to-Pan Grid** | A boundless grid you can freely drag in any compass direction. Map-like / canvas exploration. |
| **Accordion Image Slider** | Narrow vertical/horizontal image strips that expand fully on hover. Compact multi-image showcase. |
| **Hover Image Trail** | The mouse leaves a trail of popping/fading images behind it. Playful landing/portfolio backgrounds. |
| **Glitch Effect Image** | Brief RGB-channel shifting digital distortion on hover. Tech/edgy brand accents. |

### 1.6 Typography & Text

| Effect | What it is / when to use |
|--------|--------------------------|
| **Kinetic Marquee** | Endless text bands that reverse direction or speed up on scroll. Brand/word emphasis bands. |
| **Text Mask Reveal** | Massive typography acting as a transparent window to a video/animated background. Hero statements. |
| **Text Scramble Effect** | Matrix-style character decoding on load or hover. Tech/hacker accents, loading text. |
| **Circular Text Path** | Text curved along a spinning circular path. Badges, seals, decorative accents. |
| **Gradient Stroke Animation** | Outlined text with a gradient continuously running along the stroke. (Note: *stroke*, not gradient fill — gradient text *fill* is banned, see §5.) |
| **Kinetic Typography Grid** | A grid of letters dodging/rotating away from the cursor. Interactive hero playgrounds. |
| **Variable Font Animation** | Interpolate weight or width on scroll/hover so text feels alive. Headlines, editorial. |
| **Outlined-to-Fill Transition** | Text starts as a stroke outline and fills with color on scroll entry/interaction. Section headers. |

### 1.7 Micro-Interactions & Effects

| Effect | What it is / when to use |
|--------|--------------------------|
| **Particle Explosion Button** | CTAs that shatter into particles upon success. Celebratory confirmations. |
| **Liquid Pull-to-Refresh** | Mobile reload indicator behaving like a detaching water droplet. Mobile lists/feeds. |
| **Skeleton Shimmer** | Shifting light reflection moving across placeholder boxes. Loading states (preferred over spinners). |
| **Directional Hover-Aware Button** | Hover fill enters from the exact side the mouse entered. Premium button polish. |
| **Ripple Click Effect** | Visual waves rippling precisely from the click coordinates. Material-style tactile feedback. |
| **Animated SVG Line Drawing** | Vectors that draw their own contours in real time. Logos, diagrams, illustrations. |
| **Mesh Gradient Background** | Organic, lava-lamp-like animated color blobs. Ambient depth behind content. |
| **Lens Blur Depth** | Dynamic focus blur on background UI layers to highlight a foreground action. Modal/focus emphasis. |
| **Liquid Glass Refraction** | Glassmorphism beyond `backdrop-blur`: 1px inner border (`border-white/10`) + subtle inner shadow (`shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]`) to simulate physical edge refraction. |
| **Magnetic Micro-physics** | Buttons pull slightly toward the mouse cursor. CRITICAL: never via React `useState` — use Framer Motion `useMotionValue`/`useTransform` outside the render cycle (see stack-engineering.md). |
| **Perpetual Micro-Interactions** | Continuous infinite micro-animations embedded in standard components (Pulse, Typewriter, Float, Shimmer, Carousel) on avatars, status dots, backgrounds. Use Spring Physics `type: "spring", stiffness: 100, damping: 20`. |

---

## 2. Vibe & Layout Archetypes

From `soft-skill`'s Creative Variance Engine. Before building, "roll the dice": pick **one Vibe archetype** and **one Layout archetype** based on the prompt context, so output is uniquely tailored but always premium. Never generate the same layout/aesthetic twice in a row.

### 2.1 Vibe & Texture Archetypes

Pick 1. Concrete palettes preserved.

**1. Ethereal Glass** — *SaaS / AI / Tech*
- Background: deepest OLED black `#050505`.
- Radial mesh gradients (subtle glowing purple/emerald orbs) in the background.
- Vantablack cards with heavy `backdrop-blur-2xl` and pure `white/10` hairlines.
- Typography: wide geometric Grotesk.

**2. Editorial Luxury** — *Lifestyle / Real Estate / Agency*
- Background: warm creams `#FDFBF7`, muted sage, or deep espresso tones.
- High-contrast variable Serif fonts for massive headings.
- Subtle CSS noise / film-grain overlay (`opacity-[0.03]`) for a physical paper feel.

**3. Soft Structuralism** — *Consumer / Health / Portfolio*
- Background: silver-grey or completely white.
- Massive bold Grotesk typography.
- Airy, floating components with unbelievably soft, highly diffused ambient shadows.

### 2.2 Layout Archetypes

Pick 1. Each includes its mobile-collapse rule.

**1. The Asymmetrical Bento**
- A masonry-like CSS Grid of varying card sizes (e.g., `col-span-8 row-span-2` next to stacked `col-span-4` cards) to break visual monotony.
- **Mobile Collapse:** Falls back to single-column stack (`grid-cols-1`) with generous vertical gaps (`gap-6`). All `col-span` overrides reset to `col-span-1`.

**2. The Z-Axis Cascade**
- Elements stacked like physical cards, slightly overlapping at varying depths of field, some with a subtle `-2deg` or `3deg` rotation to break the digital grid.
- **Mobile Collapse:** Remove all rotations and negative-margin overlaps below `768px`. Stack vertically with standard spacing. (Overlapping elements cause touch-target conflicts on mobile.)

**3. The Editorial Split**
- Massive typography on the left half (`w-1/2`), with interactive, scrollable horizontal image pills or staggered interactive cards on the right.
- **Mobile Collapse:** Converts to full-width vertical stack (`w-full`). Typography block sits on top, interactive content flows below — horizontal scroll preserved if needed.

### 2.3 Universal mobile override

Any asymmetric layout above `md:` MUST aggressively fall back to `w-full`, `px-4`, `py-8` on viewports below `768px` (prevents horizontal scroll / layout breakage). Never use `h-screen` for full-height sections — always `min-h-[100dvh]` to prevent iOS Safari viewport jumping.

> Note (taste-skill parallel): taste-skill states the same mobile override for its DESIGN_VARIANCE levels 4–10 — asymmetric layouts above `md:` collapse to strict single-column (`w-full`, `px-4`, `py-8`) below `768px`.

---

## 3. Nested-Enclosure Techniques

The "machined hardware" component language from `soft-skill`. Makes containers look like physical objects (a glass plate sitting in an aluminum tray) rather than flat rectangles.

### 3.1 The Double-Bezel (Doppelrand)

Never place a premium card, image, or container flatly on the background. Use **nested enclosures**:

- **Outer Shell:** A wrapper `div` with:
  - subtle background: `bg-black/5` or `bg-white/5`
  - hairline outer border: `ring-1 ring-black/5` or `border border-white/10`
  - specific padding: `p-1.5` or `p-2`
  - large outer radius: `rounded-[2rem]`
- **Inner Core:** The actual content container inside the shell, with:
  - its own distinct background color
  - its own inner highlight: `shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)]`
  - a mathematically smaller radius for concentric curves: `rounded-[calc(2rem-0.375rem)]`

### 3.2 Button-in-Button / Island CTA

- **Structure:** Primary interactive buttons are fully rounded pills (`rounded-full`) with generous padding (`px-6 py-3`).
- **The "Button-in-Button" Trailing Icon:** An arrow (`↗`) NEVER sits naked next to the text. Nest it inside its own distinct circular wrapper: `w-8 h-8 rounded-full bg-black/5 dark:bg-white/10 flex items-center justify-center`, placed flush with the main button's right inner padding.
- **Hover physics (Magnetic Button):** Use the `group` utility. On hover: scale the whole button down slightly (`active:scale-[0.98]`) to simulate physical press; the nested inner icon circle translates diagonally (`group-hover:translate-x-1 group-hover:-translate-y-[1px]`) and scales up (`scale-105`) for internal kinetic tension.

### 3.3 Spatial rhythm details

- **Macro-Whitespace:** Double standard padding. Use `py-24` to `py-40` for sections; let the design breathe heavily.
- **Eyebrow Tags:** Precede major H1/H2s with a microscopic pill badge: `rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.2em] font-medium`.
- **Motion easing (soft-skill default):** Never use default transitions. Use custom cubic-beziers, e.g. `transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)]`. For scroll entry: gentle heavy fade-up `translate-y-16 blur-md opacity-0` → `translate-y-0 blur-0 opacity-100` over 800ms+.
- **Staggered Mask Reveal (nav links):** Links fade in and slide up from an invisible box (`translate-y-12 opacity-0` → `translate-y-0 opacity-100`) with staggered delays (`delay-100`, `delay-150`, `delay-200`).

---

## 4. The Motion-Engine Bento Paradigm

From `taste-skill` §9. "Bento 2.0" — a Vercel-core meets Dribbble-clean aesthetic reliant on perpetual physics. Use for modern SaaS dashboards / feature sections.

### A. Core design philosophy
- **Aesthetic:** High-end, minimal, functional.
- **Palette:** Background `#f9fafb`. Cards pure white `#ffffff` with a 1px border of `border-slate-200/50`.
- **Surfaces:** `rounded-[2.5rem]` for all major containers. Apply a "diffusion shadow" (very light, wide-spreading): `shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)]`.
- **Typography:** Strict `Geist`, `Satoshi`, or `Cabinet Grotesk` stack; subtle `tracking-tight` on headers.
- **Labels:** Titles/descriptions placed **outside and below** cards for a gallery-style presentation.
- **Padding:** Generous `p-8` or `p-10` inside cards.

### B. Animation engine specs (perpetual motion)
- **Spring Physics:** No linear easing — `type: "spring", stiffness: 100, damping: 20`.
- **Layout Transitions:** Heavily use `layout` and `layoutId` props for re-ordering, resizing, shared-element transitions.
- **Infinite Loops:** Every card has an "Active State" that loops infinitely (Pulse, Typewriter, Float, or Carousel) so the dashboard feels "alive".
- **Performance:** Wrap dynamic lists in `<AnimatePresence>`, target 60fps. Any perpetual motion MUST be memoized (`React.memo`) and isolated in its own microscopic Client Component — never re-render the parent layout.

### C. The 5-card archetypes (micro-animation specs)
Layout example: Row 1 = 3 cols | Row 2 = 2 cols split 70/30.
1. **The Intelligent List** — Vertical stack with an infinite auto-sorting loop; items swap positions via `layoutId`, simulating an AI prioritizing tasks in real time.
2. **The Command Input** — Search/AI bar with multi-step Typewriter Effect cycling through complex prompts, blinking cursor, and a "processing" state with a shimmering loading gradient.
3. **The Live Status** — Scheduling interface with "breathing" status indicators; a pop-up notification badge emerges with an "Overshoot" spring, stays 3s, then vanishes.
4. **The Wide Data Stream** — Horizontal "Infinite Carousel" of data cards/metrics; seamless loop via `x: ["0%", "-100%"]` at an effortless speed.
5. **The Contextual UI (Focus Mode)** — Document view animating a staggered highlight of a text block, followed by a "Float-in" of a floating action toolbar with micro-icons.

---

## 5. Redesign Audit Checklist (AI Tells by Category)

From `redesign-skill`. The full catalog of generic AI patterns to find and fix when auditing existing UI. Workflow: **Scan** the codebase (framework, styling method, patterns) → **Diagnose** against this list → **Fix** with targeted upgrades on the existing stack (do not rewrite from scratch).

### Typography
- **Browser default fonts or Inter everywhere** → replace with a font with character: `Geist`, `Outfit`, `Cabinet Grotesk`, `Satoshi`. (For editorial/creative, pair a serif header with a sans body.)
- **Headlines lack presence** → increase size for display text, tighten letter-spacing, reduce line-height; make headlines heavy and intentional.
- **Body text too wide** → limit paragraph width to ~65 characters; increase line-height.
- **Only Regular (400) and Bold (700) used** → introduce Medium (500) and SemiBold (600) for subtle hierarchy.
- **Numbers in proportional font** → use monospace or `font-variant-numeric: tabular-nums` for data-heavy UI.
- **Missing letter-spacing adjustments** → negative tracking for large headers, positive tracking for small caps/labels.
- **All-caps subheaders everywhere** → try lowercase italics, sentence case, or small-caps.
- **Orphaned words** (single word on last line) → fix with `text-wrap: balance` or `text-wrap: pretty`.

### Color and Surfaces
- **Pure `#000000` background** → off-black / dark charcoal / tinted dark (`#0a0a0a`, `#121212`, or dark navy).
- **Oversaturated accent colors** → keep saturation < 80%; desaturate so accents blend with neutrals.
- **More than one accent color** → pick one, remove the rest.
- **Mixing warm and cool grays** → stick to one gray family; tint all grays with a consistent hue.
- **Purple/blue "AI gradient" aesthetic** → the most common AI fingerprint; replace with neutral bases + a single considered accent.
- **Generic `box-shadow`** → tint shadows to match background hue (e.g., dark-blue shadow on a blue background) instead of pure black at low opacity.
- **Flat design with zero texture** → add subtle noise, grain, or micro-patterns.
- **Perfectly even gradients** → break uniformity with radial gradients, noise overlays, or mesh gradients instead of 45° linear fades.
- **Inconsistent lighting direction** → audit shadows to suggest one consistent light source.
- **Random dark section in a light page (or vice versa)** → commit to a full mode, or use a slightly darker shade of the same palette — never a sudden jump to `#111` mid-page.
- **Empty, flat sections with no depth** → add high-quality background imagery (blurred/overlaid/masked), subtle patterns, or ambient gradients. Reliable placeholder: `https://picsum.photos/seed/{name}/1920/1080`.

### Layout
- **Everything centered and symmetrical** → break symmetry with offset margins, mixed aspect ratios, left-aligned headers over centered content.
- **Three equal card columns as feature row** → the most generic AI layout; replace with 2-column zig-zag, asymmetric grid, horizontal scroll, or masonry.
- **`height: 100vh` for full-screen sections** → use `min-height: 100dvh` (iOS Safari viewport bug).
- **Complex flexbox percentage math** → use CSS Grid for reliable multi-column structures.
- **No max-width container** → add a constraint (~1200–1440px) with auto margins.
- **Cards forced to equal height by flexbox** → allow variable heights or use masonry.
- **Uniform border-radius on everything** → vary it: tighter on inner elements, softer on containers.
- **No overlap or depth** → use negative margins to create layering.
- **Symmetrical vertical padding** → adjust optically; bottom padding often needs to be slightly larger.
- **Dashboard always has a left sidebar** → try top nav, floating command menu, or collapsible panel.
- **Missing whitespace** → double the spacing; let it breathe (dense layouts are for data dashboards, not marketing).
- **Buttons not bottom-aligned in card groups** → pin CTAs to the bottom so they form a clean horizontal line.
- **Feature lists starting at different vertical positions** → align list start Y across columns (fixed-height title/price blocks).
- **Inconsistent vertical rhythm in side-by-side elements** → align shared elements (titles, descriptions, prices, buttons) across items.
- **Mathematical alignment that looks optically wrong** → icons next to text, play buttons in circles, text in buttons often need 1–2px optical nudges.

### Interactivity and States
- **No hover states on buttons** → add background shift, slight scale, or translate.
- **No active/pressed feedback** → `scale(0.98)` or `translateY(1px)` on press.
- **Instant transitions with zero duration** → add 200–300ms transitions to interactive elements.
- **Missing focus ring** → visible focus indicators for keyboard nav (accessibility requirement).
- **No loading states** → replace circular spinners with skeleton loaders matching layout shape.
- **No empty states** → design a composed "getting started" view.
- **No error states** → clear inline error messages for forms; never `window.alert()`.
- **Dead links** (buttons linking to `#`) → link to real destinations or visually disable.
- **No indication of current page in nav** → style the active link.
- **Scroll jumping** → add `scroll-behavior: smooth`.
- **Animations using `top`, `left`, `width`, `height`** → switch to `transform` and `opacity`.

### Content (the "Jane Doe" Effect)
- **Generic names** ("John Doe", "Jane Smith") → diverse, realistic names.
- **Fake round numbers** (`99.99%`, `50%`, `$100.00`) → organic messy data: `47.2%`, `$99.00`, `+1 (312) 847-1928`.
- **Placeholder company names** ("Acme Corp", "Nexus", "SmartFlow") → contextual believable brand names.
- **AI copywriting clichés** → never "Elevate", "Seamless", "Unleash", "Next-Gen", "Game-changer", "Delve", "Tapestry", "In the world of...". Write plain, specific language.
- **Exclamation marks in success messages** → remove; be confident, not loud.
- **"Oops!" error messages** → be direct: "Connection failed. Please try again."
- **Passive voice** → active: "We couldn't save your changes."
- **All blog post dates identical** → randomize.
- **Same avatar for multiple users** → unique assets per person.
- **Lorem Ipsum** → never; write real draft copy.
- **Title Case On Every Header** → use sentence case.

### Component Patterns
- **Generic card look** (border + shadow + white background) → remove border, or use only background color, or only spacing. Cards exist only when elevation communicates hierarchy.
- **Always one filled + one ghost button** → add text links or tertiary styles to reduce noise.
- **Pill-shaped "New"/"Beta" badges** → try square badges, flags, or plain text labels.
- **Accordion FAQ sections** → side-by-side list, searchable help, or inline progressive disclosure.
- **3-card carousel testimonials with dots** → masonry wall, embedded social posts, or single rotating quote.
- **Pricing table with 3 towers** → highlight recommended tier with color/emphasis, not just extra height.
- **Modals for everything** → inline editing, slide-over panels, or expandable sections.
- **Avatar circles exclusively** → try squircles or rounded squares.
- **Light/dark toggle always a sun/moon switch** → dropdown, system preference detection, or integrate into settings.
- **Footer link farm with 4 columns** → simplify to main paths + legally required links.

### Iconography
- **Lucide or Feather icons exclusively** → the "default" AI choice; use Phosphor, Heroicons, or a custom set. (See stack-engineering.md for the icon-library policy and the noted conflict.)
- **Rocketship for "Launch", shield for "Security"** → replace clichés with less obvious icons (bolt, fingerprint, spark, vault).
- **Inconsistent stroke widths** → standardize to one stroke weight.
- **Missing favicon** → always include a branded favicon.
- **Stock "diverse team" photos** → real team photos, candid shots, or a consistent illustration style.

### Code Quality
- **Div soup** → semantic HTML: `<nav>`, `<main>`, `<article>`, `<aside>`, `<section>`.
- **Inline styles mixed with CSS classes** → move all styling to the project's styling system.
- **Hardcoded pixel widths** → relative units (`%`, `rem`, `em`, `max-width`).
- **Missing alt text** → describe content; never `alt=""` or `alt="image"` on meaningful images.
- **Arbitrary z-index like `9999`** → establish a clean z-index scale in theme/variables.
- **Commented-out dead code** → remove debug artifacts before shipping.
- **Import hallucinations** → verify every import exists in `package.json` / project dependencies.
- **Missing meta tags** → add `<title>`, `description`, `og:image`, and social sharing meta tags.

### Strategic Omissions (What AI Typically Forgets)
- **No legal links** → add privacy policy + terms of service in the footer.
- **No "back" navigation** → every page needs a way back; no dead ends.
- **No custom 404 page** → design a helpful branded "page not found".
- **No form validation** → client-side validation for emails, required fields, formats.
- **No "skip to content" link** → add a hidden skip-link for keyboard users.
- **No cookie consent** → add a compliant consent banner where required by jurisdiction.

---

## 6. Upgrade Techniques Library

From `redesign-skill`. High-impact techniques to replace generic patterns during an upgrade.

### Typography Upgrades
- **Variable font animation** — interpolate weight/width on scroll or hover for text that feels alive.
- **Outlined-to-fill transitions** — text starts as a stroke outline and fills with color on scroll entry/interaction.
- **Text mask reveals** — large typography acting as a window to video or animated imagery behind it.

### Layout Upgrades
- **Broken grid / asymmetry** — elements that deliberately ignore column structure (overlap, bleed off-screen, calculated random offset).
- **Whitespace maximization** — aggressive negative space to force focus on a single element.
- **Parallax card stacks** — sections that stick and physically stack over each other during scroll.
- **Split-screen scroll** — two halves of the screen sliding in opposite directions.

### Motion Upgrades
- **Smooth scroll with inertia** — decouple scrolling from browser defaults for a heavier cinematic feel.
- **Staggered entry** — elements cascade in with slight delays, combining Y-axis translation with opacity fade. Never mount everything at once.
- **Spring physics** — replace linear easing with spring-based motion on all interactive elements.
- **Scroll-driven reveals** — content entering through expanding masks, wipes, or draw-on SVG paths tied to scroll progress.

### Surface Upgrades
- **True glassmorphism** — go beyond `backdrop-filter: blur`; add a 1px inner border and a subtle inner shadow to simulate edge refraction.
- **Spotlight borders** — card borders that illuminate dynamically under the cursor.
- **Grain and noise overlays** — a fixed, `pointer-events-none` overlay with subtle noise to break digital flatness.
- **Colored, tinted shadows** — shadows that carry the hue of the background rather than generic black.

---

## 7. Fix Priority Order

From `redesign-skill`. Apply changes in this order for maximum visual impact with minimum risk:

1. **Font swap** — biggest instant improvement, lowest risk.
2. **Color palette cleanup** — remove clashing or oversaturated colors.
3. **Hover and active states** — makes the interface feel alive.
4. **Layout and spacing** — proper grid, max-width, consistent padding.
5. **Replace generic components** — swap clichés for modern alternatives.
6. **Add loading, empty, and error states** — makes it feel finished.
7. **Polish typography scale and spacing** — the premium final touch.

> Redesign guardrails: work with the existing stack (don't migrate frameworks/styling libs), don't break functionality (test after each change), check dependencies before importing, check Tailwind version (v3 vs v4) before touching config, keep changes small/reviewable.

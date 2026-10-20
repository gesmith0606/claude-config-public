---
name: social-drafting
description: >-
  Drafts ready-to-copy social posts for X/Twitter, LinkedIn, Instagram, Threads, Bluesky, and
  YouTube using embedded platform format rules — pure local reasoning; never posts or schedules
  anything. Use on "write a tweet", "draft a LinkedIn post", "caption for Instagram", "YouTube
  title/description", "thread about X".
---

# social-drafting

Draft-only. No OAuth tokens. No posting. No scheduling. The human copy-pastes and posts manually — full stop.

**Why this boundary is hard:** Auto-posting is irreversible and outward-facing. This config is
git-synced across machines — social OAuth tokens must never live here. If scheduling is ever
wanted (e.g. Postiz in Docker on the gaming PC), that is a separate, later, out-of-scope decision.

Egress: zero. This skill is a local cheatsheet + drafting prompt only.

---

## Per-platform format rules

### X / Twitter
- **Limit:** 280 chars per post (verified/paid: 25 000 chars, but readability still favors short)
- **Threads:** number optionally (1/ 2/ …) or let the narrative flow; hook tweet stands alone if only one gets read
- **Hook pattern:** lead with the tension or the payoff — never bury it. First 1–2 lines show in timeline before "Show more"
- **Images:** 1200 × 675 px (16:9); up to 4 per post; alt text strongly preferred
- **Hashtags:** 1–2 max; more hurts reach algorithmically

```
Hook line that earns the click.

Body: the insight / story / evidence in 3–5 tight sentences.

CTA or punchline. [optional link]
```

---

### LinkedIn
- **Limit:** 3 000 chars; first ~210 chars show before "…see more" — those must hook
- **Whitespace is content:** one sentence per line, blank lines between thoughts; walls of text get skipped
- **Hook pattern:** bold claim → evidence → personal angle → CTA
- **Hashtags:** 3–5 relevant ones, appended at end
- **Images:** 1200 × 627 px (1.91:1) for single; 1080 × 1080 px for square feed post

```
One punchy opening line that stops the scroll.

Short para expanding the claim.

Short para with evidence or personal story.

Takeaway or question to invite comments.

#Hashtag1 #Hashtag2 #Hashtag3
```

---

### Instagram
- **Caption limit:** 2 200 chars; first ~125 chars show before "more"
- **Hashtags:** 3–10 is current best practice (algorithm deprioritizes 30-hashtag dumps); put them at end or in first comment
- **Single image:** 1080 × 1080 px (square) or 1080 × 1350 px (4:5 portrait — more feed real estate)
- **Carousel:** up to 20 slides; 1080 × 1080 or 1080 × 1350; slide 1 = hook, last slide = CTA/swipe-to-save prompt
- **Reels cover:** 1080 × 1920 px (9:16)

```
Hook line (visible before "more").

Story / value / insight.

CTA (save this, share, comment your take).

#hashtag1 #hashtag2 #hashtag3
```

---

### Threads
- **Limit:** 500 chars per post; threads chain up to 10 posts
- Style mirrors X but slightly more casual; no algorithmic hashtag signal yet (omit or use 1)
- **Images:** 1080 × 1080 px or 1080 × 1350 px

---

### Bluesky
- **Limit:** 300 chars per post
- Threads supported; link cards auto-unfurl from the first URL
- No algorithmic hashtag boost; use 0–2 for discoverability only
- **Images:** 1000 × 562 px (16:9) recommended; up to 4 per post; alt text supported

---

### YouTube
- **Title:** 60–70 chars (anything beyond ~70 truncates in search); front-load the keyword; pattern: `[Hook/Keyword] — [Outcome or Intrigue]`
- **Description:** first 2–3 lines show without "Show more"; put the key CTA and link there; timestamps at 200–300 chars in; keyword-rich but readable
- **Thumbnail:** 1280 × 720 px minimum (16:9); bold text overlay, high contrast, face if relevant
- **Tags:** 5–8 specific tags; first tag = exact title keyword

```
Title: Clear Keyword — Payoff or Curiosity Gap (≤70 chars)

Description (above fold):
One sentence on what this video delivers.
Link or CTA here.

00:00 Intro
01:20 Section 1
…

[Keyword-rich paragraph for search — 2–3 sentences, natural language.]
```

---

## Hook patterns (reusable)

| Pattern | Example opener |
|---------|---------------|
| Contrarian claim | "Most advice about X is wrong. Here's what actually works." |
| Number lead | "5 years of X taught me one thing:" |
| Direct question | "Why does X keep failing? It's not what you think." |
| Story open | "Last [week/year], I made a mistake that cost me [X]." |
| Bold stat | "[Stat]. Here's what that means for [audience]." |

---

## Handoffs

- **Visuals / image assets** — hand off to `design` (layout/brand) or `image-cloud` (AI generation; `comfyui-local-image` is the local alternative, gaming PC only)
- **Long-form content** (articles, newsletters, ghostwriting) — `doc-coauthoring`
- **Posting / scheduling** — intentionally out of scope; use the platform's native scheduler manually

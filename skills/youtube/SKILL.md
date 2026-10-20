---
name: youtube
description: Search YouTube and understand videos from the command line - find videos with yt-dlp, then summarize, transcribe, or ask questions about a video's speech AND on-screen content via Gemini's free tier. Use when the user wants to find YouTube videos on a topic, summarize or "watch" a video, get a transcript, or check what a video shows at a timestamp.
---

# youtube

The `yt` CLI. Search runs through yt-dlp (no key). Video understanding runs through the
Gemini API, which reads public YouTube URLs on Google's side - so it sees audio AND
visuals and never hits YouTube's bot checks or caption PO-token wall.

- CLI source: `%USERPROFILE%\tools\yt-cli\yt` (Python 3; needs `yt-dlp`, `google-genai`)
- Wrapper on PATH: `%USERPROFILE%\tools\bin\yt.cmd`
- If `yt` is not found: `python "$env:USERPROFILE\tools\yt-cli\yt" <args>`
- Gemini key: resolve it through this config's standard backend (env → OS keychain → Bitwarden `bw`; see the `bitwarden` skill) and pass it as the `GEMINI_API_KEY` env var, which the CLI honours:
  `GEMINI_API_KEY="$(node ~/.claude/scripts/resolve-secret.js GEMINI_API_KEY)" yt summary <url>`
  If it exits 2 the vault is locked (`bwu`) or the item is missing (`bw-add-secret.js`). Search needs no key. Never print the key.

## Commands

```
yt search "query" [-n 10] [--recent]            # titles, channel, duration, views, URL
yt summary <url|id> [--start 12:30] [--end 20:00] [--low-res]
yt ask <url|id> "question" [--start ..] [--end ..] [--low-res]
yt transcript <url|id> [--start ..] [--end ..]
```

Global: `--json` (search = one JSON object per line), `--model NAME`
(default `$YT_GEMINI_MODEL` or `gemini-flash-latest`).

## Workflow

1. `yt search` to find candidates; pick by title/channel/views.
2. `yt summary` first - it's cheaper than reading a full transcript and includes
   timestamps plus on-screen-only content (slides, code, demos).
3. `yt ask ... --start/--end` to drill into a specific section.
4. `yt transcript` only when the user needs the full text.
Cite video URLs (with `&t=<seconds>` for timestamps) when reporting back.

## Rules that matter

- **Free-tier budget: ~8 hours of YouTube video per day**, plus per-minute request
  limits. Prefer `summary` over `transcript`, clip long videos with `--start/--end`,
  and add `--low-res` for talking-head videos (cuts frame tokens ~3x).
- **Free tier = Google may use prompts.** Never put work-confidential or personal
  information in `ask` questions. Public videos and generic questions only.
- **Public videos only.** Private, age-restricted, deleted, and live videos fail.
- **Transcripts are model-generated**, not YouTube's captions. Good for understanding;
  verify wording before quoting anything verbatim.
- **`--recent` is best-effort** - YouTube's upload-date sort isn't always honored;
  check titles/dates rather than assuming strict ordering.
- On "model not found", pass `--model` with a current Flash model name from
  ai.google.dev/gemini-api/docs/models (or set `YT_GEMINI_MODEL`).
- On a quota (429) error, stop and tell the user; don't retry in a loop.

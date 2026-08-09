---
name: tts-narration
description: >-
  Converts text to a local voice WAV/MP3 for voiceover and narration using Kokoro (CPU-only,
  faster than real-time, fully local). Use on "narrate this script", "make a voiceover for my
  clip", "TTS to a file", "generate spoken audio from text".
---

# tts-narration

One job: text in → voice WAV/MP3 out, **fully local**, on CPU. Everything else (muxing, trimming,
effects) belongs to `ffmpeg`. Music generation is a separate tool (ACE-Step, below).

---

## Install (one-time, cross-platform)

```bash
# macOS / Windows — uv keeps it isolated
uv pip install kokoro soundfile
# ffmpeg must also be on PATH (for MP3 output via soundfile or direct pipe)
```

Kokoro downloads ~80 MB of model weights on first run. No API key, no egress after that. If you hit
phonemizer errors or odd pronunciation of unusual words, install the `espeak-ng` G2P fallback:
`brew install espeak-ng` (macOS) / `winget install eSpeak-NG.eSpeak-NG` (Windows).

---

## Minimal pattern — Python

```python
from kokoro import KPipeline
import soundfile as sf

pipeline = KPipeline(lang_code="a")          # "a" = American English; "b" = British
text = "Your narration script goes here."

audio_chunks = []
for _, _, audio in pipeline(text, voice="af_heart", speed=1.0):
    audio_chunks.append(audio)

import numpy as np
sf.write("narration.wav", np.concatenate(audio_chunks), 24000)
```

**Voice options** — pass `voice=` any name from `kokoro`'s voice list (e.g. `af_heart`, `am_adam`,
`bf_emma`). Run `python3 -c "from kokoro import KPipeline; help(KPipeline)"` or check
[hexgrad/kokoro on GitHub](https://github.com/hexgrad/kokoro) for the full roster.

**Cross-platform launcher:** use `python3` on macOS, `py -3` on Windows — never bare `python`.

---

## Mux narration under a video clip

Hand the WAV straight to ffmpeg (see `video-edit` for fuller patterns):

```bash
ffmpeg -i clip.mp4 -i narration.wav -c:v copy -c:a aac -map 0:v:0 -map 1:a:0 output.mp4
```

---

## Fallback: edge-tts (zero-install, personal-only)

**WARNING — edge-tts sends your text to Microsoft servers. NEVER use it for confidential or PII text.
Personal machine only, same policy as `WebFetch`.**

```bash
uv tool install edge-tts
edge-tts --voice "en-US-JennyNeural" --text "Hello world" --write-media out.mp3
```

Useful when you need a quick file fast and Kokoro isn't installed yet. Swap to Kokoro once installed.

---

## Local music generation (pointer only)

**ACE-Step** (ace-step on GitHub, MIT, ~4 GB VRAM) generates full music tracks locally on the
gaming-PC GPU. It is not scriptable from this skill — run its own app via `uv run`. Mentioned here
so you know the local path exists when you need music, not just narration.

---

## Egress summary

| Tool | Egress | Work laptop? |
|------|--------|--------------|
| Kokoro | Local only (weights downloaded once) | Yes |
| ACE-Step | Local only (GPU) | Yes — no confidential data in prompts |
| edge-tts | Microsoft servers | **Never for work** |

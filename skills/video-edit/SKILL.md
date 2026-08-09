---
name: video-edit
description: >-
  Wraps ffmpeg for everyday clip editing: trim, concat, scale, subtitle burn-in, audio
  mux/extract, GIF export, plus auto-editor for automatic silence-cutting. Use on "trim this
  clip", "cut the silences", "burn in subtitles", "replace the audio", "concat these clips",
  "export a GIF", "resize for social". Fully local — no egress.
---

# video-edit

> **Routing:** video generation (text/image → video) → `comfyui-local-image`; voiceover/TTS audio → `tts-narration`.

ffmpeg is already installed (confirmed in `machine.json` → `capabilities.tools.ffmpeg`). This skill
encodes the right incantations so you do not re-derive them each time. Everything here runs locally —
no frames, deal content, or PII ever leave the machine. Personal creative use (NFL clips, etc.); keep
work content off any hosted video service.

**Skip moviepy** unless you need frame-level Python compositing — it drags in numpy/PIL/imageio and
just wraps ffmpeg anyway.

---

## Trim

Stream-copy is instant and lossless when you do not need re-encoding:

```sh
# stream-copy (fast, no quality loss — works when no re-encode needed)
ffmpeg -ss 00:01:10 -to 00:02:45 -i in.mp4 -c copy out.mp4

# re-encode (use when the cut leaves a bad keyframe or you need a codec change)
ffmpeg -ss 00:01:10 -to 00:02:45 -i in.mp4 out.mp4
```

`-ss` before `-i` is fast (keyframe seek); `-ss` after `-i` is frame-accurate but slower.

---

## Concat

The concat demuxer is the reliable method (works across codecs, no re-encode required for copy):

```sh
# 1. build a list file
printf "file 'clip1.mp4'\nfile 'clip2.mp4'\nfile 'clip3.mp4'\n" > list.txt

# 2a. stream-copy (same codec/resolution required)
ffmpeg -f concat -safe 0 -i list.txt -c copy out.mp4

# 2b. re-encode (mixed codecs or resolutions)
ffmpeg -f concat -safe 0 -i list.txt out.mp4
```

---

## Scale / Resize

```sh
# scale to 1280 wide, preserve aspect ratio
ffmpeg -i in.mp4 -vf scale=1280:-2 out.mp4

# social formats (pad to keep aspect, no crop)
# 9:16 vertical (Reels/Shorts) — pad black bars
ffmpeg -i in.mp4 -vf "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2" out.mp4

# 1:1 square
ffmpeg -i in.mp4 -vf "scale=1080:1080:force_original_aspect_ratio=decrease,pad=1080:1080:(ow-iw)/2:(oh-ih)/2" out.mp4
```

`-2` keeps the dimension a multiple of 2 (required by most codecs).

---

## Burn-in Subtitles from .srt

```sh
ffmpeg -i in.mp4 -vf "subtitles=in.srt" out.mp4
```

On Windows, escape the path if it contains colons:

```sh
ffmpeg -i in.mp4 -vf "subtitles='C\\:/path/to/in.srt'" out.mp4
```

---

## Audio: Replace, Mux, Extract

```sh
# replace audio track (discard original)
ffmpeg -i in.mp4 -i new_audio.mp3 -c:v copy -c:a aac -map 0:v:0 -map 1:a:0 -shortest out.mp4

# mix / layer two audio streams (equal volume)
ffmpeg -i in.mp4 -i music.mp3 -filter_complex "[0:a][1:a]amix=inputs=2:duration=shortest" -c:v copy out.mp4

# extract audio only
ffmpeg -i in.mp4 -vn -c:a copy out.aac
# or transcode to mp3
ffmpeg -i in.mp4 -vn -c:a libmp3lame -q:a 2 out.mp3
```

---

## Export GIF

```sh
# palette-based GIF (good quality, reasonable size)
ffmpeg -ss 00:00:05 -t 4 -i in.mp4 -vf "fps=15,scale=640:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse" out.gif
```

Adjust `fps` and `scale` width to trade quality for file size.

---

## Auto-cut Silences with auto-editor

[auto-editor](https://github.com/WyattBlue/auto-editor) (Public Domain) detects and removes silent
sections automatically — no manual timeline work.

```sh
# install once (cross-platform via uv)
uv tool install auto-editor

# cut silences with default threshold
auto-editor in.mp4

# tune: keep 0.3 s of padding around each audible section
auto-editor in.mp4 --margin 0.3sec

# output a specific format
auto-editor in.mp4 --export premiere  # XML for Premiere import
```

Output lands next to the input as `in_ALTERED.mp4` by default.

---

## Quick-reference decision tree

| Goal | Command |
|---|---|
| Trim, no quality loss | `ffmpeg -ss … -to … -i in.mp4 -c copy out.mp4` |
| Join clips | concat demuxer + list.txt |
| Resize | `-vf scale=W:-2` |
| Subtitles | `-vf subtitles=in.srt` |
| Swap audio | `-map 0:v:0 -map 1:a:0` |
| GIF | palette two-pass |
| Remove silences | `auto-editor in.mp4` |
| Generate video from image/text | `comfyui-local-image` skill |
| Add voiceover | `tts-narration` skill |

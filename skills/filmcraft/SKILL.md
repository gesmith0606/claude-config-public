---
name: filmcraft
description: >-
  Drives FilmCraft (open-source Premiere Pro clone) headless through filmcraft-cli: import media into a
  .fcproj, build and edit sequences (razor, effects, mute), render frames, export H.264/HEVC/ProRes/
  DNxHR/WAV, and export EDL/FCP XML/FCPXML/OTIO/AAF for other editors. Use on "make a FilmCraft
  project from these clips", "cut/blur/grade this sequence", "export the timeline", "give me an EDL
  or XML for Resolve". Fully local — no egress.
---

# filmcraft

> **Routing:** one-off trims, concat, GIFs, subtitle burn-in, silence cuts → `video-edit` (ffmpeg is
> simpler and battle-tested). Use this skill when the user wants a real **project/timeline**: multi-clip
> sequences, effects, interchange with Premiere/Resolve/Avid, or a `.fcproj` they'll open in the app.

CLI-first: everything below is plain `filmcraft-cli`. It also has an MCP server (`filmcraft-cli mcp`);
don't enable it unless a task truly needs a long interactive session. Verified against filmcraft-cli
**0.9.0** (macOS; Windows last checked on 0.7.2). If `--version` is newer, re-check `"$FC" help` before
trusting a trap below.

## Find the CLI

```bash
FC="$(command -v filmcraft-cli || command -v ~/.local/bin/filmcraft-cli || echo '/c/Program Files/FilmCraft/filmcraft-cli.exe')"
"$FC" --version
```

- **Windows:** MSI install at `C:\Program Files\FilmCraft\`, not on PATH.
- **macOS:** separate CLI zip (`filmcraft-cli-<ver>-macos-universal.zip` on the `github.com/storytold/filmcraft`
  release), installed to `~/.local/bin`.
- **Paths inside JSON** or `key=value` args are not translated by Git Bash: use relative paths or
  `C:/forward/slashes`, never `/c/...`.

## State model: every call is a fresh headless session

Nothing persists between invocations unless you save. Pattern:

- First call creates the project: `"$FC" --save-as proj.fcproj import "C:/abs/clip.mp4"`
- Every later edit: `"$FC" --project proj.fcproj --save <subcommand> …`
- Read-only calls (inspect, render, export) need `--project` but not `--save`.
- Add `--compact` for one-line JSON.

## Tested workflow (0.9.0)

```bash
"$FC" probe clip.mp4 --compact                                   # codec, fps, duration (ticks)
"$FC" --save-as proj.fcproj import "C:/abs/clip.mp4"             # → {"items":[1]}
"$FC" --project proj.fcproj --save exec file.newSequenceFromClip items='[1]'   # → {"clips":[6,7],"sequence":4}
"$FC" --project proj.fcproj --save run edit.jsonl                # several edits, one session
"$FC" --project proj.fcproj inspect sequence --compact           # read back
"$FC" --project proj.fcproj render --seconds 0.5 --out frame.png # look at it
"$FC" --project proj.fcproj export out.mp4                       # format from extension; waits
```

`edit.jsonl` — one `{"id","params"}` per line, `#` comments allowed:

```
# cut at 1 s, blur the first part
{"id":"timeline.razor","params":{"seconds":1.0}}
{"id":"effects.apply","params":{"clips":[6],"effect":"Gaussian Blur"}}
{"id":"effects.setParam","params":{"clip":6,"effect":"gaussian_blur","param":"blurriness","value":40}}
```

Read the ids from each result (`items`, `clips`, `sequence`); don't assume the numbers above.

## Export

- Media: `export out.mp4 [--format h264|hevc|prores|dnxhr|apv|mjpeg|mxf-op1a|png|tiff|gif|wav|aiff|aac…]`
  or `--preset "<name>"` (`export --list-presets h264`)
  `[--start 1 --end 2.5]` (seconds, end-exclusive) `[--scale 0.5] [--quality 0-100] [--no-audio]`.
  Exit code 1 if offline media rendered as placeholders (`--allow-offline` accepts it).
- Interchange: `exec file.exportEdl path=cut.edl`, `file.exportFcp7Xml`, `file.exportFcpxml`,
  `file.exportOtio`, `file.exportAaf` (each `path=`). Read the `report` array: e.g. effects that an EDL
  can't carry are listed there. EDL keeps V1 only.
- Verify with `"$FC" probe out.mp4` (frames, fps, duration) and look at a rendered frame.

## Discover commands

`"$FC" commands razor` (id, label, params) · `"$FC" describe effects.setParam` (full param doc).
Times: 254016000000 ticks = 1 s; most commands also take `seconds=`, `frame=` or `timecode=`.

## Traps

- **Wrong-typed optional params are silently ignored.** `exec timeline.razor seconds=abc` returns ok with
  `{"cuts":0}` and cuts at the playhead. Required params (`clip`, `effect`, `param`) do error. Always
  check the result and re-read with `inspect`.
- **No selection headless.** Pass ids explicitly (`clips`, `clip`, `items`, `track`).
- **Effects arrive at defaults.** Gaussian Blur defaults to 0 — invisible until `effects.setParam`.
  `effect` there is the effect **id** from `inspect sequence` (`gaussian_blur`), not the label.
- **Muting audio:** `exec timeline.setTrack track=A1 muted=true`. `enabled=false` does not silence it.
- **Ids are reused after undo.** Re-read ids after any undo.
- **`timeline.place` on V2+** needs an explicit `audioTrack`, or the linked audio overwrites A1.
- **Overwrites are silent** for exports and saves. Use unique output names; work on copies of the
  user's projects, never `--save` onto their only copy.
- **MP3 sources** keep encoder delay (audio ~25 ms late); convert to WAV with ffmpeg first.
- **No file sandbox.** The CLI can read/write anything you can. Only use paths the user gave you.
- FilmCraft is alpha. For a deliverable that matters, watch the export before handing it over.

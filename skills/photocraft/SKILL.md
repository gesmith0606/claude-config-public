---
name: photocraft
description: >-
  Drives PhotoCraft (open-source Photoshop clone) headless through photocraft-cli: convert between
  PSD/PNG/JPEG/TIFF/WebP/EXR, inspect layers, run filters/adjustments/resizes, and batch a folder
  through an action list. Use on "edit this PSD", "blur/sharpen/curves this image", "convert PSD to
  PNG", "resize all images in a folder", "what layers are in this file". Fully local — no egress.
---

# photocraft

> **Routing:** video → `filmcraft` or `video-edit`; PDFs → `pdfcraft`; generating new images → `comfyui-local-image`.

CLI-first by design: everything below is plain `photocraft-cli` subcommands. The CLI also has an MCP
server (`photocraft-cli mcp`); don't enable it unless a task truly needs a long interactive session.
Verified against photocraft-cli **0.10.0** (macOS; Windows last checked on 0.8.2). If `--version` reports
something newer, re-check `--help` before trusting a trap below.

## Find the CLI

```bash
PC="$(command -v photocraft-cli || command -v ~/.local/bin/photocraft-cli || echo '/c/Program Files/PhotoCraft/photocraft-cli.exe')"
"$PC" --version
```

- **Windows:** the MSI installs to `C:\Program Files\PhotoCraft\` and does **not** add it to PATH.
- **macOS:** the CLI is a separate zip (`photocraft-cli-<ver>-macos-universal.zip` on the
  `github.com/storytold/photocraft` release), not inside the `.app`. It lives in `~/.local/bin`.
- **Paths inside JSON** (`--params`, action files) are not translated by Git Bash. Use relative paths
  or `C:/forward/slashes`, never `/c/...`.

## Commands

| Task | Command |
|---|---|
| Inspect | `"$PC" info in.psd --compact` → size, mode, depth, layer tree (layer `id`s) |
| Convert | `"$PC" convert in.psd out.png` (format from extension; `--quality 1-100` for JPEG/WebP; `--tiff-layers` keeps layers in TIFF) |
| Edit + save | `"$PC" run in.psd --cmd <id> --params '<json>' [--cmd … --params …] --out out.png` |
| New canvas | `"$PC" run --new '{"width":1200,"height":630}' --cmd edit.fill --params '{"color":"#3366ff"}' --out bg.png` |
| Batch a folder | `"$PC" batch --actions grade.json --in ./raw --out ./graded [--format png]` |
| Find a command | `"$PC" commands --filter blur` · params: `"$PC" commands --json --filter gaussianBlur` |

Each `--params` applies to the `--cmd` right before it. `run` prints one JSON result per command —
compare it with what you sent (e.g. `{"filter":{"filter":"gaussianBlur","radius":6.0},"layer":2}`).

Action file for `batch` — a list of `[id, params]` pairs:

```json
[["filter.blur.gaussianBlur", {"radius": 2}], ["image.adjustments.desaturate", {}]]
```

## Tested recipes (0.10.0)

```bash
# Blur + curves adjustment layer, export JPEG
"$PC" run photo.png --cmd filter.blur.gaussianBlur --params '{"radius":6}' \
  --cmd layer.newAdjustmentLayer.curves --params '{"points":[[0,0],[64,48],[192,212],[255,255]]}' \
  --out photo-graded.jpg --quality 85

# Resize to 640 wide (height keeps aspect)
"$PC" run photo.png --cmd image.imageSize --params '{"width":640}' --out photo-640.png
```

## Traps

- **Look at the output.** Read the exported image before reporting done; an ok result is not proof.
- **Flattening:** exporting a layered doc to PNG/JPEG flattens it (the CLI warns). Keep a `.psd` or
  `.pcraft` copy when layers matter.
- **Overwrites are silent.** Write to new filenames; never `--out` onto the user's original.
- **Batch name clashes:** `photo.png` and `photo.jpg` in the same `--in` folder map to the same output
  name; the second one fails. `--out` equal to `--in` is refused unless `--in-place`.
- **Params:** rejects unknown keys (`unknown parameter 'radiuss'`) and, since 0.10.0, out-of-range numbers
  (`radius must be a number in 0.1..1000`; 0.8.2 clamped them silently). Ranges: `commands --json`.
- **Colours:** pass `"#rrggbb"`. Arrays are read as 0..1, so `[128,128,128]` is white.
- **Layer targeting:** `layer` params take the integer `id` from `info`, not a name.
- **Colour-managed docs:** Linear-sRGB/EXR and ProPhoto/Adobe RGB files preview and export with raw values.
  Add `--cmd edit.convertToProfile --params '{"profile":"srgb"}'` before exporting for screen use.
- PhotoCraft is early alpha. For a deliverable that matters, confirm the result visually.

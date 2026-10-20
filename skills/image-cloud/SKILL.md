---
name: image-cloud
description: >-
  Generate an image from a text prompt via a FREE hosted service (Pollinations) — no API key, GPU,
  or setup, but the prompt egresses to a third party. Use whenever the user wants an image
  generated, drawn, rendered, or illustrated — concept art, illustrations, backgrounds,
  placeholders, mood boards, portraits — on any machine. Reach for `comfyui-local-image` instead
  only when an image must not leave the machine; it runs on the Windows gaming PC alone.
---

# image-cloud (hosted image generation — free, no key)

Generate an image from text via **Pollinations**, a free hosted service. No API key, no account, no
GPU — one HTTP call returns the image. This is the convenient, zero-setup counterpart to the local
`comfyui-local-image` skill.

## When to use which skill

- **This skill (`image-cloud`)** — the default for image generation: concept art, illustrations,
  backgrounds, placeholders, stock-style pictures, portraits. Fast, free, nothing to launch, and it
  works on every machine.
- **`comfyui-local-image` (local)** — for images that must stay entirely on-machine. Needs a running
  ComfyUI + GPU, so it is available **only on the Windows gaming PC** — not the MacBook.

**Know the tradeoff:** the prompt and the resulting image are sent to Pollinations, a third party.
That is the price of zero setup. When something must not leave the machine, use
`comfyui-local-image` on the gaming PC instead.

## The one rule: always use the bundled script

```bash
python "<skill-dir>/scripts/pollinations_generate.py" \
  --prompt "<the prompt>" \
  --out "<path/to/result.png>" \
  [--width 1024 --height 1024 --seed 42 --model flux]
```

It blocks until the image is ready, saves it, and prints the path to stdout (or exits non-zero with
a clear message). Options: `--width`/`--height` (default 1024²), `--seed` (omit = random each run),
`--model` (default `flux`; `/models` currently also lists `sana`), `--timeout` (default 180s).

Run it with a real **Python 3**. It only needs internet — no ComfyUI, no GPU. Use `python3`
(macOS/Linux); on Windows use a real interpreter or `py -3` — **not** the bare `python` MS-Store
stub. Use the `<skill-dir>`-relative path, never a hardcoded `/mnt/c/Users/<name>` path.

```bash
python3 "<skill-dir>/scripts/pollinations_generate.py" \
  --prompt '<prompt>' --out '<staging>/<name>.png'
```

## Output convention — preview first, save only on request (IMPORTANT)

Same as the `comfyui-local-image` skill — the user does NOT want images auto-saved, never in two places, and
their client does NOT render inline images. So:

1. **Generate to staging** (`~/comfy_out/<name>.png`), not a permanent folder.
2. **Show it by opening the default viewer** — open the file with the OS opener:
   macOS `open "<file>"`; Windows PowerShell `Invoke-Item "<file>"`; Linux `xdg-open "<file>"`.
   (Inline `Read` doesn't display for this user — the viewer is what they actually see.)
3. **Ask if they want to keep it.** Do nothing else until they say so.
4. **Only on approval, save to ONE place:** the machine-local keep-folder configured in
  `~/.claude/machine.json` as `preferredImageSaveDir`, falling back to the OS Downloads folder.
  Never a second location.

## Troubleshooting

- *HTTP 5xx / non-image response* → service busy; retry, or change `--model`.
- *Can't reach Pollinations* → check internet.
- *Quality not enough* → this is a free service; for top-tier quality consider adding a paid backend
  (HF Inference / Replicate / FLUX) later, or use local `comfyui-local-image` (Juggernaut XL).

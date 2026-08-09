# ComfyUI persona workflows

API-format workflows for the `comfyui` skill (`--workflow <file>`). Two parameterized node titles:
`PROMPT` (positive prompt) and `FACE` (reference LoadImage, persona only).

- **`sdxl_txt2img_api.json`** — base SDXL txt2img on Juggernaut XL v9. Plumbing smoke test.
- **`sdxl_persona_pulid_api.json`** — adds PuLID face consistency (PuLID + EVA-CLIP + InsightFace
  antelopev2). Use with `--face <reference.png>`. Tuning: `ApplyPulid.weight` (0.8) and `method`
  (`fidelity`/`style`/`neutral`).

## Potential add — upscaler (NOT built; add only when needed)

1024² is SDXL-native and fine for digital use. Add an upscale pass only when a deliverable is
**print** (1024px @ 300 DPI ≈ 3.4") or the face needs more skin/detail texture.

**Leanest option — "hires fix" (no extra downloads):** after the existing KSampler, insert
`LatentUpscaleBy` (scale 2.0) → a 2nd `KSampler` (same model/positive/negative, `denoise ≈ 0.4`,
~15 steps) → `VAEDecode` → `SaveImage`. Doubles to 2048² and adds detail using the already-loaded
model. Heavier alternative: an ESRGAN model upscaler (`4x-UltraSharp` via `UpscaleModelLoader` +
`ImageUpscaleWithModel`) — only if hires-fix isn't crisp enough.

Trigger to remember: *"is this going to print, or does the face need more texture?"* → then add it.

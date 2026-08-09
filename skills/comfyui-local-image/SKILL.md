---
name: comfyui-local-image
description: >-
  Generate images locally through a running ComfyUI instance (Stable Diffusion / SDXL / Flux,
  IP-Adapter, PuLID/InsightFace face-consistency) on the user's own GPU — nothing leaves the
  machine. Use whenever the user wants to create or render an image, art, a portrait, or a
  persona/likeness; MANDATORY over any hosted API when a real person's face is involved.
---

# ComfyUI (local image generation)

Drive the user's **local ComfyUI** to generate images on their own GPU. Everything stays on the
machine — which is the whole point for persona/likeness work (a client's face must never be sent
to a hosted service). The engine is their ComfyUI workflow (e.g. Juggernaut XL + IP-Adapter +
PuLID); this skill just submits it, waits, and returns the finished image.

## The one rule: always use the bundled script — never hand-roll the API calls

ComfyUI's API is **asynchronous** — `POST /prompt` returns immediately with a `prompt_id`,
generation runs in a queue, and you must poll `/history/<prompt_id>` until the image exists, then
fetch it from `/view`. Do **not** improvise this with `curl` + a `sleep` loop (it's error-prone,
and the harness blocks foreground `sleep`). The async flow is encapsulated in
`scripts/comfyui_generate.py`, which **blocks internally and returns the saved path in one call.**

**This is the exact, deterministic pattern — run it every time:**

```bash
python3 "<skill-dir>/scripts/comfyui_generate.py" \
  --workflow "<path/to/workflow_api.json>" \
  --prompt "<the positive prompt>" \
  [--face "<path/to/reference_face.png>"] \
  --out "<path/to/result.png>"
```

It prints the saved image path to stdout on success, or exits non-zero with a clear message
(unreachable server, workflow rejected, no output, timeout). That's the whole interface — submit,
wait, get a path. Nothing else to orchestrate.

Options: `--server` (default `http://localhost:8188`, or `COMFYUI_URL`), `--timeout` (default 300s,
raise for heavy PuLID/upscale graphs), `--poll` (default 1.5s).

## Two conventions the workflow must follow

The script injects parameters by **node title**, so it works with *any* workflow without editing
code:

1. **Export the workflow in API format.** In ComfyUI: gear/settings → enable dev mode →
   **Save (API Format)**. That JSON (node-id keyed, with `_meta.title`) is what `--workflow` takes —
   *not* the regular "Save" graph format.
2. **Title the two parameterized nodes** in ComfyUI (right-click node → Title):
   - the positive-prompt node (CLIPTextEncode) → **`PROMPT`**
   - the reference-image loader (LoadImage feeding IP-Adapter/PuLID) → **`FACE`** (only needed for
     likeness work)
   Re-export after titling. Other nodes (model, sampler, seed, upscale) stay as the user set them.

If a titled node is missing, the script says exactly which one and how to fix it.

## Setup / reachability (do this once)

- **ComfyUI must be running** before calling the script. It does **not** auto-start — after a
  machine reboot you must launch it again (see command below).
- **WSL2 ↔ Windows:** Claude runs on Windows; ComfyUI runs in WSL2. Confirm reachability first:
  `curl -s http://localhost:8188/system_stats` from Windows. If it fails, start ComfyUI with
  `--listen 0.0.0.0` (so it binds beyond WSL's loopback) and/or set `COMFYUI_URL` to the WSL2 IP
  (`wsl hostname -I`). Once `/system_stats` returns JSON, generation will work.

### This machine — validated quick-start (verified working)

- **Launch ComfyUI** (in WSL2; required after every reboot — it isn't a service):
  ```bash
  wsl -e bash -lc "cd ~/ComfyUI && python3 main.py --listen 0.0.0.0 --port 8188 --cuda-device 0"
  ```
  Keep it as a persistent/background process — a bare `wsl -e ... &` dies when the wsl call returns.
- **Run the script via WSL `python3`, not Windows python.** Windows `python3`/`python` is the
  MS-Store stub and fails. From WSL use `--server http://127.0.0.1:8188` and reference Windows-side
  files through the Windows mount for your local Claude home:
  ```bash
  wsl -e bash -lc "CLAUDE_HOME_WIN=${CLAUDE_HOME_WIN:-/mnt/c/Users/<your-user>/.claude}; python3 \"$CLAUDE_HOME_WIN/skills/comfyui-local-image/scripts/comfyui_generate.py\" \
    --workflow \"$CLAUDE_HOME_WIN/skills/comfyui-local-image/workflows/sdxl_persona_pulid_api.json\" \
    --prompt '<scene>' --face <ref.png> --server http://127.0.0.1:8188 --out ~/comfy_out/x.png"
  ```
  Replace `<your-user>` once per machine, or export `CLAUDE_HOME_WIN` in your shell profile.
- **Two ready workflows ship in `workflows/`** (see `workflows/README.md`):
  `sdxl_txt2img_api.json` (plain SDXL on Juggernaut XL v9) and `sdxl_persona_pulid_api.json`
  (PuLID face-consistency — use with `--face`).
- **First persona run is slow** (auto-downloads EVA-CLIP ~2GB + loads InsightFace on CPU) — use
  `--timeout 600`. Subsequent runs are fast.
- **After adding any new model file, restart ComfyUI** — loader dropdowns are cached at startup.

## How to use it in a task

1. Make sure ComfyUI is up (quick `system_stats` check if unsure; launch it if not).
2. Pick the workflow: default to the bundled `workflows/sdxl_txt2img_api.json` (plain image) or
   `workflows/sdxl_persona_pulid_api.json` (likeness, with `--face`) unless the user has their own.
3. Run the command above with their prompt (and `--face` for likeness).
4. Follow the **Output convention** below: preview first, save only if they want it.

## Output convention — preview first, save only on request (IMPORTANT)

The user does **not** want images auto-saved, and **never** in more than one place. Always:

1. **Generate to staging**, not to any permanent folder. Point `--out` at the WSL staging dir
   `~/comfy_out/<name>.png` (e.g. `~/comfy_out/dachshund.png`).
2. **Show it by opening the default image viewer** — inline chat rendering does NOT display in
   this user's client, so always open the file in a real viewer window. Copy the staged file to a
   Windows-accessible path (session scratchpad) and open it:
   `cp ~/comfy_out/<name>.png "<scratchpad>/<name>.png"`, then from PowerShell
   `Invoke-Item "<scratchpad>\<name>.png"` (you may also `Read` it inline as a fallback, but the
   viewer is what the user actually sees).
3. **Ask if they want to keep it.** Do nothing else until they say so. The preview alone is often
   enough — no file needs to leave staging.
4. **Only on approval, save to ONE place:** copy to the machine-local keep-folder configured in
  `~/.claude/machine.json` as `preferredImageSaveDir`, falling back to the OS Downloads folder if
  that setting is absent. Never save to a second location (no Desktop + Downloads). One file,
  one folder.

Staging (`~/comfy_out/` and the scratchpad) is ephemeral/working space — fine to leave or clean;
the user doesn't browse it. The approved keep-folder copy is the only "real" output, and only
when asked.

## Privacy (non-negotiable for likeness)

When a real person's / client's likeness is involved, this local path is the *only* acceptable
one — never fall back to a hosted image API (Pollinations, HF, Replicate, OpenAI, etc.) for those
images. Local generation keeps the likeness on the user's machine, under their control.

## Video (local, same ComfyUI + GPU)

For local **video** generation (text/image→video) the same ComfyUI install does it via custom nodes —
**ComfyUI-LTXVideo** (Lightricks; fast, native audio) or **Wan 2.x** (higher quality, heavier; ~12GB+ VRAM).
Install the nodes, export the workflow in API format, and drive it the same async way. Caveat:
`scripts/comfyui_generate.py` waits on a `SaveImage` node, so a video graph (which saves via a different node)
needs ComfyUI's own API/save until a video helper exists. Stays fully local — same privacy guarantee as images.
Trim/join the result with the `video-edit` skill (ffmpeg).

## Troubleshooting (the script surfaces these)

- *Cannot reach ComfyUI* → not running, or WSL2 binding/forwarding (see Setup).
- *Workflow rejected (node_errors)* → a missing model/custom node, or wrong (non-API) JSON format.
- *Finished but no image output* → the workflow has no `SaveImage` node.
- *Timed out* → heavy graph; raise `--timeout`.

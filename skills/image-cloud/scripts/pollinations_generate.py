#!/usr/bin/env python3
"""Generate an image via Pollinations (free, hosted, no API key) in ONE call.

Pollinations serves the image directly from a GET:
  https://image.pollinations.ai/prompt/<url-encoded prompt>?width=&height=&seed=&model=&nologo=true
There is no async queue (unlike local ComfyUI) — the request blocks until the image is ready and
returns the bytes. This script wraps that with sane errors and saves the result.

Stdlib only. Exit non-zero with a clear message on failure (HTTP error, non-image response, empty).

PRIVACY: Pollinations is a third-party hosted service — the prompt and image leave this machine.
NEVER use it for a real person's / client's likeness; use the local `comfyui` skill for that.
"""
import argparse, sys, urllib.parse, urllib.request, urllib.error

BASE = "https://image.pollinations.ai/prompt/"


def main():
    ap = argparse.ArgumentParser(description="Generate an image via Pollinations (free hosted).")
    ap.add_argument("--prompt", required=True, help="text prompt")
    ap.add_argument("--out", default="pollinations_output.png", help="where to save the result")
    ap.add_argument("--width", type=int, default=1024)
    ap.add_argument("--height", type=int, default=1024)
    ap.add_argument("--seed", type=int, help="fixed seed for reproducibility (omit = random)")
    ap.add_argument("--model", default="flux", help="model name (default flux; try sana, turbo)")
    ap.add_argument("--timeout", type=int, default=180, help="max seconds to wait")
    a = ap.parse_args()

    params = {"width": a.width, "height": a.height, "model": a.model, "nologo": "true"}
    if a.seed is not None:
        params["seed"] = a.seed
    url = BASE + urllib.parse.quote(a.prompt, safe="") + "?" + urllib.parse.urlencode(params)

    req = urllib.request.Request(url, headers={"User-Agent": "claude-image-cloud/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=a.timeout) as r:
            ctype = r.headers.get("Content-Type", "")
            data = r.read()
    except urllib.error.HTTPError as e:
        sys.exit(f"Pollinations returned HTTP {e.code} ({e.reason}). Try again, or a different --model.")
    except urllib.error.URLError as e:
        sys.exit(f"Could not reach Pollinations ({e}). Check your internet connection.")

    if not ctype.startswith("image/"):
        sys.exit(f"Expected an image but got Content-Type '{ctype}' ({len(data)} bytes). "
                 f"The service may be busy — retry, or change --model.")
    if not data:
        sys.exit("Pollinations returned an empty response. Retry.")

    with open(a.out, "wb") as f:
        f.write(data)
    print(a.out)  # result path on stdout


if __name__ == "__main__":
    main()

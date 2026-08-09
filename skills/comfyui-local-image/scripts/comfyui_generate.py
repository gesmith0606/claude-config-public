#!/usr/bin/env python3
"""Drive a local ComfyUI instance end-to-end in ONE blocking call.

Encapsulates ComfyUI's async protocol so the caller never hand-rolls polling:
  1. (optional) upload a reference image so a LoadImage node can use it
  2. inject prompt / face into nodes found by their _meta.title ("PROMPT" / "FACE")
  3. POST the workflow to /prompt  -> prompt_id
  4. poll /history/<prompt_id> until outputs appear (internal sleep; no foreground sleep)
  5. download the first image via /view and save it
  6. print the saved path to stdout

Stdlib only. Blocks until done or --timeout. Exit non-zero with a clear message on failure.
"""
import argparse, io, json, mimetypes, os, sys, time, urllib.error, urllib.parse, urllib.request, uuid


def _get_json(url, timeout=30):
    with urllib.request.urlopen(url, timeout=timeout) as r:
        return json.loads(r.read() or b"{}")


def _post_json(url, payload, timeout=30):
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read() or b"{}")


def _node_by_title(wf, title):
    for nid, node in wf.items():
        if node.get("_meta", {}).get("title", "").strip().lower() == title.lower():
            return nid, node
    return None, None


def _upload_image(server, path):
    """Upload an image to ComfyUI's input dir so a LoadImage node can reference it."""
    boundary = "----comfyui" + uuid.uuid4().hex
    fn = os.path.basename(path)
    buf = io.BytesIO()
    w = lambda s: buf.write(s.encode() if isinstance(s, str) else s)
    w(f"--{boundary}\r\n")
    w(f'Content-Disposition: form-data; name="image"; filename="{fn}"\r\n')
    w(f"Content-Type: {mimetypes.guess_type(path)[0] or 'application/octet-stream'}\r\n\r\n")
    w(open(path, "rb").read()); w("\r\n")
    w(f"--{boundary}\r\n")
    w('Content-Disposition: form-data; name="overwrite"\r\n\r\ntrue\r\n')
    w(f"--{boundary}--\r\n")
    req = urllib.request.Request(f"{server}/upload/image", data=buf.getvalue(),
                                 headers={"Content-Type": f"multipart/form-data; boundary={boundary}"})
    with urllib.request.urlopen(req, timeout=60) as r:
        res = json.loads(r.read() or b"{}")
    name, sub = res.get("name", fn), res.get("subfolder", "")
    return f"{sub}/{name}" if sub else name


def main():
    ap = argparse.ArgumentParser(description="Run a ComfyUI workflow and save the image.")
    ap.add_argument("--workflow", required=True, help="ComfyUI API-format workflow JSON (Save (API Format))")
    ap.add_argument("--prompt", help="positive prompt; injected into the node titled PROMPT")
    ap.add_argument("--face", help="reference image path; uploaded + injected into the node titled FACE")
    ap.add_argument("--out", default="comfyui_output.png", help="where to save the result")
    ap.add_argument("--server", default=os.environ.get("COMFYUI_URL", "http://localhost:8188"))
    ap.add_argument("--timeout", type=int, default=300, help="max seconds to wait for generation")
    ap.add_argument("--poll", type=float, default=1.5, help="seconds between history polls")
    a = ap.parse_args()
    server = a.server.rstrip("/")

    try:
        wf = json.load(open(a.workflow, encoding="utf-8"))
    except Exception as e:
        sys.exit(f"Could not read workflow JSON {a.workflow}: {e}")

    if a.prompt:
        _, node = _node_by_title(wf, "PROMPT")
        if not node:
            sys.exit("No node titled 'PROMPT'. In ComfyUI, rename your positive-prompt node's title to PROMPT, re-export (Save API Format).")
        node.setdefault("inputs", {})["text"] = a.prompt

    if a.face:
        try:
            ref = _upload_image(server, a.face)
        except urllib.error.URLError as e:
            sys.exit(f"Could not reach ComfyUI at {server} to upload the face image ({e}). Is it running + reachable?")
        _, node = _node_by_title(wf, "FACE")
        if not node:
            sys.exit("No node titled 'FACE'. Rename your reference LoadImage node's title to FACE, re-export.")
        node.setdefault("inputs", {})["image"] = ref

    # 3. submit
    try:
        resp = _post_json(f"{server}/prompt", {"prompt": wf, "client_id": uuid.uuid4().hex})
    except urllib.error.URLError as e:
        sys.exit(f"Cannot reach ComfyUI at {server} ({e}). Start it, and from Windows->WSL2 ensure it binds 0.0.0.0 "
                 f"(`--listen`) or that localhost forwarding works. Override with COMFYUI_URL.")
    if resp.get("node_errors"):
        sys.exit("ComfyUI rejected the workflow:\n" + json.dumps(resp["node_errors"], indent=2))
    pid = resp.get("prompt_id")
    if not pid:
        sys.exit(f"No prompt_id returned: {resp}")
    print(f"[comfyui] submitted prompt_id={pid}; waiting...", file=sys.stderr)

    # 4-5. poll until outputs, then download
    deadline = time.time() + a.timeout
    while time.time() < deadline:
        entry = _get_json(f"{server}/history/{pid}").get(pid)
        if entry and entry.get("outputs"):
            for out in entry["outputs"].values():
                for img in out.get("images", []):
                    q = urllib.parse.urlencode({"filename": img["filename"],
                                                "subfolder": img.get("subfolder", ""),
                                                "type": img.get("type", "output")})
                    with urllib.request.urlopen(f"{server}/view?{q}", timeout=120) as r:
                        open(a.out, "wb").write(r.read())
                    print(a.out)  # 6. result path on stdout
                    return
            sys.exit("Workflow finished but produced no image output (check the workflow has a SaveImage node).")
        time.sleep(a.poll)
    sys.exit(f"Timed out after {a.timeout}s waiting for ComfyUI (prompt_id={pid}). Increase --timeout for heavy workflows.")


if __name__ == "__main__":
    main()

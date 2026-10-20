"""yt — search YouTube (yt-dlp, no key) and understand videos (Gemini, which reads public
YouTube URLs server-side, so it sees speech AND on-screen content).

Lives in ~/.claude/skills/youtube/bin so it syncs with the config repo; run via the `yt`
(macOS/Linux) or `yt.cmd` (Windows) wrapper, which picks the ~/.claude venv python.
Needs: yt-dlp on PATH, google-genai in the venv. Gemini key: $GEMINI_API_KEY, else
~/.claude/scripts/resolve-secret.js GEMINI_API_KEY (env -> OS keychain -> Bitwarden).
"""
import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import urllib.parse
from pathlib import Path

DEFAULT_MODEL = os.environ.get("YT_GEMINI_MODEL", "gemini-flash-latest")
RESOLVER = Path.home() / ".claude" / "scripts" / "resolve-secret.js"

SUMMARY_PROMPT = (
    "Summarize this video for someone deciding whether to watch it. Start with a 2-3 sentence "
    "overview, then a timestamped outline (MM:SS - point). Include content that appears only on "
    "screen (slides, code, diagrams, demos, on-screen text), marked [on screen]. End with the key "
    "takeaways as bullets. Be concrete; no filler."
)
TRANSCRIPT_PROMPT = (
    "Transcribe the speech in this video verbatim, in the original language. Prefix each paragraph "
    "with a [MM:SS] timestamp and identify speakers when they change (Speaker 1, Speaker 2, or "
    "their names if stated). Do not summarize or omit anything."
)


def die(msg, code=1):
    print(f"yt: {msg}", file=sys.stderr)
    sys.exit(code)


# ---------- search (yt-dlp, no key) ----------

def fmt_duration(sec):
    if not sec:
        return "?"
    sec = int(sec)
    h, m, s = sec // 3600, sec % 3600 // 60, sec % 60
    return f"{h}:{m:02d}:{s:02d}" if h else f"{m}:{s:02d}"


def cmd_search(a):
    if not shutil.which("yt-dlp"):
        die("yt-dlp not found on PATH (brew install yt-dlp / winget install yt-dlp.yt-dlp)")
    if a.recent:
        # yt-dlp dropped the ytsearchdate: prefix; YouTube's results page sorted by upload date
        # (sp=CAI%3D) is the supported route.
        target = ("https://www.youtube.com/results?sp=CAI%253D&search_query="
                  + urllib.parse.quote_plus(a.query))
        limit = ["--playlist-end", str(a.n)]
    else:
        target, limit = f"ytsearch{a.n}:{a.query}", []
    proc = subprocess.run(
        ["yt-dlp", target, *limit, "--flat-playlist", "--dump-json",
         "--no-warnings", "--ignore-errors"],
        capture_output=True, text=True, encoding="utf-8")
    if proc.returncode not in (0, 1) or not proc.stdout.strip():
        die(f"search failed: {(proc.stderr or 'no output').strip().splitlines()[-1:]}")
    for line in proc.stdout.splitlines():
        try:
            v = json.loads(line)
        except json.JSONDecodeError:
            continue
        item = {
            "id": v.get("id"),
            "title": v.get("title"),
            "channel": v.get("channel") or v.get("uploader"),
            "duration": fmt_duration(v.get("duration")),
            "views": v.get("view_count"),
            "url": f"https://www.youtube.com/watch?v={v.get('id')}",
        }
        if a.json:
            print(json.dumps(item, ensure_ascii=False))
        else:
            views = f"{item['views']:,} views" if isinstance(item["views"], int) else "? views"
            print(f"{item['title']}\n  {item['channel']}  |  {item['duration']}  |  {views}\n  {item['url']}\n")


# ---------- Gemini (summary / ask / transcript) ----------

def video_url(ref):
    m = re.search(r"(?:v=|youtu\.be/|/shorts/|/live/|/embed/)([A-Za-z0-9_-]{11})", ref)
    vid = m.group(1) if m else ref.strip()
    if not re.fullmatch(r"[A-Za-z0-9_-]{11}", vid):
        die(f"not a YouTube URL or 11-character video id: {ref!r}")
    return f"https://www.youtube.com/watch?v={vid}"


def offset(ts):
    """'12:30' / '1:02:03' / '750' / '750s' -> '750s' (Gemini VideoMetadata offset)."""
    if ts is None:
        return None
    t = ts.strip().rstrip("s")
    try:
        parts = [float(p) for p in t.split(":")]
    except ValueError:
        die(f"bad timestamp {ts!r}: use SS, MM:SS or HH:MM:SS")
    sec = 0.0
    for p in parts:
        sec = sec * 60 + p
    return f"{int(sec)}s"


def gemini_key():
    key = os.environ.get("GEMINI_API_KEY", "").strip()
    if key:
        return key
    node = shutil.which("node")
    if node and RESOLVER.exists():
        r = subprocess.run([node, str(RESOLVER), "GEMINI_API_KEY"], capture_output=True, text=True)
        if r.returncode == 0 and r.stdout.strip():
            return r.stdout.strip()
    die("no Gemini key: set GEMINI_API_KEY, or unlock Bitwarden (`bwu`) so "
        "resolve-secret.js can read the GEMINI_API_KEY item", 2)


def ask_gemini(a, prompt):
    try:
        from google import genai
        from google.genai import errors, types
    except ImportError:
        die("google-genai is not installed in the ~/.claude venv "
            "(~/.claude/.venv/bin/python3 -m pip install google-genai)")
    url = video_url(a.video)          # validate the video before touching the key
    client = genai.Client(api_key=gemini_key())
    meta = None
    if a.start or a.end:
        meta = types.VideoMetadata(start_offset=offset(a.start), end_offset=offset(a.end))
    video = types.Part(file_data=types.FileData(file_uri=url), video_metadata=meta)
    cfg = types.GenerateContentConfig(
        media_resolution=types.MediaResolution.MEDIA_RESOLUTION_LOW if a.low_res else None)
    try:
        resp = client.models.generate_content(
            model=a.model, contents=types.Content(role="user", parts=[video, types.Part(text=prompt)]),
            config=cfg)
    except errors.APIError as e:
        code = getattr(e, "code", None)
        if code == 429:
            die("Gemini quota hit (429) - stop and try later; don't retry in a loop", 3)
        if code == 404:
            die(f"model {a.model!r} not found - pass --model with a current Flash model "
                "(ai.google.dev/gemini-api/docs/models) or set YT_GEMINI_MODEL")
        die(f"Gemini error {code}: {getattr(e, 'message', e)}")
    text = (resp.text or "").strip()
    if not text:
        die("Gemini returned no text (private, age-restricted, deleted or live video?)")
    if a.json:
        print(json.dumps({"url": url, "model": a.model, "start": a.start,
                          "end": a.end, "text": text}, ensure_ascii=False))
    else:
        print(text)


def main(argv):
    p = argparse.ArgumentParser(prog="yt", description=__doc__.split("\n\n")[0])
    p.add_argument("--json", action="store_true", help="JSON output (search: one object per line)")
    p.add_argument("--model", default=DEFAULT_MODEL, help=f"Gemini model (default {DEFAULT_MODEL})")
    sp = p.add_subparsers(dest="cmd", required=True)

    s = sp.add_parser("search")
    s.add_argument("query")
    s.add_argument("-n", type=int, default=10)
    s.add_argument("--recent", action="store_true", help="sort by upload date (best-effort)")

    def video_cmd(name, extra=None):
        q = sp.add_parser(name)
        q.add_argument("video", help="YouTube URL or video id")
        if extra:
            q.add_argument(extra)
        q.add_argument("--start", help="clip start (SS, MM:SS, HH:MM:SS)")
        q.add_argument("--end", help="clip end")
        if name != "transcript":
            q.add_argument("--low-res", action="store_true", help="fewer frame tokens (talking heads)")
        return q

    video_cmd("summary")
    video_cmd("ask", "question")
    video_cmd("transcript")

    # Accept the global flags anywhere, as the skill documents (`yt summary URL --json`).
    globals_ = []
    rest = []
    it = iter(argv)
    for x in it:
        if x == "--json":
            globals_.append(x)
        elif x == "--model":
            globals_ += [x, next(it, "")]
        elif x.startswith("--model="):
            globals_.append(x)
        else:
            rest.append(x)
    a = p.parse_args(globals_ + rest)
    a.low_res = getattr(a, "low_res", False)

    if a.cmd == "search":
        cmd_search(a)
    elif a.cmd == "summary":
        ask_gemini(a, SUMMARY_PROMPT)
    elif a.cmd == "ask":
        ask_gemini(a, f"Answer this question about the video, citing [MM:SS] timestamps for the "
                      f"evidence you use (including on-screen content):\n\n{a.question}")
    else:
        ask_gemini(a, TRANSCRIPT_PROMPT)


if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    main(sys.argv[1:])

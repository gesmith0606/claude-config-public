---
name: reddit
description: Search and read Reddit from the command line (no login, no API key) via the Arctic Shift archive. Use when the user asks what Reddit says about something, wants community opinions, troubleshooting threads, "is X legit" checks, subreddit consensus, or a user's post history.
---

# reddit

Search and read Reddit via the `reddit` CLI, which queries the Arctic Shift archive
API (`https://arctic-shift.photon-reddit.com/api`). Free, no key, no account. Data is
near-live (usually minutes behind reddit.com) with history back to 2005.

- CLI source: `%USERPROFILE%\tools\reddit-cli\reddit` (Python 3, stdlib only)
- Wrapper on PATH: `%USERPROFILE%\tools\bin\reddit.cmd` (sets UTF-8 output)
- If `reddit` is not found in a shell, run:
  `python "$env:USERPROFILE\tools\reddit-cli\reddit" <args>`

Why this exists: Reddit closed self-service API keys (Nov 2025) and blocks
unauthenticated .json requests with 403 (mid-2026), which broke PRAW-based tools and
most Reddit MCP servers. The archive is the working no-auth path.

## Commands

```
reddit search "keywords" -s sub1,sub2 [-n 25] [--after YYYY-MM-DD] [--before YYYY-MM-DD]
reddit browse -s sub1,sub2 [-n 25] [--after DATE] [--before DATE]
reddit thread <post_id|full reddit url> [-n 30]
reddit comments "keywords" -s sub [-n 25]
reddit user <username> [-n 25] [--after DATE] [--before DATE]
```

Add `--json` anywhere for JSON lines (one object per post/comment) - prefer this when
filtering or saving results, e.g. `reddit --json search ... > results.jsonl`.

## Rules that matter

- **Keyword search REQUIRES `-s subreddit`.** No global keyword index. Cover a topic
  by passing several relevant subs comma-separated; the CLI fans out and dedupes.
- **HTTP 422 = archive query timeout, not a bad request.** Full-text search on large
  or broad scopes times out. Fixes, in order:
  1. Search one subreddit per call instead of a comma list.
  2. Add `--after` to bound the date range (a year or less usually works).
  3. Use a simpler single-word keyword.
  4. Wait 30-60s and retry. Large subs (e.g. r/ReverseEngineering) time out more often.
  The CLI already retries 422/429 with backoff before failing.
- **HTTP 429 = rate limited.** Stop and wait a minute. Do not loop rapid retries.
- **Scores are unreliable.** Post scores are snapshotted early (often 0/1). Use
  `num_comments` and comment scores for signal.
- **Be polite.** Volunteer-run service. Don't parallelize or raise limits aggressively.
- **Removed content:** results may include posts later removed by mods (`[removed]`).
  Cross-check the permalink if a result matters.

## When to use this vs web search

- Use `reddit` for: owner opinions, troubleshooting threads, community consensus,
  user histories, finding discussion of a specific product/vuln/tool.
- Use web search for: breaking news, or when phrasing matters - web search sometimes
  finds threads the archive keyword search misses. If `reddit search` returns nothing,
  try alternate phrasings and neighboring subreddits before concluding nothing exists.

## Output

Text mode: one block per result - date, subreddit, score, comment count, author,
title, selftext snippet, permalink (`https://reddit.com/r/<sub>/comments/<id>/`).
`thread` prints the post body plus top comments, score-sorted. Dates are UTC.
When reporting results to the user, cite permalinks.

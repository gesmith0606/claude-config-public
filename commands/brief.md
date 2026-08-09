---
description: Morning brief — today's calendar, important unread mail, and open PRs needing attention. Read-only.
argument-hint: "[date YYYY-MM-DD]  (default: today)"
allowed-tools: Bash(gws calendar events list:*), Bash(gws gmail users messages list:*), Bash(gws gmail users messages get:*), Bash(gh pr list:*)
---

Assemble a concise morning brief for **$ARGUMENTS** (default: today). Strictly read-only — no writes, no sends.

Resolve the target date: if `$ARGUMENTS` is empty use today's date; if it is a relative word like `tomorrow` compute the correct YYYY-MM-DD. Then derive ISO 8601 boundaries: `<date>T00:00:00Z` and `<date>T23:59:59Z`.

**1. Calendar — what's on**

- !`gws calendar events list --params '{"calendarId":"primary","timeMin":"<date>T00:00:00Z","timeMax":"<date>T23:59:59Z","singleEvents":true,"orderBy":"startTime","maxResults":25}'`

Render each event: start time · title · duration · join/location link if present. Flag back-to-back blocks (< 10 min gap), overlapping events, and all-day holds that shrink focus time. Omit declined and cancelled events.

**2. Mail — important & unread**

- !`gws gmail users messages list --params '{"userId":"me","q":"is:unread is:important newer_than:1d","maxResults":15}'`

For each message ID returned, fetch metadata:
- !`gws gmail users messages get --params '{"userId":"me","id":"<id>","format":"metadata","metadataHeaders":["From","Subject","Date"]}'`

Summarize: sender · subject · one-line gist from the snippet. Flag anything action-required or time-sensitive. Cap display at 10 threads; if more exist, note the overflow count. If `gws` is unavailable (auth lapsed, not installed), fall back to the **Gmail claude.ai connector** (enable at claude.ai → Settings → Connectors → Gmail; it requires no CLI auth).

**3. PRs — attention required**

- !`gh pr list --search "assignee:@me is:open" --json number,title,updatedAt,reviewDecision,statusCheckRollup --limit 20`
- !`gh pr list --search "review-requested:@me is:open" --json number,title,author,updatedAt,reviewDecision --limit 20`

Merge and deduplicate by PR number. Surface items in this priority order: failing CI → changes-requested → no reviewer assigned → stale (> 3 days without activity). Skip draft PRs unless they have a failing check. If `gh` is not authenticated, note it and skip this section rather than failing the whole brief.

**Output format**

Three compact sections — **Calendar / Mail / PRs** — each fitting a phone screen. No padding prose. One line per item; urgency signals only where genuinely urgent.

Close with: "Deliver via `~/.claude/scripts/notify.js`?" — if the user confirms, invoke that script with the brief text (pipe as stdin or pass as first argument). If `notify.js` does not yet exist, say so and offer to print to terminal as-is.

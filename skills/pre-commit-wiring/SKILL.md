---
name: pre-commit-wiring
description: >-
  Wires the pre-commit framework into a repo so secret scanning (gitleaks), lint, and
  file-hygiene gates run automatically on every `git commit`. Use when setting up a new
  repo, onboarding a project to automated checks, or asking "how do I stop secrets from
  leaking into git history".
---

# Pre-commit Wiring

One job: put a local gate in front of every `git commit`. The analysis skills
(`secrets-handling`, `insecure-defaults`, `supply-chain-risk-auditor`) tell you
*what* to fix — this skill makes the checks *run automatically*. All hooks execute
fully local after an initial download of hook code from their public repos; no code
or data is sent outbound. Safe for confidential work with regulated data present.

## Install (once per machine)

```bash
uv tool install pre-commit
```

Then in each repo:

```bash
pre-commit install
```

## Canonical `.pre-commit-config.yaml`

Drop this at repo root. Remove the ruff block for non-Python repos.

```yaml
repos:
  # Secret scanning — keep on EVERY repo; mandatory for confidential work ───
  - repo: https://github.com/gitleaks/gitleaks
    rev: v8.18.4            # refresh with: pre-commit autoupdate
    hooks:
      - id: gitleaks

  # File hygiene ─────────────────────────────────────────────────────────────
  - repo: https://github.com/pre-commit/pre-commit-hooks
    rev: v4.6.0
    hooks:
      - id: trailing-whitespace
      - id: end-of-file-fixer
      - id: check-added-large-files
      - id: check-merge-conflict

  # Python: ruff lint + format — remove for non-Python repos ────────────────
  # Enable Bandit-equivalent S rules via pyproject.toml: select = ["E","F","S","W"]
  - repo: https://github.com/astral-sh/ruff-pre-commit
    rev: v0.4.10
    hooks:
      - id: ruff
        args: [--fix]
      - id: ruff-format
```

Refresh all pins in one command (needs network; run periodically):

```bash
pre-commit autoupdate
```

## Per-context selection

| Hook | Every repo | Python repo | Confidential work |
|---|---|---|---|
| gitleaks | ✓ | ✓ | ✓ **mandatory** |
| pre-commit-hooks | ✓ | ✓ | ✓ |
| ruff | — | ✓ | ✓ (Python only) |

**Confidential-work rule:** never skip gitleaks on any repo that has touched client, regulated,
or PII data.

## Scanning all files (not just staged)

```bash
pre-commit run --all-files           # full scan
pre-commit run gitleaks --all-files  # secret scan only
```

Run once after wiring an existing repo — catches anything staged or already tracked.

## Gitleaks: custom org-specific patterns

For org-specific patterns (internal project codes, identifiers), add `.gitleaks.toml`:

```toml
[[rules]]
id = "project-code"
description = "Internal project codename"
regex = '''PROJECT-[A-Z]{3,6}'''    # adjust to your naming convention
tags = ["confidential"]
```

Then reference it in the hook:

```yaml
      - id: gitleaks
        args: [--config, .gitleaks.toml]
```

## What NOT to add

- **CodeQL** — uploads code to GitHub. Disqualified for PE-fund repos.
- **Dependabot / Renovate** — hosted services. Fine on the personal/public NFL repo; not PE repos.
- **Semgrep** — managed ruleset has a 2024 commercial-use restriction; CE is optional and overkill here.
- **trivy** — container/image scanning; out of scope for this config.

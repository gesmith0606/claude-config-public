---
name: secrets-handling
description: "Write-time secret hygiene: keep credentials out of code as it's written. Use when adding a DB connection, API client, auth token, cloud SDK call, or .env — or when asked where a credential should live. Covers runtime resolution (env / AWS / Azure / GCP / Vault), password-free connection strings, log redaction, and rotation."
allowed-tools: Read, Write, Edit, Grep, Glob
---

# Secrets Handling (write-time)

Keep credentials out of source as you write it. The rule: **code carries the
*name* of a secret, never its *value*.** Resolve the value at runtime.

This is the *prevention* counterpart to `insecure-defaults` (which *detects*
hardcoded secrets and fail-open fallbacks after the fact). For credential APIs
that are easy to misuse see `sharp-edges`; for failures during resolution see
`error-handling`.

## The one rule, four tiers

Pick the lowest tier that fits the deployment:

1. **Local dev** — `.env` file (git-ignored) loaded via `dotenv`. Commit a
   `.env.example` with keys and placeholder values only.
2. **CI / runtime** — process environment variables injected by the platform
   (GitHub Actions secrets, container env, systemd `EnvironmentFile`).
3. **Servers / cloud** — a secret manager: AWS Secrets Manager, Azure Key Vault,
   GCP Secret Manager, or HashiCorp Vault. Fetch at startup, cache in memory.
4. **Workload identity** — no stored secret at all; assume an IAM role / managed
   identity and let the SDK sign requests. Prefer this when available.

## Resolve at runtime, fail-secure

```python
import os
secret = os.environ["DB_PASSWORD"]          # KeyError if missing → fail-secure
# NOT: os.environ.get("DB_PASSWORD", "changeme")  # fail-open — insecure-defaults flags this
```

```python
# Secret manager (AWS shown; same shape for Azure/GCP/Vault) — fetch, don't embed
import boto3, json
def load_db_secret(name="prod/db"):
    raw = boto3.client("secretsmanager").get_secret_value(SecretId=name)
    return json.loads(raw["SecretString"])   # {"username":..., "password":...}
```

Invoke Python as `python3` (on Windows the MS-Store `python` may be a stub; use
`py -3` if `python3` is unavailable).

## Connection strings without embedded passwords

Never bake the password into a literal URL. Build it from resolved parts, or
hand credentials to the driver separately so they never live in one string.

```python
from sqlalchemy import create_engine, URL
url = URL.create(                            # safely URL-encodes; nothing to log-leak
    "postgresql+psycopg",
    username=os.environ["DB_USER"],
    password=os.environ["DB_PASSWORD"],
    host=os.environ["DB_HOST"], database="app",
)
engine = create_engine(url)
```

- For workload identity, omit the password entirely and use IAM auth tokens
  (RDS IAM, Cloud SQL connector, Azure AD) generated per-connection.
- `.env` example: `DATABASE_URL=postgresql+psycopg://app@localhost/app` — note
  the password is absent; the driver prompts/resolves it.

## Redact in logs and tracebacks

Secrets leak through `print`, log lines, exception messages, and repr of config
objects. Defend at the boundary:

- Never log a connection URL, header dict, or full config object verbatim.
- Wrap secrets in a type whose `__repr__`/`__str__` returns `"***"` (e.g.
  Pydantic `SecretStr`), so accidental interpolation can't expose them.
- Scrub known keys (`password`, `token`, `api_key`, `authorization`) in a
  logging filter before records are emitted.
- On exceptions, log the secret's *name/source*, not its value — see
  `error-handling` for the message-shaping pattern.

## Rotation

Assume every secret will be rotated. Resolve at startup (and on a refresh
interval or on auth-failure retry) rather than caching for the process lifetime,
so a rotated value is picked up without a redeploy. Prefer managers that version
secrets so rollback is a pointer change.

## Never

- Inline a literal key/password/token in source, even "temporarily."
- Commit a real `.env`, keyfile, or `*.pem` — git-ignore them; commit only
  `.env.example`.
- Print secrets in **notebooks** (outputs are saved to disk and pushed) or echo
  them in **CI logs** (use the platform's masked-secret mechanism).
- Pass secrets as command-line args (visible in `ps` / shell history) — use env
  or stdin.
- Embed credentials in container images, IaC literals, or front-end bundles.

Before finishing any change that touches credentials, run `insecure-defaults`
over the diff to confirm nothing hardcoded slipped in.

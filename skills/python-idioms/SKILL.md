---
name: python-idioms
description: >-
  Declares the user's Python toolchain defaults and idiom decisions so each session stops
  re-negotiating tool choice. Use when starting a new Python project, picking a linter/formatter,
  choosing between dataclass and Pydantic, deciding on async, or setting up pytest fixtures.
---

# Python Idioms

> **Routing:** dataframe correctness → `dataframes`; the TDD cycle itself → `test-driven-development`; error-handling design → `error-handling`.

One page of locked-in decisions. Claude already knows this language; this skill stops relitigating
tool choice. Follow these defaults unless the project already diverges — if it does, note the delta
and move on.

## Toolchain defaults

| Concern | Use | Not |
|---|---|---|
| Package/env management | **uv** | pip, poetry, venv |
| Lint + format + import sort | **ruff** | black + flake8 + isort |
| Type checking | **mypy** | (see ty note below) |
| Testing | **pytest** + pytest-cov | unittest |

**uv** — already installed. Always use it.

```bash
uv init my-project          # new project
uv add requests             # runtime dep
uv add --dev pytest ruff mypy pytest-cov  # dev deps
uv run pytest               # run without activating venv
uv run mypy src/            # same pattern for any tool
```

**ruff** replaces black + flake8 + isort in one pass. Default config in `pyproject.toml`:

```toml
[tool.ruff]
line-length = 88

[tool.ruff.lint]
select = ["E", "F", "I", "UP"]  # pycodestyle, pyflakes, isort, pyupgrade
```

**mypy** is the safe default today. **ty** (`astral-sh/ty`) is the faster forward path but still
BETA as of mid-2025 — do not default to it yet; note the option when mypy is the bottleneck.

## dataclass vs Pydantic v2

**Rule:** dataclass for internal value objects; Pydantic v2 for anything crossing a trust boundary.

- Internal pipeline node, named tuple replacement, simple struct → `@dataclass`
- API request/response, config file, CLI args, external JSON → `pydantic.BaseModel`

```python
# Internal — no runtime validation needed
from dataclasses import dataclass

@dataclass
class TradeRecord:
    ticker: str
    shares: int

# Trust boundary — validate on entry
from pydantic import BaseModel

class ApiPayload(BaseModel):
    ticker: str
    shares: int  # Pydantic rejects "abc" at runtime
```

Pydantic v2 only. Do not mix v1 patterns (`orm_mode`, `validator`) — use `model_config` and
`@field_validator`.

## Typing defaults

Prefer typed shapes over bare containers:

```python
# Prefer
from typing import Protocol, TypeVar, Literal, TypedDict

class Readable(Protocol):          # structural subtyping — no inheritance needed
    def read(self) -> str: ...

T = TypeVar("T")                   # generics

Status = Literal["open", "closed"] # exhaustive string sets

class Row(TypedDict):              # typed dict shape (no runtime overhead)
    ticker: str
    price: float

# Avoid
def process(data: dict) -> list: ...  # too loose
```

Use `X | None` (Python 3.10+ union syntax) over `Optional[X]`.

## pytest quick-ref

```python
# conftest.py — place at the package root (or test root) for shared fixtures
import pytest

@pytest.fixture(scope="module")   # function | module | session | package
def db_conn():
    conn = connect()
    yield conn
    conn.close()

# parametrize
@pytest.mark.parametrize("x,expected", [(1, 2), (3, 4)])
def test_increment(x, expected):
    assert increment(x) == expected

# float equality
assert result == pytest.approx(3.14, rel=1e-4)

# file I/O — use tmp_path (function-scoped fixture, auto-cleaned)
def test_write(tmp_path):
    f = tmp_path / "out.csv"
    f.write_text("a,b")
    assert f.read_text() == "a,b"
```

Coverage: `uv run pytest --cov=src --cov-report=term-missing`

## Async rule

**Sync first.** Add asyncio only when an I/O boundary forces concurrent waiting (HTTP fan-out,
multiple DB calls in parallel). Never for CPU-bound work — use `multiprocessing` or `concurrent.futures`.

If you do go async: `asyncio.TaskGroup` (3.11+) over `gather`; `anyio` if you need backend-agnostic
code.

## Profiling ladder

Start cheap; escalate only when the previous step doesn't answer the question.

1. **cProfile** — call-count hotspots, zero install:
   ```bash
   uv run python -m cProfile -s cumulative my_script.py | head -30
   ```
2. **py-spy** — sampling profiler, attach to live process, no code changes:
   ```bash
   uv tool install py-spy
   py-spy top --pid <PID>          # live top-like view
   py-spy record -o profile.svg --pid <PID>   # flamegraph
   ```
3. **memray** — memory profiling. **Linux/macOS/WSL only** (not native Windows):
   ```bash
   uv add --dev memray
   uv run memray run my_script.py
   uv run memray flamegraph memray-my_script.py.bin
   ```

---

All tooling runs locally. No egress.

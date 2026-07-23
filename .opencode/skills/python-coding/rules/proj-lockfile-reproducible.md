# proj-lockfile-reproducible

> Pin/lock dependencies (lockfile) for reproducible installs across environments

## Why It Matters

`dependencies = ["httpx>=0.27"]` in `pyproject.toml` is a *range*, not a specific version — two installs performed on different days can resolve to different transitive dependency versions, and "works on my machine" turns into "broke in CI" or "broke in production" purely because the dependency graph shifted underneath you. A lockfile pins every package (direct and transitive) to an exact version and hash, so `pip install` / `uv sync` / `poetry install` produces byte-for-byte the same environment everywhere it's run.

## Bad

```toml
# pyproject.toml — only loose ranges, no lockfile committed
[project]
dependencies = [
    "httpx>=0.27",
    "pydantic>=2.0",
]
```

```bash
# CI installs whatever the latest matching versions happen to be *today*
pip install -e .
# ...six months later, a transitive dependency bump silently changes behavior in prod
```

## Good

```bash
# uv: generates uv.lock pinning every resolved package + hash
uv lock
git add uv.lock

# CI and every developer install from the lock, not from loose ranges
uv sync --frozen
```

```toml
# pyproject.toml still declares ranges — the lockfile pins the exact resolution
[project]
dependencies = [
    "httpx>=0.27",
    "pydantic>=2.0",
]
```

## Tool-Specific Lockfiles

| Tool | Lockfile |
|---|---|
| `uv` | `uv.lock` |
| Poetry | `poetry.lock` |
| pip-tools | `requirements.txt` (compiled from `requirements.in`) |
| Pipenv | `Pipfile.lock` |

```bash
# pip-tools: the classic approach when not using a full dependency manager
pip-compile pyproject.toml --output-file requirements.txt
pip-sync requirements.txt
```

Commit the lockfile to version control alongside `pyproject.toml`, regenerate it deliberately (not automatically in CI) when you want to accept new versions, and treat lockfile diffs in PRs as something to actually review — a lockfile update is a real change to what code runs in production.

## See Also

- [`proj-venv-isolation`](proj-venv-isolation.md) - the environment the lockfile is installed into
- [`proj-pyproject-single-source`](proj-pyproject-single-source.md) - where the loose version ranges are declared
- [`lint-ci-enforce`](lint-ci-enforce.md) - enforcing that CI installs from the lockfile, not a fresh resolution

# proj-venv-isolation

> Isolate project dependencies with a dedicated virtual environment per project

## Why It Matters

Installing dependencies into the system/global Python (or a single shared environment used by every project) means two projects with conflicting version requirements for the same library simply cannot coexist, and upgrading a dependency for one project silently breaks another. A dedicated virtual environment per project pins exactly the packages (and versions) that project needs, isolated from the system interpreter and from every other project, so `pip install` in one project can never affect another.

## Bad

```bash
# Installing directly into the system Python — affects every project and script on the machine
sudo pip install httpx==0.20 pydantic==1.10

# Later, a different project needs httpx>=0.27 and pydantic v2 — now they conflict globally
sudo pip install httpx==0.27 pydantic==2.5  # may silently break the first project
```

## Good

```bash
# Create and activate an isolated environment scoped to this project only
python -m venv .venv
source .venv/bin/activate       # Linux/macOS
# .venv\Scripts\activate        # Windows

pip install -e ".[dev]"         # installs into .venv, not system Python
```

```
myproject/
├── .venv/            # gitignored — not committed, regenerated per machine
├── pyproject.toml
└── src/mypackage/
```

## Modern Alternatives

Tools like `uv`, `pipenv`, and `poetry` wrap `venv` creation and dependency installation into a single workflow, often faster and with an integrated lockfile:

```bash
# uv: creates .venv automatically and resolves deps against pyproject.toml
uv venv
uv pip install -e ".[dev]"

# or, for a fully managed project workflow:
uv sync
```

Whichever tool you use, the invariant stays the same: never `pip install` into the interpreter your OS or shell defaults to. Add `.venv/` (or the tool's equivalent) to `.gitignore` — the environment itself is disposable and machine-specific; only the dependency *specification* (`pyproject.toml`) and lockfile should be committed.

A broken or stale environment should always be safe to delete and recreate from scratch (`rm -rf .venv && python -m venv .venv && pip install -e ".[dev]"`) in seconds — if recreating your project's environment feels risky or slow, that's a sign dependencies or setup steps aren't fully captured in version-controlled configuration.

```bash
# Sanity-check which interpreter/environment is actually active before installing anything
which python
python -c "import sys; print(sys.prefix)"  # should point inside .venv, not the system install
```

## See Also

- [`proj-lockfile-reproducible`](proj-lockfile-reproducible.md) - pinning exact versions inside the isolated environment
- [`proj-pyproject-single-source`](proj-pyproject-single-source.md) - the dependency declarations the venv is built from
- [`proj-optional-dependencies`](proj-optional-dependencies.md) - installing extras like `.[dev]` into the venv

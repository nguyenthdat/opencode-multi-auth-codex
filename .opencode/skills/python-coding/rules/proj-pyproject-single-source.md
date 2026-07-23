# proj-pyproject-single-source

> Use `pyproject.toml` as the single source of packaging/build configuration

## Why It Matters

Before PEP 517/518, Python packaging configuration was scattered across `setup.py` (imperative, arbitrary code executed at build time), `setup.cfg`, `MANIFEST.in`, and tool-specific files, making it hard to know where a given setting lived or to build a package without executing untrusted code. `pyproject.toml` centralizes build-system requirements, project metadata, and most tool configuration (pytest, mypy, ruff, coverage) into one declarative, statically parseable file, which is both safer and easier for humans and tools to reason about.

## Bad

```python
# setup.py — imperative, executed as arbitrary code during build/install
from setuptools import setup, find_packages

setup(
    name="mypackage",
    version="1.2.3",          # duplicated in mypackage/__init__.py too
    packages=find_packages(),
    install_requires=["httpx>=0.27", "pydantic>=2.0"],
)
```

```ini
# setup.cfg — a second file with overlapping, easy-to-miss configuration
[options]
python_requires = >=3.11
```

## Good

```toml
# pyproject.toml — single declarative source of truth
[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[project]
name = "mypackage"
version = "1.2.3"
requires-python = ">=3.11"
dependencies = [
    "httpx>=0.27",
    "pydantic>=2.0",
]

[project.optional-dependencies]
dev = ["pytest>=8.0", "ruff>=0.6", "mypy>=1.10"]

[tool.ruff]
line-length = 100

[tool.pytest.ini_options]
testpaths = ["tests"]
```

## When a `setup.py` Is Still Needed

A minimal `setup.py` is occasionally still required for packages with compiled extensions that need custom build steps (Cython, C extensions via `setuptools.Extension`), but even then it should be a thin shim that defers to `pyproject.toml` for everything expressible there:

```python
# setup.py — only present because this package needs a custom build_ext step
from setuptools import setup

setup()  # all metadata lives in pyproject.toml; this file exists only for build_ext hooks
```

Modern build backends (hatchling, PDM, Poetry, setuptools >= 61) all read `[project]` directly, so for pure-Python packages `pyproject.toml` alone is sufficient — no `setup.py` at all.

## See Also

- [`proj-version-single-source`](proj-version-single-source.md) - avoiding the version-duplication problem shown above
- [`proj-entry-points`](proj-entry-points.md) - declaring CLI scripts in the same file
- [`proj-optional-dependencies`](proj-optional-dependencies.md) - the `[project.optional-dependencies]` table in practice

# proj-version-single-source

> Single-source the package version (avoid duplicating it in multiple files)

## Why It Matters

When the version string is written by hand in `pyproject.toml`, `mypackage/__init__.py`, and maybe a `docs/conf.py`, it's only a matter of time before a release bumps one and forgets another — producing a package that reports a different version depending on which file you check, and CI that ships a wheel labeled `1.2.3` built from `__version__ = "1.2.2"` source. Single-sourcing means exactly one file holds the real version, and everything else (including runtime introspection) derives from it.

## Bad

```toml
# pyproject.toml
[project]
name = "mypackage"
version = "1.2.3"
```

```python
# mypackage/__init__.py
__version__ = "1.2.2"  # forgot to bump this when pyproject.toml was updated — now they disagree
```

## Good

```toml
# pyproject.toml — dynamic version, no hardcoded string to keep in sync
[project]
name = "mypackage"
dynamic = ["version"]

[tool.hatch.version]
path = "src/mypackage/__init__.py"
```

```python
# src/mypackage/__init__.py — the one place the version literally lives
__version__ = "1.2.3"
```

```python
# anywhere else that needs the version, read it at runtime instead of hardcoding it again
from importlib.metadata import version

installed_version = version("mypackage")
```

## Alternative: Derive the Version from Git Tags

Tools like `hatch-vcs` or `setuptools-scm` go a step further and derive the version directly from the latest git tag at build time, so there's no file to bump manually at all:

```toml
[build-system]
requires = ["hatchling", "hatch-vcs"]
build-backend = "hatchling.build"

[project]
dynamic = ["version"]

[tool.hatch.version]
source = "vcs"
```

```bash
git tag v1.3.0
python -m build  # the built wheel is automatically versioned 1.3.0
```

Whichever approach you pick, the test is simple: can you point to exactly one place in the repo where the version is authored, with every other reference derived from it?

## See Also

- [`proj-pyproject-single-source`](proj-pyproject-single-source.md) - the file that declares `dynamic = ["version"]`
- [`proj-init-explicit`](proj-init-explicit.md) - `__init__.py` as the common home for `__version__`
- [`doc-changelog-keep`](doc-changelog-keep.md) - pairing each version bump with a changelog entry

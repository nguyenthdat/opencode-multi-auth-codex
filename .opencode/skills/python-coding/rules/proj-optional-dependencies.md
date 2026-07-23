# proj-optional-dependencies

> Use `[project.optional-dependencies]`/extras for optional features

## Why It Matters

Bundling every dependency a package could ever need into one mandatory `dependencies` list forces every user to install heavy, often-unused packages (a plotting library, a specific cloud SDK, test tooling) just to use the core functionality. `[project.optional-dependencies]` groups dependencies into named "extras" that users opt into explicitly (`pip install mypackage[plotting]`), keeping the base install lean while still making the optional features a first-class, discoverable part of the package.

## Bad

```toml
# pyproject.toml — everything is mandatory, even features most users never touch
[project]
dependencies = [
    "httpx>=0.27",
    "pydantic>=2.0",
    "matplotlib>=3.8",   # only needed for the optional `.plot()` method
    "boto3>=1.34",        # only needed for the optional S3 export feature
    "pytest>=8.0",         # a dev/test dependency, shouldn't ship to end users at all
]
```

## Good

```toml
# pyproject.toml
[project]
dependencies = [
    "httpx>=0.27",
    "pydantic>=2.0",
]

[project.optional-dependencies]
plotting = ["matplotlib>=3.8"]
aws = ["boto3>=1.34"]
dev = ["pytest>=8.0", "ruff>=0.6", "mypy>=1.10"]
all = ["mypackage[plotting,aws]"]   # convenience group referencing other extras
```

```bash
pip install mypackage             # core only, lean install
pip install "mypackage[plotting]" # opts into matplotlib
pip install "mypackage[all]"      # everything
```

## Guarding the Optional Import at Runtime

Code that depends on an extra should fail with a clear, actionable message if it's not installed, rather than a bare `ModuleNotFoundError`:

```python
def plot(self) -> None:
    try:
        import matplotlib.pyplot as plt
    except ImportError as e:
        raise ImportError(
            "Plotting requires the 'plotting' extra: pip install mypackage[plotting]"
        ) from e
    ...
```

`dev`/`test`/`docs` extras are a convention for tooling that only contributors need, never end users — they're commonly excluded from `all` for exactly that reason.

## See Also

- [`proj-pyproject-single-source`](proj-pyproject-single-source.md) - the file where extras are declared
- [`perf-lazy-import`](perf-lazy-import.md) - importing the optional dependency only when the feature is used
- [`proj-lockfile-reproducible`](proj-lockfile-reproducible.md) - locking extras alongside core dependencies

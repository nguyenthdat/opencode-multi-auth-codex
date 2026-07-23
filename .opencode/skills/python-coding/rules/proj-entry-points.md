# proj-entry-points

> Define CLI entry points declaratively in `pyproject.toml` `[project.scripts]`

## Why It Matters

Without a declared entry point, users have to know your package's internal module path and invoke it with `python -m mypackage.cli` (or worse, a hardcoded shebang script) — an implementation detail that's a poor and unstable public interface. `[project.scripts]` lets the build backend generate a real executable (`mycli`) on `pip install`, placed on `PATH` inside whatever environment it was installed into, so users get a normal command-line tool instead of having to know your module layout.

## Bad

```python
# README.md tells users to run:
#   python -m mypackage.cli --help
# ...which breaks if the CLI module ever moves, and doesn't give a standalone `mycli` command
```

```bash
#!/usr/bin/env bash
# scripts/mycli.sh — hand-rolled wrapper shipped alongside the package, easy to get out of sync
python -m mypackage.cli "$@"
```

## Good

```toml
# pyproject.toml
[project.scripts]
mycli = "mypackage.cli:main"

# multiple entry points are fine too
mycli-admin = "mypackage.admin_cli:main"
```

```python
# src/mypackage/cli.py
import sys

def main() -> int:
    args = sys.argv[1:]
    ...
    return 0

if __name__ == "__main__":  # still supports `python -m mypackage.cli` for local dev
    sys.exit(main())
```

After `pip install .`, users get a real `mycli` command on their `PATH`:

```bash
$ pip install .
$ mycli --help
```

## GUI Scripts and Plugin Entry Points

`[project.gui-scripts]` is the equivalent table for GUI apps (avoids opening a console window on Windows), and `[project.entry-points."some.group"]` supports arbitrary plugin discovery groups beyond executables — the mechanism setuptools/Click/pytest plugins all rely on:

```toml
[project.entry-points."pytest11"]
myplugin = "mypackage.pytest_plugin"
```

## See Also

- [`proj-pyproject-single-source`](proj-pyproject-single-source.md) - where entry points are declared alongside the rest of packaging config
- [`proj-namespace-packages`](proj-namespace-packages.md) - the related plugin-discovery mechanism for extensible packages
- [`proj-src-layout`](proj-src-layout.md) - the package layout entry points typically point into

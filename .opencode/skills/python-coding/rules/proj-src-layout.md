# proj-src-layout

> Use a `src/` layout for installable packages to avoid accidental local imports

## Why It Matters

With a flat layout (package directory sitting next to `pyproject.toml` at the repo root), running tests or scripts from the repo root can silently import the package from the working directory instead of from the installed distribution — masking packaging bugs like missing files in the wheel, incorrect `package_data`, or an editable install that isn't actually wired up correctly. A `src/` layout makes it structurally impossible to import the package without it being installed, because the package isn't on `sys.path` by accident of your current working directory.

## Bad

```
myproject/
├── pyproject.toml
├── mypackage/          # importable directly from the repo root without installing
│   ├── __init__.py
│   └── core.py
└── tests/
    └── test_core.py    # `import mypackage` here might succeed even if the install is broken
```

## Good

```
myproject/
├── pyproject.toml
├── src/
│   └── mypackage/
│       ├── __init__.py
│       └── core.py
└── tests/
    └── test_core.py    # `import mypackage` only works if the package is actually installed
```

```toml
# pyproject.toml
[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[tool.hatch.build.targets.wheel]
packages = ["src/mypackage"]
```

## Verifying the Layout Actually Works

```bash
python -m venv .venv && source .venv/bin/activate
pip install -e .
pytest  # this now genuinely exercises the installed package, not a directory-proximity accident
```

Flat layouts are still fine for simple scripts or applications that are never installed as a distributable package (a standalone CLI you run with `python app.py`, not `pip install`). The `src/` layout earns its keep specifically for anything published to PyPI or installed by other projects, where "it works on my machine because I'm standing in the right directory" is a real, recurring bug class.

This is not a theoretical concern: `pip install -e .` combined with a flat layout has historically allowed `import mypackage` to succeed from the repo root even when the package metadata was broken, because Python found the directory on `sys.path` before ever consulting the installed distribution. The `src/` layout removes that ambiguity by construction — there is no `mypackage` directory sitting at the same level as your shell's current working directory to be found by accident.

## See Also

- [`proj-pyproject-single-source`](proj-pyproject-single-source.md) - the build configuration that declares the `src/` package
- [`proj-namespace-packages`](proj-namespace-packages.md) - a related packaging subtlety around implicit namespace packages
- [`proj-package-by-feature`](proj-package-by-feature.md) - how to organize the modules inside `src/mypackage`

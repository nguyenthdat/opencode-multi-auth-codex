# proj-namespace-packages

> Understand implicit namespace packages before relying on them for plugin systems

## Why It Matters

Since PEP 420, a directory containing Python files but no `__init__.py` is still importable as a "namespace package" — Python discovers it implicitly by scanning `sys.path` for matching directory names and merges all of them into one logical package. This enables powerful plugin architectures (multiple independently installed distributions contributing to the same top-level package name), but it also means a *missing* `__init__.py` might be an accident rather than a deliberate namespace-package design, silently changing import behavior and error messages in confusing ways if you don't know which one you're looking at.

## Bad

```
# Two unrelated packages accidentally share a directory name with no __init__.py,
# and nobody intended a namespace package — this "works" by accident and breaks
# in confusing ways when packaging tools disagree about it.
company_utils/
    logging.py   # no __init__.py — is this intentional or a forgotten file?
```

```python
# Debugging this is painful: `company_utils` might resolve to a directory the
# developer didn't expect, from a completely different installed distribution.
import company_utils.logging
```

## Good

```
# Deliberate namespace package: each plugin distribution owns its own subpackage,
# all contributing to the shared `company_plugins` namespace.

# Distribution A: company-plugins-auth
src/
    company_plugins/          # no __init__.py — intentional namespace package root
        auth/
            __init__.py       # the actual plugin subpackage DOES have __init__.py
            handler.py

# Distribution B: company-plugins-billing, installed separately
src/
    company_plugins/          # same namespace root, no __init__.py here either
        billing/
            __init__.py
            handler.py
```

```toml
# Each distribution declares only its own subpackage
[tool.hatch.build.targets.wheel]
packages = ["src/company_plugins"]
```

```python
import company_plugins.auth.handler
import company_plugins.billing.handler  # merged from a separate installed distribution
```

## The Practical Rule

For ordinary application/library code, always include `__init__.py` — regular packages are simpler, more explicit, and avoid surprises with tools that don't fully support namespace packages (older linters, some bundlers). Reserve namespace packages specifically for the plugin-ecosystem case, and document it clearly, since an absent `__init__.py` is otherwise indistinguishable from a mistake.

## See Also

- [`proj-src-layout`](proj-src-layout.md) - the layout namespace packages are typically built on top of
- [`proj-init-explicit`](proj-init-explicit.md) - why regular packages should have deliberate `__init__.py` files
- [`proj-package-by-feature`](proj-package-by-feature.md) - organizing the subpackages that plug into a namespace

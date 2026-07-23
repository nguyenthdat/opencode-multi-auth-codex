# anti-wildcard-import

> Don't use `from module import *`

## Why It Matters

Wildcard imports pull an unknown, unbounded set of names into the current namespace, so readers (and static analyzers) can no longer tell where a given name came from just by reading the file. Two wildcard-imported modules that happen to define the same name silently shadow each other with no error, and IDE "go to definition" and linting for unused/undefined names both degrade significantly. What looks like a shortcut in a small script becomes a maintenance hazard the moment the module grows or gets imported alongside another wildcard.

## Bad

```python
from os.path import *
from shutil import *

def deploy(path):
    if exists(path):          # from os.path or somewhere else? Not obvious from this line.
        copy(path, "/backup") # shutil.copy? or something else entirely?
    join(path, "logs")        # os.path.join - but nothing here signals that
```

## Good

```python
import os.path
import shutil

def deploy(path: str) -> None:
    if os.path.exists(path):
        shutil.copy(path, "/backup")
    os.path.join(path, "logs")
```

## Ruff Rule

`F403` flags wildcard imports, and `F405` flags names that *may* have come from one:

```toml
[tool.ruff.lint]
select = ["F"]
```

```python
from module import *   # F403: 'from module import *' used; unable to detect undefined names
result = some_name()    # F405: may be undefined, or defined from star imports
```

## Sanctioned Exceptions

A package's `__init__.py` re-exporting a submodule's public API is the one common accepted case, and even then, prefer explicit `__all__` plus explicit names over `*` where practical:

```python
# mypackage/__init__.py
from mypackage.models import User, Profile, Order  # explicit is preferable

__all__ = ["User", "Profile", "Order"]
```

Test modules using `from conftest import *` for shared fixtures are sometimes tolerated in small projects, but even there, explicit imports keep `F401`/`F405` linting meaningful.

## See Also

- [`anti-circular-import`](anti-circular-import.md) - another import-hygiene failure mode
- [`api-explicit-exports`](api-explicit-exports.md) - using `__all__` to define a deliberate public surface
- [`lint-isort-import-order`](lint-isort-import-order.md) - keeping explicit imports organized

# doc-all-dunder

> Declare `__all__` to make the intentional public surface of a module explicit

## Why It Matters

Without `__all__`, `from module import *` imports every top-level name that doesn't start with an underscore — including names imported *into* the module for internal use, which then leak into the importer's namespace as if they were part of the public API. Declaring `__all__` makes the module's public surface an explicit, reviewable list rather than an accident of which names happen to lack a leading underscore, and it's also read by documentation tools (Sphinx's `autosummary`, `pdoc`) to decide what to include in generated docs. It additionally gives static analysis tools a clear signal for "unused import" warnings — a name imported for re-export shouldn't be flagged as unused if it's listed in `__all__`.

## Bad

```python
# geometry.py
import math          # imported for internal use only
from typing import Protocol

PI = math.pi


class Point:
    ...


class _InternalHelper:  # underscore hides it from `import *`, but that's implicit
    ...


# No __all__: `from geometry import *` pulls in `math`, `Protocol`, `PI`,
# and `Point` all together - the module never declared what's actually public.
```

## Good

```python
# geometry.py
import math
from typing import Protocol

__all__ = ["PI", "Point", "distance"]

PI = math.pi


class Point:
    ...


def distance(a: Point, b: Point) -> float:
    ...


class _InternalHelper:
    ...
```

Now `from geometry import *` only pulls in `PI`, `Point`, and `distance` — `math` and `Protocol` stay implementation details, and `_InternalHelper`'s leading underscore is reinforced rather than being the only signal.

## `__all__` in Packages (`__init__.py`)

This is especially valuable at the package level, where `__init__.py` re-exports selected names from submodules to form a clean public API:

```python
# mypackage/__init__.py
from mypackage.client import Client
from mypackage.errors import APIError, RateLimitError

__all__ = ["Client", "APIError", "RateLimitError"]
```

## Keeping It in Sync

Linters can catch drift between `__all__` and what's actually defined:

```toml
[tool.ruff.lint]
select = ["F822"]  # undefined name in __all__
```

## See Also

- [`name-leading-underscore-private`](name-leading-underscore-private.md) - the complementary convention for individual private names
- [`api-explicit-exports`](api-explicit-exports.md) - designing the exported surface `__all__` declares
- [`doc-all-public-api`](doc-all-public-api.md) - `__all__` defines *what* is public; this rule covers documenting it

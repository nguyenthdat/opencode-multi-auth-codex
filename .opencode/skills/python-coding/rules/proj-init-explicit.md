# proj-init-explicit

> Keep `__init__.py` files intentional and minimal; avoid heavy logic at import time

## Why It Matters

`__init__.py` runs the moment its package (or any submodule inside it) is imported, so any expensive work placed there — network calls, file I/O, heavy third-party imports, database connections — executes unconditionally for every consumer of the package, even ones that only need one small function from a deep submodule. Heavy `__init__.py` logic also increases the risk of circular imports, since it forces the entire package's dependency graph to resolve before any single piece of it is usable.

## Bad

```python
# mypackage/__init__.py
import logging
from mypackage.db import connect  # opens a real connection at import time
from mypackage.config import load_config

logging.basicConfig(level=logging.DEBUG)  # mutates global logging config on import
config = load_config()                    # reads a file from disk on import
db_connection = connect(config.db_url)    # network I/O on import

from mypackage.models import User, Order  # pulls in the entire models module eagerly
```

## Good

```python
# mypackage/__init__.py
"""Public API surface for mypackage."""

from mypackage.models import Order, User

__all__ = ["User", "Order"]
__version__ = "1.2.3"

# No I/O, no side effects. Consumers who need config/db explicitly import and call:
#   from mypackage.config import load_config
#   from mypackage.db import connect
```

## What Belongs in `__init__.py`

A good `__init__.py` re-exports the package's intended public API (so callers can write `from mypackage import User` instead of `from mypackage.models.user import User`), sets `__all__` to make that surface explicit, and optionally exposes `__version__`. It should not perform I/O, register global logging/signal handlers, or eagerly import every submodule if some are rarely used and expensive to load:

```python
# For a package with an optional, heavy submodule, avoid pulling it in at __init__ time:
# mypackage/__init__.py
from mypackage.core import Client  # cheap, always needed

# users who need the heavy plotting extra import it explicitly:
#   from mypackage.plotting import render_chart
```

A quick litmus test during review: if removing every line from `__init__.py` except imports and `__all__` would break something, that something (I/O, global state mutation, network calls) almost certainly belongs in an explicit setup function the caller invokes deliberately, not in code that runs the instant the package is imported.

```python
# Prefer an explicit setup function callers opt into over implicit import-time side effects
def configure_logging(level: int = logging.INFO) -> None:
    logging.basicConfig(level=level)
```

## See Also

- [`api-explicit-exports`](api-explicit-exports.md) - defining `__all__` as the public surface
- [`perf-lazy-import`](perf-lazy-import.md) - deferring expensive imports instead of putting them in `__init__.py`
- [`anti-circular-import`](anti-circular-import.md) - how heavy `__init__.py` logic often causes import cycles

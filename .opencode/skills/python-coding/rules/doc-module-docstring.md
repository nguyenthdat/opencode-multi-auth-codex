# doc-module-docstring

> Give every module a top-of-file docstring describing its purpose

## Why It Matters

A module docstring is the first thing shown by `help(module)`, the first paragraph on a generated documentation page, and the first thing a new contributor reads when they open the file — it should answer "what does this module do and why does it exist" before they read a single line of code. Without one, understanding a module's purpose requires reverse-engineering it from its contents, which is slow for large modules and actively misleading for modules whose name is ambiguous (`utils.py`, `helpers.py`, `core.py`). This is enforced automatically by `ruff`'s `D100` rule and is standard practice across the standard library and major frameworks (Django, FastAPI, requests).

## Bad

```python
# billing/invoices.py
import datetime
from decimal import Decimal


class Invoice:
    ...
```

No indication of what this module is responsible for, what it does or doesn't handle, or how it relates to neighboring modules like `billing/payments.py`.

## Good

```python
"""Invoice generation and lifecycle management.

Handles creation, itemization, and status transitions for customer
invoices. Payment processing itself lives in `billing.payments`; this
module only tracks what is owed and its due/paid state.
"""

import datetime
from decimal import Decimal


class Invoice:
    ...
```

## What a Good Module Docstring Includes

- **One-line summary** of the module's responsibility (first line, since tools often show only this).
- **Boundary clarification** — what's explicitly *not* handled here, especially useful when responsibilities are split across sibling modules.
- Optionally, a brief usage note or pointer to the primary entry point.

```python
"""Rate limiting primitives for the public API gateway.

Provides `TokenBucket` and `SlidingWindowLimiter` for per-client request
throttling. Limiter state is in-memory only; for multi-process
deployments, see `ratelimit.redis_backend` instead.
"""
```

## Enforcing It

```toml
[tool.ruff.lint]
select = ["D100"]  # Missing docstring in public module
```

## See Also

- [`doc-all-public-api`](doc-all-public-api.md) - the broader rule this specializes for module scope
- [`doc-readme-quickstart`](doc-readme-quickstart.md) - project-level documentation that complements module docstrings
- [`proj-package-by-feature`](proj-package-by-feature.md) - module boundaries this docstring should describe accurately

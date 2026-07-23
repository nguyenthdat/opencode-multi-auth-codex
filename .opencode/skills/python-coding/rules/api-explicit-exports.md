# api-explicit-exports

> Make module exports explicit with `__all__` rather than relying on import-star defaults

## Why It Matters

Without an `__all__` declaration, `from module import *` pulls in every top-level name that doesn't start with an underscore — including names imported *into* that module for internal use, helper functions never meant to be public, and anything else that happens to be a module-level identifier. Declaring `__all__` explicitly draws a hard line between "this module's public API" and "implementation details that happen to live at module scope," and it also documents the intended surface for readers and IDEs without them having to infer it from naming conventions alone.

## Bad

```python
# transforms.py
import re
import json
from collections import Counter

_CACHE: dict[str, str] = {}

def normalize(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()

def word_counts(text: str) -> Counter:
    return Counter(normalize(text).split())

# consumer.py
from transforms import *
# pulls in `re`, `json`, `Counter`, and `_CACHE`'s friends along with
# the two functions actually meant to be public — pollutes the namespace
# and silently shadows any local `re` or `json` the consumer had
```

## Good

```python
# transforms.py
import re
import json
from collections import Counter

__all__ = ["normalize", "word_counts"]

_CACHE: dict[str, str] = {}

def normalize(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()

def word_counts(text: str) -> Counter:
    return Counter(normalize(text).split())

# consumer.py
from transforms import *
# only `normalize` and `word_counts` are imported — `re`, `json`, `Counter`,
# and `_CACHE` stay internal, exactly as intended
```

## `__all__` Also Documents Intent Without `import *`

Even in codebases that never use `from module import *` (most style guides discourage it — see `anti-wildcard-import`), `__all__` is still valuable: static analysis tools, IDEs, and `help(module)` all use it to distinguish public API from incidentally-module-scoped names, and linters like `ruff` (`F401`) treat names in `__all__` as intentionally re-exported rather than unused imports.

```python
# mypkg/__init__.py
from mypkg.client import Client
from mypkg.errors import ApiError, RateLimitError

__all__ = ["Client", "ApiError", "RateLimitError"]
# ruff won't flag Client/ApiError/RateLimitError as "imported but unused"
# specifically because they're declared in __all__
```

## See Also

- [`api-init-public-surface`](api-init-public-surface.md) - the package-level re-export pattern `__all__` supports
- [`anti-wildcard-import`](anti-wildcard-import.md) - why `import *` itself remains discouraged even with `__all__` defined
- [`name-leading-underscore-private`](name-leading-underscore-private.md) - the underscore convention `__all__` formalizes

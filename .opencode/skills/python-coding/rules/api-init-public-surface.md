# api-init-public-surface

> Curate the public surface deliberately via `__init__.py` re-exports

## Why It Matters

Without deliberate re-exports, users of a package either have to know its internal module layout (`from mypkg._internal.parsers.json_parser import JsonParser`) or resort to `from mypkg import *`, both of which couple external code to implementation details that should be free to change. Re-exporting a curated set of names at the package's top level via `__init__.py` gives consumers one stable import path (`from mypkg import JsonParser`) while the internal module structure — file layout, helper submodules, private classes — can be refactored freely without breaking anyone.

## Bad

```python
# mypkg/_internal/parsers/json_parser.py
class JsonParser:
    def parse(self, data: bytes) -> dict: ...

# mypkg/_internal/parsers/xml_parser.py
class XmlParser:
    def parse(self, data: bytes) -> dict: ...

# mypkg/__init__.py
# (empty — nothing re-exported)

# consumer code has to reach into internal module paths directly:
from mypkg._internal.parsers.json_parser import JsonParser
from mypkg._internal.parsers.xml_parser import XmlParser
# any future rename of `_internal.parsers` breaks every consumer
```

## Good

```python
# mypkg/_internal/parsers/json_parser.py
class JsonParser:
    def parse(self, data: bytes) -> dict: ...

# mypkg/_internal/parsers/xml_parser.py
class XmlParser:
    def parse(self, data: bytes) -> dict: ...

# mypkg/__init__.py
from mypkg._internal.parsers.json_parser import JsonParser
from mypkg._internal.parsers.xml_parser import XmlParser

__all__ = ["JsonParser", "XmlParser"]

# consumer code depends only on the stable top-level path:
from mypkg import JsonParser, XmlParser
# internal reshuffling of _internal/parsers/* never breaks this import
```

## Real-World Example: `requests`

`requests/__init__.py` re-exports the entire public API — `get`, `post`, `Session`, `Response`, exception classes — from a handful of internal modules (`requests.api`, `requests.sessions`, `requests.models`), so `import requests; requests.get(...)` works without any caller ever needing to know that `get` actually lives in `requests.api`. `httpx` and `sqlalchemy` follow the same convention: a flat, curated top-level namespace backed by a deep internal package structure.

```python
# requests/__init__.py (illustrative excerpt)
from .api import get, post, put, delete
from .models import Response
from .sessions import Session
from .exceptions import RequestException, HTTPError

__all__ = ["get", "post", "put", "delete", "Response", "Session", "RequestException", "HTTPError"]
```

## See Also

- [`api-explicit-exports`](api-explicit-exports.md) - the `__all__` mechanism used to declare the curated set
- [`anti-wildcard-import`](anti-wildcard-import.md) - why `import *` is not a substitute for curated re-exports
- [`proj-package-by-feature`](proj-package-by-feature.md) - organizing internal modules that this re-export layer sits on top of

# type-union-pipe

> Use `X | None` and `X | Y` union syntax (PEP 604) instead of `Optional[X]` / `Union[X, Y]`

## Why It Matters

PEP 604 (Python 3.10+) lets you write unions with `|` directly, eliminating the `typing.Optional`/`typing.Union` import and the extra bracket nesting. It reads closer to how you'd say it out loud ("a string or None") and matches how unions are increasingly documented across the ecosystem (FastAPI, Pydantic v2, msgspec). Sticking with `Optional[X]` in new code is a tell that a codebase hasn't updated its style since pre-3.10.

## Bad

```python
from typing import Optional, Union

def find_user(user_id: int) -> Optional[dict]:
    ...

def parse_value(raw: Union[str, bytes, None]) -> Union[int, float]:
    if raw is None:
        raise ValueError("raw value required")
    return float(raw) if b"." in raw if isinstance(raw, bytes) else "." in raw else int(raw)

class Cache:
    def __init__(self, ttl: Optional[int] = None) -> None:
        self.ttl: Optional[int] = ttl
```

## Good

```python
def find_user(user_id: int) -> dict | None:
    ...

def parse_value(raw: str | bytes | None) -> int | float:
    if raw is None:
        raise ValueError("raw value required")
    text = raw.decode() if isinstance(raw, bytes) else raw
    return float(text) if "." in text else int(text)

class Cache:
    def __init__(self, ttl: int | None = None) -> None:
        self.ttl: int | None = ttl
```

## Runtime Caveat (Python 3.9 and earlier)

`X | Y` in annotation position works at runtime only from 3.10+. If you must support 3.9, either:

```python
from __future__ import annotations  # defers evaluation; works on 3.7+

def find_user(user_id: int) -> dict | None:  # safe even on 3.9 with the future import
    ...
```

or fall back to `Optional`/`Union` for that target. Note `from __future__ import annotations` does not help with runtime introspection (`typing.get_type_hints`, Pydantic v1) unless the library explicitly resolves string annotations.

## See Also

- [`type-modern-generics`](type-modern-generics.md) - the parallel PEP 585 modernization for containers
- [`type-alias-statement`](type-alias-statement.md) - naming a recurring union with `type`
- [`type-narrow-guards`](type-narrow-guards.md) - safely narrowing a `X | None` or `X | Y` value

# api-sentinel-default

> Use a sentinel object instead of `None` to mean "argument not provided"

## Why It Matters

When `None` is itself a meaningful value a caller might legitimately want to pass — "clear this field," "no timeout," "unset this key" — using `None` as the "argument not supplied" default makes it impossible to distinguish "caller explicitly passed `None`" from "caller passed nothing at all." A dedicated sentinel object (a unique instance no caller could plausibly construct or pass by accident) resolves that ambiguity cleanly and is exactly the technique the standard library itself reaches for.

## Bad

```python
def update_user(user_id: int, name: str | None = None, email: str | None = None) -> None:
    updates = {}
    if name is not None:
        updates["name"] = name
    if email is not None:
        updates["email"] = email
    apply_updates(user_id, updates)

# Caller wants to explicitly CLEAR the email field by setting it to None —
# but there is no way to distinguish that intent from "don't touch email"
update_user(42, email=None)  # silently does nothing, instead of clearing the field
```

## Good

```python
class _Unset:
    def __repr__(self) -> str:
        return "<unset>"

UNSET = _Unset()

def update_user(
    user_id: int,
    name: str | None | _Unset = UNSET,
    email: str | None | _Unset = UNSET,
) -> None:
    updates = {}
    if name is not UNSET:
        updates["name"] = name       # None here means "clear the name"
    if email is not UNSET:
        updates["email"] = email     # None here means "clear the email"
    apply_updates(user_id, updates)

update_user(42, email=None)   # now correctly means "clear email"
update_user(42, name="Ada")   # email untouched, since it was never provided
```

## The Standard Library's Own Sentinel

Python 3.13 added `object()`-based sentinels formally via a documented pattern, and now `enum.sentinel`:

```python
from enum import sentinel

MISSING = sentinel("MISSING")

def get_setting(key: str, default: object = MISSING) -> object:
    value = _settings.get(key, MISSING)
    if value is MISSING:
        if default is MISSING:
            raise KeyError(key)
        return default
    return value
```

Prior to `enum.sentinel`, the idiomatic approach was a private singleton class instance exactly like `UNSET` above (this is what `pydantic`'s internal `PydanticUndefined` and `attrs`'s `NOTHING` both are) — a plain `object()` also works but doesn't give you a readable `repr()` for debugging.

## See Also

- [`api-no-mutable-default`](api-no-mutable-default.md) - the related pitfall of mutable default arguments
- [`api-keyword-only-args`](api-keyword-only-args.md) - sentinel defaults are almost always paired with keyword-only params
- [`type-literal-constrain`](type-literal-constrain.md) - typing a small fixed set of sentinel-like values with `Literal`

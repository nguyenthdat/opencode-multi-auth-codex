# type-runtime-checkable

> Use `@runtime_checkable` when a `Protocol` needs `isinstance()` checks

## Why It Matters

By default, `Protocol` classes exist purely for static type checking — calling `isinstance()` against a plain `Protocol` raises a `TypeError` at runtime. When your code genuinely needs to branch on "does this object support this interface" at runtime (not just at type-check time), you must opt in with `@runtime_checkable`. Forgetting this decorator produces a confusing runtime crash the first time the `isinstance` check actually executes, often long after the code was written and reviewed.

## Bad

```python
from typing import Protocol

class SupportsClose(Protocol):
    def close(self) -> None: ...

def cleanup(resource: object) -> None:
    if isinstance(resource, SupportsClose):  # TypeError at runtime!
        resource.close()
```

```
TypeError: Instance and class checks can only be used with
@runtime_checkable protocols
```

## Good

```python
from typing import Protocol, runtime_checkable

@runtime_checkable
class SupportsClose(Protocol):
    def close(self) -> None: ...

def cleanup(resource: object) -> None:
    if isinstance(resource, SupportsClose):
        resource.close()
```

## Caveats

`@runtime_checkable` only checks that the named methods/attributes *exist* — it does not check their signatures or types:

```python
@runtime_checkable
class SupportsRead(Protocol):
    def read(self, size: int = -1) -> bytes: ...

class Fake:
    def read(self) -> str:  # wrong signature, wrong return type
        return "not bytes"

isinstance(Fake(), SupportsRead)  # True! isinstance only checks method presence
```

Use `@runtime_checkable` for lightweight "does it quack" checks at boundaries (e.g., deciding whether to call `.close()` before garbage collection), but don't rely on it as a substitute for static type checking of the full signature — that guarantee only comes from mypy/pyright at the call site.

## See Also

- [`type-protocol-structural`](type-protocol-structural.md) - the base Protocol pattern this decorator extends
- [`type-narrow-guards`](type-narrow-guards.md) - `isinstance`-based narrowing patterns in general
- [`anti-isinstance-type-check-abuse`](anti-isinstance-type-check-abuse.md) - overusing `isinstance` where static typing would suffice

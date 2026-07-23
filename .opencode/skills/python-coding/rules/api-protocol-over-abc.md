# api-protocol-over-abc

> Prefer `Protocol` over `ABC` when only structural compatibility matters

## Why It Matters

`abc.ABC` requires explicit, nominal subclassing — a class must declare `class Foo(MyABC)` to satisfy the interface, which forces every implementer (including third-party classes you don't control) to know about and depend on your abstract base. `typing.Protocol` gives structural typing instead: any object with matching methods/attributes satisfies the protocol, with zero coupling and no inheritance required. This matches how Python's own duck-typed idioms (iterables, context managers, comparables) already work, and lets you type-check code against objects from libraries that were never written with your interface in mind.

## Bad

```python
from abc import ABC, abstractmethod

class Serializer(ABC):
    @abstractmethod
    def serialize(self) -> bytes: ...

# Every implementer MUST inherit from Serializer, even third-party classes
class JsonPayload(Serializer):
    def serialize(self) -> bytes:
        return b'{"ok": true}'

# A perfectly compatible third-party class can't be used here without a wrapper,
# even though it already has a matching serialize() method
class ThirdPartyReport:
    def serialize(self) -> bytes:
        return b"report-bytes"

def send(item: Serializer) -> None:   # rejects ThirdPartyReport statically
    ...
```

## Good

```python
from typing import Protocol

class Serializer(Protocol):
    def serialize(self) -> bytes: ...

class JsonPayload:
    def serialize(self) -> bytes:
        return b'{"ok": true}'

class ThirdPartyReport:
    def serialize(self) -> bytes:
        return b"report-bytes"

def send(item: Serializer) -> None:   # both classes satisfy this structurally, no inheritance needed
    payload = item.serialize()
    ...

send(JsonPayload())       # type-checks
send(ThirdPartyReport())  # type-checks too, no wrapper or registration required
```

## When `ABC` Is Still the Right Choice

Use `ABC` when you want shared implementation (template methods, mixins with real logic) or when you deliberately want to force explicit opt-in via inheritance, e.g. for a plugin system where accidental structural matches would be dangerous:

```python
from abc import ABC, abstractmethod

class Plugin(ABC):
    @abstractmethod
    def run(self, context: dict) -> None: ...

    def setup(self) -> None:
        print(f"loading plugin: {type(self).__name__}")  # shared, concrete behavior
```

`Protocol` classes can also be made `@runtime_checkable` for `isinstance()` checks, but that only verifies method *names* exist, not signatures — reserve it for lightweight duck-typing checks, not full static guarantees.

## See Also

- [`type-protocol-structural`](type-protocol-structural.md) - deeper coverage of structural typing with `Protocol`
- [`type-runtime-checkable`](type-runtime-checkable.md) - `isinstance()` checks against protocols
- [`api-composition-inheritance`](api-composition-inheritance.md) - avoiding deep hierarchies more generally

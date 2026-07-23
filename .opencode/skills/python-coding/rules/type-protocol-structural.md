# type-protocol-structural

> Use `typing.Protocol` for structural typing instead of forcing inheritance

## Why It Matters

Nominal typing (`isinstance`/ABC inheritance) requires every implementer to know about and subclass your interface, which is impossible for third-party types you don't control and awkward for simple duck-typed code. `Protocol` lets you describe "anything with this shape" and get full static-type checking without any inheritance relationship, matching Python's long-standing duck-typing philosophy while still catching mismatches with mypy/pyright.

## Bad

```python
from abc import ABC, abstractmethod

class Serializable(ABC):
    @abstractmethod
    def to_dict(self) -> dict:
        ...

# Every type that wants to be "serializable" must inherit — including
# types you don't own, like third-party response objects.
class Invoice(Serializable):
    def to_dict(self) -> dict:
        return {"id": self.id, "total": self.total}

def save(item: Serializable) -> None:
    write_json(item.to_dict())

# Can't pass a third-party object even if it already has to_dict() —
# it isn't a Serializable subclass.
save(some_orm_row)  # type error, even though some_orm_row.to_dict() exists
```

## Good

```python
from typing import Protocol

class Serializable(Protocol):
    def to_dict(self) -> dict: ...

class Invoice:  # no inheritance needed
    def __init__(self, id: str, total: float) -> None:
        self.id = id
        self.total = total

    def to_dict(self) -> dict:
        return {"id": self.id, "total": self.total}

def save(item: Serializable) -> None:
    write_json(item.to_dict())

save(Invoice("INV-1", 42.0))   # OK: structurally matches
save(some_orm_row)             # OK, as long as it defines to_dict() -> dict
```

## Real-World Example

`sqlalchemy` and `httpx` both lean on structural typing for extensibility points:

```python
from typing import Protocol

class SupportsRead(Protocol):
    def read(self, size: int = -1) -> bytes: ...

def upload(stream: SupportsRead) -> None:
    data = stream.read()
    ...

# Works with io.BytesIO, an open file, or any custom object with .read()
upload(open("report.pdf", "rb"))
```

Use `Protocol` when: the interface is behavioral ("has a `.read()`"), you don't control all implementers, or you want to type third-party/duck-typed objects. Use an ABC when you also want shared implementation (mixins) or want to force explicit registration.

## See Also

- [`type-runtime-checkable`](type-runtime-checkable.md) - enabling `isinstance()` checks against a Protocol
- [`api-protocol-over-abc`](api-protocol-over-abc.md) - choosing Protocol over ABC at the API design level
- [`type-typevar-generic`](type-typevar-generic.md) - combining Protocol bounds with generics

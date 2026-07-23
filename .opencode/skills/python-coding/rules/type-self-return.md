# type-self-return

> Use `Self` as the return type for methods that return the instance's own type

## Why It Matters

Before `Self` (PEP 673, 3.11+), methods returning "an instance of whatever class this is" had to either hardcode the class name (which breaks for subclasses) or use an awkward `TypeVar` bound to the class. `Self` lets type checkers correctly infer that a subclass's fluent/factory method returns the subclass, not the base class, which matters heavily for builder patterns and classmethod constructors.

## Bad

```python
class QueryBuilder:
    def __init__(self) -> None:
        self._filters: list[str] = []

    def filter(self, condition: str) -> "QueryBuilder":  # hardcoded class name
        self._filters.append(condition)
        return self

class AdminQueryBuilder(QueryBuilder):
    def include_deleted(self) -> "AdminQueryBuilder":
        self._filters.append("include_deleted=true")
        return self

builder = AdminQueryBuilder()
# Type checker thinks .filter() returns QueryBuilder, not AdminQueryBuilder,
# so chaining loses access to subclass-only methods.
result = builder.filter("active=true").include_deleted()  # type error on some checkers
```

## Good

```python
from typing import Self

class QueryBuilder:
    def __init__(self) -> None:
        self._filters: list[str] = []

    def filter(self, condition: str) -> Self:
        self._filters.append(condition)
        return self

class AdminQueryBuilder(QueryBuilder):
    def include_deleted(self) -> Self:
        self._filters.append("include_deleted=true")
        return self

builder = AdminQueryBuilder()
result = builder.filter("active=true").include_deleted()  # correctly typed as AdminQueryBuilder
```

## Classmethod Factories

```python
from typing import Self

class Config:
    def __init__(self, values: dict[str, str]) -> None:
        self.values = values

    @classmethod
    def from_file(cls, path: str) -> Self:
        with open(path) as f:
            values = dict(line.strip().split("=", 1) for line in f)
        return cls(values)  # correctly typed as the calling subclass, not Config

class DevConfig(Config):
    pass

dev = DevConfig.from_file("dev.env")  # type checker knows this is DevConfig
```

Use `Self` for: `__enter__`, fluent builder methods, `copy()`/`with_x()` methods, and `@classmethod` alternate constructors. Don't use it when the return type is genuinely unrelated to the instance's class.

## See Also

- [`type-typevar-generic`](type-typevar-generic.md) - the general generics mechanism `Self` specializes
- [`api-classmethod-factory`](api-classmethod-factory.md) - classmethod constructors that benefit from `Self`
- [`res-async-context-manager`](res-async-context-manager.md) - `__aenter__` typically returns `Self`

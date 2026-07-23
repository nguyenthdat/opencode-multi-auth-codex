# api-dunder-methods

> Implement dunder methods (`__repr__`, `__eq__`, `__hash__`, `__len__`, ...) to integrate with Python's protocols

## Why It Matters

Python's built-in functions and syntax (`repr()`, `==`, `len()`, `for`, `in`, `+`) all dispatch to dunder methods rather than assuming a fixed interface, which means a class that implements the right ones gets to participate fully in the language instead of requiring bespoke methods like `.to_string()` or `.contains(x)` that every caller has to learn separately. Skipping `__repr__` in particular means every debugger, log line, and test failure shows a useless `<MyClass object at 0x7f...>` instead of the object's actual state.

## Bad

```python
class Vector:
    def __init__(self, x: float, y: float) -> None:
        self.x = x
        self.y = y

    def to_string(self) -> str:
        return f"Vector({self.x}, {self.y})"

    def equals(self, other: "Vector") -> bool:
        return self.x == other.x and self.y == other.y

    def plus(self, other: "Vector") -> "Vector":
        return Vector(self.x + other.x, self.y + other.y)

v1 = Vector(1, 2)
print(v1)                    # <__main__.Vector object at 0x1046b2a10> — useless
v2 = v1.plus(Vector(3, 4))   # doesn't read like arithmetic
```

## Good

```python
class Vector:
    def __init__(self, x: float, y: float) -> None:
        self.x = x
        self.y = y

    def __repr__(self) -> str:
        return f"Vector({self.x!r}, {self.y!r})"

    def __eq__(self, other: object) -> bool:
        if not isinstance(other, Vector):
            return NotImplemented
        return self.x == other.x and self.y == other.y

    def __hash__(self) -> int:
        return hash((self.x, self.y))

    def __add__(self, other: "Vector") -> "Vector":
        return Vector(self.x + other.x, self.y + other.y)

    def __len__(self) -> int:
        return 2  # number of components, e.g. for iterable-unpacking sanity checks

v1 = Vector(1, 2)
print(v1)                 # Vector(1, 2)
v2 = v1 + Vector(3, 4)    # reads as real arithmetic
assert v1 == Vector(1, 2)
```

## Choosing Which Dunders Matter

| Dunder | Enables |
|--------|---------|
| `__repr__` | Useful debugger/log output — implement on every non-trivial class |
| `__eq__` + `__hash__` | `==`, use as dict keys / set members |
| `__len__`, `__iter__`, `__getitem__` | `len()`, `for x in obj`, `obj[i]` |
| `__enter__`/`__exit__` | `with obj:` |
| `__lt__` etc. (or `functools.total_ordering`) | `sorted()`, `<`, `>=` |

Defining `__eq__` without `__hash__` makes instances unhashable (Python sets `__hash__ = None` automatically) — set both together, or use `@dataclass(frozen=True)` which generates a consistent pair for you.

## See Also

- [`api-dataclass-value-object`](api-dataclass-value-object.md) - generating these dunders automatically for value objects
- [`api-property-computed`](api-property-computed.md) - the attribute-access protocol via `@property`
- [`api-return-consistent-types`](api-return-consistent-types.md) - `NotImplemented` vs raising, and consistent return types in comparisons

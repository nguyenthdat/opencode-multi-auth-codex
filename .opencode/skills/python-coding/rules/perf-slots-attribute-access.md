# perf-slots-attribute-access

> Use `__slots__`/dataclasses for faster, lower-overhead attribute access

## Why It Matters

By default, every instance of a Python class carries a `__dict__` for its attributes, which costs memory (roughly 100+ bytes per instance just for the dict machinery) and adds a layer of hashing indirection to every attribute read and write. Declaring `__slots__` replaces that per-instance dict with fixed-size, descriptor-based storage, cutting memory per instance significantly and making attribute access measurably faster — this matters a lot when you're instantiating thousands or millions of small objects (rows, points, events).

## Bad

```python
class Point:
    def __init__(self, x: float, y: float) -> None:
        self.x = x
        self.y = y

# 1,000,000 Points each carry a full __dict__ — memory and lookup overhead add up
points = [Point(i, i * 2) for i in range(1_000_000)]
```

## Good

```python
class Point:
    __slots__ = ("x", "y")

    def __init__(self, x: float, y: float) -> None:
        self.x = x
        self.y = y

points = [Point(i, i * 2) for i in range(1_000_000)]
```

## Dataclasses Get This for Free

`@dataclass(slots=True)` (3.10+) generates the `__slots__` declaration for you, so you don't have to keep the field list in sync in two places:

```python
from dataclasses import dataclass

@dataclass(slots=True)
class Point:
    x: float
    y: float
```

## Trade-offs to Know

`__slots__` disables per-instance `__dict__` (so you can't set arbitrary new attributes at runtime), makes multiple inheritance with other slotted classes tricky (each base contributes its own slots, and duplicate slot names conflict), and is incompatible with class-level default values that aren't descriptors. It also cannot be combined with `__weakref__` support unless you explicitly add `"__weakref__"` to the tuple. Reserve it for value-like classes instantiated in bulk, not for classes that need dynamic attributes (e.g., objects patched by test mocks or ORMs that rely on `__dict__`).

```python
class Point:
    __slots__ = ("x", "y")

p = Point(1, 2)
p.z = 3  # AttributeError: 'Point' object has no attribute 'z' — expected, by design
```

If a subclass needs extra attributes, it must declare its own `__slots__` too; forgetting to do so silently reintroduces a `__dict__` on the subclass and gives up the memory savings entirely.

## See Also

- [`res-slots-memory`](res-slots-memory.md) - the memory-focused case for `__slots__`
- [`data-slots-dataclass`](data-slots-dataclass.md) - `slots=True` on dataclasses specifically
- [`api-immutable-value-objects`](api-immutable-value-objects.md) - slotted, frozen classes as value objects

# res-slots-memory

> Use `__slots__` to cut per-instance memory overhead on high-volume classes

## Why It Matters

By default, every instance of a Python class carries a `__dict__` to hold its attributes, which costs on the order of 100+ bytes of overhead per instance even before any attribute values are stored. When you create millions of small objects — parsed records, graph nodes, event payloads — that per-instance dictionary dominates memory usage. `__slots__` replaces the per-instance `__dict__` with a fixed-size C-level array, typically cutting memory by 40-50% and also speeding up attribute access slightly.

## Bad

```python
class Point:
    def __init__(self, x: float, y: float) -> None:
        self.x = x
        self.y = y

# 2 million points, each carrying an unused __dict__
points = [Point(i * 0.1, i * 0.2) for i in range(2_000_000)]
```

## Good

```python
class Point:
    __slots__ = ("x", "y")

    def __init__(self, x: float, y: float) -> None:
        self.x = x
        self.y = y

points = [Point(i * 0.1, i * 0.2) for i in range(2_000_000)]
```

## Measuring the Difference

```python
import sys
import tracemalloc

class WithDict:
    def __init__(self, x: int, y: int) -> None:
        self.x = x
        self.y = y

class WithSlots:
    __slots__ = ("x", "y")
    def __init__(self, x: int, y: int) -> None:
        self.x = x
        self.y = y

tracemalloc.start()
_ = [WithDict(1, 2) for _ in range(100_000)]
dict_peak = tracemalloc.get_traced_memory()[1]
tracemalloc.stop()

tracemalloc.start()
_ = [WithSlots(1, 2) for _ in range(100_000)]
slots_peak = tracemalloc.get_traced_memory()[1]
tracemalloc.stop()
# slots_peak is typically 40-50% smaller than dict_peak
```

## Caveats

`__slots__` disables dynamic attribute assignment (`obj.new_attr = 1` raises `AttributeError`), and every non-slotted attribute must be declared. It also complicates multiple inheritance — only one base class in the MRO may define non-empty `__slots__` with instance layout. If a class needs `__weakref__` support, add it explicitly:

```python
class CachedNode:
    __slots__ = ("value", "__weakref__")  # allow weakref.ref() to this instance
```

`@dataclass(slots=True)` (Python 3.10+) generates `__slots__` automatically without hand-listing field names, and is the preferred spelling for data-holding classes.

## See Also

- [`data-slots-dataclass`](data-slots-dataclass.md) - the dataclass-specific `slots=True` shortcut
- [`perf-slots-attribute-access`](perf-slots-attribute-access.md) - the attribute-access speed benefit of slots
- [`res-weakref-cache`](res-weakref-cache.md) - combining `__slots__` with `__weakref__` for cache entries

# data-slots-dataclass

> Use `@dataclass(slots=True)` for memory-efficient, fast-attribute-access models

## Why It Matters

By default every Python instance carries a `__dict__` for its attributes, which costs roughly a few hundred bytes of overhead per object and makes attribute access go through a dictionary lookup. `@dataclass(slots=True)` (3.10+) generates `__slots__` automatically, cutting per-instance memory significantly and making attribute reads/writes faster — a meaningful win for code that creates millions of small objects, like parsed records or graph nodes.

## Bad

```python
from dataclasses import dataclass

@dataclass
class Pixel:
    x: int
    y: int
    r: int
    g: int
    b: int

def load_image(width: int, height: int) -> list[Pixel]:
    # Each Pixel carries a full __dict__ even though it only ever holds
    # these five fixed fields — wasted memory at real scale (millions of pixels).
    return [Pixel(x, y, 0, 0, 0) for y in range(height) for x in range(width)]
```

## Good

```python
from dataclasses import dataclass

@dataclass(slots=True)
class Pixel:
    x: int
    y: int
    r: int
    g: int
    b: int

def load_image(width: int, height: int) -> list[Pixel]:
    # No per-instance __dict__ — memory scales with declared fields only,
    # and attribute access is measurably faster in hot loops.
    return [Pixel(x, y, 0, 0, 0) for y in range(height) for x in range(width)]
```

## Combining with `frozen=True`

```python
@dataclass(slots=True, frozen=True)
class Vector3:
    x: float
    y: float
    z: float

    def __add__(self, other: "Vector3") -> "Vector3":
        return Vector3(self.x + other.x, self.y + other.y, self.z + other.z)
```

One caveat: `slots=True` classes cannot have class-level default mutable
attributes assigned outside `field(default_factory=...)`, and default
values used as **class attributes** for non-dataclass purposes will
conflict with slot descriptors. Also note that `slots=True` combined with
inheritance from a non-slotted base reintroduces a `__dict__`, so keep the
whole hierarchy slotted if memory is the goal.

## See Also

- [`res-slots-memory`](res-slots-memory.md) - the general `__slots__` memory-saving principle
- [`data-frozen-immutable`](data-frozen-immutable.md) - combining slots with immutability for value objects
- [`perf-slots-attribute-access`](perf-slots-attribute-access.md) - the performance angle of slotted attribute access

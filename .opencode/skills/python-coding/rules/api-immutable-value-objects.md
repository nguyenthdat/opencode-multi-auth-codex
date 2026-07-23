# api-immutable-value-objects

> Prefer frozen dataclasses/immutable value objects when identity shouldn't change

## Why It Matters

Mutable value objects invite a class of bugs where code far from the point of mutation silently observes stale-vs-fresh state, or where an object passed into a function gets mutated unexpectedly by that function (aliasing bugs). Immutable value objects — `@dataclass(frozen=True)`, `NamedTuple`, or plain tuples — remove that entire category of bug: once constructed, the object's state can never change out from under any holder of a reference, which also makes them safe to share across threads and safe to use as dict keys or set members.

## Bad

```python
from dataclasses import dataclass

@dataclass
class Coordinates:
    latitude: float
    longitude: float

def recenter_map(center: Coordinates) -> None:
    center.latitude += 0.01   # mutates the caller's object in place — surprising aliasing
    render(center)

start = Coordinates(37.7749, -122.4194)
recenter_map(start)
print(start.latitude)  # 37.7849 — caller never intended for `start` to change
```

## Good

```python
from dataclasses import dataclass, replace

@dataclass(frozen=True, slots=True)
class Coordinates:
    latitude: float
    longitude: float

def recenter_map(center: Coordinates) -> Coordinates:
    recentered = replace(center, latitude=center.latitude + 0.01)  # new object, no aliasing
    render(recentered)
    return recentered

start = Coordinates(37.7749, -122.4194)
moved = recenter_map(start)
print(start.latitude)  # 37.7749 — unchanged, as expected
print(moved.latitude)  # 37.7849
```

## Attempting Mutation Raises Immediately

```python
coord = Coordinates(0.0, 0.0)
coord.latitude = 1.0  # raises dataclasses.FrozenInstanceError — caught at the point of misuse
```

## `NamedTuple` as a Lighter Alternative

For simple, purely positional value objects without methods, `NamedTuple` is an even lighter immutable option that also supports tuple unpacking:

```python
from typing import NamedTuple

class Coordinates(NamedTuple):
    latitude: float
    longitude: float

lat, lon = Coordinates(37.7749, -122.4194)  # unpacks like a tuple
```

Reach for a mutable object only when the thing being modeled has genuine identity and lifecycle — a bank account balance changing over time, a running total — as opposed to a value that's simply recomputed and replaced wholesale.

## See Also

- [`data-frozen-immutable`](data-frozen-immutable.md) - deeper coverage of `frozen=True` mechanics and hashing
- [`api-dataclass-value-object`](api-dataclass-value-object.md) - the general dataclass-for-value-objects rule this builds on
- [`data-namedtuple-lightweight`](data-namedtuple-lightweight.md) - `NamedTuple` as a lighter-weight immutable alternative

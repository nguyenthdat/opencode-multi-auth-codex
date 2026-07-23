# data-namedtuple-lightweight

> Use `typing.NamedTuple` for lightweight immutable records

## Why It Matters

Plain tuples are immutable and fast but force callers to remember what `result[0]` and `result[1]` mean, which is a readability and correctness hazard as soon as a function returns more than one value. `typing.NamedTuple` keeps the same memory footprint and tuple semantics (unpacking, equality, hashing) while giving every field a name and a static type, so `result.latitude` is both self-documenting and checkable by a type checker.

## Bad

```python
def geocode(address: str) -> tuple[float, float, float]:
    # What are these three floats? Latitude? Longitude? Altitude? Accuracy?
    return (37.7749, -122.4194, 15.0)

lat, lon, alt = geocode("1 Infinite Loop")
print(f"{lat}, {lon}")  # readable only because we guessed the right names
```

## Good

```python
from typing import NamedTuple

class GeoPoint(NamedTuple):
    latitude: float
    longitude: float
    altitude_m: float

def geocode(address: str) -> GeoPoint:
    return GeoPoint(latitude=37.7749, longitude=-122.4194, altitude_m=15.0)

point = geocode("1 Infinite Loop")
print(f"{point.latitude}, {point.longitude}")  # self-documenting field access
lat, lon, alt = point  # still unpacks like a plain tuple
```

## NamedTuple vs Dataclass

| Feature | `NamedTuple` | `dataclass` |
|---|---|---|
| Immutable by default | yes | no (needs `frozen=True`) |
| Tuple unpacking (`a, b = point`) | yes | no |
| Positional + keyword construction | yes | yes |
| Methods, `__post_init__` | limited | full support |
| Memory (no `__dict__`) | yes, always | only with `slots=True`  |
| Good fit | small immutable records, function return tuples | general-purpose data models |

```python
from typing import NamedTuple

class RGB(NamedTuple):
    red: int
    green: int
    blue: int

    def to_hex(self) -> str:
        return f"#{self.red:02x}{self.green:02x}{self.blue:02x}"

white = RGB(255, 255, 255)
assert white.to_hex() == "#ffffff"
```

`NamedTuple` supports simple methods too, making it a genuinely lightweight
alternative to a frozen dataclass when tuple-unpacking ergonomics matter and
the type has few or no behaviors beyond the data itself.

## See Also

- [`data-frozen-immutable`](data-frozen-immutable.md) - the dataclass equivalent for immutable records
- [`data-slots-dataclass`](data-slots-dataclass.md) - the memory-conscious dataclass alternative
- [`coll-namedtuple-record`](coll-namedtuple-record.md) - using `NamedTuple` for structured collection records

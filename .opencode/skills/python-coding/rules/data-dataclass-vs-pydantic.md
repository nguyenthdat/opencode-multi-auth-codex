# data-dataclass-vs-pydantic

> Choose plain dataclasses for internal data, Pydantic for external/validated boundaries

## Why It Matters

Pydantic's validation and coercion machinery costs real overhead — every model construction runs schema validation, which is wasted work for data your own code already constructed correctly and controls entirely. Using Pydantic everywhere "just in case" bloats internal call graphs with unnecessary validation cost and import weight; using plain dataclasses everywhere leaves external input unchecked. Matching the tool to the boundary keeps both fast and safe.

## Bad

```python
from pydantic import BaseModel

class Point(BaseModel):
    x: float
    y: float

def distance(a: Point, b: Point) -> float:
    return ((a.x - b.x) ** 2 + (a.y - b.y) ** 2) ** 0.5

def generate_grid(n: int) -> list[Point]:
    # Millions of pure-internal, already-valid objects paying full
    # Pydantic validation cost on every single construction.
    return [Point(x=float(i), y=float(j)) for i in range(n) for j in range(n)]
```

## Good

```python
from dataclasses import dataclass
from pydantic import BaseModel

@dataclass(slots=True, frozen=True)
class Point:  # internal, hot-path data: no validation overhead needed
    x: float
    y: float

def distance(a: Point, b: Point) -> float:
    return ((a.x - b.x) ** 2 + (a.y - b.y) ** 2) ** 0.5

def generate_grid(n: int) -> list[Point]:
    return [Point(x=float(i), y=float(j)) for i in range(n) for j in range(n)]

class PointRequest(BaseModel):  # external boundary: untrusted API input
    x: float
    y: float

def handle_api_request(payload: dict) -> Point:
    validated = PointRequest.model_validate(payload)
    return Point(x=validated.x, y=validated.y)  # convert once, then use plain dataclass
```

## Decision Table

| Situation | Use |
|---|---|
| Internal domain object, constructed by trusted code | `dataclass` |
| Data crossing an API/CLI/config/file boundary | Pydantic `BaseModel` |
| Hot loop constructing millions of objects | `dataclass(slots=True)` |
| Need JSON schema generation, coercion, or `.model_dump()` | Pydantic |
| Need to freeze and hash as a value object | `dataclass(frozen=True)` |

A common pattern: validate once with Pydantic at the boundary, then convert
to lightweight dataclasses for everything downstream — you get safety where
it matters and speed everywhere else.

## See Also

- [`data-pydantic-validation`](data-pydantic-validation.md) - when Pydantic is the right call
- [`data-slots-dataclass`](data-slots-dataclass.md) - the performance-oriented dataclass option
- [`data-frozen-immutable`](data-frozen-immutable.md) - freezing dataclasses for value-object semantics

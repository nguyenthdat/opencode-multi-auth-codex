# coll-namedtuple-record

> Use `NamedTuple`/`dataclass` instead of plain unlabeled tuples for structured records

## Why It Matters

A plain tuple like `("Ada Lovelace", 36, "Engineering")` carries no field names, so every access site (`record[0]`, `record[1]`) is a magic index that means nothing to a reader and breaks silently if the tuple's shape ever changes order. `NamedTuple` gives you named, typed fields with the same memory footprint and immutability as a regular tuple (still unpacks, still comparable, still hashable), while `dataclass` covers the same need when you want mutability or don't need tuple semantics.

## Bad

```python
def parse_employee(row: list[str]) -> tuple[str, int, str]:
    return (row[0], int(row[1]), row[2])

def format_employee(emp: tuple[str, int, str]) -> str:
    return f"{emp[0]} ({emp[1]}) - {emp[2]}"  # what is emp[1]? age? id? readers must guess
```

## Good

```python
from typing import NamedTuple

class Employee(NamedTuple):
    name: str
    age: int
    department: str

def parse_employee(row: list[str]) -> Employee:
    return Employee(name=row[0], age=int(row[1]), department=row[2])

def format_employee(emp: Employee) -> str:
    return f"{emp.name} ({emp.age}) - {emp.department}"

# Still behaves like a tuple: unpacking, equality, and indexing all work
name, age, department = parse_employee(["Ada", "36", "Engineering"])
```

## NamedTuple vs. dataclass

| | `NamedTuple` | `dataclass` |
|---|---|---|
| Mutability | Immutable | Mutable by default (`frozen=True` for immutable) |
| Tuple behavior (unpack, index, iterate) | Yes | No |
| Memory | Compact, no `__dict__` | Compact only with `slots=True` |
| Inheritance | Limited | Normal class inheritance |

Choose `NamedTuple` for small, position-meaningful records that behave like tuples (coordinates, RGB colors, rows returned from a query). Choose `dataclass` when you need mutability, methods with more complex behavior, or don't want callers relying on tuple-unpacking semantics.

```python
# A NamedTuple can also carry methods, just like a regular class:
class Point(NamedTuple):
    x: float
    y: float

    def distance_to(self, other: "Point") -> float:
        return ((self.x - other.x) ** 2 + (self.y - other.y) ** 2) ** 0.5

origin = Point(0, 0)
print(origin.distance_to(Point(3, 4)))  # 5.0
```

## See Also

- [`data-namedtuple-lightweight`](data-namedtuple-lightweight.md) - deeper coverage of `NamedTuple` as a data-modeling choice
- [`data-dataclass-vs-pydantic`](data-dataclass-vs-pydantic.md) - choosing between dataclasses and validated models
- [`coll-unpacking-star`](coll-unpacking-star.md) - unpacking these records with star expressions

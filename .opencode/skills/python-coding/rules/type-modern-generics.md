# type-modern-generics

> Use built-in generics `list[int]` / `dict[str, int]` instead of `typing.List` / `typing.Dict`

## Why It Matters

Since PEP 585 (Python 3.9+), the built-in collection types support subscripting directly, making `typing.List`, `typing.Dict`, `typing.Tuple`, and `typing.Set` redundant. Importing from `typing` adds noise, forces an extra import, and confuses readers about whether there's a meaningful difference (there isn't at runtime). Modern codebases that still import `List`/`Dict` signal an outdated style guide and often carry stale Python 2/early-3 assumptions elsewhere.

## Bad

```python
from typing import List, Dict, Tuple, Set, Optional

def group_by_owner(
    records: List[Dict[str, str]],
) -> Dict[str, List[Tuple[str, int]]]:
    result: Dict[str, List[Tuple[str, int]]] = {}
    for record in records:
        owner = record["owner"]
        result.setdefault(owner, []).append((record["name"], len(record["name"])))
    return result

def unique_tags(tags: List[str]) -> Set[str]:
    return set(tags)
```

## Good

```python
def group_by_owner(
    records: list[dict[str, str]],
) -> dict[str, list[tuple[str, int]]]:
    result: dict[str, list[tuple[str, int]]] = {}
    for record in records:
        owner = record["owner"]
        result.setdefault(owner, []).append((record["name"], len(record["name"])))
    return result

def unique_tags(tags: list[str]) -> set[str]:
    return set(tags)
```

## When `typing` Imports Are Still Needed

Some names have no built-in equivalent and remain necessary:

```python
from typing import Iterable, Iterator, Sequence, Mapping, Callable

def process(items: Iterable[int]) -> Iterator[int]:
    yield from (i * 2 for i in items)

def apply(fn: Callable[[int], int], values: Sequence[int]) -> list[int]:
    return [fn(v) for v in values]
```

`Iterable`, `Sequence`, `Mapping`, `Callable`, and `Iterator` describe protocols/abstract shapes rather than concrete containers — keep importing these from `typing` or `collections.abc`. Prefer `collections.abc` directly for `isinstance()` checks, since `typing` aliases are for annotations only.

## See Also

- [`type-union-pipe`](type-union-pipe.md) - the companion PEP 604 modernization for `Optional`/`Union`
- [`type-alias-statement`](type-alias-statement.md) - naming complex generic shapes with `type`
- [`type-typevar-generic`](type-typevar-generic.md) - generic classes/functions beyond built-in containers

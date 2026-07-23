# api-no-mutable-default

> Never use a mutable object as a default argument value

## Why It Matters

Default argument values in Python are evaluated exactly once, at function-definition time, and the same object is reused on every call that doesn't supply that argument. If the default is a mutable object (`list`, `dict`, `set`, or a mutable custom class), mutations from one call persist into every subsequent call, producing state that silently leaks across unrelated invocations — one of the most notorious footguns in the language and a frequent source of "impossible" bugs in code review.

## Bad

```python
def add_item(item: str, items: list[str] = []) -> list[str]:
    items.append(item)
    return items

first = add_item("apple")
print(first)               # ['apple']
second = add_item("banana")
print(second)               # ['apple', 'banana'] — unexpectedly carries over!

def get_config(overrides: dict[str, str] = {}) -> dict[str, str]:
    overrides["last_accessed"] = "now"  # mutates the shared default dict
    return overrides
```

## Good

```python
def add_item(item: str, items: list[str] | None = None) -> list[str]:
    if items is None:
        items = []  # fresh list every call
    items.append(item)
    return items

first = add_item("apple")
second = add_item("banana")
print(first, second)  # ['apple'] ['banana'] — independent, as expected

def get_config(overrides: dict[str, str] | None = None) -> dict[str, str]:
    overrides = dict(overrides) if overrides else {}
    overrides["last_accessed"] = "now"
    return overrides
```

## Immutable Defaults Are Fine As-Is

The problem is mutability, not defaults themselves — `None`, numbers, strings, `bool`, and `tuple` are safe to use directly:

```python
def format_row(values: tuple[str, ...] = ("N/A",), width: int = 10, prefix: str = "") -> str:
    return prefix + " | ".join(v.ljust(width) for v in values)  # tuple default is safe, immutable
```

If a function genuinely wants a shared, read-only default collection, freeze it explicitly so the intent is unmistakable:

```python
_DEFAULT_HEADERS: tuple[str, ...] = ("Content-Type", "Accept")

def build_request(headers: tuple[str, ...] = _DEFAULT_HEADERS) -> Request:
    ...  # tuple can't be mutated in place, so sharing it across calls is safe
```

## See Also

- [`anti-mutable-default-arg`](anti-mutable-default-arg.md) - this exact anti-pattern catalogued with broader examples
- [`api-sentinel-default`](api-sentinel-default.md) - using a sentinel instead of `None` when `None` is a valid value
- [`data-field-defaults-factory`](data-field-defaults-factory.md) - the dataclass-specific equivalent using `default_factory`

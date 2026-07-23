# perf-comprehension-over-loop

> Use list/dict/set comprehensions instead of manual append loops

## Why It Matters

Comprehensions run their loop body in specialized bytecode (`LIST_APPEND`/`MAP_ADD`/`SET_ADD`) inside a single compiled code object, avoiding the repeated attribute lookup of `list.append` and the overhead of a Python-level `for` loop with manual mutation. In practice this is measurably faster (often 20-50% on CPython) and, more importantly, it removes the boilerplate of initializing an empty container and mutating it, letting the reader see the transformation in one expression instead of reconstructing it from three lines.

## Bad

```python
def active_usernames(users: list[User]) -> list[str]:
    result = []
    for user in users:
        if user.is_active:
            result.append(user.username)
    return result

def price_by_sku(items: list[Item]) -> dict[str, float]:
    prices = {}
    for item in items:
        prices[item.sku] = item.price
    return prices
```

## Good

```python
def active_usernames(users: list[User]) -> list[str]:
    return [user.username for user in users if user.is_active]

def price_by_sku(items: list[Item]) -> dict[str, float]:
    return {item.sku: item.price for item in items}
```

## When a Loop Is Clearer

Comprehensions lose their advantage once the body needs multiple statements, exception handling, or early exit logic. Forcing those into a comprehension (via nested calls or walrus tricks) hurts readability more than it helps performance:

```python
def parse_all(raw_lines: list[str]) -> list[Record]:
    records = []
    for line in raw_lines:
        try:
            records.append(Record.parse(line))
        except ValueError:
            logger.warning("skipping malformed line: %r", line)
    return records
```

A plain loop is also the right call when the body has side effects unrelated to building the collection (logging, incrementing counters, writing to a file) — a comprehension that exists only for its side effects is a code smell in its own right.

```python
# BAD: comprehension used purely for its side effect, discarding the list it builds
[logger.info("processed %s", item) for item in items]  # confusing, wasteful allocation

# GOOD: a plain loop states the intent directly
for item in items:
    logger.info("processed %s", item)
```

## See Also

- [`coll-comprehension-readability`](coll-comprehension-readability.md) - the flip side: when comprehensions become too dense
- [`perf-generator-expression`](perf-generator-expression.md) - skip materializing the list entirely when possible
- [`coll-avoid-index-loop`](coll-avoid-index-loop.md) - the related anti-pattern of manual indexing

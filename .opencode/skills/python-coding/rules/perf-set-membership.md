# perf-set-membership

> Use `set`/`dict` for O(1) membership tests instead of `list`/`in` on a list

## Why It Matters

`x in some_list` is an O(n) linear scan — CPython compares `x` against every element until it finds a match or exhausts the list. `x in some_set` (or `some_dict`) is an O(1) average-case hash lookup. For a membership check performed once this difference is invisible; for a check performed inside a loop over a large collection, it turns an O(n*m) algorithm into O(n+m), which is the difference between milliseconds and minutes as data grows.

## Bad

```python
BLOCKED_DOMAINS = ["spam.example", "junk.example", "phishing.example", ...]  # 500 entries

def is_blocked(domain: str) -> bool:
    return domain in BLOCKED_DOMAINS  # O(n) scan on every call

def dedupe_keep_order(items: list[str]) -> list[str]:
    seen = []
    result = []
    for item in items:
        if item not in seen:  # O(n) scan, O(n^2) overall
            seen.append(item)
            result.append(item)
    return result
```

## Good

```python
BLOCKED_DOMAINS = frozenset(["spam.example", "junk.example", "phishing.example", ...])

def is_blocked(domain: str) -> bool:
    return domain in BLOCKED_DOMAINS  # O(1) average-case hash lookup

def dedupe_keep_order(items: list[str]) -> list[str]:
    seen: set[str] = set()
    result = []
    for item in items:
        if item not in seen:  # O(1) lookup, O(n) overall
            seen.add(item)
            result.append(item)
    return result
```

## When a List Is Fine

For very small, fixed collections (a handful of literal values checked rarely), the constant-factor overhead of hashing can make `list` membership just as fast in practice, and the readability is identical either way:

```python
if status in ("pending", "active", "closed"):  # 3 items, checked occasionally — fine as-is
    ...
```

The rule matters once the collection is built at runtime, grows with input size, or the check runs inside a hot loop. As a rough heuristic: if you're tempted to write `in` inside a `for` loop, or the right-hand side has more than ~10 elements, reach for a `set`.

## See Also

- [`coll-frozenset-immutable-set`](coll-frozenset-immutable-set.md) - immutable sets for exactly this use case
- [`anti-list-for-membership`](anti-list-for-membership.md) - the anti-pattern this rule corrects
- [`perf-avoid-premature-optimization`](perf-avoid-premature-optimization.md) - when the O(n) scan actually doesn't matter

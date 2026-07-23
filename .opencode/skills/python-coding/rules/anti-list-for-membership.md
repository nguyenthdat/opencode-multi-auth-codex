# anti-list-for-membership

> Don't use a `list` for repeated membership tests when a `set`/`dict` fits

## Why It Matters

`in` on a `list` is O(n) — Python scans element by element until it finds a match or exhausts the list — while `in` on a `set` or `dict` is O(1) average case via hashing. For a membership check run once, the difference is invisible; for a check run inside a loop over a large collection, a `list` turns an O(n) operation into an O(n*m) algorithm, which is a common and easily-avoided source of code that "works fine in dev" and times out in production once the input size grows.

## Bad

```python
BLOCKED_USER_IDS = [4821, 9932, 1055, 7743, 2210, 6698, ...]  # thousands of entries

def is_blocked(user_id: int) -> bool:
    return user_id in BLOCKED_USER_IDS   # O(n) scan on every call

def filter_active(orders: list[Order], valid_skus: list[str]) -> list[Order]:
    return [o for o in orders if o.sku in valid_skus]  # O(n * m): list scan per order
```

## Good

```python
BLOCKED_USER_IDS = frozenset({4821, 9932, 1055, 7743, 2210, 6698})  # O(1) lookup

def is_blocked(user_id: int) -> bool:
    return user_id in BLOCKED_USER_IDS

def filter_active(orders: list[Order], valid_skus: list[str]) -> list[Order]:
    valid = set(valid_skus)   # convert once, O(m)
    return [o for o in orders if o.sku in valid]  # O(n) total, not O(n * m)
```

## When to Use Which

| Structure | Membership | Ordered | Duplicates | Use when |
|---|---|---|---|---|
| `list` | O(n) | yes | yes | order matters, small size, or you need indexing |
| `set`/`frozenset` | O(1) avg | no | no | fast membership, uniqueness, no need for order |
| `dict` | O(1) avg | insertion-order | no (keys) | membership *plus* an associated value |

If the collection is small (a handful of items) or checked only once, the `list`'s O(n) cost is irrelevant and converting to a `set` is unnecessary ceremony — this rule matters specifically when membership is checked repeatedly, in a loop, or against a large collection.

## Ruff Rule

Ruff's `PERF` and `C4` rule families flag related inefficiencies, e.g. building a `list` solely to call `.count()` or to check membership once inside a loop (`PERF401`), nudging toward the appropriate structure.

## Real-World Example

`django`'s form validation and `requests`'s `codes` lookup both favor sets/frozensets for exactly this reason — CPython's own `keyword.iskeyword()` is backed by a `frozenset` of keywords rather than a list, since it's called on every identifier the tokenizer sees:

```python
# cpython/Lib/keyword.py (simplified)
kwlist = ["False", "None", "True", "and", "as", ...]
softkwlist = ["_", "case", "match", "type"]

# Exposed to callers as a set-backed check, not a list scan:
iskeyword = frozenset(kwlist).__contains__
```

## See Also

- [`perf-set-membership`](perf-set-membership.md) - the performance-focused framing of this same optimization
- [`coll-frozenset-immutable-set`](coll-frozenset-immutable-set.md) - using `frozenset` for fixed, hashable membership sets
- [`perf-avoid-premature-optimization`](perf-avoid-premature-optimization.md) - knowing when this optimization actually matters

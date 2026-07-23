# coll-comprehension-readability

> Keep comprehensions readable; avoid deeply nested or multi-condition comprehensions

## Why It Matters

A comprehension is a readability win only up to a point — once it has nested loops, multiple `if` clauses, and a non-trivial expression all crammed onto one line, it becomes harder to read than the equivalent `for` loop it was meant to replace. Readers have to mentally reconstruct the loop order (comprehensions evaluate left-to-right, outermost-`for`-first, which is easy to get backwards when nested), and debugging a failing condition means picking apart a single dense expression instead of setting a breakpoint on a specific line.

## Bad

```python
# Three nested loops, two conditions, and a transform, all in one comprehension
matrix_pairs = [
    (i, j, matrix[i][j])
    for i in range(len(matrix))
    for j in range(len(matrix[i]))
    if matrix[i][j] is not None
    if matrix[i][j] > threshold
    for threshold in [compute_threshold(i)]  # abusing `for` to bind a local
]
```

## Good

```python
def matrix_pairs_above_threshold(matrix: list[list[float | None]]) -> list[tuple[int, int, float]]:
    pairs = []
    for i, row in enumerate(matrix):
        threshold = compute_threshold(i)
        for j, value in enumerate(row):
            if value is not None and value > threshold:
                pairs.append((i, j, value))
    return pairs
```

## A Practical Line

A single `for` and up to one `if` clause is usually still clearer as a comprehension:

```python
evens = [n for n in numbers if n % 2 == 0]  # fine — one loop, one condition
```

Two `for` clauses (flattening a nested structure) is often still acceptable if the intent is obvious:

```python
flattened = [item for row in matrix for item in row]  # a common, well-understood idiom
```

Beyond that — multiple conditions, nested comprehensions inside comprehensions, or an expression that itself needs a line break — switch to a named function or an explicit loop. A good smell test: if you can't read the comprehension aloud in one breath and have it make sense, rewrite it as a loop.

```python
# Borderline: two conditions is still readable if kept short and combined with `and`
valid_active = [u for u in users if u.is_active and u.email_verified]

# Over the line: extract the predicate into a named function instead
def is_eligible_for_upgrade(user: User) -> bool:
    return user.is_active and user.email_verified and user.tenure_days > 90 and not user.is_banned

eligible = [u for u in users if is_eligible_for_upgrade(u)]
```

## See Also

- [`perf-comprehension-over-loop`](perf-comprehension-over-loop.md) - when a comprehension is the right performance choice
- [`coll-avoid-index-loop`](coll-avoid-index-loop.md) - the loop-based alternative for indexed iteration
- [`anti-deep-nesting`](anti-deep-nesting.md) - the general anti-pattern of excessive nesting

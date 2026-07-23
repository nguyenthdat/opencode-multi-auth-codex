# coll-avoid-index-loop

> Use `enumerate`/`zip` instead of manual `range(len(...))` index loops

## Why It Matters

`for i in range(len(items)): item = items[i]` re-derives, via an extra indexing operation, something Python can hand you directly through iteration — and it opens the door to off-by-one errors, forgetting to update a bound after mutating the list, and awkward parallel-index bugs when you need to walk two sequences together. `enumerate` and `zip` are C-implemented, express intent directly ("give me index and value" / "walk these together"), and are the idiomatic Python readers expect.

## Bad

```python
def print_numbered(items: list[str]) -> None:
    for i in range(len(items)):
        print(f"{i + 1}. {items[i]}")

def combine(names: list[str], scores: list[int]) -> list[str]:
    result = []
    for i in range(len(names)):
        result.append(f"{names[i]}: {scores[i]}")  # assumes both lists are same length, unchecked
    return result
```

## Good

```python
def print_numbered(items: list[str]) -> None:
    for i, item in enumerate(items, start=1):
        print(f"{i}. {item}")

def combine(names: list[str], scores: list[int]) -> list[str]:
    return [f"{name}: {score}" for name, score in zip(names, scores, strict=True)]
```

## `zip(strict=True)` Catches Length Mismatches

Python 3.10 added `strict=True` to `zip`, which raises `ValueError` if the sequences aren't the same length instead of silently truncating to the shortest one — almost always what you want when the sequences are supposed to correspond one-to-one:

```python
# Without strict=True, a length mismatch silently drops trailing items — a real footgun
for name, score in zip(names, scores, strict=True):
    record(name, score)
```

Manual indexing is still appropriate when you need to write to specific positions in an existing list (`items[i] = new_value`) rather than just read — `enumerate` gives you the index for exactly that case too, without the `range(len(...))` boilerplate:

```python
for i, value in enumerate(items):
    if value < 0:
        items[i] = 0  # in-place update, enumerate still avoids range(len(...))
```

`enumerate` also accepts a `start` argument for 1-based (or any offset) numbering without manual `+1` arithmetic scattered through the loop body, and both `enumerate` and `zip` are lazy iterators themselves, so they add no extra memory overhead compared to indexing.

```python
# zip naturally extends to three or more sequences walked in lockstep
for name, score, rank in zip(names, scores, ranks, strict=True):
    print(f"{rank}. {name}: {score}")
```

## See Also

- [`coll-unpacking-star`](coll-unpacking-star.md) - destructuring the tuples that `enumerate`/`zip` produce
- [`perf-comprehension-over-loop`](perf-comprehension-over-loop.md) - combining this with comprehensions
- [`coll-comprehension-readability`](coll-comprehension-readability.md) - keeping `zip`-based comprehensions readable

# res-generator-lazy

> Use generators for lazy, memory-efficient iteration instead of building full lists

## Why It Matters

A function that returns a `list` must materialize every element in memory before the caller sees any of them, even if the caller only needs the first few or plans to stream them elsewhere. A generator produces values one at a time on demand, keeping memory bounded to a single item (plus whatever state the generator itself holds) regardless of how large the logical sequence is. This matters enormously for file processing, pagination, and pipelines chained together with `itertools`.

## Bad

```python
def read_large_log(path: str) -> list[str]:
    lines = []
    with open(path) as f:
        for line in f:
            lines.append(line.strip())
    return lines  # entire file held in memory at once

def squares_up_to(n: int) -> list[int]:
    return [i * i for i in range(n)]  # materializes all n values eagerly

# Caller only wants the first error, but pays for computing all of them
errors = [validate(record) for record in huge_dataset if not validate(record)]
first_error = errors[0] if errors else None
```

## Good

```python
from collections.abc import Iterator

def read_large_log(path: str) -> Iterator[str]:
    with open(path) as f:
        for line in f:
            yield line.strip()  # one line in memory at a time

def squares_up_to(n: int) -> Iterator[int]:
    return (i * i for i in range(n))

def first_invalid(records: Iterator[Record]) -> Record | None:
    return next((r for r in records if not validate(r)), None)  # stops early
```

## When a List Is the Right Choice

Generators are one-shot and can't be indexed, `len()`-ed, or iterated twice. Use a list when the caller genuinely needs random access, multiple passes, or `len()`:

```python
def load_lookup_table(path: str) -> list[str]:
    with open(path) as f:
        return f.readlines()  # small, reused repeatedly by index — a list is fine

def top_n(items: Iterator[int], n: int) -> list[int]:
    import heapq
    return heapq.nlargest(n, items)  # consumes the generator once, returns a finite list
```

A useful heuristic: if the consumer is a `for` loop or feeds into another generator-based pipeline (`itertools.chain`, `map`, `filter`), keep it lazy. If the consumer needs to slice, sort in place, or check membership repeatedly, materialize a list deliberately and name it as such.

## See Also

- [`res-streaming-large-files`](res-streaming-large-files.md) - the file-I/O-specific application of laziness
- [`perf-generator-expression`](perf-generator-expression.md) - generator expressions for performance, not just memory
- [`coll-comprehension-readability`](coll-comprehension-readability.md) - when a comprehension is clearer than a generator

# perf-generator-expression

> Use generator expressions to avoid materializing full lists when only iterating once

## Why It Matters

A list comprehension allocates and fills an entire container before the first consumer sees any value. When the result feeds directly into `sum()`, `any()`, `all()`, `max()`, or a single `for` loop, that allocation is pure waste — the generator expression form computes each value lazily, uses constant memory, and can short-circuit functions like `any()`/`all()` after the first hit instead of always doing full work. The only syntactic cost is dropping the brackets.

## Bad

```python
# Builds a full list of booleans just to reduce it to one
has_admin = any([user.role == "admin" for user in users])

# Materializes every squared value before summing
total = sum([x * x for x in range(1_000_000)])

# Allocates a full list of parsed lines even though only one is consumed at a time
for record in [parse(line) for line in log_lines]:
    process(record)
```

## Good

```python
has_admin = any(user.role == "admin" for user in users)

total = sum(x * x for x in range(1_000_000))

for record in (parse(line) for line in log_lines):
    process(record)
```

## When a List Comprehension Is Still Right

Use `[...]` (not a generator) when the caller needs `len()`, indexing, repeated iteration, or the values are small and reused. Generators are single-use; if you accidentally pass an exhausted generator to a second consumer, you'll silently get an empty result:

```python
squares = [x * x for x in range(10)]  # need to iterate this twice below
print(len(squares))
for s in squares:
    ...
for s in squares:  # a generator would be empty here on the second pass
    ...
```

A useful rule of thumb: if the expression is being passed straight into a single function call that consumes an iterable (`sum`, `any`, `all`, `sorted`, `"".join`, `max`), drop the brackets. If it's being bound to a name for later reuse, keep them.

Note that `sorted(...)` and `list(...)` still need to consume the whole generator to do their job, so a generator expression buys you nothing there beyond a cosmetic difference — the memory win specifically comes from functions that can process values one at a time (`sum`, `any`, `all`) or short-circuit before reaching the end (`any`, `all`, `next`).

```python
# next() with a default is the idiomatic way to pull the first match from a generator
first_negative = next((x for x in numbers if x < 0), None)

# Passing a generator expression as the sole argument doesn't even need extra parens
total = sum(x for x in readings if x is not None)
```

## See Also

- [`perf-comprehension-over-loop`](perf-comprehension-over-loop.md) - comprehensions vs. manual loops
- [`res-generator-lazy`](res-generator-lazy.md) - the broader memory-efficiency case for generators
- [`coll-comprehension-readability`](coll-comprehension-readability.md) - keeping the expression itself readable

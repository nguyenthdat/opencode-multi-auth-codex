# coll-unpacking-star

> Use unpacking (`*rest`, `first, *middle, last`) instead of manual slicing

## Why It Matters

Manual slicing (`items[0]`, `items[1:]`) to pull apart a sequence works but forces the reader to count indices and reason about off-by-one boundaries. Star-unpacking expresses the same "first element plus the rest" (or "head, middle, tail") shape directly in the assignment target, which is both more self-documenting and less error-prone — there's no index arithmetic to get wrong.

## Bad

```python
def process_command(tokens: list[str]) -> None:
    command = tokens[0]
    args = tokens[1:]
    dispatch(command, args)

def first_and_last(scores: list[int]) -> tuple[int, int]:
    return scores[0], scores[-1]

def drop_header_and_footer(rows: list[str]) -> list[str]:
    return rows[1:-1]
```

## Good

```python
def process_command(tokens: list[str]) -> None:
    command, *args = tokens
    dispatch(command, args)

def first_and_last(scores: list[int]) -> tuple[int, int]:
    first, *_, last = scores
    return first, last

def drop_header_and_footer(rows: list[str]) -> list[str]:
    _header, *body, _footer = rows
    return body
```

## Unpacking in Loops and Function Calls

Star-unpacking also reads cleanly when destructuring items produced by a loop or combining sequences:

```python
def summarize(readings: list[tuple[str, float, float, float]]) -> None:
    for sensor_id, *values in readings:  # sensor_id plus a variable-length tail
        print(sensor_id, sum(values) / len(values))

# Merging sequences with unpacking instead of concatenation calls
combined = [*defaults, *overrides]  # equivalent to defaults + overrides, reads as "spread"

def call_with_extra(fn, first_arg, *rest_args):
    return fn(first_arg, *rest_args, extra=True)
```

Reach for plain slicing (`items[2:5]`) when you genuinely want a sub-sequence back rather than individually named variables — star-unpacking is for *naming* pieces of a sequence, not for extracting an arbitrary contiguous range.

## See Also

- [`coll-namedtuple-record`](coll-namedtuple-record.md) - named records that these unpacking patterns commonly destructure
- [`coll-avoid-index-loop`](coll-avoid-index-loop.md) - the related anti-pattern of manual index-based access
- [`api-return-consistent-types`](api-return-consistent-types.md) - keeping the unpacked shape stable across call sites

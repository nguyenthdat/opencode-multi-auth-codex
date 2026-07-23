# perf-join-strings

> Use `str.join()` instead of repeated `+=` string concatenation in loops

## Why It Matters

Strings in Python are immutable, so `result += chunk` inside a loop allocates a brand-new string every iteration and copies the old contents into it. CPython has a narrow optimization that can sometimes do this in place when the reference count allows it, but it's not guaranteed and doesn't apply across all builds/versions, so `+=` concatenation in a loop is worst-case O(n^2) in the total length. `str.join()` pre-computes the total size once and builds the result in a single allocation, giving O(n) behavior.

## Bad

```python
def build_csv_row(fields: list[str]) -> str:
    row = ""
    for field in fields:
        row += field + ","  # new string object allocated every iteration
    return row.rstrip(",")

def render_report(sections: list[str]) -> str:
    output = ""
    for section in sections:
        output += section + "\n\n"
    return output
```

## Good

```python
def build_csv_row(fields: list[str]) -> str:
    return ",".join(fields)

def render_report(sections: list[str]) -> str:
    return "\n\n".join(sections)
```

## Building Strings Incrementally

When the pieces aren't known up front (e.g., built conditionally across a loop with other logic in between), collect them in a list and join once at the end rather than concatenating as you go:

```python
def format_diff(changes: list[Change]) -> str:
    lines = []
    for change in changes:
        if change.kind is ChangeKind.ADDED:
            lines.append(f"+ {change.path}")
        elif change.kind is ChangeKind.REMOVED:
            lines.append(f"- {change.path}")
    return "\n".join(lines)
```

For truly large or streamed output (megabytes of text, or generated incrementally over time), write directly to an `io.StringIO` buffer or a file object instead of building one giant string in memory:

```python
import io

buf = io.StringIO()
for section in sections:
    buf.write(section)
    buf.write("\n\n")
report = buf.getvalue()
```

## See Also

- [`perf-batch-io`](perf-batch-io.md) - batching output writes instead of many small ones
- [`coll-comprehension-readability`](coll-comprehension-readability.md) - building the list that gets joined
- [`res-streaming-large-files`](res-streaming-large-files.md) - when the output itself shouldn't live fully in memory

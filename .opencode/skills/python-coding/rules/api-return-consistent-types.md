# api-return-consistent-types

> Return a consistent type from a function; avoid union "return soup"

## Why It Matters

A function that sometimes returns a `list`, sometimes `None`, and sometimes a bare value forces every caller to branch on `type()` or add defensive `isinstance()` checks before doing anything useful with the result, and it defeats the purpose of type hints since `X | Y | None` accumulates into an unreadable signature as more cases get added. Consistent return types — even if that means always returning an empty collection instead of `None`, or wrapping variants in a single result type — push the complexity into one well-defined place instead of leaking it into every call site.

## Bad

```python
def find_matches(pattern: str, items: list[str]) -> list[str] | str | None:
    matches = [i for i in items if pattern in i]
    if not matches:
        return None                 # caller must check for None
    if len(matches) == 1:
        return matches[0]           # caller must check for str
    return matches                  # caller must check for list

result = find_matches("foo", data)
if result is None:
    ...
elif isinstance(result, str):
    ...
else:
    ...  # three branches just to consume one function's output
```

## Good

```python
def find_matches(pattern: str, items: list[str]) -> list[str]:
    return [i for i in items if pattern in i]  # always a list, possibly empty

matches = find_matches("foo", data)
if not matches:
    handle_no_matches()
else:
    handle_matches(matches)  # single, consistent shape to work with
```

## When Multiple Outcomes Are Genuinely Different

If a function has real success/failure or found/not-found variants, model that explicitly with a single sum type rather than an ad hoc union of unrelated shapes:

```python
from dataclasses import dataclass

@dataclass(frozen=True)
class Found:
    value: str

@dataclass(frozen=True)
class NotFound:
    pattern: str

def find_first(pattern: str, items: list[str]) -> Found | NotFound:
    for item in items:
        if pattern in item:
            return Found(item)
    return NotFound(pattern)

result = find_first("foo", data)
match result:
    case Found(value):
        print(f"matched: {value}")
    case NotFound(pattern):
        print(f"no match for {pattern!r}")
```

This is still a union return type, but each branch is a distinct, well-named, exhaustively matchable case — the opposite of an incidental mix of `list | str | None` that grew accidentally over time.

## See Also

- [`type-narrow-guards`](type-narrow-guards.md) - narrowing union return types safely at call sites
- [`api-sentinel-default`](api-sentinel-default.md) - distinguishing "no value" from "falsy value" without overloading `None`
- [`err-fail-fast-validate`](err-fail-fast-validate.md) - raising instead of returning an error-shaped value for exceptional cases

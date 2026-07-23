# err-no-exceptions-control-flow

> Don't use exceptions for expected, ordinary control flow

## Why It Matters

Exceptions are for *exceptional* conditions — situations a function's normal contract doesn't cover. Using `try/except` to implement routine, expected branching (checking membership, handling an empty collection, distinguishing "found" from "not found" in the common case) makes control flow harder to follow, is often slower than a direct check, and blurs the line between "this is a bug/failure" and "this is just one of two normal outcomes."

## Bad

```python
def get_discount(user_id: str) -> float:
    try:
        return _DISCOUNTS[user_id]
    except KeyError:
        return 0.0  # "no discount" is a completely normal, expected case

def is_valid_port(value: str) -> bool:
    try:
        port = int(value)
        return 0 <= port <= 65535
    except ValueError:
        return False  # used as the *primary* mechanism to test validity
```

## Good

```python
def get_discount(user_id: str) -> float:
    return _DISCOUNTS.get(user_id, 0.0)  # direct, no exception needed at all

def is_valid_port(value: str) -> bool:
    return value.isdigit() and 0 <= int(value) <= 65535
```

## When Exceptions Are the Right Tool

```python
def get_user(user_id: str) -> User:
    user = _users.get(user_id)
    if user is None:
        raise UserNotFoundError(user_id)  # genuinely exceptional: caller expected a user
    return user

# vs. returning Optional when "missing" is a normal, expected outcome
def find_user(user_id: str) -> User | None:
    return _users.get(user_id)
```

Reserve exceptions for conditions that violate a function's contract or represent genuine failure (file truly should have existed, network truly should have responded). For routine "is it there / is it valid" checks where absence is a normal outcome, prefer direct checks, `dict.get`, or returning `X | None` — reserve `raise`/`except` for the caller who explicitly expects the value to exist and wants a hard failure if it doesn't.

## Performance Is a Secondary but Real Factor

```python
import timeit

def with_exception(d: dict, key: str) -> int:
    try:
        return d[key]
    except KeyError:
        return 0

def with_get(d: dict, key: str) -> int:
    return d.get(key, 0)

# When the key is usually missing, the exception-based version pays the
# cost of unwinding the stack on every miss; .get() never pays that cost.
```

Exception handling in CPython is cheap when nothing is raised (the `try` block itself is nearly free), but *raising* is comparatively expensive — so using exceptions for a code path that fails routinely (e.g., most lookups miss) is measurably slower than a direct check, on top of being harder to read.

## See Also

- [`err-fail-fast-validate`](err-fail-fast-validate.md) - the boundary-validation case where raising *is* correct
- [`type-narrow-guards`](type-narrow-guards.md) - narrowing `X | None` instead of catching an exception
- [`api-sentinel-default`](api-sentinel-default.md) - using a sentinel/`None` return instead of exceptions for "not found"

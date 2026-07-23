# err-custom-attributes

> Attach structured, machine-readable data as attributes on custom exceptions

## Why It Matters

An exception whose only information is a formatted message string forces every caller who needs to react programmatically (retry logic, structured logging, error-code mapping to an HTTP response) to parse that string with regexes — brittle and prone to breaking whenever the wording changes. Attaching the relevant data as real attributes on the exception instance lets callers access it directly and safely, while the message string remains free to be human-friendly.

## Bad

```python
class RateLimitError(Exception):
    pass

def call_api(endpoint: str) -> dict:
    if is_rate_limited(endpoint):
        raise RateLimitError(f"rate limited on {endpoint}, retry after 30s")

try:
    call_api("/orders")
except RateLimitError as exc:
    # Caller has to parse the message string to get the retry delay -- fragile.
    import re
    match = re.search(r"retry after (\d+)s", str(exc))
    retry_after = int(match.group(1)) if match else 60
    time.sleep(retry_after)
```

## Good

```python
class RateLimitError(Exception):
    def __init__(self, endpoint: str, retry_after: float) -> None:
        super().__init__(f"rate limited on {endpoint}, retry after {retry_after}s")
        self.endpoint = endpoint
        self.retry_after = retry_after

def call_api(endpoint: str) -> dict:
    if is_rate_limited(endpoint):
        raise RateLimitError(endpoint, retry_after=30.0)

try:
    call_api("/orders")
except RateLimitError as exc:
    time.sleep(exc.retry_after)  # direct, type-safe access, no parsing
```

## Structured Exceptions With `dataclass`-Style Fields

```python
class ValidationError(Exception):
    def __init__(self, field: str, value: object, reason: str) -> None:
        super().__init__(f"invalid {field}={value!r}: {reason}")
        self.field = field
        self.value = value
        self.reason = reason

try:
    validate(payload)
except ValidationError as exc:
    return JSONResponse(
        status_code=422,
        content={"field": exc.field, "reason": exc.reason},
    )
```

This pattern is exactly how `requests.exceptions.HTTPError` exposes `.response`, and how Pydantic's `ValidationError` exposes `.errors()` — both give callers structured access instead of forcing string parsing.

## See Also

- [`err-custom-hierarchy`](err-custom-hierarchy.md) - the base hierarchy these attribute-bearing exceptions live in
- [`err-raise-from`](err-raise-from.md) - preserving cause data alongside these custom attributes
- [`data-dataclass-vs-pydantic`](data-dataclass-vs-pydantic.md) - structuring rich exception payloads

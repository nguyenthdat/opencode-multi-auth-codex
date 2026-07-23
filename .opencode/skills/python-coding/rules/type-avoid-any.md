# type-avoid-any

> Avoid `Any`; narrow with unions, protocols, or generics instead

## Why It Matters

`Any` is a type-checker escape hatch: it disables checking for every operation performed on that value and silently propagates to everything it touches, effectively creating a hole in your type coverage. Each `Any` in a public signature is a place where a caller's mistake — wrong type, typo'd attribute, wrong argument count — will not be caught until runtime, defeating the purpose of adding type hints at all.

## Bad

```python
from typing import Any

def process_event(event: Any) -> Any:
    if event["type"] == "click":
        return event["payload"]["x"] + event["payload"]["y"]
    return None

def get_config(key: str) -> Any:
    return _CONFIG.get(key)

timeout: Any = get_config("timeout")
result = timeout + 5  # no error even if timeout is a string
```

## Good

```python
from typing import TypedDict, Literal

class ClickPayload(TypedDict):
    x: int
    y: int

class ClickEvent(TypedDict):
    type: Literal["click"]
    payload: ClickPayload

def process_event(event: ClickEvent) -> int:
    return event["payload"]["x"] + event["payload"]["y"]

def get_timeout_seconds() -> float:
    value = _CONFIG.get("timeout")
    if not isinstance(value, (int, float)):
        raise TypeError(f"expected numeric timeout, got {type(value).__name__}")
    return float(value)

result = get_timeout_seconds() + 5  # statically safe
```

## When `Any` Is Acceptable

- **Truly dynamic boundaries**: decoding arbitrary user-supplied JSON before you've validated its shape (validate immediately after with Pydantic/TypedDict + `isinstance`, then stop using `Any`).
- **Third-party stubs with incomplete typing**: isolate the `Any` behind a thin wrapper function with a precise signature so it doesn't leak further.
- **Gradual migration**: adding types to a large untyped codebase incrementally — prefer `object` over `Any` when possible, since `object` still forces explicit narrowing:

```python
def log_value(value: object) -> None:
    print(str(value))  # only operations valid on `object` are allowed
```

`object` is the type-safe alternative to `Any` when you genuinely don't know or care about the type: it accepts anything but doesn't let you call arbitrary methods without narrowing first.

## See Also

- [`type-typeddict-shape`](type-typeddict-shape.md) - shaping dict-like data instead of `dict[str, Any]`
- [`type-narrow-guards`](type-narrow-guards.md) - narrowing `object`/union values safely
- [`type-check-tool`](type-check-tool.md) - enforcing strict mode so new `Any` usage is flagged

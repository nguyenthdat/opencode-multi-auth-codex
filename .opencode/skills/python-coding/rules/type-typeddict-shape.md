# type-typeddict-shape

> Use `TypedDict` to type dict-shaped data instead of `dict[str, Any]`

## Why It Matters

`dict[str, Any]` tells the type checker nothing about which keys exist or what their value types are, so typos in key names and wrong-type assignments slip through silently until runtime. `TypedDict` documents the exact shape of a JSON-like payload (API responses, config blocks, kwargs bags) while still being a plain `dict` at runtime — zero overhead, full static safety.

## Bad

```python
def build_user_payload(name: str, age: int) -> dict[str, Any]:
    return {"name": name, "age": age, "is_active": True}

def render(payload: dict[str, Any]) -> str:
    # Typo not caught: "nmae" instead of "name"
    return f"{payload['nmae']} ({payload['age']})"

payload = build_user_payload("Ada", 30)
payload["age"] = "thirty"  # wrong type, no error from the checker
```

## Good

```python
from typing import TypedDict

class UserPayload(TypedDict):
    name: str
    age: int
    is_active: bool

def build_user_payload(name: str, age: int) -> UserPayload:
    return {"name": name, "age": age, "is_active": True}

def render(payload: UserPayload) -> str:
    return f"{payload['name']} ({payload['age']})"  # typo now caught by mypy/pyright

payload = build_user_payload("Ada", 30)
payload["age"] = "thirty"  # type error: expected int, got str
```

## Optional Keys and Inheritance

```python
from typing import TypedDict, NotRequired

class BaseEvent(TypedDict):
    event_id: str
    timestamp: float

class ClickEvent(BaseEvent):
    element_id: str
    metadata: NotRequired[dict[str, str]]  # optional key, PEP 655 (3.11+)

def handle(event: ClickEvent) -> None:
    element = event["element_id"]
    tags = event.get("metadata", {})
```

`TypedDict` shines for external boundaries (JSON payloads, `**kwargs`, config dicts read from YAML) where you want dict semantics but static shape guarantees. For internal domain objects that need methods, validation, or immutability, prefer a `dataclass` or Pydantic model instead.

## See Also

- [`data-avoid-dict-any`](data-avoid-dict-any.md) - the broader principle this rule specializes
- [`data-pydantic-validation`](data-pydantic-validation.md) - when you need runtime validation, not just static shape
- [`type-avoid-any`](type-avoid-any.md) - why `Any` erodes type safety generally

# type-overload-signatures

> Use `@overload` to describe multiple call signatures precisely

## Why It Matters

Some functions genuinely behave differently depending on the combination of argument types they receive — the return type or accepted arguments vary by call shape. A single loosely-typed signature (with unions and `Any`) forces every caller to narrow the result themselves, even though the correct return type was knowable at the call site. `@overload` lets you declare each valid call shape separately so the type checker resolves the precise return type per call, while keeping one real implementation.

## Bad

```python
def fetch(id_or_ids: int | list[int]) -> dict | list[dict]:
    if isinstance(id_or_ids, int):
        return _get_one(id_or_ids)
    return [_get_one(i) for i in id_or_ids]

# Caller has to narrow manually even though the shape was determined by the input:
result = fetch(42)
# result: dict | list[dict]  -- checker can't tell it's just `dict` here
name = result["name"]  # type error: list[dict] has no __getitem__ with str key semantics
```

## Good

```python
from typing import overload

@overload
def fetch(id_or_ids: int) -> dict: ...
@overload
def fetch(id_or_ids: list[int]) -> list[dict]: ...
def fetch(id_or_ids: int | list[int]) -> dict | list[dict]:
    if isinstance(id_or_ids, int):
        return _get_one(id_or_ids)
    return [_get_one(i) for i in id_or_ids]

result = fetch(42)          # inferred as dict
name = result["name"]       # OK, no error

results = fetch([1, 2, 3])  # inferred as list[dict]
names = [r["name"] for r in results]  # OK
```

## Overloads With Literal Discriminants

```python
from typing import overload, Literal

@overload
def parse(data: bytes, *, as_text: Literal[True]) -> str: ...
@overload
def parse(data: bytes, *, as_text: Literal[False] = False) -> bytes: ...
def parse(data: bytes, *, as_text: bool = False) -> str | bytes:
    return data.decode() if as_text else data
```

Rules of thumb: keep the implementation signature (the last, un-decorated `def`) as the union of all overloads — it's never checked against call sites directly. Only reach for `@overload` when the return type or accepted keyword combination genuinely differs by input shape; for straightforward optional parameters, a single signature with defaults is simpler and preferred.

## See Also

- [`type-literal-constrain`](type-literal-constrain.md) - `Literal` discriminants used to select an overload
- [`type-union-pipe`](type-union-pipe.md) - the union syntax used in the fallback implementation signature
- [`api-return-consistent-types`](api-return-consistent-types.md) - why unpredictable return shapes are a design smell in the first place

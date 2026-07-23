# res-avoid-unnecessary-copy

> Avoid copying large structures (`list()`, `dict()`, `copy.deepcopy`) unnecessarily

## Why It Matters

Every `list(x)`, `dict(x)`, or `copy.deepcopy(x)` allocates a new structure and copies every element, which costs both time and memory proportional to the structure's size. When the original isn't going to be mutated, or when a view/slice would do, an unnecessary copy doubles peak memory usage and adds an O(n) cost that shows up directly in profiles on hot paths. Reach for a copy only when you specifically need independent, mutable state.

## Bad

```python
def get_active_users(users: list[dict[str, object]]) -> list[dict[str, object]]:
    users_copy = list(users)  # unnecessary — we never mutate the copy
    return [u for u in users_copy if u["active"]]

def merge_config(base: dict[str, object], overrides: dict[str, object]) -> dict[str, object]:
    result = copy.deepcopy(base)  # deep copy when values are already immutable-ish
    result.update(overrides)
    return result

def process_batch(records: list[Record]) -> None:
    snapshot = records[:]  # full copy just to iterate
    for r in snapshot:
        handle(r)
```

## Good

```python
import copy

def get_active_users(users: list[dict[str, object]]) -> list[dict[str, object]]:
    return [u for u in users if u["active"]]  # no intermediate copy needed

def merge_config(base: dict[str, object], overrides: dict[str, object]) -> dict[str, object]:
    return base | overrides  # shallow merge, new dict, no deep copy of nested values

def process_batch(records: list[Record]) -> None:
    for r in records:  # iterate directly; nothing here mutates `records`
        handle(r)
```

## When a Copy Is Actually Required

A copy is justified when you need to mutate independently of the original, or must protect against the caller mutating shared state later:

```python
def with_defaults(overrides: dict[str, int]) -> dict[str, int]:
    config = dict(_DEFAULTS)  # shallow copy: we're about to mutate `config`
    config.update(overrides)
    return config

def snapshot_for_rollback(state: MutableState) -> MutableState:
    return copy.deepcopy(state)  # nested mutable structures, genuine independence needed
```

Prefer the shallowest copy that satisfies the requirement: `list(x)`/`dict(x)`/`x[:]` for one level, `copy.copy()` for a single object, and `copy.deepcopy()` only when nested mutable structures must be fully independent — it is the slowest option and should not be the default reach.

## See Also

- [`res-generator-lazy`](res-generator-lazy.md) - avoiding materialization in the first place
- [`data-frozen-immutable`](data-frozen-immutable.md) - immutable objects never need defensive copying
- [`perf-avoid-premature-optimization`](perf-avoid-premature-optimization.md) - profile before chasing copy overhead that isn't hot

# coll-dict-merge-pipe

> Use `|`/`|=` to merge dicts (3.9+) instead of `{**a, **b}` or manual loops

## Why It Matters

`{**a, **b}` works but is a slightly obscure idiom borrowed from function-call unpacking syntax, and a manual loop (`for k, v in b.items(): a[k] = v`) is verbose and mutates in place when you may not want that. PEP 584's `|` and `|=` operators (Python 3.9+) give dict merging the same clear, symmetric operator syntax as set union, with `|` producing a new dict and `|=` updating in place — matching how `|`/`|=` already work for sets.

## Bad

```python
def merged_config(defaults: dict, overrides: dict) -> dict:
    return {**defaults, **overrides}  # works, but reads as call-unpacking syntax repurposed

def apply_overrides(config: dict, overrides: dict) -> None:
    for key, value in overrides.items():  # manual loop for what's really just a merge
        config[key] = value
```

## Good

```python
def merged_config(defaults: dict, overrides: dict) -> dict:
    return defaults | overrides  # right operand wins on key conflicts

def apply_overrides(config: dict, overrides: dict) -> None:
    config |= overrides  # in-place merge, same precedence rule
```

## Merge Order and Multiple Dicts

Later operands win on conflicting keys, same as `{**a, **b}` — `a | b` prefers `b`'s values:

```python
base = {"timeout": 30, "retries": 3}
user_config = {"timeout": 60}
effective = base | user_config  # {"timeout": 60, "retries": 3}

# Chaining merges left-to-right for layered config (defaults -> file -> env -> CLI flags)
final_config = defaults | file_config | env_config | cli_args
```

For codebases that must support Python 3.8 or earlier, `{**a, **b}` or `dict(a, **b)` remain the fallback — `|`/`|=` on dicts is strictly a 3.9+ feature (sets have supported `|` for merging much longer).

```python
# `|=` mutates the left-hand dict in place, useful for updating a long-lived object
class Settings:
    def __init__(self) -> None:
        self._values: dict[str, object] = {}

    def apply(self, overrides: dict[str, object]) -> None:
        self._values |= overrides  # in-place merge, no new dict object created
```

Note that `|` requires both operands to be `dict` instances (or subclasses); merging a dict with an arbitrary mapping still needs `dict(a) | dict(b)` or the `{**a, **b}` form.

## See Also

- [`coll-defaultdict-grouping`](coll-defaultdict-grouping.md) - building the dicts that later get merged
- [`coll-frozenset-immutable-set`](coll-frozenset-immutable-set.md) - the equivalent `|` operator for sets
- [`api-no-mutable-default`](api-no-mutable-default.md) - avoiding accidental shared-state bugs when merging into defaults

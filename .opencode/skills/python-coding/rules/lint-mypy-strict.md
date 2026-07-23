# lint-mypy-strict

> Run mypy or pyright in strict mode, not the permissive default

## Why It Matters

Mypy's default settings allow untyped function bodies, implicit `Any` on missing annotations, and permissive `Optional` handling — meaning a file full of `def f(x): return x.foo` type-checks cleanly even though `x` could be anything. Strict mode turns on the checks that catch real bugs: unreachable code, missing return statements, incompatible overrides, and functions that silently return `Any`. Teams that adopt mypy without strict mode get a false sense of safety; the tool passes while whole modules are effectively untyped.

## Bad

```python
# mypy default mode - passes with zero errors
def get_user(user_id):          # untyped def, no error
    user = fetch(user_id)
    return user.profile          # profile could be anything

def process(items=None):         # implicit Optional, no error
    for item in items:            # crashes at runtime if items is None
        print(item.name)

class Repository:
    def save(self, obj) -> None:  # untyped param accepted silently
        self._store(obj)
```

## Good

```python
from __future__ import annotations

from myapp.models import User, UserProfile


def get_user(user_id: int) -> UserProfile:
    user: User = fetch(user_id)
    return user.profile


def process(items: list[Item] | None = None) -> None:
    if items is None:
        items = []
    for item in items:
        print(item.name)


class Repository:
    def save(self, obj: Item) -> None:
        self._store(obj)
```

## Strict Mode Configuration

```toml
# pyproject.toml
[tool.mypy]
python_version = "3.12"
strict = true
warn_unused_ignores = true
warn_redundant_casts = true
disallow_untyped_defs = true
disallow_any_generics = true
no_implicit_reexport = true
```

`strict = true` enables, among others: `disallow_untyped_defs`, `disallow_incomplete_defs`, `check_untyped_defs`, `no_implicit_optional`, `warn_return_any`, and `strict_equality`.

Pyright equivalent:

```json
{
  "typeCheckingMode": "strict",
  "pythonVersion": "3.12"
}
```

## Adopting Strict Mode Incrementally

For an existing codebase, enable strict mode per-module rather than all at once:

```toml
[[tool.mypy.overrides]]
module = "myapp.legacy.*"
strict = false
disallow_untyped_defs = false
```

New modules go in under full strict mode; legacy modules get grandfathered until migrated.

## See Also

- [`type-avoid-any`](type-avoid-any.md) - strict mode's `warn_return_any` catches `Any` leaking through
- [`lint-ci-enforce`](lint-ci-enforce.md) - making mypy failures block merges
- [`type-check-tool`](type-check-tool.md) - choosing between mypy and pyright

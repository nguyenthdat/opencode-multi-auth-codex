# api-keyword-only-args

> Use keyword-only arguments (`*`) for clarity and to prevent positional misuse

## Why It Matters

Positional arguments beyond two or three become a memorization exercise for callers and a silent-bug factory for reviewers: swapping two same-typed positional arguments (`width, height` vs `height, width`) compiles and runs without any error, it just produces wrong results. Marking parameters keyword-only with a bare `*` forces every call site to name them, turning a silent transposition bug into a `TypeError` at best and, more importantly, making every call site self-documenting without needing to check the function signature.

## Bad

```python
def resize_image(path: str, width: int, height: int, keep_aspect: bool, quality: int) -> None:
    ...

# Which is width and which is height? Easy to swap by accident.
resize_image("photo.jpg", 1080, 1920, True, 85)

def create_user(name: str, email: str, is_admin: bool, send_welcome: bool) -> User:
    ...

# Two adjacent bools — a reviewer cannot tell which flag is which without checking the signature
create_user("Ada Lovelace", "ada@example.com", True, False)
```

## Good

```python
def resize_image(
    path: str,
    *,
    width: int,
    height: int,
    keep_aspect: bool = True,
    quality: int = 85,
) -> None:
    ...

resize_image("photo.jpg", width=1080, height=1920, keep_aspect=True, quality=85)

def create_user(
    name: str, email: str, *, is_admin: bool = False, send_welcome: bool = True
) -> User:
    ...

create_user("Ada Lovelace", "ada@example.com", is_admin=True, send_welcome=False)
```

## Mixing Positional and Keyword-Only

Keep the first one or two "obvious" arguments positional (subject of the call), and force everything else — especially flags and options — to be named:

```python
def query(
    table: str,
    condition: str,
    *,
    limit: int | None = None,
    order_by: str | None = None,
) -> list[dict]:
    ...

query("users", "active = true", limit=50, order_by="created_at")
```

This mirrors the standard library itself: `dict.get(key, default=...)` stays positional for the common case, while `sorted(iterable, *, key=None, reverse=False)` forces `key` and `reverse` to be named because guessing their order by position would be error-prone.

## See Also

- [`api-positional-only`](api-positional-only.md) - the complementary `/` marker for parameters that shouldn't be named
- [`api-no-mutable-default`](api-no-mutable-default.md) - another common default-argument pitfall
- [`name-boolean-is-has`](name-boolean-is-has.md) - naming the boolean flags this rule forces callers to spell out

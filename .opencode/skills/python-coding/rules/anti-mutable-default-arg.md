# anti-mutable-default-arg

> Don't use mutable objects (`[]`, `{}`) as default argument values

## Why It Matters

Default argument values are evaluated exactly once, at function definition time, and the resulting object is reused across every call that doesn't pass its own value. A mutable default (`list`, `dict`, `set`, or any mutable class instance) becomes shared, hidden state — one call's mutation silently leaks into the next call, producing bugs that only appear after the function has been invoked multiple times and are notoriously hard to trace back to the definition.

## Bad

```python
def add_item(item, cart=[]):
    cart.append(item)
    return cart

cart_a = add_item("apple")
print(cart_a)  # ['apple']

cart_b = add_item("banana")
print(cart_b)  # ['apple', 'banana'] - the same list object, shared across calls!
print(cart_a)  # ['apple', 'banana'] - cart_a mutated too, even though it was never touched again
```

## Good

```python
def add_item(item, cart: list[str] | None = None) -> list[str]:
    if cart is None:
        cart = []
    cart.append(item)
    return cart

cart_a = add_item("apple")
print(cart_a)  # ['apple']

cart_b = add_item("banana")
print(cart_b)  # ['banana'] - fresh list every call
```

## Ruff Rule

`B006` (flake8-bugbear) flags mutable default arguments directly:

```toml
[tool.ruff.lint]
select = ["B"]
```

```python
def f(items=[]):   # B006: Do not use mutable data structures for argument defaults
    ...
```

The companion rule `B008` flags mutable *calls* as defaults (e.g. `def f(x=SomeMutableClass())`), which has the same one-time-evaluation problem.

## Real-World Example

`requests.Session` avoids this entirely by defaulting to `None` and constructing fresh containers inside `__init__`:

```python
class Session:
    def __init__(self):
        self.headers = default_headers()   # constructed fresh, not a shared default
        self.cookies = cookiejar_from_dict({})
```

The only safe mutable default is an *immutable* sentinel used purely for detection, such as a module-level `object()` sentinel, never a container that gets mutated.

## See Also

- [`api-no-mutable-default`](api-no-mutable-default.md) - the API-design framing of this same rule
- [`api-sentinel-default`](api-sentinel-default.md) - the sentinel pattern for "no value passed"
- [`data-field-defaults-factory`](data-field-defaults-factory.md) - the dataclass/pydantic equivalent using `default_factory`

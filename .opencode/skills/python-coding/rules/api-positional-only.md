# api-positional-only

> Use positional-only parameters (`/`) to keep parameter names free to rename later

## Why It Matters

Once a keyword argument name is part of a public function's signature, callers may pass it by name (`func(value=42)`), and renaming that parameter later becomes a breaking change even though the implementation detail — what you happen to call the parameter internally — shouldn't be part of the contract. Marking parameters positional-only with `/` (PEP 570, Python 3.8+) explicitly declares "the name of this parameter is an implementation detail; only its position and type are part of the API," giving you room to rename it without breaking callers.

## Bad

```python
def calculate_tax(amount: float, rate: float) -> float:
    return amount * rate

calculate_tax(amount=100.0, rate=0.08)   # caller now depends on the exact names
# Renaming `amount` to `subtotal` for clarity later breaks every keyword-call site
```

## Good

```python
def calculate_tax(amount: float, rate: float, /) -> float:
    return amount * rate

calculate_tax(100.0, 0.08)              # only position matters
# calculate_tax(amount=100.0, rate=0.08)  # TypeError — names were never part of the contract

# Free to rename the internal parameter without breaking any caller:
def calculate_tax(subtotal: float, rate: float, /) -> float:
    return subtotal * rate
```

## Combining `/` and `*` for a Fully Deliberate Signature

```python
def resize(image: Image, /, *, width: int, height: int, keep_aspect: bool = True) -> Image:
    ...
# `image` is positional-only (its name isn't part of the API);
# `width`/`height`/`keep_aspect` are keyword-only (must be named for clarity)

resize(photo, width=800, height=600)
```

## Real-World Example: Built-ins

Many built-in functions already use `/` for exactly this reason — `len(obj, /)`, `isinstance(obj, class_or_tuple, /)`, and `dict.get(key, default=None, /)` (in some CPython versions) all mark their first parameters positional-only, because implementations use internal C-level argument names that were never meant to be a stable, name-based API. `pow(base, exp, mod=None, /)` is a clear example visible in `help(pow)`.

```python
help(pow)
# pow(base, exp, mod=None, /)
#     Equivalent to base**exp with 2 arguments...
# Trying pow(base=2, exp=10) raises TypeError: pow() takes no keyword arguments
```

## Why Not Just Prefix With an Underscore?

A common instinct is to name the parameter `_amount` to signal "don't rely on this name," but that's only a convention — nothing stops a caller from writing `func(_amount=100.0)` anyway, and the underscore leaks into `help()` output and IDE autocomplete as an ugly, unexplained wart. Positional-only markers are enforced by the interpreter itself and don't require renaming anything:

```python
def calculate_tax(_amount: float, rate: float) -> float:  # convention only, not enforced
    return _amount * rate

calculate_tax(_amount=100.0, rate=0.08)  # still works — the underscore didn't prevent this
```

## See Also

- [`api-keyword-only-args`](api-keyword-only-args.md) - the complementary `*` marker for parameters that must be named
- [`api-explicit-exports`](api-explicit-exports.md) - deliberately curating what's part of the stable public contract
- [`doc-all-public-api`](doc-all-public-api.md) - documenting which parts of a signature are guaranteed stable

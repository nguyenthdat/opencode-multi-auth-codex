# name-dunder-name-mangling

> Use double leading underscores sparingly; understand Python's name-mangling behavior

## Why It Matters

A name like `__value` inside a class body is rewritten by the interpreter to `_ClassName__value`, a mechanism called name mangling that exists specifically to avoid attribute collisions in subclasses — not to make an attribute "extra private." Engineers who reach for `__name` expecting stronger privacy are often surprised when `dir()`, debuggers, or pickling show the mangled name, or when subclassing breaks in confusing ways. Overusing double underscores where a single underscore would do adds friction to debugging and introspection for no real access-control benefit.

## Bad

```python
class Cache:
    def __init__(self, maxsize: int) -> None:
        self.__maxsize = maxsize      # mangled to _Cache__maxsize
        self.__store = {}

    def __evict(self):                # mangled to _Cache__evict
        ...


class LRUCache(Cache):
    def __evict(self):
        # This does NOT override Cache.__evict - it creates a *separate*
        # method _LRUCache__evict due to mangling. Silent, confusing bug.
        ...
```

## Good

```python
class Cache:
    def __init__(self, maxsize: int) -> None:
        self._maxsize = maxsize       # single underscore: internal, overridable
        self._store = {}

    def _evict(self):
        ...


class LRUCache(Cache):
    def _evict(self):
        # Correctly overrides Cache._evict - single underscore has no mangling.
        ...
```

## When Name Mangling Is the Right Tool

Reserve `__name` for attributes you deliberately want to be collision-proof across a whole inheritance chain — typically internal bookkeeping in a base class meant to be subclassed by unrelated code, where you specifically don't want subclasses to accidentally shadow it:

```python
class Base:
    def __init__(self) -> None:
        self.__id = uuid.uuid4()  # deliberately isolated per-class storage

    def get_id(self):
        return self.__id


class Derived(Base):
    def __init__(self) -> None:
        super().__init__()
        self.__id = "something else"  # does NOT clobber Base's __id - separate slot
```

Dunder *methods* (`__init__`, `__repr__`, `__eq__`) are a different mechanism entirely — they are not mangled, they are Python's operator-overloading protocol, and using them is expected and idiomatic (see `api-dunder-methods`).

## See Also

- [`name-leading-underscore-private`](name-leading-underscore-private.md) - the common case; prefer this by default
- [`api-dunder-methods`](api-dunder-methods.md) - dunder *methods* are a different, unmangled protocol
- [`res-slots-memory`](res-slots-memory.md) - `__slots__` interacts with attribute naming and mangling

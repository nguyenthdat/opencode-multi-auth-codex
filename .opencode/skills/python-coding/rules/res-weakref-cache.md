# res-weakref-cache

> Use `weakref` to avoid reference cycles and unbounded cache growth

## Why It Matters

A cache or observer registry that holds strong references to the objects it tracks prevents those objects from ever being garbage collected, even after every other part of the program has stopped using them — a slow, silent memory leak. `weakref` lets you reference an object without extending its lifetime, so the cache entry disappears automatically once the real owner drops the object. This is the standard fix for parent/child back-references and for memoization caches keyed on live objects.

## Bad

```python
class Node:
    def __init__(self, name: str) -> None:
        self.name = name
        self.children: list["Node"] = []
        self.parent: "Node | None" = None

    def add_child(self, child: "Node") -> None:
        child.parent = self  # strong reference cycle: parent <-> child
        self.children.append(child)

# root and every descendant stay alive as long as ANY node is referenced,
# even parts of the tree the caller thought they discarded

_listeners: dict[int, list[object]] = {}

def register(event_id: int, handler: object) -> None:
    _listeners.setdefault(event_id, []).append(handler)
    # handler objects (often bound methods on view/controller instances)
    # are kept alive forever, leaking whole UI objects
```

## Good

```python
import weakref

class Node:
    def __init__(self, name: str) -> None:
        self.name = name
        self.children: list["Node"] = []
        self._parent: "weakref.ReferenceType[Node] | None" = None

    def add_child(self, child: "Node") -> None:
        child._parent = weakref.ref(self)  # no cycle: child doesn't keep parent alive
        self.children.append(child)

    @property
    def parent(self) -> "Node | None":
        return self._parent() if self._parent is not None else None

_listeners: "weakref.WeakValueDictionary[int, object]" = weakref.WeakValueDictionary()

def register(event_id: int, handler: object) -> None:
    _listeners[event_id] = handler  # entry vanishes once handler is collected
```

## `WeakKeyDictionary` and `WeakValueDictionary`

```python
import weakref

class ExpensiveResult:
    def __init__(self, data: bytes) -> None:
        self.data = data

_cache: "weakref.WeakKeyDictionary[object, ExpensiveResult]" = weakref.WeakKeyDictionary()

def compute_for(owner: object) -> ExpensiveResult:
    if owner not in _cache:
        _cache[owner] = ExpensiveResult(data=expensive_computation(owner))
    return _cache[owner]  # entry auto-removed when `owner` is garbage collected
```

Note that `weakref.ref()` requires the target class to support weak references — built-ins like `int`, `str`, and `tuple` don't, and a `__slots__`-based class needs `"__weakref__"` added to its slots.

## See Also

- [`res-gc-cycles`](res-gc-cycles.md) - why reference cycles are costly even when collectible
- [`res-slots-memory`](res-slots-memory.md) - adding `__weakref__` to a slotted class
- [`perf-lru-cache`](perf-lru-cache.md) - `functools.lru_cache` for value-based memoization instead

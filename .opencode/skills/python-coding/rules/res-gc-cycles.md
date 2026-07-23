# res-gc-cycles

> Understand reference cycles and the cyclic garbage collector's cost, break cycles deliberately

## Why It Matters

CPython primarily frees memory via reference counting: an object is deallocated the instant its refcount hits zero. Objects that reference each other in a cycle (parent → child → parent) never reach a refcount of zero on their own, so CPython falls back to a periodic generational cyclic collector to find and break these cycles. That collector is a stop-the-world scan that gets slower as the live object graph grows, and objects with `__del__` methods involved in cycles used to be entirely uncollectable pre-3.4 — even today, cycles delay collection and inflate peak memory between GC passes. Deliberately avoiding cycles (or using `weakref`) keeps memory reclamation prompt and keeps the collector's work small.

## Bad

```python
class Observer:
    def __init__(self, subject: "Subject") -> None:
        self.subject = subject  # strong ref down

class Subject:
    def __init__(self) -> None:
        self.observers: list[Observer] = []

    def attach(self, observer: Observer) -> None:
        self.observers.append(observer)  # strong ref up — subject <-> observer cycle

def build_scene() -> Subject:
    subject = Subject()
    subject.attach(Observer(subject))
    return subject
    # neither object's refcount can reach zero without the cyclic GC intervening
```

## Good

```python
import weakref

class Observer:
    def __init__(self, subject: "Subject") -> None:
        self.subject = subject  # observer -> subject is fine, it's a leaf reference

class Subject:
    def __init__(self) -> None:
        self._observers: list[weakref.ReferenceType[Observer]] = []

    def attach(self, observer: Observer) -> None:
        self._observers.append(weakref.ref(observer))  # no back-cycle

    def notify(self) -> None:
        for ref in self._observers:
            observer = ref()
            if observer is not None:
                observer.subject  # still reachable, no cycle involved
```

## Inspecting and Tuning the Collector

```python
import gc

gc.collect()          # force a full collection pass, useful before measuring memory
gc.get_stats()         # per-generation collection counts and timings
gc.get_referrers(obj)  # find what's keeping an unexpectedly-alive object rooted

# For latency-sensitive services, disabling the cyclic GC and calling
# gc.collect() at safe points (e.g. between request batches) avoids
# unpredictable pause times, provided cycles are otherwise kept rare:
gc.freeze()  # move long-lived objects out of the generations the collector scans
```

Reference cycles are not a memory leak per se — the cyclic GC does eventually reclaim them — but they defer reclamation, add scan overhead proportional to live-object count, and interact poorly with `__del__`-based cleanup. Prefer `weakref` for back-references and parent pointers whenever a genuine ownership cycle isn't required.

## See Also

- [`res-weakref-cache`](res-weakref-cache.md) - the primary tool for breaking parent/child cycles
- [`res-del-not-guaranteed`](res-del-not-guaranteed.md) - how cycles interact badly with `__del__`-based cleanup
- [`res-slots-memory`](res-slots-memory.md) - memory overhead considerations alongside cycle avoidance

# perf-avoid-global-lookup-hot-loop

> Bind hot-loop globals/attribute lookups to local variables

## Why It Matters

CPython resolves local variables through a fast array-indexed slot (`LOAD_FAST`), but module globals and attribute access go through dictionary lookups (`LOAD_GLOBAL`, `LOAD_ATTR`) every single time they're evaluated. Inside a loop that runs millions of times, re-resolving `self.data`, `math.sqrt`, or a module-level constant on every iteration adds real, measurable overhead. Binding the lookup to a local name once before the loop turns repeated dictionary lookups into cheap slot reads.

## Bad

```python
import math

class Vector3:
    def __init__(self, points: list[tuple[float, float, float]]) -> None:
        self.points = points

    def magnitudes(self) -> list[float]:
        result = []
        for x, y, z in self.points:  # self.points already bound once via iteration, fine
            # math.sqrt resolved via global+attribute lookup on every iteration
            result.append(math.sqrt(x * x + y * y + z * z))
        return result
```

## Good

```python
import math

class Vector3:
    def __init__(self, points: list[tuple[float, float, float]]) -> None:
        self.points = points

    def magnitudes(self) -> list[float]:
        sqrt = math.sqrt  # bind once: local slot lookup for the rest of the loop
        return [sqrt(x * x + y * y + z * z) for x, y, z in self.points]
```

## When It's Not Worth It

This micro-optimization only pays off in loops that run enough iterations for the lookup overhead to matter (tens of thousands or more) — typically numeric kernels, parsers, or serialization hot paths identified by profiling. Applying it everywhere makes ordinary code harder to read for no measurable benefit:

```python
def greet(name: str) -> str:
    # Not a hot loop; binding `str.upper` locally here would be pure noise.
    return f"Hello, {name.upper()}!"
```

If a loop is genuinely this hot, also consider whether the work belongs in NumPy, a C-accelerated library, or `functools.lru_cache` before micro-tuning attribute lookups — the algorithmic win is usually bigger than the lookup win.

```python
# Another common instance: binding a bound method to skip repeated attribute lookup
def flush_all(buffers: list[list[str]], sink: list[str]) -> None:
    append = sink.append  # bind once instead of resolving sink.append every iteration
    for buf in buffers:
        for line in buf:
            append(line)
```

## See Also

- [`perf-avoid-premature-optimization`](perf-avoid-premature-optimization.md) - profile first; this rule applies only to confirmed hot paths
- [`perf-numpy-vectorize`](perf-numpy-vectorize.md) - the bigger win for numeric hot loops
- [`perf-slots-attribute-access`](perf-slots-attribute-access.md) - reducing attribute-lookup cost structurally

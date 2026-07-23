# perf-numpy-vectorize

> Vectorize numeric work with NumPy instead of per-element Python loops

## Why It Matters

A Python `for` loop over numeric data pays the interpreter's per-iteration overhead (bytecode dispatch, boxing/unboxing of Python `float`/`int` objects) for every single element. NumPy's vectorized operations push the loop down into compiled C code operating on contiguous, typed memory, which is typically 10-100x faster and uses far less memory since values aren't wrapped in individual Python objects. For any numeric workload beyond a few hundred elements, vectorizing is the highest-leverage performance change available.

## Bad

```python
def normalize(values: list[float]) -> list[float]:
    total = sum(values)
    return [v / total for v in values]  # fine for small lists, but a Python-level loop

def euclidean_distances(points: list[tuple[float, float]], origin: tuple[float, float]) -> list[float]:
    distances = []
    for x, y in points:
        dx = x - origin[0]
        dy = y - origin[1]
        distances.append((dx * dx + dy * dy) ** 0.5)  # per-element Python math
    return distances
```

## Good

```python
import numpy as np

def normalize(values: np.ndarray) -> np.ndarray:
    return values / values.sum()  # vectorized division, no Python-level loop

def euclidean_distances(points: np.ndarray, origin: np.ndarray) -> np.ndarray:
    diffs = points - origin  # broadcasting: subtracts origin from every row
    return np.sqrt((diffs ** 2).sum(axis=1))
```

## Recognizing When to Reach for NumPy

The signal is a loop whose body is pure arithmetic over homogeneous numeric data — sums, differences, dot products, elementwise transforms, filtering by a numeric condition:

```python
# Elementwise threshold filter, vectorized instead of `[v for v in values if v > 0]`
positive_only = values[values > 0]

# Dot product instead of a manual sum-of-products loop
weighted_score = np.dot(weights, scores)
```

If the data isn't numeric, is small (a handful of elements where conversion overhead exceeds the win), or the operation isn't expressible as array algebra (arbitrary per-element branching, string processing), a plain Python loop or comprehension remains the right and more readable tool. Converting back and forth between Python lists and NumPy arrays repeatedly inside a hot loop can also erase the benefit — vectorize the whole pipeline, not just one step of it.

```python
# Anti-pattern: converting to/from arrays inside the loop defeats the purpose
def bad_running_total(values: list[float]) -> list[float]:
    totals = []
    running = np.array(0.0)  # array overhead paid on every single iteration
    for v in values:
        running = running + v
        totals.append(float(running))
    return totals

# Better: use np.cumsum on the whole array at once
def running_total(values: np.ndarray) -> np.ndarray:
    return np.cumsum(values)
```

## See Also

- [`perf-avoid-premature-optimization`](perf-avoid-premature-optimization.md) - confirm the numeric loop is the actual bottleneck first
- [`conc-cpu-bound-multiprocessing`](conc-cpu-bound-multiprocessing.md) - parallelizing CPU-bound work that can't be vectorized
- [`perf-comprehension-over-loop`](perf-comprehension-over-loop.md) - the right tool when the data isn't numeric/array-shaped

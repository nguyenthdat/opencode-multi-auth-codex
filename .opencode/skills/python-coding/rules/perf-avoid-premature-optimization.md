# perf-avoid-premature-optimization

> Profile before optimizing; don't guess where the bottleneck is

## Why It Matters

Intuition about performance is frequently wrong — the code that "looks slow" (a comprehension, a dict lookup) is rarely the actual bottleneck, while the real cost is often somewhere unglamorous like network I/O, an N+1 query, or JSON serialization. Optimizing without measuring wastes engineering time, adds complexity and bugs to code that didn't need it, and can even make things slower if the "optimization" fights the interpreter's actual hot paths. Profile first, then optimize the specific thing the profile points at.

## Bad

```python
# "This nested loop looks slow, let me rewrite it with a manual index cache"
def find_matches(haystack: list[str], needles: list[str]) -> list[str]:
    index = {}
    for i, h in enumerate(haystack):
        index[h] = i
    matches = []
    for n in needles:
        if n in index:
            matches.append(n)
    return matches
    # ...meanwhile the function is called once per request, and the actual
    # bottleneck is the unindexed database query two lines above the call site.
```

## Good

```python
import cProfile
import pstats

def find_matches(haystack: list[str], needles: list[str]) -> list[str]:
    haystack_set = set(haystack)  # simple, readable, correct
    return [n for n in needles if n in haystack_set]

# Measure before deciding anything needs to change:
profiler = cProfile.Profile()
profiler.enable()
run_the_actual_workload()
profiler.disable()
pstats.Stats(profiler).sort_stats("cumulative").print_stats(15)
```

## A Practical Workflow

1. Reproduce the slowness with a realistic workload, not a synthetic microbenchmark.
2. Profile with `cProfile`/`py-spy`/`scalene` to find where time is actually spent.
3. Fix the top one or two entries, not everything that looks suboptimal.
4. Re-profile to confirm the fix moved the needle, and add a regression benchmark if the path is important.

```python
# py-spy attaches to a running process without code changes — great for prod-like repros
# $ py-spy record -o profile.svg -- python app.py
```

Donald Knuth's often-quoted line applies directly here: "premature optimization is the root of all evil" — clarity and correctness should win by default, with targeted optimization reserved for paths a profiler has actually flagged.

## See Also

- [`perf-lru-cache`](perf-lru-cache.md) - a targeted fix once a function is confirmed hot
- [`perf-numpy-vectorize`](perf-numpy-vectorize.md) - a bigger structural win once numeric code is confirmed to be the bottleneck
- [`doc-inline-comments-why`](doc-inline-comments-why.md) - documenting why an optimization exists once you've made one

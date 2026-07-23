# coll-defaultdict-grouping

> Use `collections.defaultdict` for grouping items without manual key-existence checks

## Why It Matters

Grouping items by a key into lists (or sets, or counters) with a plain `dict` requires checking whether the key already exists before you can append to it — miss that check and you get a `KeyError` on the first item of every new group. `defaultdict` takes a zero-argument factory (`list`, `set`, `int`, or any callable) and calls it automatically the first time a missing key is accessed, eliminating the existence check entirely and making the grouping loop a single line.

## Bad

```python
def group_by_department(employees: list[Employee]) -> dict[str, list[Employee]]:
    groups = {}
    for emp in employees:
        if emp.department not in groups:
            groups[emp.department] = []
        groups[emp.department].append(emp)
    return groups
```

## Good

```python
from collections import defaultdict

def group_by_department(employees: list[Employee]) -> dict[str, list[Employee]]:
    groups: defaultdict[str, list[Employee]] = defaultdict(list)
    for emp in employees:
        groups[emp.department].append(emp)
    return groups
```

## Nested Grouping and Other Factories

`defaultdict` composes cleanly for multi-level grouping, and works with any zero-arg factory, not just `list`:

```python
from collections import defaultdict

# Group by (department, year) into a nested structure without any existence checks
by_dept_and_year: defaultdict[str, defaultdict[int, list[Employee]]] = defaultdict(
    lambda: defaultdict(list)
)
for emp in employees:
    by_dept_and_year[emp.department][emp.hire_year].append(emp)

# defaultdict(int) for accumulating sums instead of hand-rolled `.get(key, 0)`
totals: defaultdict[str, float] = defaultdict(int)
for sale in sales:
    totals[sale.region] += sale.amount
```

Convert to a plain `dict` before returning from a public API if you don't want callers to accidentally create new empty entries just by reading a missing key (`defaultdict.__getitem__` on a missing key inserts it) — `dict(groups)` freezes the current contents without the surprising auto-vivification behavior.

```python
def group_by_department(employees: list[Employee]) -> dict[str, list[Employee]]:
    groups: defaultdict[str, list[Employee]] = defaultdict(list)
    for emp in employees:
        groups[emp.department].append(emp)
    return dict(groups)  # return a plain dict so callers can't silently create empty groups
```

## See Also

- [`coll-counter-tally`](coll-counter-tally.md) - `defaultdict(int)` overlaps with what `Counter` gives you directly
- [`coll-dict-merge-pipe`](coll-dict-merge-pipe.md) - merging grouped dicts together afterward
- [`perf-comprehension-over-loop`](perf-comprehension-over-loop.md) - comprehensions as the alternative when grouping isn't needed

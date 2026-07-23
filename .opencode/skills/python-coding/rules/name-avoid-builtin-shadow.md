# name-avoid-builtin-shadow

> Don't shadow builtins (`list`, `type`, `id`, `dict`, `input`) with local names

## Why It Matters

Naming a variable `list`, `dict`, `type`, `id`, or `str` shadows the builtin for the rest of that scope, so any later code in the same function that expects the real builtin (`list(other_iterable)`, `id(obj)`) either breaks with a confusing `TypeError: 'list' object is not callable` or silently does the wrong thing. This is especially dangerous in long functions where the shadowing happens far above the line that fails, making the bug hard to trace back to its source. Linters (`ruff` rule `A001`/`A002`, `pylint` `redefined-builtin`) flag this exact pattern because it has bitten enough engineers to warrant automated enforcement.

## Bad

```python
def summarize(list, filter):        # shadows builtins `list` and `filter`
    id = list[0].id                 # shadows builtin `id` too
    type = "summary"                # shadows builtin `type`
    return {"type": type, "first_id": id}


def load_config(input):             # shadows builtin `input`
    dict = json.loads(input)        # now `dict()` is unusable below
    return dict


def process(data):
    list = [x for x in data if x > 0]   # local `list` now shadows the type
    return list(sorted(list))            # TypeError: 'list' object is not callable
```

## Good

```python
def summarize(items, predicate):
    item_id = items[0].id
    summary_type = "summary"
    return {"type": summary_type, "first_id": item_id}


def load_config(raw_config):
    config = json.loads(raw_config)
    return config


def process(data):
    positive_values = [x for x in data if x > 0]
    return sorted(positive_values)
```

## Detecting Existing Shadows

```python
import builtins

# Quick sanity check for accidental shadowing during development/review
assert not hasattr(builtins, "items")  # confirms `items` is a safe name
```

`ruff` catches this automatically with the `A` (flake8-builtins) rule family:

```toml
# pyproject.toml
[tool.ruff.lint]
select = ["A"]  # flake8-builtins: flag shadowed builtins
```

## Acceptable Exceptions

Some shadowing is idiomatic and low-risk because the scope is tiny and the builtin isn't needed nearby — e.g., a one-line lambda or comprehension using `id` as a loop variable inside a narrow generator. Even then, prefer a clearer name; the cost of avoiding the shadow is nearly always lower than the cost of the ambiguity.

## See Also

- [`name-snake-case-functions`](name-snake-case-functions.md) - general function/variable naming conventions
- [`name-plural-collections`](name-plural-collections.md) - naming collections without reaching for `list`/`dict` as identifiers
- [`lint-ruff-rule-selection`](lint-ruff-rule-selection.md) - enabling the `A` rule family to catch shadowing

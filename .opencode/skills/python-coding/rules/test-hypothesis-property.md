# test-hypothesis-property

> Use `hypothesis` for property-based testing to find edge cases automatically

## Why It Matters

Example-based tests only verify the specific inputs the author thought of, but bugs love to hide in inputs nobody thought to write down — empty strings, unicode edge cases, integer overflow boundaries, deeply nested structures. `hypothesis` generates hundreds of randomized inputs against an invariant you specify ("round-tripping through serialize/deserialize always returns the original value") and automatically shrinks any failing case down to the smallest reproducible example, saving hours of manual bisection. This catches classes of bugs — off-by-one errors, sign handling, encoding edge cases — that a fixed set of hand-picked examples systematically misses.

## Bad

```python
def test_serialize_roundtrip():
    # Only tests one hand-picked value; misses negative numbers, unicode,
    # empty containers, very large integers, etc.
    original = {"name": "Alice", "age": 30}
    assert deserialize(serialize(original)) == original
```

## Good

```python
from hypothesis import given, strategies as st


@given(
    st.fixed_dictionaries(
        {
            "name": st.text(min_size=0, max_size=100),
            "age": st.integers(min_value=0, max_value=150),
        }
    )
)
def test_serialize_roundtrip(payload):
    assert deserialize(serialize(payload)) == payload
```

## Testing Invariants, Not Just Examples

```python
from hypothesis import given, strategies as st


@given(st.lists(st.integers()))
def test_sorted_is_idempotent(values):
    once = sorted(values)
    twice = sorted(once)
    assert once == twice


@given(st.integers(), st.integers())
def test_add_is_commutative(a, b):
    assert add(a, b) == add(b, a)


@given(st.text())
def test_normalize_never_raises(raw_input):
    # Property: this function should handle any string input without crashing.
    normalize_username(raw_input)
```

## Combining with `pytest.mark.parametrize`

Use `hypothesis` for open-ended invariants and reserve `parametrize` for a handful of known, named edge cases (e.g., regression tests for a specific bug) — they complement rather than replace each other:

```python
import pytest
from hypothesis import given, strategies as st


@pytest.mark.parametrize("known_edge_case", ["", " ", "\x00", "a" * 10_000])
def test_normalize_known_edge_cases(known_edge_case):
    normalize_username(known_edge_case)


@given(st.text())
def test_normalize_never_raises_generated(raw_input):
    normalize_username(raw_input)
```

## See Also

- [`test-parametrize-cases`](test-parametrize-cases.md) - the complementary approach for known, named cases
- [`test-coverage-meaningful`](test-coverage-meaningful.md) - property tests improve behavioral coverage beyond line coverage
- [`err-fail-fast-validate`](err-fail-fast-validate.md) - properties often encode the validation invariants you're asserting

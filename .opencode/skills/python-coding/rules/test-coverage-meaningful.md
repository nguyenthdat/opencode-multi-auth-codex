# test-coverage-meaningful

> Target meaningful coverage of behavior and edge cases, not 100% coverage as a vanity metric

## Why It Matters

Line coverage measures whether a line executed, not whether its behavior was actually verified — a test can call a function, hit every branch, and assert nothing meaningful, producing 100% coverage with zero confidence. Chasing 100% as a target incentivizes exactly this: engineers write hollow tests to satisfy a CI gate instead of tests that would catch a real regression, and genuinely risky code (a rare error path, a boundary condition) can still be undertested even at 100% line coverage if the assertions are weak. Coverage is a useful signal for finding *untested* code, but it should never be treated as proof of *correctness*.

## Bad

```python
def calculate_shipping(weight_kg: float, distance_km: float) -> float:
    if weight_kg <= 0:
        raise ValueError("weight must be positive")
    if distance_km > 10_000:
        return weight_kg * 0.5  # long-haul rate
    return weight_kg * distance_km * 0.01


def test_calculate_shipping():
    # Hits every line - 100% coverage - but asserts nothing about correctness
    # of the long-haul branch or the error path.
    result = calculate_shipping(5.0, 100.0)
    assert result is not None
```

## Good

```python
import pytest


def test_calculate_shipping_standard_rate():
    assert calculate_shipping(weight_kg=5.0, distance_km=100.0) == pytest.approx(5.0)


def test_calculate_shipping_long_haul_rate():
    assert calculate_shipping(weight_kg=5.0, distance_km=15_000) == pytest.approx(2.5)


def test_calculate_shipping_boundary_at_10000km():
    # Exercise the exact boundary between standard and long-haul pricing.
    just_under = calculate_shipping(weight_kg=5.0, distance_km=10_000)
    just_over = calculate_shipping(weight_kg=5.0, distance_km=10_001)
    assert just_under != just_over


def test_calculate_shipping_rejects_non_positive_weight():
    with pytest.raises(ValueError, match="weight must be positive"):
        calculate_shipping(weight_kg=0, distance_km=100.0)
```

## Using Coverage Reports Correctly

Use `pytest-cov` to *find gaps*, not as a pass/fail gate on its own:

```bash
pytest --cov=myapp --cov-report=term-missing
```

```
Name                 Stmts   Miss  Cover   Missing
--------------------------------------------------
myapp/shipping.py       12      2    83%   9-10
```

The `Missing` column tells you exactly which lines have never run — usually an error path or an edge case — which is the actionable part. Treat that as a todo list for missing *tests*, not a number to inflate.

## A Better Target

Prioritize covering: error/exception paths, boundary values, and business-critical branches. Accept that some code (thin wrappers, `__repr__`, defensive `assert`s that should never trigger) may reasonably stay untested.

## See Also

- [`test-hypothesis-property`](test-hypothesis-property.md) - finding edge cases coverage metrics alone won't reveal
- [`test-parametrize-cases`](test-parametrize-cases.md) - systematically covering boundary and edge-case inputs
- [`err-fail-fast-validate`](err-fail-fast-validate.md) - the validation/error paths most worth testing deliberately

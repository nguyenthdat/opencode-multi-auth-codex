# test-fixture-scope

> Choose fixture scope (`function`, `class`, `module`, `session`) deliberately based on cost and isolation needs

## Why It Matters

The default `function` scope re-runs a fixture for every test, which is correct for cheap, mutable state but wastes significant time when a fixture does something expensive like spinning up a database container or loading a large model. Widening scope to `module` or `session` trades isolation for speed — but if the fixture's state is mutable and tests forget that they share it, one test's side effects leak into another, producing order-dependent failures that are painful to debug. Picking scope deliberately (not just defaulting to `session` for speed) means explicitly deciding which fixtures are safe to share and which must stay isolated.

## Bad

```python
import pytest


@pytest.fixture(scope="session")            # shared across the whole test run
def shopping_cart():
    return ShoppingCart()                    # mutable, shared, never reset


def test_add_item(shopping_cart):
    shopping_cart.add(Item("A", 10.0))
    assert len(shopping_cart.items) == 1


def test_cart_starts_empty(shopping_cart):
    # Fails or passes depending on test execution order - leaked mutable state
    assert len(shopping_cart.items) == 0
```

## Good

```python
import pytest


@pytest.fixture(scope="session")
def db_engine():
    # Expensive, immutable-enough to share: connection setup, not test data.
    engine = create_engine("postgresql:///test_db")
    yield engine
    engine.dispose()


@pytest.fixture
def db_session(db_engine):
    # Function-scoped: fresh transaction per test, rolled back after.
    connection = db_engine.connect()
    transaction = connection.begin()
    session = Session(bind=connection)
    yield session
    session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture
def shopping_cart():
    return ShoppingCart()  # function-scoped: fresh, mutable, isolated


def test_add_item(shopping_cart):
    shopping_cart.add(Item("A", 10.0))
    assert len(shopping_cart.items) == 1


def test_cart_starts_empty(shopping_cart):
    assert len(shopping_cart.items) == 0  # always true now
```

## Scope Selection Guide

| Scope | Use for | Risk |
|---|---|---|
| `function` (default) | Mutable state, cheap setup | None — safest default |
| `class` | State shared across a test class only | Moderate — class must own the state intentionally |
| `module` | Expensive, read-only resources reused by one file | Leakage if any test mutates it |
| `session` | Very expensive, truly immutable resources (DB engine, compiled config) | High — never mutate a session-scoped fixture's value |

## See Also

- [`test-fixtures-setup`](test-fixtures-setup.md) - the base fixture mechanics this rule refines
- [`test-tmp-path-fixture`](test-tmp-path-fixture.md) - `tmp_path` is intentionally function-scoped for isolation
- [`conc-thread-safety-shared-state`](conc-thread-safety-shared-state.md) - similar reasoning applies to shared state under parallel test execution

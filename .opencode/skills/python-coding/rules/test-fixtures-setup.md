# test-fixtures-setup

> Use pytest fixtures for setup/teardown instead of shared mutable module state

## Why It Matters

Module-level mutable state shared across tests creates hidden coupling: one test's leftover mutation can silently change the outcome of a test that runs after it, and the failure only reproduces when tests run in a specific order. Fixtures give each test a fresh, isolated instance by default (function scope) and handle teardown deterministically via `yield`, even when the test itself raises. This isolation is what makes `pytest -p no:randomly` or parallel test execution (`pytest-xdist`) safe — shared global state usually is not.

## Bad

```python
# module-level shared state - tests can pollute each other
_db_connection = create_connection()
_seeded_users = []


def test_create_user():
    user = _db_connection.create_user("alice@example.com")
    _seeded_users.append(user)          # leaks into other tests
    assert user.email == "alice@example.com"


def test_user_count():
    # Passes or fails depending on whether test_create_user ran first
    assert len(_seeded_users) == 0
```

## Good

```python
import pytest


@pytest.fixture
def db_connection():
    conn = create_connection()
    yield conn
    conn.close()                        # guaranteed teardown, even on failure


@pytest.fixture
def seeded_user(db_connection):
    return db_connection.create_user("alice@example.com")


def test_create_user(seeded_user):
    assert seeded_user.email == "alice@example.com"


def test_user_count(db_connection):
    assert db_connection.user_count() == 0   # fresh connection, no leakage
```

## Composing Fixtures

Fixtures can depend on other fixtures, building up complex setup declaratively instead of imperative `setUp` chains:

```python
@pytest.fixture
def app_config():
    return AppConfig(debug=True, database_url="sqlite:///:memory:")


@pytest.fixture
def app(app_config):
    application = create_app(app_config)
    yield application
    application.shutdown()


@pytest.fixture
def client(app):
    return app.test_client()


def test_health_endpoint_returns_ok(client):
    response = client.get("/health")
    assert response.status_code == 200
```

## Autouse for Cross-Cutting Concerns

```python
@pytest.fixture(autouse=True)
def reset_metrics_registry():
    yield
    metrics_registry.clear()  # runs after every test in scope, no opt-in needed
```

## See Also

- [`test-fixture-scope`](test-fixture-scope.md) - choosing `function`/`module`/`session` scope deliberately
- [`test-tmp-path-fixture`](test-tmp-path-fixture.md) - a built-in fixture for filesystem isolation
- [`test-monkeypatch-over-mock-patch`](test-monkeypatch-over-mock-patch.md) - another fixture-based isolation tool

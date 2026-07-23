# test-mock-boundaries

> Mock at external boundaries (network, filesystem, clock), not internal implementation details

## Why It Matters

Mocking your own internal functions couples the test to *how* the code is implemented rather than *what* it does, so an internal refactor that preserves behavior still breaks tests that were never supposed to care about implementation. Mocking only at true external boundaries — the HTTP client, the database driver, `datetime.now()`, the filesystem — keeps tests resilient to refactors while still eliminating real network calls, flaky timing, and slow I/O. Over-mocked tests also give false confidence: they pass even when the real integration between your own functions is broken, because every internal seam was stubbed out.

## Bad

```python
def test_process_order(mocker):
    # Mocking internal collaborators - test breaks on any internal refactor,
    # even if the real behavior of process_order is unchanged.
    mocker.patch("orders.service._validate_items")
    mocker.patch("orders.service._calculate_tax", return_value=5.0)
    mocker.patch("orders.service._apply_discount", return_value=95.0)

    result = process_order(order)

    assert result.total == 95.0  # only verifies the mocks return what we told them
```

## Good

```python
def test_process_order_charges_customer(mocker):
    # Mock only the true external boundary: the payment gateway HTTP client.
    mock_gateway = mocker.patch("orders.service.payment_gateway")
    mock_gateway.charge.return_value = ChargeResult(success=True, amount=95.0)

    order = Order(items=[Item(price=100.0, qty=1)], discount_rate=0.05)
    result = process_order(order)  # internal _validate/_calculate/_apply run for real

    assert result.total == 95.0
    mock_gateway.charge.assert_called_once_with(amount=95.0, currency="USD")
```

## Common External Boundaries Worth Mocking

```python
# Network calls
mocker.patch("httpx.Client.get", return_value=fake_response)

# Filesystem
mocker.patch("pathlib.Path.exists", return_value=True)

# Wall-clock time (prefer dependency injection over patching datetime directly)
def test_token_expires_after_ttl(monkeypatch):
    fixed_now = datetime(2026, 1, 1, tzinfo=timezone.utc)
    monkeypatch.setattr("auth.clock.now", lambda: fixed_now)
    token = issue_token(ttl_seconds=60)
    assert token.expires_at == fixed_now + timedelta(seconds=60)

# External processes
mocker.patch("subprocess.run", return_value=CompletedProcess(args=[], returncode=0))
```

## A Rule of Thumb

If the thing you're mocking lives in your own codebase and contains business logic, prefer running it for real and mocking only what it calls out to. If it's a network socket, a clock, a random source, or a third-party SDK, mock it.

## See Also

- [`test-arrange-act-assert`](test-arrange-act-assert.md) - structuring tests so the mocked boundary is clear in "arrange"
- [`test-monkeypatch-over-mock-patch`](test-monkeypatch-over-mock-patch.md) - the pytest-native alternative to `unittest.mock.patch`
- [`async-avoid-sync-in-async`](async-avoid-sync-in-async.md) - boundaries matter doubly for async I/O mocking

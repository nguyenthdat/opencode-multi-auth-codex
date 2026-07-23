# test-monkeypatch-over-mock-patch

> Prefer the `monkeypatch` fixture over manual `unittest.mock.patch` context managers in pytest

## Why It Matters

`unittest.mock.patch` as a decorator or context manager requires you to manage nesting and cleanup yourself, and stacking several patches produces deeply indented decorator chains or context managers that are awkward to read. pytest's `monkeypatch` fixture integrates with the test's teardown automatically — every patched attribute, environment variable, or `sys.path` entry is reverted after the test regardless of whether it passed or failed — and it composes cleanly with other fixtures since it's just another fixture argument. It also has convenience methods (`setenv`, `delenv`, `chdir`, `syspath_prepend`) that `mock.patch` doesn't provide at all.

## Bad

```python
from unittest import mock


def test_uses_configured_api_key():
    with mock.patch.dict("os.environ", {"API_KEY": "test-key"}):
        with mock.patch("myapp.client.requests.get") as mock_get:
            mock_get.return_value.json.return_value = {"status": "ok"}
            result = call_external_api()
            assert result["status"] == "ok"
    # Deep nesting grows further with each additional patch needed.
```

## Good

```python
def test_uses_configured_api_key(monkeypatch):
    monkeypatch.setenv("API_KEY", "test-key")

    def fake_get(*args, **kwargs):
        return FakeResponse(json_data={"status": "ok"})

    monkeypatch.setattr("myapp.client.requests.get", fake_get)

    result = call_external_api()

    assert result["status"] == "ok"
    # Environment variable and patched attribute both revert automatically.
```

## Common `monkeypatch` Operations

```python
def test_reads_config_path_from_env(monkeypatch, tmp_path):
    config_file = tmp_path / "config.toml"
    config_file.write_text('[app]\nname = "demo"\n')

    monkeypatch.setenv("APP_CONFIG_PATH", str(config_file))
    monkeypatch.chdir(tmp_path)

    settings = load_settings()
    assert settings.app_name == "demo"


def test_disables_feature_flag(monkeypatch):
    monkeypatch.setattr("myapp.features.FLAGS", {"new_ui": False})
    assert not is_feature_enabled("new_ui")


def test_missing_optional_dependency(monkeypatch):
    monkeypatch.delitem(sys.modules, "optional_lib", raising=False)
```

## When `mock.patch` Still Makes Sense

`mock.patch` remains the better tool when you need `MagicMock`'s call-tracking assertions (`assert_called_once_with`, `call_count`) rather than a real substitute function — `pytest-mock`'s `mocker` fixture gives you that same `Mock`/`MagicMock` power with `monkeypatch`-style automatic cleanup, combining both benefits.

```python
def test_sends_notification(mocker):
    mock_send = mocker.patch("notifications.client.send")
    notify_user(user_id=1, message="hello")
    mock_send.assert_called_once_with(user_id=1, message="hello")
```

## See Also

- [`test-mock-boundaries`](test-mock-boundaries.md) - deciding what to mock, independent of which tool you use
- [`test-fixtures-setup`](test-fixtures-setup.md) - `monkeypatch` is itself a built-in pytest fixture
- [`test-tmp-path-fixture`](test-tmp-path-fixture.md) - often paired with `monkeypatch.chdir`/`setenv` for filesystem tests

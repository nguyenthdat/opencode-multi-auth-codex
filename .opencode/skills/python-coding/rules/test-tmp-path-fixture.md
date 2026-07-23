# test-tmp-path-fixture

> Use the `tmp_path`/`tmp_path_factory` fixtures instead of hardcoded temp paths

## Why It Matters

Hardcoded paths like `/tmp/test_output.csv` collide across parallel test runs (`pytest-xdist`), leak files between test runs if cleanup is skipped on failure, and behave differently across operating systems (Windows has no `/tmp`). pytest's `tmp_path` fixture gives each test function its own uniquely-named, automatically-cleaned-up directory as a `pathlib.Path`, so tests are hermetic by construction and portable across platforms without any manual `os.remove` or `shutil.rmtree` bookkeeping. It also plays well with pytest's built-in retention policy, keeping only the last few runs' temp directories for post-mortem debugging.

## Bad

```python
import os


def test_writes_export_file():
    path = "/tmp/export_test.csv"          # collides across parallel runs
    export_report(path)
    assert os.path.exists(path)
    os.remove(path)                        # skipped entirely if assert fails above
```

## Good

```python
def test_writes_export_file(tmp_path):
    path = tmp_path / "export_test.csv"
    export_report(path)
    assert path.exists()
    # No manual cleanup - pytest removes tmp_path automatically.
```

## Building Directory Structures

```python
def test_loads_config_from_nested_directory(tmp_path):
    config_dir = tmp_path / "config" / "env"
    config_dir.mkdir(parents=True)
    config_file = config_dir / "settings.toml"
    config_file.write_text('[app]\nname = "demo"\n')

    settings = load_settings(config_dir)

    assert settings.app_name == "demo"
```

## Sharing a Temp Directory Across Tests with `tmp_path_factory`

`tmp_path` is function-scoped by design; for a shared, session-scoped temp directory (e.g., an expensive fixture download), use `tmp_path_factory` instead:

```python
import pytest


@pytest.fixture(scope="session")
def shared_dataset(tmp_path_factory):
    data_dir = tmp_path_factory.mktemp("dataset")
    download_test_dataset(into=data_dir)
    return data_dir


def test_dataset_has_expected_files(shared_dataset):
    assert (shared_dataset / "labels.csv").exists()
```

## See Also

- [`test-fixture-scope`](test-fixture-scope.md) - deciding whether temp resources should be function- or session-scoped
- [`res-file-handles-close`](res-file-handles-close.md) - proper file handling patterns these fixtures encourage
- [`res-streaming-large-files`](res-streaming-large-files.md) - testing file-streaming code against `tmp_path` fixtures

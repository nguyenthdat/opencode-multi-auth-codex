# api-classmethod-factory

> Use `@classmethod` for alternative constructors instead of overloaded `__init__`

## Why It Matters

`__init__` can only have one signature, so a class with several meaningfully different ways to be constructed — from a file, from a dict, from a network response — either has to cram all those cases behind a pile of optional parameters and `if` branches, or give up and force every caller through one generic-but-confusing constructor. `@classmethod` factories let each construction path have its own descriptive name and its own precise signature, while keeping `__init__` itself simple and focused on just assigning already-validated fields.

## Bad

```python
class Config:
    def __init__(
        self,
        data: dict | None = None,
        path: str | None = None,
        env_prefix: str | None = None,
    ) -> None:
        if path is not None:
            with open(path) as f:
                data = json.load(f)
        elif env_prefix is not None:
            data = {k[len(env_prefix):]: v for k, v in os.environ.items() if k.startswith(env_prefix)}
        elif data is None:
            raise ValueError("must supply one of data, path, or env_prefix")
        self.data = data

# Callers must know which combination of mutually exclusive kwargs to pass
cfg = Config(path="settings.json")
```

## Good

```python
class Config:
    def __init__(self, data: dict[str, str]) -> None:
        self.data = data

    @classmethod
    def from_file(cls, path: str) -> "Config":
        with open(path) as f:
            return cls(json.load(f))

    @classmethod
    def from_env(cls, prefix: str) -> "Config":
        data = {k[len(prefix):]: v for k, v in os.environ.items() if k.startswith(prefix)}
        return cls(data)

    @classmethod
    def from_dict(cls, data: dict[str, str]) -> "Config":
        return cls(dict(data))

cfg = Config.from_file("settings.json")   # self-documenting call site
cfg2 = Config.from_env("APP_")
```

## Real-World Example: `datetime`

`datetime.datetime` is a canonical standard-library example: rather than one constructor with a dozen optional parameters, it exposes `datetime.now()`, `datetime.fromtimestamp()`, `datetime.fromisoformat()`, and `datetime.strptime()` as separate classmethod-style factories, each with a signature suited to its input. `dict.fromkeys()` and `pathlib.Path.cwd()` follow the same convention.

```python
from datetime import datetime

now = datetime.now()
parsed = datetime.fromisoformat("2026-07-20T10:00:00")
from_epoch = datetime.fromtimestamp(1_700_000_000)
```

Because `@classmethod` receives `cls` rather than a hardcoded class name, these factories are also inherited correctly by subclasses — `cls(...)` in `from_file` constructs the subclass, not always `Config`.

## See Also

- [`api-dataclass-value-object`](api-dataclass-value-object.md) - value objects that these factories often construct
- [`api-composition-inheritance`](api-composition-inheritance.md) - factories as a way to keep `__init__` minimal
- [`err-fail-fast-validate`](err-fail-fast-validate.md) - validating input inside a factory before calling `cls(...)`

# err-raise-from

> Use `raise NewError(...) from original` to preserve the causal exception chain

## Why It Matters

When you catch a low-level exception and raise a higher-level one in its place, Python already links them implicitly via `__context__` — but that implicit link is displayed as "During handling of the above exception, another exception occurred," which reads as if the second exception was an unrelated accident rather than a deliberate translation. `raise ... from exc` makes the causal relationship explicit (`__cause__`), producing a clearer traceback and letting tools/tests distinguish "I meant to wrap this" from "an unrelated bug happened while handling the first error."

## Bad

```python
def load_config(path: str) -> dict:
    try:
        with open(path) as f:
            return json.load(f)
    except FileNotFoundError:
        raise ConfigError(f"config file missing: {path}")
        # implicit chaining still shows the FileNotFoundError, but as if
        # it were an unrelated, unintended second failure
```

```
FileNotFoundError: [Errno 2] No such file or directory: 'app.json'

During handling of the above exception, another exception occurred:

ConfigError: config file missing: app.json
```

## Good

```python
def load_config(path: str) -> dict:
    try:
        with open(path) as f:
            return json.load(f)
    except FileNotFoundError as exc:
        raise ConfigError(f"config file missing: {path}") from exc
```

```
FileNotFoundError: [Errno 2] No such file or directory: 'app.json'

The above exception was the direct cause of the following exception:

ConfigError: config file missing: app.json
```

## Suppressing the Chain Entirely

```python
def parse_id(raw: str) -> int:
    try:
        return int(raw)
    except ValueError:
        # Explicitly hide the low-level cause because it adds no useful
        # detail to a user-facing validation error.
        raise ValueError(f"'{raw}' is not a valid id") from None
```

Use `from exc` whenever the new exception is a deliberate translation/wrapping of a lower-level failure (I/O errors into domain errors, parse errors into validation errors) — this is the common case and should be the default. Use `from None` only when the original traceback is pure noise for the reader (e.g., re-raising the same conceptual error with better wording). Never omit both and let implicit chaining stand in for an intentional wrap — it misleads whoever reads the traceback later.

## See Also

- [`err-custom-hierarchy`](err-custom-hierarchy.md) - the wrapping pattern this rule supports
- [`err-reraise-preserve`](err-reraise-preserve.md) - re-raising the *same* exception without wrapping
- [`err-custom-attributes`](err-custom-attributes.md) - attaching the original error's data alongside the chain

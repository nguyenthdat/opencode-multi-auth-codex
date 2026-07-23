# doc-type-hints-not-docstring-types

> Let type hints carry type information; use docstrings for meaning and behavior, not types

## Why It Matters

When a docstring restates the type of a parameter that's already annotated (`price (float): the price`), that information now lives in two places, and the two inevitably drift apart the first time someone changes the signature but forgets to update the prose. Type checkers (`mypy`, `pyright`) verify annotations at every call site, but nothing verifies that a docstring's claimed type still matches — so a stale docstring type is actively misleading, worse than no type note at all. The docstring's job is to explain what a value *means* and any constraints a type alone can't express (units, valid ranges, side effects), while the signature's job is to say what type it *is*.

## Bad

```python
def schedule_reminder(user_id: int, remind_at: datetime, message: str) -> str:
    """Schedule a reminder for a user.

    Args:
        user_id (int): the user's id
        remind_at (datetime): when to send the reminder
        message (str): the message text

    Returns:
        str: the reminder id
    """
    ...
```

The `(int)`, `(datetime)`, `(str)` annotations in the docstring are pure duplication of the signature and will silently rot if the signature changes.

## Good

```python
def schedule_reminder(user_id: int, remind_at: datetime, message: str) -> str:
    """Schedule a reminder for a user.

    Args:
        user_id: Must correspond to an existing, active account.
        remind_at: Must be timezone-aware and in the future; naive
            datetimes are rejected with a ValueError.
        message: Rendered as-is; not sanitized for HTML.

    Returns:
        A reminder id that can be passed to `cancel_reminder`.
    """
    ...
```

Note what changed: the docstring now says what a caller *couldn't* infer from the type alone — that `remind_at` must be timezone-aware and future, and that `message` isn't sanitized.

## Reserve Docstring Type Notes for Constraints a Type Can't Express

```python
def resize_image(data: bytes, max_dimension: int) -> bytes:
    """Resize image bytes so neither dimension exceeds max_dimension.

    Args:
        data: Raw image bytes; must be a valid PNG or JPEG.
        max_dimension: Positive pixel count; values above 8192 are
            clamped for memory-safety reasons.

    Returns:
        Re-encoded PNG bytes, always smaller than or equal to the input.
    """
    ...
```

`bytes` and `int` are already in the signature — what's worth documenting is the *format constraint* (`PNG or JPEG`) and the *clamping behavior*, neither of which a type hint alone conveys.

## See Also

- [`doc-google-numpy-style`](doc-google-numpy-style.md) - the section structure these notes fit into
- [`type-avoid-any`](type-avoid-any.md) - precise types reduce the need for type-explaining prose in the first place
- [`doc-raises-section`](doc-raises-section.md) - another category of behavior a signature alone can't fully convey

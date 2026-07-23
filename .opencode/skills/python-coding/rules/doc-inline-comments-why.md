# doc-inline-comments-why

> Use inline comments to explain "why", not to restate "what" the code already shows

## Why It Matters

A comment that restates what the next line does (`# increment counter` above `counter += 1`) adds reading overhead without adding information, and worse, it rots the moment the code changes since nothing forces the comment to update alongside it. A comment that explains *why* — a non-obvious business rule, a workaround for a library bug, a performance trade-off — captures information that the code itself cannot express, and that's exactly the information a future maintainer (including the original author, six months later) actually needs before they dare change the line. Reviewers should treat "what" comments as a signal the code isn't clear enough to stand on its own, and push for clearer naming instead.

## Bad

```python
# Loop through all users
for user in users:
    # Check if user is active
    if user.is_active:
        # Add user to the list
        active_users.append(user)

# Set timeout to 30
timeout = 30

# Retry up to 3 times
for attempt in range(3):
    try:
        response = client.get(url, timeout=timeout)
        break
    except TimeoutError:
        continue
```

## Good

```python
active_users = [user for user in users if user.is_active]

# Payment provider's SLA guarantees a response within 30s; anything
# longer indicates their outage, not a transient blip on our end.
timeout = 30

# Three attempts matches the provider's documented retry guidance;
# more than that risks tripping their rate limiter (see INC-4821).
for attempt in range(3):
    try:
        response = client.get(url, timeout=timeout)
        break
    except TimeoutError:
        continue
```

## Comments That Justify Themselves

```python
# Sorting by (-priority, created_at) puts high-priority items first while
# preserving FIFO order within the same priority level.
tasks.sort(key=lambda t: (-t.priority, t.created_at))

# Using a set here instead of a list: `blocked_ids` can grow to ~100k entries
# and this lookup runs per-request, so O(1) membership matters (see perf-set-membership).
if user.id in blocked_ids:
    return Forbidden()

# unittest.mock's autospec can't see this dynamically-added attribute,
# so we patch it manually - remove once upstream issue #4821 is fixed.
mock_client.extra_headers = {}
```

## A Quick Test

Before writing a comment, ask: "could I make this unnecessary by renaming a variable or extracting a function instead?" If yes, do that. If the information is about *intent*, *history*, or a *constraint from outside this file*, write the comment.

## See Also

- [`doc-raises-section`](doc-raises-section.md) - documenting exception behavior formally instead of via inline comment
- [`name-boolean-is-has`](name-boolean-is-has.md) - clear naming that removes the need for "what" comments
- [`anti-premature-abstraction`](anti-premature-abstraction.md) - over-commented code is often a symptom of unclear structure

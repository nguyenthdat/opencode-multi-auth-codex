# coll-frozenset-immutable-set

> Use `frozenset` for immutable, hashable set-like data (e.g. dict keys, cache keys)

## Why It Matters

A regular `set` is mutable and therefore unhashable — you cannot use one as a dict key, put it inside another set, or use it as a `frozenset`-like cache key, because Python's hashing model requires that a hashable object's hash never changes over its lifetime, which mutability makes impossible to guarantee. `frozenset` provides the exact same O(1) membership testing and set algebra (`|`, `&`, `-`, `^`) as `set`, but is immutable and hashable, so it can go anywhere an immutable value is required.

## Bad

```python
def permission_sets_by_role(roles: dict[str, list[str]]) -> dict[frozenset, str]:
    lookup = {}
    for role, perms in roles.items():
        key = set(perms)  # TypeError: unhashable type 'set' when used as a dict key below
        lookup[key] = role
    return lookup

CACHE: dict[set, Result] = {}  # also invalid — sets can't be dict keys at all
```

## Good

```python
def permission_sets_by_role(roles: dict[str, list[str]]) -> dict[frozenset[str], str]:
    return {frozenset(perms): role for role, perms in roles.items()}

CACHE: dict[frozenset[str], Result] = {}

def get_or_compute(tags: set[str]) -> Result:
    key = frozenset(tags)  # convert the mutable working set to an immutable key
    if key not in CACHE:
        CACHE[key] = expensive_computation(tags)
    return CACHE[key]
```

## Set Algebra Still Works

```python
ADMIN_PERMS = frozenset({"read", "write", "delete"})
GUEST_PERMS = frozenset({"read"})

shared = ADMIN_PERMS & GUEST_PERMS       # frozenset({"read"})
combined = ADMIN_PERMS | GUEST_PERMS     # frozenset({"read", "write", "delete"})
admin_only = ADMIN_PERMS - GUEST_PERMS   # frozenset({"write", "delete"})

# Class-level constants benefit from being frozensets: can't be accidentally mutated
class Role:
    VALID_STATUSES: frozenset[str] = frozenset({"active", "suspended", "deleted"})
```

Use a plain `set` for a working collection you intend to keep mutating (adding/removing members over its lifetime); switch to `frozenset` once the collection is "finalized" and needs to be shared, hashed, or stored as a constant.

```python
# frozenset is also useful as a de-duplicated, order-independent function argument
def has_permission(user_perms: frozenset[str], required: frozenset[str]) -> bool:
    return required.issubset(user_perms)
```

## See Also

- [`perf-set-membership`](perf-set-membership.md) - the O(1) lookup benefit shared by both `set` and `frozenset`
- [`data-frozen-immutable`](data-frozen-immutable.md) - the broader immutability pattern this rule is one instance of
- [`coll-dict-merge-pipe`](coll-dict-merge-pipe.md) - the analogous `|` operator for dicts

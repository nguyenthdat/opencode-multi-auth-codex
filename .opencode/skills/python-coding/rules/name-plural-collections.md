# name-plural-collections

> Name variables holding collections with plural nouns (`users`, not `user_list`)

## Why It Matters

A plural name like `users` tells the reader "this is a collection, iterate over it" without needing a type suffix, and it reads naturally in a `for user in users:` loop. Suffixing with the container type (`user_list`, `order_dict`) instead couples the name to an implementation detail that changes the moment you swap a `list` for a `tuple`, `set`, or generator — forcing an unnecessary rename or leaving a misleading name behind. This convention is pervasive in the standard library (`sys.path`, `os.environ.items()`, `dict.keys()`) and idiomatic Python style guides (Google, PEP 8 community norms).

## Bad

```python
user_list = fetch_users()
order_dict = {}
for user in user_list:
    order_dict[user.id] = user.orders

# Six months later the list becomes a generator for memory reasons,
# and "user_list" is now a lie about the underlying type.
user_list = (u for u in fetch_users_lazily())
```

## Good

```python
users = fetch_users()
orders_by_user_id = {}
for user in users:
    orders_by_user_id[user.id] = user.orders

# Swapping the implementation doesn't force a rename:
users = (u for u in fetch_users_lazily())
```

## Mappings: Name by What They Map

For dictionaries, a plain plural is ambiguous about keys vs. values, so prefer a `<value>_by_<key>` or `<value>_to_<key>` pattern instead of a generic type suffix:

```python
# Ambiguous: is `users` here a list or a dict keyed by something?
users = {u.id: u for u in fetch_users()}  # avoid - looks like a list

# Clear: name states the mapping shape
users_by_id = {u.id: u for u in fetch_users()}
permissions_by_role = defaultdict(set)
```

## Singular Loop Variables

Pair the plural collection name with the natural singular for its loop variable — this alone documents the iteration without a comment:

```python
active_sessions = [s for s in sessions if s.is_active]

for session in active_sessions:
    session.refresh()
```

## See Also

- [`name-snake-case-functions`](name-snake-case-functions.md) - casing rules that apply to collection names too
- [`coll-defaultdict-grouping`](coll-defaultdict-grouping.md) - building `_by_<key>` mappings idiomatically
- [`coll-comprehension-readability`](coll-comprehension-readability.md) - naming inside comprehensions

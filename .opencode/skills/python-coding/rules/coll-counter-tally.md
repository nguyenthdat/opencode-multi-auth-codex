# coll-counter-tally

> Use `collections.Counter` for tallying/frequency counting

## Why It Matters

Hand-rolled tallying with a plain `dict` requires an explicit "have I seen this key before?" check (`dict.get(key, 0) + 1` or an `if key in counts` branch) on every update, which is easy to get subtly wrong and more verbose than the problem warrants. `Counter` is a `dict` subclass purpose-built for this: missing keys default to `0`, and it ships with `most_common()`, arithmetic operators (`+`, `-`, `&`, `|`) for combining tallies, and a constructor that counts an iterable directly.

## Bad

```python
def word_frequencies(words: list[str]) -> dict[str, int]:
    counts = {}
    for word in words:
        if word in counts:
            counts[word] += 1
        else:
            counts[word] = 1
    return counts

def most_common_word(words: list[str]) -> str:
    counts = word_frequencies(words)
    return max(counts, key=counts.get)  # re-derives what Counter gives for free
```

## Good

```python
from collections import Counter

def word_frequencies(words: list[str]) -> Counter[str]:
    return Counter(words)

def most_common_word(words: list[str]) -> str:
    return Counter(words).most_common(1)[0][0]
```

## Combining and Comparing Tallies

```python
from collections import Counter

inventory = Counter(warehouse_a) + Counter(warehouse_b)  # merge counts
shortage = Counter(required) - Counter(in_stock)          # only positive remainders
common_tags = Counter(post_a_tags) & Counter(post_b_tags)  # min per key (intersection)

# Top 3 most frequent HTTP status codes seen in an access log
top_statuses = Counter(entry.status for entry in log_entries).most_common(3)
```

`Counter` also tolerates missing keys gracefully in arithmetic and returns `0` (never raises `KeyError`) for `counter[missing_key]`, which is exactly the behavior most tallying code wants without any extra guard clauses.

```python
counts = Counter(["a", "b", "a"])
print(counts["z"])  # 0, no KeyError — a plain dict would raise here
counts["z"] += 1    # works fine too, starts from the implicit 0
```

`Counter.update()` also accepts another iterable or mapping to add to existing counts in place, which is the idiomatic way to accumulate a tally across multiple batches without reinitializing it each time.

## See Also

- [`coll-defaultdict-grouping`](coll-defaultdict-grouping.md) - the related pattern for grouping instead of counting
- [`perf-comprehension-over-loop`](perf-comprehension-over-loop.md) - comprehensions as `Counter`'s input, not a replacement for it
- [`data-enum-over-constants`](data-enum-over-constants.md) - typed keys to count over instead of raw strings

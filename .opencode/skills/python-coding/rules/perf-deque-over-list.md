# perf-deque-over-list

> Use `collections.deque` for queue-like FIFO/LIFO operations instead of `list`

## Why It Matters

`list.pop(0)` and `list.insert(0, x)` are O(n) operations because every remaining element has to shift over in memory to fill or make room at the front. `collections.deque` is implemented as a doubly linked list of fixed-size blocks, giving O(1) appends and pops from *both* ends. For any queue, sliding-window, or breadth-first-search workload that repeatedly adds/removes from the front, using a `list` silently turns an O(n) algorithm into O(n^2).

## Bad

```python
def process_queue(tasks: list[Task]) -> None:
    queue = list(tasks)
    while queue:
        task = queue.pop(0)  # O(n) — shifts every remaining element left
        handle(task)

def sliding_window_max(nums: list[int], k: int) -> list[int]:
    window = []
    result = []
    for n in nums:
        window.append(n)
        if len(window) > k:
            window.pop(0)  # O(n) per removal
        if len(window) == k:
            result.append(max(window))
    return result
```

## Good

```python
from collections import deque

def process_queue(tasks: list[Task]) -> None:
    queue = deque(tasks)
    while queue:
        task = queue.popleft()  # O(1)
        handle(task)

def sliding_window_max(nums: list[int], k: int) -> list[int]:
    window: deque[int] = deque(maxlen=k)  # auto-evicts oldest when full
    result = []
    for n in nums:
        window.append(n)
        if len(window) == k:
            result.append(max(window))
    return result
```

## When `list` Is Still Correct

`list` remains the right choice when you only ever append/pop from the *end* (both are O(1) on a list) or when you need random-access indexing and slicing, which `deque` supports but with O(n) cost for arbitrary index access (deque is optimized for the ends, not the middle):

```python
stack = []       # LIFO from one end only — list.append/list.pop() are both O(1)
stack.append(x)
stack.pop()

data[len(data) // 2]  # frequent middle-index access — keep this a list
```

`deque` also supports a bounded `maxlen`, which is a convenient way to implement a fixed-size rolling buffer (recent-history logs, moving averages) without manual truncation logic.

## See Also

- [`coll-avoid-index-loop`](coll-avoid-index-loop.md) - related indexing anti-patterns on lists
- [`async-queue-backpressure`](async-queue-backpressure.md) - the async-native queue for producer/consumer pipelines
- [`perf-avoid-premature-optimization`](perf-avoid-premature-optimization.md) - confirm the queue is actually large enough for this to matter

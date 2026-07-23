# conc-cpu-bound-multiprocessing

> Use multiprocessing (or subinterpreters) for CPU-bound parallel work

## Why It Matters

CPython's GIL allows only one thread to execute Python bytecode at a time, so no number of threads will make a pure-Python CPU-bound computation (parsing, numeric loops, image transforms in pure Python) run faster — it will actually run slightly slower due to thread-switching overhead. Separate processes each get their own interpreter and GIL, so `multiprocessing`/`ProcessPoolExecutor` is the only standard-library tool that turns CPU-bound Python work into genuine multi-core parallelism.

## Bad

```python
from concurrent.futures import ThreadPoolExecutor

def compute_mandelbrot_row(y: int, width: int, max_iter: int = 100) -> list[int]:
    row = []
    for x in range(width):
        c = complex((x - width / 2) / (width / 4), (y - width / 2) / (width / 4))
        z = 0j
        count = 0
        while abs(z) < 2 and count < max_iter:
            z = z * z + c
            count += 1
        row.append(count)
    return row

def render(height: int, width: int) -> list[list[int]]:
    # Threads can't help here: the GIL serializes bytecode execution for
    # this pure-Python numeric loop, so this is no faster than sequential.
    with ThreadPoolExecutor(max_workers=8) as pool:
        return list(pool.map(lambda y: compute_mandelbrot_row(y, width), range(height)))
```

## Good

```python
from concurrent.futures import ProcessPoolExecutor
from functools import partial

def compute_mandelbrot_row(y: int, width: int, max_iter: int = 100) -> list[int]:
    row = []
    for x in range(width):
        c = complex((x - width / 2) / (width / 4), (y - width / 2) / (width / 4))
        z = 0j
        count = 0
        while abs(z) < 2 and count < max_iter:
            z = z * z + c
            count += 1
        row.append(count)
    return row

def render(height: int, width: int) -> list[list[int]]:
    with ProcessPoolExecutor() as pool:
        rows = pool.map(partial(compute_mandelbrot_row, width=width), range(height))
        return list(rows)
```

## Amortizing Process Overhead with Chunking

```python
def render_chunked(height: int, width: int, chunksize: int = 8) -> list[list[int]]:
    with ProcessPoolExecutor() as pool:
        # chunksize batches multiple rows per IPC round-trip, reducing
        # pickling/dispatch overhead for fine-grained work.
        rows = pool.map(
            partial(compute_mandelbrot_row, width=width), range(height), chunksize=chunksize
        )
        return list(rows)
```

Every argument and return value crosses a process boundary via pickling,
so this approach pays off when per-task work meaningfully outweighs
serialization cost — batch fine-grained tasks rather than submitting one
tiny unit of work per process call.

## See Also

- [`conc-choose-model`](conc-choose-model.md) - the broader decision this specializes
- [`conc-process-pool-executor`](conc-process-pool-executor.md) - preferring the executor API over raw `Process`/`Pool`
- [`async-gil-awareness`](async-gil-awareness.md) - why the GIL forces this choice
- [`async-multiprocessing-cpu`](async-multiprocessing-cpu.md) - combining this with an async application

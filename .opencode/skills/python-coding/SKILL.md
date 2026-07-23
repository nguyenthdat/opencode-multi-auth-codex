---
name: python-coding
description: "Comprehensive idiomatic Python guidance: 172 prioritized rules across 15 categories. Use when writing, reviewing, refactoring, optimizing, or debugging Python (`.py`, `pyproject.toml`). Covers type hints, error handling, resource management, API design, async/concurrency, data modeling, testing, and anti-patterns. Preserve the target project's declared Python version and dependency constraints; use 3.11+/3.12+/3.13-specific syntax (TaskGroup, `except*`, PEP 695 generics, `Self`) only when the project's supported Python version allows it."
compatibility: opencode
metadata:
  domain: python
  audience: software-engineer
  edition: project-declared
---

# Python Best Practices

Comprehensive guide for writing high-quality, idiomatic Python code. Contains 172 rules across 15 categories, prioritized by impact. Project constraints override generic defaults: preserve the declared minimum Python version, dependency policy, and framework conventions unless the user explicitly requests a migration.

## When to Apply

Reference these guidelines when:
- Writing new Python functions, classes, or modules
- Adding or reviewing type hints on public APIs
- Implementing error handling, resource cleanup, or async code
- Designing public APIs for libraries or services
- Reviewing code for correctness, memory, or concurrency issues
- Optimizing hot paths or reducing allocations/overhead
- Refactoring existing Python code
- Setting up or tightening linting, formatting, and type-checking in CI
- Modeling data with dataclasses, Pydantic, or `TypedDict`

## Python 3.11 / 3.12 / 3.13

Preserve an existing project's declared minimum Python version (`requires-python` in `pyproject.toml`) unless a version bump is explicitly in scope. For new projects, target the latest stable release the team can support, and use these version-gated features only when the floor allows it:

```toml
[project]
requires-python = ">=3.11"   # raise only when code or dependencies require it
```

Key features to apply when the project's floor allows them:

- **Structural pattern matching (`match`/`case`, 3.10+).** Use for dispatching on shape/type instead of long `if/elif` chains over `isinstance`.
- **Exception groups and `except*` (PEP 654, 3.11+).** Use `ExceptionGroup` to carry multiple unrelated failures (e.g. from `asyncio.TaskGroup`) and `except*` to handle them selectively.
- **`asyncio.TaskGroup` and `asyncio.timeout()` (3.11+).** Prefer these over manual `create_task`/`gather` bookkeeping and `wait_for` cancellation edge cases.
- **`tomllib` (3.11+).** Parse TOML from the standard library; no third-party dependency needed for read-only TOML parsing.
- **Improved tracebacks (3.11+).** Errors point at the exact sub-expression that failed; write code that keeps expressions small enough for this to stay useful.
- **`Self` type (PEP 673, 3.11+).** Annotate methods that return the instance's own type, including in subclasses, without generic boilerplate.
- **PEP 695 generic syntax and the `type` statement (3.12+).** `class Stack[T]:` and `type IntList = list[int]` replace `TypeVar`/`TypeAlias` boilerplate where the floor allows it.
- **`StrEnum` and improved `Enum` reprs (3.11+/3.12+).** Prefer `StrEnum` over ad hoc `(str, Enum)` mixins.
- **Better f-strings (PEP 701, 3.12+).** Nested quotes, multi-line expressions, and backslashes are permitted inside f-string expressions.
- **Per-interpreter GIL / free-threaded builds (3.12+/3.13+).** `PEP 684` subinterpreters and the experimental free-threaded (`--disable-gil`) build change CPU-bound concurrency trade-offs; verify what the deployment target actually ships before relying on either.
- **Deprecation of `distutils` and legacy typing aliases.** Use `packaging`/`setuptools`/`hatchling` and `list`/`dict`/`tuple` generics instead of the removed or soft-deprecated `typing` aliases.

Everything below applies across supported versions; prefer the newer forms above only where the project's declared floor supports them.

## Rule Categories by Priority

| Priority | Category | Impact | Prefix | Rules |
|----------|----------|--------|--------|-------|
| 1 | Type Hints & Static Typing | CRITICAL | `type-` | 14 |
| 2 | Error Handling | CRITICAL | `err-` | 13 |
| 3 | Memory & Resource Management | CRITICAL | `res-` | 12 |
| 4 | API/Interface Design | HIGH | `api-` | 14 |
| 5 | Async/Concurrency | HIGH | `async-` | 14 |
| 6 | Data Modeling | HIGH | `data-` | 10 |
| 7 | Concurrency Model Choice | MEDIUM | `conc-` | 6 |
| 8 | Naming Conventions | MEDIUM | `name-` | 10 |
| 9 | Testing | MEDIUM | `test-` | 13 |
| 10 | Documentation | MEDIUM | `doc-` | 10 |
| 11 | Performance Patterns | MEDIUM | `perf-` | 12 |
| 12 | Collections & Data Structures | MEDIUM | `coll-` | 8 |
| 13 | Project Structure/Packaging | LOW | `proj-` | 10 |
| 14 | Linting & Formatting | LOW | `lint-` | 10 |
| 15 | Anti-patterns | REFERENCE | `anti-` | 16 |

---

## Quick Reference

### 1. Type Hints & Static Typing (CRITICAL)

- [`type-modern-generics`](rules/type-modern-generics.md) - Use built-in generics `list[int]`/`dict[str, int]` over `typing.List`/`typing.Dict`
- [`type-union-pipe`](rules/type-union-pipe.md) - Use `X | None` and `X | Y` union syntax (PEP 604) over `Optional`/`Union`
- [`type-protocol-structural`](rules/type-protocol-structural.md) - Use `typing.Protocol` for structural typing instead of forcing inheritance
- [`type-typeddict-shape`](rules/type-typeddict-shape.md) - Use `TypedDict` to type dict-shaped data instead of `dict[str, Any]`
- [`type-typevar-generic`](rules/type-typevar-generic.md) - Use `TypeVar`/PEP 695 generic syntax for reusable generic classes and functions
- [`type-self-return`](rules/type-self-return.md) - Use `Self` as the return type for methods that return the instance's own type
- [`type-avoid-any`](rules/type-avoid-any.md) - Avoid `Any`; narrow with unions, protocols, or generics instead
- [`type-overload-signatures`](rules/type-overload-signatures.md) - Use `@overload` to describe multiple call signatures precisely
- [`type-literal-constrain`](rules/type-literal-constrain.md) - Use `Literal` to constrain a parameter to a fixed set of values
- [`type-alias-statement`](rules/type-alias-statement.md) - Use the `type` statement (PEP 695, 3.12+) or `TypeAlias` for named type aliases
- [`type-runtime-checkable`](rules/type-runtime-checkable.md) - Use `@runtime_checkable` when a `Protocol` needs `isinstance()` checks
- [`type-dataclass-fields`](rules/type-dataclass-fields.md) - Type every dataclass/attrs field explicitly; never leave a field untyped
- [`type-narrow-guards`](rules/type-narrow-guards.md) - Use `TypeGuard`/`TypeIs` and narrowing idioms to narrow union types safely
- [`type-check-tool`](rules/type-check-tool.md) - Enforce mypy or pyright in CI as a hard gate, not an optional suggestion

### 2. Error Handling (CRITICAL)

- [`err-specific-except`](rules/err-specific-except.md) - Catch specific exception types; never catch bare `Exception` unless re-raising
- [`err-custom-hierarchy`](rules/err-custom-hierarchy.md) - Define a custom exception hierarchy rooted in a package-specific base exception
- [`err-raise-from`](rules/err-raise-from.md) - Use `raise NewError(...) from original` to preserve the causal exception chain
- [`err-context-manager-cleanup`](rules/err-context-manager-cleanup.md) - Use context managers for guaranteed cleanup instead of manual try/finally boilerplate
- [`err-try-else`](rules/err-try-else.md) - Use `try/except/else` to separate risky code from the success-path logic
- [`err-no-bare-except`](rules/err-no-bare-except.md) - Never use a bare `except:` clause
- [`err-exception-group`](rules/err-exception-group.md) - Use `ExceptionGroup`/`except*` (PEP 654, 3.11+) to handle concurrent/multiple failures
- [`err-fail-fast-validate`](rules/err-fail-fast-validate.md) - Validate inputs at the boundary and fail fast with a clear, specific error
- [`err-log-dont-swallow`](rules/err-log-dont-swallow.md) - Log or re-raise every caught exception; never silently swallow it
- [`err-finally-cleanup`](rules/err-finally-cleanup.md) - Use `finally` only for cleanup side effects, never for control flow or return values
- [`err-custom-attributes`](rules/err-custom-attributes.md) - Attach structured, machine-readable data as attributes on custom exceptions
- [`err-reraise-preserve`](rules/err-reraise-preserve.md) - Use a bare `raise` inside `except` to re-raise without losing the original traceback
- [`err-no-exceptions-control-flow`](rules/err-no-exceptions-control-flow.md) - Don't use exceptions for expected, ordinary control flow

### 3. Memory & Resource Management (CRITICAL)

- [`res-context-manager-with`](rules/res-context-manager-with.md) - Use `with` for anything that acquires a resource (files, locks, sockets, DB connections)
- [`res-contextlib-helpers`](rules/res-contextlib-helpers.md) - Use `contextlib.contextmanager`/`ExitStack` to build custom resource managers
- [`res-generator-lazy`](rules/res-generator-lazy.md) - Use generators for lazy, memory-efficient iteration instead of building full lists
- [`res-slots-memory`](rules/res-slots-memory.md) - Use `__slots__` to cut per-instance memory overhead on high-volume classes
- [`res-weakref-cache`](rules/res-weakref-cache.md) - Use `weakref` to avoid reference cycles and unbounded cache growth
- [`res-avoid-unnecessary-copy`](rules/res-avoid-unnecessary-copy.md) - Avoid copying large structures unnecessarily
- [`res-file-handles-close`](rules/res-file-handles-close.md) - Always close/manage file and network handles explicitly via context managers
- [`res-del-not-guaranteed`](rules/res-del-not-guaranteed.md) - Don't rely on `__del__` for critical cleanup
- [`res-async-context-manager`](rules/res-async-context-manager.md) - Use `async with`/`@asynccontextmanager` for async resource cleanup
- [`res-streaming-large-files`](rules/res-streaming-large-files.md) - Stream large files/data instead of loading fully into memory
- [`res-connection-pooling`](rules/res-connection-pooling.md) - Pool and reuse expensive connections (DB, HTTP) instead of opening per-call
- [`res-gc-cycles`](rules/res-gc-cycles.md) - Understand reference cycles and the cyclic garbage collector's cost

### 4. API/Interface Design (HIGH)

- [`api-keyword-only-args`](rules/api-keyword-only-args.md) - Use keyword-only arguments (`*`) for clarity and to prevent positional misuse
- [`api-no-mutable-default`](rules/api-no-mutable-default.md) - Never use a mutable object as a default argument value
- [`api-dataclass-value-object`](rules/api-dataclass-value-object.md) - Use `@dataclass` for value objects instead of hand-written `__init__`/`__eq__`
- [`api-property-computed`](rules/api-property-computed.md) - Use `@property` for computed/derived attributes instead of getter methods
- [`api-protocol-over-abc`](rules/api-protocol-over-abc.md) - Prefer `Protocol` over `ABC` when only structural compatibility matters
- [`api-init-public-surface`](rules/api-init-public-surface.md) - Curate the public surface deliberately via `__init__.py` re-exports
- [`api-sentinel-default`](rules/api-sentinel-default.md) - Use a sentinel object instead of `None` to mean "argument not provided"
- [`api-dunder-methods`](rules/api-dunder-methods.md) - Implement dunder methods to integrate with Python's protocols
- [`api-positional-only`](rules/api-positional-only.md) - Use positional-only parameters (`/`) to keep parameter names free to rename later
- [`api-composition-inheritance`](rules/api-composition-inheritance.md) - Prefer composition over deep inheritance hierarchies
- [`api-return-consistent-types`](rules/api-return-consistent-types.md) - Return a consistent type from a function; avoid union "return soup"
- [`api-classmethod-factory`](rules/api-classmethod-factory.md) - Use `@classmethod` for alternative constructors instead of overloaded `__init__`
- [`api-immutable-value-objects`](rules/api-immutable-value-objects.md) - Prefer frozen dataclasses/immutable value objects when identity shouldn't change
- [`api-explicit-exports`](rules/api-explicit-exports.md) - Make module exports explicit with `__all__`

### 5. Async/Concurrency (HIGH)

- [`async-taskgroup-structured`](rules/async-taskgroup-structured.md) - Use `asyncio.TaskGroup` for structured concurrency (3.11+)
- [`async-gather-parallel`](rules/async-gather-parallel.md) - Use `asyncio.gather` to run independent awaitables in parallel
- [`async-no-blocking-call`](rules/async-no-blocking-call.md) - Never call blocking I/O directly inside async functions
- [`async-to-thread`](rules/async-to-thread.md) - Use `asyncio.to_thread` to offload blocking/CPU calls from async code
- [`async-with-resource`](rules/async-with-resource.md) - Use `async with`/`async for` for async resources and async iterators
- [`async-timeout`](rules/async-timeout.md) - Use `asyncio.timeout()` to bound awaits with a deadline (3.11+)
- [`async-cancellation-handling`](rules/async-cancellation-handling.md) - Handle `asyncio.CancelledError` correctly; never swallow it silently
- [`async-queue-backpressure`](rules/async-queue-backpressure.md) - Use `asyncio.Queue` for bounded producer/consumer backpressure
- [`async-lock-primitives`](rules/async-lock-primitives.md) - Use `asyncio.Lock`/`Semaphore`/`Event` for async-safe coordination
- [`async-avoid-sync-in-async`](rules/async-avoid-sync-in-async.md) - Never mix `time.sleep()` with async code
- [`async-multiprocessing-cpu`](rules/async-multiprocessing-cpu.md) - Use multiprocessing for CPU-bound parallelism, not asyncio
- [`async-threading-io`](rules/async-threading-io.md) - Use threads for blocking I/O-bound concurrency when async isn't available
- [`async-gil-awareness`](rules/async-gil-awareness.md) - Understand the GIL (and free-threaded 3.13 build) when choosing a concurrency model
- [`async-context-vars`](rules/async-context-vars.md) - Use `contextvars.ContextVar` for async-safe request-scoped state

### 6. Data Modeling (HIGH)

- [`data-pydantic-validation`](rules/data-pydantic-validation.md) - Use Pydantic models to validate data at I/O boundaries
- [`data-dataclass-vs-pydantic`](rules/data-dataclass-vs-pydantic.md) - Choose plain dataclasses for internal data, Pydantic for external/validated boundaries
- [`data-frozen-immutable`](rules/data-frozen-immutable.md) - Freeze dataclasses/models that represent immutable facts
- [`data-field-defaults-factory`](rules/data-field-defaults-factory.md) - Use `field(default_factory=...)` for mutable default values on dataclasses
- [`data-post-init-validation`](rules/data-post-init-validation.md) - Use `__post_init__`/validators to enforce invariants at construction time
- [`data-namedtuple-lightweight`](rules/data-namedtuple-lightweight.md) - Use `typing.NamedTuple` for lightweight immutable records
- [`data-enum-over-constants`](rules/data-enum-over-constants.md) - Use `Enum`/`StrEnum` (3.11+) instead of raw string/int constants
- [`data-avoid-dict-any`](rules/data-avoid-dict-any.md) - Avoid passing loosely typed `dict[str, Any]` between layers
- [`data-serialization-explicit`](rules/data-serialization-explicit.md) - Make (de)serialization explicit and centralized at system boundaries
- [`data-slots-dataclass`](rules/data-slots-dataclass.md) - Use `@dataclass(slots=True)` for memory-efficient, fast-attribute-access models

### 7. Concurrency Model Choice (MEDIUM)

- [`conc-choose-model`](rules/conc-choose-model.md) - Choose asyncio vs threading vs multiprocessing deliberately based on the workload's bottleneck
- [`conc-cpu-bound-multiprocessing`](rules/conc-cpu-bound-multiprocessing.md) - Use multiprocessing (or subinterpreters) for CPU-bound parallel work
- [`conc-io-bound-asyncio`](rules/conc-io-bound-asyncio.md) - Use asyncio for high-concurrency I/O-bound workloads
- [`conc-thread-safety-shared-state`](rules/conc-thread-safety-shared-state.md) - Guard shared mutable state with locks when using threads
- [`conc-process-pool-executor`](rules/conc-process-pool-executor.md) - Use `ProcessPoolExecutor`/`ThreadPoolExecutor` over managing raw threads/processes
- [`conc-avoid-shared-mutable-state`](rules/conc-avoid-shared-mutable-state.md) - Minimize shared mutable state between concurrent units of work

### 8. Naming Conventions (MEDIUM)

- [`name-snake-case-functions`](rules/name-snake-case-functions.md) - Use `snake_case` for functions, variables, and modules (PEP 8)
- [`name-pascal-case-classes`](rules/name-pascal-case-classes.md) - Use `PascalCase` for class names (PEP 8)
- [`name-screaming-constants`](rules/name-screaming-constants.md) - Use `SCREAMING_SNAKE_CASE` for module-level constants
- [`name-leading-underscore-private`](rules/name-leading-underscore-private.md) - Use a single leading underscore to mark internal, non-public API
- [`name-dunder-name-mangling`](rules/name-dunder-name-mangling.md) - Use double leading underscores sparingly; understand name-mangling behavior
- [`name-boolean-is-has`](rules/name-boolean-is-has.md) - Prefix boolean-returning names with `is_`, `has_`, `can_`, or `should_`
- [`name-avoid-builtin-shadow`](rules/name-avoid-builtin-shadow.md) - Don't shadow builtins with local names
- [`name-plural-collections`](rules/name-plural-collections.md) - Name variables holding collections with plural nouns
- [`name-verb-functions-noun-classes`](rules/name-verb-functions-noun-classes.md) - Name functions/methods as verbs and classes as nouns
- [`name-module-short-lowercase`](rules/name-module-short-lowercase.md) - Keep module/package names short, lowercase, without underscores when possible

### 9. Testing (MEDIUM)

- [`test-pytest-plain-asserts`](rules/test-pytest-plain-asserts.md) - Use pytest with plain `assert` statements instead of `unittest` assertion methods
- [`test-fixtures-setup`](rules/test-fixtures-setup.md) - Use pytest fixtures for setup/teardown instead of shared mutable module state
- [`test-parametrize-cases`](rules/test-parametrize-cases.md) - Use `@pytest.mark.parametrize` to cover multiple cases without duplicating test bodies
- [`test-mock-boundaries`](rules/test-mock-boundaries.md) - Mock at external boundaries, not internal implementation details
- [`test-hypothesis-property`](rules/test-hypothesis-property.md) - Use `hypothesis` for property-based testing
- [`test-arrange-act-assert`](rules/test-arrange-act-assert.md) - Structure tests as arrange/act/assert
- [`test-fixture-scope`](rules/test-fixture-scope.md) - Choose fixture scope deliberately based on cost and isolation needs
- [`test-tmp-path-fixture`](rules/test-tmp-path-fixture.md) - Use the `tmp_path`/`tmp_path_factory` fixtures instead of hardcoded temp paths
- [`test-async-pytest`](rules/test-async-pytest.md) - Use `pytest-asyncio` (or anyio) to test async functions properly
- [`test-monkeypatch-over-mock-patch`](rules/test-monkeypatch-over-mock-patch.md) - Prefer the `monkeypatch` fixture over manual `unittest.mock.patch`
- [`test-descriptive-names`](rules/test-descriptive-names.md) - Give tests descriptive, behavior-based names
- [`test-no-logic-in-tests`](rules/test-no-logic-in-tests.md) - Avoid conditionals and loops inside test bodies
- [`test-coverage-meaningful`](rules/test-coverage-meaningful.md) - Target meaningful coverage, not 100% as a vanity metric

### 10. Documentation (MEDIUM)

- [`doc-google-numpy-style`](rules/doc-google-numpy-style.md) - Use a single consistent docstring convention (Google or NumPy style)
- [`doc-all-public-api`](rules/doc-all-public-api.md) - Document every public module, class, function, and method
- [`doc-type-hints-not-docstring-types`](rules/doc-type-hints-not-docstring-types.md) - Let type hints carry types; use docstrings for meaning and behavior
- [`doc-examples-doctest`](rules/doc-examples-doctest.md) - Include runnable usage examples in docstrings and verify with doctest
- [`doc-raises-section`](rules/doc-raises-section.md) - Document exceptions a function can raise in a `Raises` section
- [`doc-module-docstring`](rules/doc-module-docstring.md) - Give every module a top-of-file docstring
- [`doc-readme-quickstart`](rules/doc-readme-quickstart.md) - Provide a README with installation and a minimal quickstart
- [`doc-changelog-keep`](rules/doc-changelog-keep.md) - Maintain a `CHANGELOG.md` following the Keep a Changelog convention
- [`doc-inline-comments-why`](rules/doc-inline-comments-why.md) - Use inline comments to explain "why", not to restate "what"
- [`doc-all-dunder`](rules/doc-all-dunder.md) - Declare `__all__` to make the intentional public surface explicit

### 11. Performance Patterns (MEDIUM)

- [`perf-comprehension-over-loop`](rules/perf-comprehension-over-loop.md) - Use comprehensions instead of manual append loops
- [`perf-generator-expression`](rules/perf-generator-expression.md) - Use generator expressions to avoid materializing full lists
- [`perf-set-membership`](rules/perf-set-membership.md) - Use `set`/`dict` for O(1) membership tests
- [`perf-lru-cache`](rules/perf-lru-cache.md) - Use `functools.lru_cache`/`cache` to memoize expensive pure functions
- [`perf-join-strings`](rules/perf-join-strings.md) - Use `str.join()` instead of repeated `+=` concatenation
- [`perf-avoid-global-lookup-hot-loop`](rules/perf-avoid-global-lookup-hot-loop.md) - Bind hot-loop globals/attribute lookups to locals
- [`perf-lazy-import`](rules/perf-lazy-import.md) - Defer expensive/optional imports until they're needed
- [`perf-avoid-premature-optimization`](rules/perf-avoid-premature-optimization.md) - Profile before optimizing
- [`perf-slots-attribute-access`](rules/perf-slots-attribute-access.md) - Use `__slots__`/dataclasses for faster attribute access
- [`perf-batch-io`](rules/perf-batch-io.md) - Batch I/O operations instead of many small calls
- [`perf-numpy-vectorize`](rules/perf-numpy-vectorize.md) - Vectorize numeric work with NumPy instead of per-element loops
- [`perf-deque-over-list`](rules/perf-deque-over-list.md) - Use `collections.deque` for queue-like operations

### 12. Collections & Data Structures (MEDIUM)

- [`coll-comprehension-readability`](rules/coll-comprehension-readability.md) - Keep comprehensions readable; avoid deeply nested comprehensions
- [`coll-counter-tally`](rules/coll-counter-tally.md) - Use `collections.Counter` for tallying/frequency counting
- [`coll-defaultdict-grouping`](rules/coll-defaultdict-grouping.md) - Use `collections.defaultdict` for grouping without manual key checks
- [`coll-namedtuple-record`](rules/coll-namedtuple-record.md) - Use `NamedTuple`/`dataclass` instead of unlabeled tuples for records
- [`coll-unpacking-star`](rules/coll-unpacking-star.md) - Use unpacking (`*rest`) instead of manual slicing
- [`coll-dict-merge-pipe`](rules/coll-dict-merge-pipe.md) - Use `|`/`|=` to merge dicts (3.9+)
- [`coll-avoid-index-loop`](rules/coll-avoid-index-loop.md) - Use `enumerate`/`zip` instead of manual index loops
- [`coll-frozenset-immutable-set`](rules/coll-frozenset-immutable-set.md) - Use `frozenset` for immutable, hashable set-like data

### 13. Project Structure/Packaging (LOW)

- [`proj-src-layout`](rules/proj-src-layout.md) - Use a `src/` layout for installable packages
- [`proj-pyproject-single-source`](rules/proj-pyproject-single-source.md) - Use `pyproject.toml` as the single packaging config
- [`proj-init-explicit`](rules/proj-init-explicit.md) - Keep `__init__.py` files intentional and minimal
- [`proj-entry-points`](rules/proj-entry-points.md) - Define CLI entry points declaratively in `pyproject.toml`
- [`proj-package-by-feature`](rules/proj-package-by-feature.md) - Organize packages by feature/domain, not by technical layer
- [`proj-venv-isolation`](rules/proj-venv-isolation.md) - Isolate dependencies per project with a virtual environment
- [`proj-lockfile-reproducible`](rules/proj-lockfile-reproducible.md) - Pin/lock dependencies for reproducible installs
- [`proj-version-single-source`](rules/proj-version-single-source.md) - Single-source the package version
- [`proj-optional-dependencies`](rules/proj-optional-dependencies.md) - Use extras/optional-dependencies for optional features
- [`proj-namespace-packages`](rules/proj-namespace-packages.md) - Understand implicit namespace packages before relying on them

### 14. Linting & Formatting (LOW)

- [`lint-ruff-primary`](rules/lint-ruff-primary.md) - Use Ruff as the primary linter and formatter
- [`lint-mypy-strict`](rules/lint-mypy-strict.md) - Run mypy or pyright in strict mode
- [`lint-pre-commit-hooks`](rules/lint-pre-commit-hooks.md) - Enforce lint/format/type-check via pre-commit hooks
- [`lint-ruff-rule-selection`](rules/lint-ruff-rule-selection.md) - Curate Ruff's rule selection deliberately
- [`lint-format-on-save`](rules/lint-format-on-save.md) - Auto-format with `ruff format`, don't hand-format
- [`lint-isort-import-order`](rules/lint-isort-import-order.md) - Sort/group imports consistently
- [`lint-noqa-justified`](rules/lint-noqa-justified.md) - Justify every `# noqa`/`# type: ignore` with a reason
- [`lint-ci-enforce`](rules/lint-ci-enforce.md) - Enforce lint/type-check as a CI gate, not optional
- [`lint-line-length-consistent`](rules/lint-line-length-consistent.md) - Pick one line-length and enforce it via tooling
- [`lint-bandit-security`](rules/lint-bandit-security.md) - Run a security linter (Bandit/Ruff `S` rules) in CI

### 15. Anti-patterns (REFERENCE)

- [`anti-mutable-default-arg`](rules/anti-mutable-default-arg.md) - Don't use mutable default arguments
- [`anti-bare-except`](rules/anti-bare-except.md) - Don't use bare `except:`
- [`anti-wildcard-import`](rules/anti-wildcard-import.md) - Don't use `from module import *`
- [`anti-stringly-typed`](rules/anti-stringly-typed.md) - Don't use strings for structured/enum-like data
- [`anti-god-object`](rules/anti-god-object.md) - Don't build God objects with too many responsibilities
- [`anti-global-mutable-state`](rules/anti-global-mutable-state.md) - Don't rely on mutable global state
- [`anti-deep-nesting`](rules/anti-deep-nesting.md) - Don't nest conditionals/loops beyond a few levels
- [`anti-catch-and-ignore`](rules/anti-catch-and-ignore.md) - Don't catch exceptions and silently ignore them
- [`anti-type-comment-legacy`](rules/anti-type-comment-legacy.md) - Don't use legacy `# type:` comments when annotations work
- [`anti-isinstance-type-check-abuse`](rules/anti-isinstance-type-check-abuse.md) - Don't chain `isinstance`/`type()` checks instead of polymorphism
- [`anti-manual-context-manager`](rules/anti-manual-context-manager.md) - Don't manually call `__enter__`/`__exit__` instead of `with`
- [`anti-premature-abstraction`](rules/anti-premature-abstraction.md) - Don't over-abstract before duplication actually hurts
- [`anti-list-for-membership`](rules/anti-list-for-membership.md) - Don't use `list` for repeated membership tests
- [`anti-print-debugging`](rules/anti-print-debugging.md) - Don't leave `print()` debugging in production code
- [`anti-circular-import`](rules/anti-circular-import.md) - Don't create circular imports via poor module structure
- [`anti-eval-exec-untrusted`](rules/anti-eval-exec-untrusted.md) - Don't use `eval`/`exec` on untrusted input

---

## Recommended pyproject.toml Settings

```toml
[project]
name = "your-package"
version = "0.1.0"
requires-python = ">=3.11"

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[tool.ruff]
line-length = 100
target-version = "py311"

[tool.ruff.lint]
select = [
    "E", "F", "W",      # pycodestyle / pyflakes
    "I",                # isort
    "UP",               # pyupgrade (modernize syntax)
    "B",                # bugbear (common bugs/design issues)
    "C4",               # comprehensions
    "SIM",              # simplify
    "S",                # bandit (security)
    "RUF",              # ruff-specific rules
]
ignore = ["E501"]  # line length enforced by formatter, not linter

[tool.ruff.format]
quote-style = "double"

[tool.mypy]
python_version = "3.11"
strict = true
warn_unused_ignores = true
warn_redundant_casts = true
disallow_untyped_defs = true
disallow_incomplete_defs = true

[tool.pytest.ini_options]
minversion = "8.0"
addopts = "-ra -q --strict-markers"
testpaths = ["tests"]
asyncio_mode = "auto"
filterwarnings = ["error"]

[tool.coverage.run]
branch = true
source = ["src"]
```

---

## How to Use

This skill provides rule identifiers for quick reference. When generating or reviewing Python code:

1. **Check relevant category** based on task type
2. **Apply rules** with matching prefix
3. **Prioritize** CRITICAL > HIGH > MEDIUM > LOW
4. **Read rule files** in `rules/` for detailed examples

### Rule Application by Task

| Task | Primary Categories |
|------|-------------------|
| New function | `type-`, `err-`, `name-` |
| New class/API | `api-`, `type-`, `data-`, `doc-` |
| Async code | `async-`, `conc-`, `res-` |
| Error handling | `err-`, `api-` |
| Data modeling | `data-`, `type-`, `coll-` |
| Memory/resource cleanup | `res-`, `perf-` |
| Performance tuning | `perf-`, `res-`, `coll-` |
| Code review | `anti-`, `lint-` |
| Project setup | `proj-`, `lint-` |

---

## Related Skills

- [design-patterns](../design-patterns/SKILL.md) - choosing and implementing GoF and idiomatic patterns; apply alongside this skill's API and typing rules for pattern-heavy Python design.
- [security-review](../security-review/SKILL.md) - security-focused audit checklists; apply alongside this skill's error-handling and dependency rules when reviewing Python code for vulnerabilities.

## Sources

This skill synthesizes best practices from:
- [PEP 8 — Style Guide for Python Code](https://peps.python.org/pep-0008/)
- [PEP 20 — The Zen of Python](https://peps.python.org/pep-0020/)
- [PEP 484 — Type Hints](https://peps.python.org/pep-0484/), [PEP 604 — Union types as `X | Y`](https://peps.python.org/pep-0604/), [PEP 695 — Type Parameter Syntax](https://peps.python.org/pep-0695/)
- [PEP 654 — Exception Groups and `except*`](https://peps.python.org/pep-0654/), [PEP 673 — `Self` Type](https://peps.python.org/pep-0673/)
- *Effective Python* by Brett Slatkin (2nd/3rd edition)
- [Python typing documentation](https://docs.python.org/3/library/typing.html) and the [typing spec](https://typing.readthedocs.io/)
- [Ruff rule documentation](https://docs.astral.sh/ruff/rules/)
- [pytest documentation](https://docs.pytest.org/) and [Hypothesis documentation](https://hypothesis.readthedocs.io/)
- Production codebases: httpx, pydantic, fastapi, django, requests, sqlalchemy
- Community conventions (2024-2025)

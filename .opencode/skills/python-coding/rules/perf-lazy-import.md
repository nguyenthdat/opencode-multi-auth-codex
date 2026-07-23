# perf-lazy-import

> Defer expensive/optional imports until they're actually needed

## Why It Matters

Every `import` at module load time runs that module's top-level code immediately, and heavy dependencies (pandas, matplotlib, boto3, torch) can add tens to hundreds of milliseconds — or tens of megabytes of memory — to startup, even if the code path that uses them never executes for a given invocation. For CLIs, serverless functions, and libraries with optional features, importing eagerly at the top of the file punishes every user for a feature only some of them use.

## Bad

```python
# top of cli.py — every subcommand pays for these imports, even `mytool --help`
import pandas as pd
import matplotlib.pyplot as plt
import boto3

def main(argv: list[str]) -> None:
    args = parse_args(argv)
    if args.command == "plot":
        df = pd.read_csv(args.input)
        plt.plot(df["x"], df["y"])
        plt.savefig(args.output)
    elif args.command == "upload":
        boto3.client("s3").upload_file(args.input, args.bucket, args.key)
    else:
        print_help()
```

## Good

```python
def main(argv: list[str]) -> None:
    args = parse_args(argv)
    if args.command == "plot":
        import matplotlib.pyplot as plt
        import pandas as pd

        df = pd.read_csv(args.input)
        plt.plot(df["x"], df["y"])
        plt.savefig(args.output)
    elif args.command == "upload":
        import boto3

        boto3.client("s3").upload_file(args.input, args.bucket, args.key)
    else:
        print_help()
```

## When to Keep Imports at the Top

Lazy imports trade startup cost for a slightly less obvious dependency graph and repeated (though cheap, thanks to `sys.modules` caching) import machinery calls. For cheap, always-needed imports (`os`, `json`, your own package's core modules), keep them at the top — that's the PEP 8 default and what readers expect. Reach for a lazy import specifically when:

- The dependency is large/slow to import and only used behind a feature flag or subcommand.
- The dependency is genuinely optional (an `extras_require` package that might not be installed).
- You need to break an import cycle (see `anti-circular-import`) — though restructuring the modules is usually the better long-term fix.

```python
def to_dataframe(records: list[Record]):
    # Optional dependency: only users who call this need pandas installed.
    import pandas as pd

    return pd.DataFrame([r.__dict__ for r in records])
```

## See Also

- [`anti-circular-import`](anti-circular-import.md) - lazy imports as a workaround, and why fixing the cycle is better
- [`proj-optional-dependencies`](proj-optional-dependencies.md) - declaring the extras that back a lazy import
- [`perf-avoid-premature-optimization`](perf-avoid-premature-optimization.md) - measure startup time before scattering lazy imports everywhere

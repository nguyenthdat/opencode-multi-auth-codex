# lint-pre-commit-hooks

> Enforce lint/format/type-check via pre-commit hooks, not just editor integrations

## Why It Matters

Editor integrations only help the developer who configured their editor correctly — a new hire without the Ruff plugin installed, a contributor on a different IDE, or someone editing a file over SSH will commit unformatted or unlinted code with no warning. Pre-commit hooks run the same checks for every contributor regardless of editor, catching issues before they ever reach a commit, let alone CI. This shifts feedback left: failing in CI five minutes after a push is slower and more disruptive than failing locally in half a second before the commit is even made.

## Bad

```text
# CONTRIBUTING.md
"Please install the Ruff and mypy extensions in your editor before
committing. Make sure to run `ruff format` before pushing."

# Nothing enforces this. Half the team has the extension,
# half doesn't, and CI becomes the first and only place
# formatting violations are caught - after the PR is already open.
```

## Good

```yaml
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/astral-sh/ruff-pre-commit
    rev: v0.6.9
    hooks:
      - id: ruff
        args: [--fix]
      - id: ruff-format

  - repo: https://github.com/pre-commit/mirrors-mypy
    rev: v1.11.2
    hooks:
      - id: mypy
        additional_dependencies: [pydantic, types-requests]
```

```bash
# One-time setup per clone
pip install pre-commit
pre-commit install

# Now every `git commit` runs ruff, ruff-format, and mypy first
git commit -m "add feature"
# ruff.....................................................Passed
# ruff-format...............................................Passed
# mypy......................................................Passed
```

## Keeping Hooks Fast and In Sync With CI

```yaml
# .pre-commit-config.yaml
default_stages: [pre-commit]

repos:
  - repo: https://github.com/astral-sh/ruff-pre-commit
    rev: v0.6.9
    hooks:
      - id: ruff
        args: [--fix, --exit-non-zero-on-fix]
      - id: ruff-format
```

Pin the same Ruff/mypy versions used in CI (`rev:` here, `requirements-dev.txt` there) so a hook passing locally never fails downstream. Run `pre-commit autoupdate` periodically, and use `pre-commit run --all-files` in CI as a backstop for contributors who bypassed hooks with `--no-verify`.

## See Also

- [`lint-ci-enforce`](lint-ci-enforce.md) - the CI backstop for commits that skip hooks
- [`lint-ruff-primary`](lint-ruff-primary.md) - the linter/formatter these hooks run
- [`lint-format-on-save`](lint-format-on-save.md) - the editor-side complement to hooks

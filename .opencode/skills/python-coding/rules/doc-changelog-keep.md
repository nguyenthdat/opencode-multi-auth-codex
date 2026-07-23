# doc-changelog-keep

> Maintain a `CHANGELOG.md` following the Keep a Changelog convention

## Why It Matters

Without a changelog, users upgrading a dependency have to diff git history or read every commit message to figure out whether a new release contains a breaking change, a bugfix they need, or a deprecation they should plan around. The Keep a Changelog format (keepachangelog.com) standardizes this into predictable sections — `Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`, `Security` — grouped under version headers, so consumers can scan just the sections relevant to them instead of parsing prose. Paired with semantic versioning, a changelog is often the deciding factor in whether a team feels safe upgrading a dependency promptly, which affects how quickly security fixes propagate downstream.

## Bad

```markdown
# Changelog

- fixed stuff
- updated deps
- v2 release
- more fixes
```

No dates, no version boundaries, no distinction between breaking changes and bugfixes — not actionable for someone deciding whether to upgrade.

## Good

```markdown
# Changelog

All notable changes to this project are documented in this file.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- `Client.stream()` for chunked response handling.

## [2.0.0] - 2026-06-15

### Changed
- **Breaking:** `Client.get()` now returns a `Response` object instead of
  a raw dict. Use `response.json()` to get the previous behavior.

### Removed
- **Breaking:** Dropped support for Python 3.9.

### Fixed
- Connection pool no longer leaks sockets on `TimeoutError`.

## [1.4.1] - 2026-03-02

### Security
- Upgraded `certifi` to patch an expired root certificate bundle.
```

## Automating It

Tools like `towncrier` or `git-cliff` generate changelog entries from per-PR fragment files or conventional commit messages, avoiding a single contentious "who edits CHANGELOG.md" merge conflict:

```bash
# towncrier: each PR adds a small fragment file, merged at release time
echo "Added streaming response support" > changelog.d/142.added.md
towncrier build --version 2.1.0
```

## What Belongs in "Unreleased"

Keep an `[Unreleased]` section at the top updated as PRs merge, so a release is just renaming that section to a version and date — never write the changelog retroactively from `git log` right before cutting a release.

## See Also

- [`doc-readme-quickstart`](doc-readme-quickstart.md) - the companion document users read before the changelog
- [`proj-version-single-source`](proj-version-single-source.md) - keeping the version referenced in the changelog authoritative
- [`api-return-consistent-types`](api-return-consistent-types.md) - the kind of breaking change a changelog must call out clearly

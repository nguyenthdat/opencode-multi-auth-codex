# doc-readme-quickstart

> Provide a README with installation and a minimal quickstart example

## Why It Matters

A README is almost always the first thing a new user, contributor, or your own future self sees — on GitHub, on PyPI's project page, or in a cloned repo — and if it doesn't answer "how do I install this" and "what does using it look like" within the first screen, people bounce before finding out the project solves their problem. A minimal, copy-pasteable quickstart lets someone verify the library works in under a minute, which builds the confidence needed to invest in reading further docs. This is exactly the pattern followed by widely-adopted libraries like `httpx`, `requests`, and `fastapi`, whose READMEs lead with a runnable snippet before anything else.

## Bad

```markdown
# MyProject

This is a project for doing things.

## Contributing

See CONTRIBUTING.md.

## License

MIT
```

No installation instructions, no example, no indication of what the project actually does.

## Good

```markdown
# httpclient-lite

A small, typed HTTP client built on `httpx` with automatic retries and
structured logging.

## Installation

    pip install httpclient-lite

## Quickstart

    from httpclient_lite import Client

    client = Client(base_url="https://api.example.com", max_retries=3)
    response = client.get("/users/42")
    print(response.json())

## Documentation

Full docs: https://httpclient-lite.readthedocs.io

## License

MIT
```

## A README Structure That Scales

1. **One-sentence description** — what problem this solves.
2. **Installation** — the exact `pip install` (or `uv add`) command.
3. **Quickstart** — a runnable example under 15 lines, covering the single most common use case.
4. **Link to full docs** — for anything beyond the basics; don't try to cram everything into the README.
5. **License** — one line, with a link to the `LICENSE` file.

```python
# Verify your quickstart snippet actually runs by testing it as a doctest
# or including it in your test suite - a broken README example erodes trust fast.
```

## See Also

- [`doc-examples-doctest`](doc-examples-doctest.md) - keeping code examples (including README snippets) runnable and verified
- [`doc-changelog-keep`](doc-changelog-keep.md) - the companion document tracking what changed release to release
- [`proj-pyproject-single-source`](proj-pyproject-single-source.md) - README often pulls install name/version from `pyproject.toml`

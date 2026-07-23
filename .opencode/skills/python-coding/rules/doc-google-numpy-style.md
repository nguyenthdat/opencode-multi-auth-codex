# doc-google-numpy-style

> Use a single consistent docstring convention (Google or NumPy style) across the codebase

## Why It Matters

Docstring tooling (Sphinx's `napoleon` extension, `pdoc`, IDEs) parses specific section headers to render formatted parameter lists, return types, and exceptions — and it can only do that correctly if every docstring in the project uses the *same* convention. Mixing Google-style (`Args:`, `Returns:`) and NumPy-style (underlined `Parameters\n----------`) in the same codebase means some docstrings render beautifully in generated docs and others render as a wall of unstructured text. Picking one convention and enforcing it (via `ruff`'s `pydocstyle` rules or `darglint`) also makes docstrings easier to write from muscle memory, since contributors don't have to guess which style applies file-to-file.

## Bad

```python
def calculate_discount(price, rate):
    """Calculate a discounted price.

    :param price: original price
    :param rate: discount rate between 0 and 1
    :return: discounted price
    """
    return price * (1 - rate)


def apply_tax(amount, tax_rate):
    """Apply tax to an amount.

    Parameters
    ----------
    amount : float
        The pre-tax amount.
    tax_rate : float
        Tax rate between 0 and 1.

    Returns
    -------
    float
    """
    return amount * (1 + tax_rate)
```

Two different conventions (`:param:` reST-style and NumPy-style) in the same module — pick one.

## Good

Google style, applied consistently:

```python
def calculate_discount(price: float, rate: float) -> float:
    """Calculate a discounted price.

    Args:
        price: Original price before discount.
        rate: Discount rate between 0 and 1.

    Returns:
        The discounted price.
    """
    return price * (1 - rate)


def apply_tax(amount: float, tax_rate: float) -> float:
    """Apply tax to an amount.

    Args:
        amount: The pre-tax amount.
        tax_rate: Tax rate between 0 and 1.

    Returns:
        The amount including tax.
    """
    return amount * (1 + tax_rate)
```

## NumPy Style, as an Equally Valid Alternative

```python
def calculate_discount(price: float, rate: float) -> float:
    """Calculate a discounted price.

    Parameters
    ----------
    price : float
        Original price before discount.
    rate : float
        Discount rate between 0 and 1.

    Returns
    -------
    float
        The discounted price.
    """
    return price * (1 - rate)
```

NumPy style is the convention of choice in the scientific Python stack (`numpy`, `pandas`, `scipy`); Google style is more common in application/service codebases. Either is fine — consistency within one project is what matters.

## Enforcing It

```toml
# pyproject.toml
[tool.ruff.lint]
select = ["D"]  # pydocstyle
[tool.ruff.lint.pydocstyle]
convention = "google"  # or "numpy"
```

## See Also

- [`doc-all-public-api`](doc-all-public-api.md) - what must be documented, once a style is chosen
- [`doc-raises-section`](doc-raises-section.md) - the `Raises:`/`Raises` section within the chosen convention
- [`doc-type-hints-not-docstring-types`](doc-type-hints-not-docstring-types.md) - keeping type info out of the docstring body

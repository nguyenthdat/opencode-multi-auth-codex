# proj-package-by-feature

> Organize packages/modules by feature or domain, not by technical layer

## Why It Matters

Organizing by technical layer (`models/`, `views/`, `serializers/`, `utils/`) scatters everything related to a single feature across many top-level directories, so adding or understanding one feature (say, "invoicing") requires jumping between five unrelated directories instead of looking in one place. Organizing by feature/domain keeps everything about a capability co-located, makes the module boundary match the mental model of the business problem, and makes it much easier to delete or extract a feature wholesale later.

## Bad

```
myapp/
├── models/
│   ├── user.py
│   ├── invoice.py
│   └── order.py
├── views/
│   ├── user_views.py
│   ├── invoice_views.py
│   └── order_views.py
├── serializers/
│   ├── user_serializer.py
│   ├── invoice_serializer.py
│   └── order_serializer.py
└── services/
    ├── user_service.py
    ├── invoice_service.py
    └── order_service.py
```

## Good

```
myapp/
├── users/
│   ├── __init__.py
│   ├── models.py
│   ├── views.py
│   ├── serializers.py
│   └── service.py
├── invoicing/
│   ├── __init__.py
│   ├── models.py
│   ├── views.py
│   ├── serializers.py
│   └── service.py
└── orders/
    ├── __init__.py
    ├── models.py
    ├── views.py
    ├── serializers.py
    └── service.py
```

## When Layer-Based Grouping Still Makes Sense

For very small applications (a handful of models total, one team, no meaningful feature boundaries yet) a layer-based split can be simpler and premature feature boundaries can add ceremony without payoff. It's also normal to keep genuinely cross-cutting infrastructure — auth middleware, a shared `db` connection module, common `exceptions.py` — in a top-level `core/` or `shared/` package rather than forcing it into a feature folder it doesn't belong to:

```
myapp/
├── core/          # genuinely cross-cutting: db session, settings, base exceptions
├── users/
├── invoicing/
└── orders/
```

The test is whether a change to one feature (adding a field to `Invoice`) requires touching files outside that feature's directory — if it consistently does, the boundaries are probably drawn wrong.

## See Also

- [`proj-src-layout`](proj-src-layout.md) - where this feature-based tree sits inside the package
- [`anti-god-object`](anti-god-object.md) - the layer-based split's tendency to produce oversized shared modules
- [`name-module-short-lowercase`](name-module-short-lowercase.md) - naming the feature packages themselves

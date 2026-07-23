# Documentation Index

This index distinguishes current operating documentation from dated phase
records. Current code and tests win whenever a historical report disagrees.

## Current References

1. `README.md`
   Primary installation, behavior, API, environment, troubleshooting, and
   release documentation.
2. `SECURITY.md`
   Current dashboard boundary, local threat model, and credential handling.
3. `OPENCODE_SETUP_1TO1.md`
   Current OpenCode/plugin/TUI/React-dashboard setup.
4. `SANDBOX_QUICK_REF.md`
   Isolated local testing without touching live accounts.
5. `TEST_EXECUTION_PLAN.md`
   Automated gates, manual React checks, packaging, and long-soak limitations.
6. `codextesting.md`
   Manual React dashboard and live OpenCode/Codex checklist.
7. `CONTRIBUTING.md`
   Source layout and pull-request verification requirements.

## Historical Records

These documents preserve results and decisions from a particular phase. They
must not be used as current release evidence unless a newer dated validation
explicitly says so:

- `IMPLEMENTATION_PLAN.md`
- `docs/ADMIN_MERGE_BRIEF.md`
- `docs/PHASE_H_VALIDATION.md`
- `docs/QA.md`
- `docs/PHASE_REVIEW.md`
- `docs/PRODUCTION_READINESS.md`
- `docs/gpt-5.4-fast-benchmark.md`

Several historical records predate the React 19 migration and refer to the old
inline dashboard implementation in `src/web.ts`.

## Current Dashboard Architecture

```text
Browser
  |-- GET /dashboard.js  -> dist/web-ui/dashboard.js
  |-- GET /dashboard.css -> dist/web-ui/dashboard.css
  `-- /api/*             -> src/web.ts

web-ui/main.tsx + web-ui/dashboard.css
  -> bun run build
  -> dist/web-ui/*
```

`src/web.ts` owns the HTTP shell, static asset routing, request security checks,
and APIs. React components and styles belong under `web-ui/`. Generated files
under `dist/` must never be hand-edited.

## Rule of Precedence

1. Current source code and tests.
2. `README.md` and `SECURITY.md`.
3. Current runbooks listed above.
4. Dated historical phase records.

## Documentation Update Policy

- Update `README.md` for user-visible behavior.
- Update `SECURITY.md` for boundary or credential-handling changes.
- Update `web-ui/` architecture and `dist/web-ui/` build details together.
- Update test runbooks when scripts or actual coverage changes.
- Update `docs/images/react-dashboard.png` when the dashboard design changes
  materially, using illustrative data only.
- Add a new dated validation record for new evidence; do not rewrite old test
  counts or phase outcomes.

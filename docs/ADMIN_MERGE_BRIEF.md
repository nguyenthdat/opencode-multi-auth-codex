# Admin Merge Brief

> Historical pre-React merge brief. UI source locations, bundle paths, test
> counts, and verification results below describe that patch at the time. The
> current UI lives in `web-ui/` and builds to `dist/web-ui/`.

## Summary

This update hardens account rotation behavior and dashboard controls for multi-account Codex usage:

- Accounts that hit rate limits are slept until reset instead of being retried immediately.
- Force Mode is strict (no silent fallback to another alias when force is active).
- Rotation strategy control is visible next to Force Mode in dashboard.
- Runtime account selection now follows persisted dashboard strategy changes reliably.
- Dashboard now explains Force Mode and strategy behavior via mouseover help.
- Enabled/disabled account toggles are enforced in rotation eligibility.

## Why this matters

- Reduces wasted retries on exhausted accounts.
- Makes forced-account testing deterministic.
- Prevents confusion where UI setting changed but runtime behavior did not.
- Improves operator clarity during live testing.

## Key behavior changes

1. Limit sleep until reset

- On `429`, code computes `rateLimitedUntil` from:
  - `Retry-After`
  - known rate-limit window reset times
  - provider reset text in error message
  - fallback cooldown
- Rotator excludes any account with `rateLimitedUntil > now`.

2. Force Mode strict pinning

- When Force Mode is active, requests only target the forced alias.
- If forced alias is blocked (for example rate-limited), request fails with deterministic error instead of falling back.
- Force state auto-clears only on expiry/removal/disabled account, not transient ineligibility.

3. Runtime strategy reliability

- Rotation reads runtime settings used by dashboard persistence.
- Strategy updates from `/api/settings` apply to selection logic immediately.
- Legacy strategy field is kept in sync for compatibility with force-state restore.

4. Dashboard UX improvements

- Strategy selector appears next to Force Mode.
- Hover/mouseover help explains each strategy and Force Mode interaction.
- Weighted round-robin tooltip now explains percentage behavior with example and skip rules.

## Compatibility and risk

- Backward compatible for existing stores.
- No destructive migrations introduced in this patch set.
- Main risk area is strategy precedence across env overrides vs persisted settings; this update makes runtime behavior deterministic from persisted settings for dashboard operations.

## Verification executed

Run locally in repo root:

```bash
npm run lint
npm run test:unit
npm run build
```

Latest observed results:

- `lint`: pass
- `test:unit`: pass (9 suites, 125 tests)
- `build`: pass

Live checks performed against local dashboard (`127.0.0.1:3434`):

- Strategy toggle reflected in `/api/state` and restored successfully.
- New tooltip strings confirmed in served `dist/web.js`.

## Recommended reviewer focus

1. `src/index.ts` and `src/rate-limits.ts`: `429` handling and reset inference.
2. `src/rotation.ts` and `src/force-mode.ts`: strict force semantics and runtime strategy path.
3. `src/settings.ts`: runtime settings precedence and sync semantics.
4. `src/web.ts`: strategy/force UI placement and tooltip copy.

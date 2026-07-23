# OpenCode VPS Hardening Notes (Safari + HTTP)

> Scope: these notes apply to the upstream OpenCode browser application, not
> this plugin's localhost React dashboard. Do not apply hashed `session-*.js` or
> `assets/index-*.js` patching procedures to `dist/web-ui/dashboard.js` or
> `dashboard.css`. Remote exposure of the plugin dashboard is unsupported.

This repo is a *plugin*, but we keep VPS ops notes here because these issues are easy
to forget and painful to rediscover.

## Symptoms (seen in Safari over plain HTTP)

- File attach / drag-and-drop fails with:
  - `TypeError: crypto.randomUUID is not a function`
- Copy/share fails with:
  - `TypeError: undefined is not an object (evaluating 'navigator.clipboard.writeText')`
- Sessions sometimes "load forever" after a bad deployment/change:
  - `SyntaxError: Unexpected token '}' ...` (often a cached/broken chunk)

## Root Causes

- On `http://` Safari often lacks `crypto.randomUUID()` (or provides `crypto` without
  `randomUUID`) depending on OS/browser version and secure context.
- On `http://` Safari often does not expose `navigator.clipboard` at all.
- If you override a hashed chunk (e.g. `session-*.js`) and produce a broken file, the
  browser can cache it and keep failing until cache is bypassed.

## Recommended Fix Strategy (Minimal + Robust)

1. Do *not* rewrite/override `session-*.js` chunks.
   - Instead, proxy them from the upstream OpenCode server and force
     `Cache-Control: no-store` to avoid sticky caching of a bad module.

2. Patch only the main bundle `assets/index-<hash>.js` (the entry module) to add:
   - a `crypto.randomUUID` polyfill fallback
   - a clipboard fallback that works on `http://` (textarea + `document.execCommand('copy')`)

3. If you run upstream behind nginx basic-auth, inject the upstream `Authorization`
   header at nginx so the browser doesn't need to send it to `127.0.0.1` upstream.

Files in this folder:

- `ops/opencode-vps/nginx-opencode.conf.example`: nginx server block template
- `ops/opencode-vps/scripts/patch-opencode-web.sh`: helper to patch the main bundle

## Operational Notes

- If the server "randomly died" during heavy tasks, check systemd logs for OOM:
  - `journalctl -u opencode --no-pager | rg -n \"OOM killer|oom-kill\"`
- If a session is "stuck loading", a quick mitigation is opening in a private tab.
  A proper mitigation is `no-store` on the session chunk route as described above.

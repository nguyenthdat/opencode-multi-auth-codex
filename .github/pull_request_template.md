## Summary

- Describe the change.

## Verification

- [ ] `bun run lint`
- [ ] `bun run build`
- [ ] `bun test`
- [ ] `uv run --with 'python-dotenv>=1.2.1,<2' python -m unittest auto-login/test_auto_login.py` when `auto-login/` changed
- [ ] `bun audit`
- [ ] `npm pack --dry-run` includes `dist/web-ui/dashboard.js` and `dist/web-ui/dashboard.css`
- [ ] Generated `dist/` output is current
- [ ] React desktop/mobile behavior checked when `web-ui/` changed
- [ ] Documentation and dashboard screenshot updated when UX changed

## Release Impact

- [ ] No release required
- [ ] Patch
- [ ] Minor
- [ ] Major

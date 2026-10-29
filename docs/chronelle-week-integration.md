# Chronelle Week View Integration

Released with Frienden 2026.10.30.3 on 2026-10-30.

The OAuth v2 embed in the adjacent Chronelle backend now provides day/week
switching, Monday-based week navigation, per-day all-day entries, and timed
selection within any visible day. It still emits one bounded day/time range
for Frienden's existing meeting flow. Partial coverage remains unknown rather
than being treated as free time; expired or denied permissions hide the grid.

Only these provider runtime files were deployed:

- `oauth_platform/embed_bridge.mjs`
- `oauth_platform/display.py`
- `oauth_platform/embed_shell.html`
- `oauth_platform/embed_week.css`

The deployment verified the previous file hashes, preserved a protected backup
at `/home/ubuntu/apps/chronelle/backups/embed-week-20261030-005834`, ran Django
checks, and restarted only the backend service. No migration, credential change,
grant change, or user event write was performed. Both public Chronelle origins
were checked for exact script/style matches and the existing CSP/no-store headers.

Provider regression commands:

```sh
node --test scripts/test-oauth-week.mjs
TESTING=1 .venv/bin/python manage.py test oauth_platform --noinput
```

The provider's local OAuth directory was already untracked and its repository
has no remote. Its unrelated work was not staged or published. Runtime publication
was a reviewed four-file overlay, not a Git deployment.

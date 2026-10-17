# Update readiness and reports

Update checks query both public release endpoints, but installation always verifies
the current origin. Discovery never triggers navigation or activates a worker.

On explicit installation, verify release metadata, a cache-busted `/index.html`
release marker, its module/preload/style resources, worker installation and the
worker's own `GET_RELEASE` response. Worker update fetches retry once. Timeouts and
version mismatches stop before navigation; no unregister or cache deletion is used.
A successful check navigates to the same route with a version query parameter.
The next boot compares the bundled running version against the saved target.

Failures offer a user-triggered upload through the existing debug-report endpoint.
Existing verified-account requirements, administrator-only reads/deletes, six-hour
retention and five-report limit are unchanged. No bearer tokens, URLs, chat text,
cookies or arbitrary exception messages are included. There is no automatic upload.

Reports use `event: update`. Stages: 1 start, 2 current site, 3 HTML version,
4 resources ready, 5 worker installation, 6 worker version, 8 successful reboot,
9 failure, 10 fetching HTML, 11 fetching resources, 12 fetching worker (`retry`),
13 resource response (`httpStatus`, `offlineFallback`).
`site`: 1 primary/other, 2 mirror. Version metrics may be null.

Failure codes: 0 network/unknown, 1 site not ready, 2 resource unavailable,
3 HTML mismatch, 4 missing entry, 5 unexpected origin, 6 invalid resource type,
7 worker fetch timeout, 8 worker not ready, 9 worker version mismatch,
10 activation timeout, 11 worker message failure.

Deploy backend support before encouraging report uploads. Existing layout reports
remain valid; no database migration is necessary. Clients predating this change
cannot gain the diagnostics until they successfully load the updated frontend.
Only bootstrap dependencies are probed; this is not a full offline installation
of every lazily loaded page.

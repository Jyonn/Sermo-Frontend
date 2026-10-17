# Chronelle day navigation — local review

This change remains local; do not push master or publish until requested.

The shared `ChronelleCalendar` remains inside `UserProfilePanel`. Previous/next controls change the selected local date by one calendar day; Today resets to the current local day. The week strip, month heading and dated agenda derive from this same date. Switching weeks aborts the old request and ignores late responses. Data is keyed by calendar and week to prevent stale contents crossing calendars.

Timed entries show both endpoints and explicit dates outside the selected day. All-day intervals keep their all-day label. The compact bar clips intervals to local midnight boundaries and merges overlapping busy periods. An optional, initially collapsed timeline uses actual elapsed duration between local midnights, including 23/25-hour DST days. Its labels are local clock times.

Privacy: anonymous GET `/api/events/?share=…` uses `credentials: omit`; no read key, authorization request or invitation is created. Locked rows strip title/location in normalization. Chronelle's `calendarapp/test_access.py` and event handlers confirm anonymous public details and optional locked busy rows; hidden events may be omitted. Therefore hatched gaps are explicitly **not guaranteed free**. Loading/error never renders the availability bar. No availability-completeness contract is inferred.

Local review: `http://127.0.0.1:5176/tmp/chronelle-review.html` (Vite on localhost). The untracked fixture uses synthetic busy, overlapping, cross-midnight and all-day entries and blocks other fetches. Production bundling excludes the fixture. Review previous/next, Today, week-boundary navigation, disclosure, narrow viewport and dark mode. Browser UI validation is pending: the current execution environment does not provide the in-app browser; no user production tab was repurposed.

Validation: `node --test tests/chronelleAgenda.test.ts` (7 tests); `npm run build`. No backend changes, migration, external write or deployment.

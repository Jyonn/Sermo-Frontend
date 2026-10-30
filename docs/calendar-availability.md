# Shared calendar availability

The profile calendar and the direct-chat calendar popover use `CalendarAvailabilityBar`.
Busy intervals are normalized, clipped to the selected local day and merged.
Per the product decision on October 20, 2026, gaps between returned intervals
are displayed as free in both contexts. This is a display convention over the
permission-filtered projection, not a change to Chronelle's visibility or authorization.

Busy periods use muted green on an 8px track. Past time is gently faded without
hatching. Today's track has a single 1px vertical now marker with no visible
time label, refreshed every 30 seconds and when the page becomes visible. Day
fractions use actual midnight boundaries, including 23/25-hour DST days.

Direct chats no longer render a strip between the header and pins. A calendar
button matching the adjacent details button appears to its left on both mobile
and desktop. Its six calendar cells and sage/ochre/clay color summarize today's
busy fraction (light below 3 occupied hours, balanced below 8 hours, full from
8 hours onward). The ring and percentage use the actual local-day duration.
A status dot supplements
the accessible label; the popover also uses explicit text and a clock/check glyph.
Only ordinary direct chats qualify. Both the header and profile read
`/users/{ownerId}/chronelle/calendar` through the authenticated API transport.
The backend resolves the current OAuth binding and viewer-specific permissions;
the header does not require a friendship or a retired public calendar ID.

While visible, a single resource shared by both header buttons refreshes binding,
permissions and the next three local days' events
once per minute. Hidden pages stop requests. Returning to the page revalidates;
changing account, peer or local date cannot display the preceding scope's data.
Hidden/unbound results remove the button; failed reads show a neutral unavailable
state, never an empty/free day. Partial visibility keeps the calendar accessible
but suppresses complete busy/free summaries, load ratios and forecasts.
Header and profile use the same projection normalizer, strip locked event titles
and locations, and do not cache OAuth calendar responses. Retired share-ID reads
and unused legacy binding methods have been removed from the frontend.
No backend schema, OAuth scopes or plugin permissions change.

The popover shows the current busy/free state, merged busy interval end and next
real free window. Adjacent and overlapping periods are merged before forecasting.
All-day and overnight intervals retain their actual endpoints. A free period
with no further busy record today is described as free for the rest of today,
not indefinitely. The full shared `ChronelleCalendar` expands inside the same
popover; it is not a second calendar implementation. Escape, outside pointer/
focus and a close button dismiss the panel. Position and maximum scroll height
follow the visual viewport, including mobile keyboards. Account, peer, calendar
or local-day changes close the existing popover before paint.

Focused validation:

```sh
node --test tests/calendarAvailability.test.ts tests/chronelleAgenda.test.ts
npm run build
```

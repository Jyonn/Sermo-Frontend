# Shared calendar availability

The profile calendar and the direct-chat header use `CalendarAvailabilityBar`.
Busy intervals are normalized, clipped to the selected local day and merged.
Per the product decision on October 20, 2026, gaps between returned intervals
are displayed as free in both contexts. This is a display convention over the
existing public API, not a change to Chronelle's visibility or authorization.

Busy periods use muted green. Past time has a faded hatched overlay; hatching
no longer represents unknown availability. Today's track includes an HH:mm
marker, refreshed every 30 seconds and when the page becomes visible. Day
fractions use actual midnight boundaries, including 23/25-hour DST days.

The direct-chat variant is 10px tall, square-edged and placed between the
conversation header and the pin bar, without outer padding or margin. It is
only mounted for ordinary direct chats. The authenticated friends list must
contain the peer and a valid public calendar ID before a public calendar read
is attempted. An existing conversation alone does not grant eligibility.

While visible, the chat strip refreshes friendship, binding and today's events
once per minute. Hidden pages stop requests. Returning to the page revalidates;
changing account, peer or local date cannot display the preceding scope's data.
Unbound/non-friend/error results remove the strip. A failed request is never
rendered as an empty/free day. Public calendar reads use `credentials: omit`
and no authorization headers or read keys. Locked event titles and locations
remain stripped. No backend schema, OAuth scopes or plugin permissions change.

Focused validation:

```sh
node --test tests/calendarAvailability.test.ts tests/chronelleAgenda.test.ts
npm run build
```

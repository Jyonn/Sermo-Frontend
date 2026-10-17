# Frienden OAuth UI review — local draft 2026.10.17.18

Scope: frontend presentation only. Browser acceptance completed; user-approved release
is ready for publication. No backend, endpoint,
database, registry policy, grant or consent behavior is changed. Existing user changes
in `logos/frienden/preview.html` are excluded.

## Information design

The platform's existing dark green sidebar, light paper panels, compact headings,
orange accent and directory/list rhythm are retained. The primary OAuth surface is
now an application directory: search, All/Pending/Enabled/Disabled filters, pending
count, state badges and one Add action. A row shows application name, public client ID,
state and approved permission/callback counts. No create form, raw JSON, internal
revision ID or expanded history is shown on the primary screen.

Selecting a row uses the shared SideDrawer on desktop and BottomSheet on mobile.
Configuration, revision history and audit are separate detail tabs. A pending rename
does not replace the approved display name/counts in the directory. Selecting a history
entry displays only that configuration. Public client IDs remain available because
developers need them; internal database IDs and concurrency versions stay in requests.

Editing replaces detail content in the same surface. Approve/reject/submit and disable/
restore replace it with a focused confirmation, not another overlay. Rejection requires
a reason and HTTP loopback approval requires its exact exception checkbox. Platform
direct creation reviews the requested permissions before its final confirmation.
Closing a dirty editor switches to an inline discard choice; Escape there returns to
editing. The panel traps Tab focus and restores the originating row/button when closed.

Developer use reuses the existing member drawer and switches its content inline;
it does not create an additional detail or confirmation overlay. Only platform mode
renders review/disable controls. All mutations retain the existing `version` and
`revision_id` contract; a failed mutation keeps the editor/review open and values intact.

## Verification status

- PASS: `node --test tests/oauthApplicationPresentation.test.ts tests/oauthClients.test.ts`
  (4 tests: approved-vs-pending presentation, filters/empty revisions and callback safety).
- PASS: `npm run build`, including stylesheet architecture checks and TypeScript.
- PASS: `git diff --check`.
- PASS: actual published-source vs new-source desktop and 390px screenshots, using the
  same four synthetic applications and actual existing platform-console layout.
- PASS: pending filter, application-name/client search, one detail surface, approve/
  reject confirmation and rejection disabled until a reason is entered. Cancellation
  leaves the pending application unchanged; no production application was reviewed.
- PASS: Tab/Shift+Tab wrap between first and last panel controls; Escape closes detail
  and restores its originating row. Dirty-editor Escape shows a single discard choice;
  Keep editing retains client ID/name/callback.
- PASS: synthetic save error retains all form values. Returning from confirmation to
  the editor preserves them; retry after synthetic recovery succeeds and restores
  focus to Add. No production API is used by the fixture.
- PASS: phone page scroll width equals viewport width (390px); detail is one bottom
  sheet. Configuration/history/audit tabs render individually, and Escape and the close
  button return focus to the application row.
- PASS: actual local preview marker was refreshed and read as `2026.10.17.18`; the
  initial dev-server marker had cached .17 at startup while HMR displayed the new source.
  Build output is .18. Production remains unchanged until the approved publication.
- REVIEWED: member mode keeps inline detail inside its existing member surface and
  platform review/disable actions remain guarded by the existing `platform` mode.
  Backend permission enforcement and API contracts are untouched.

Screenshots are saved at `/Users/jyonn/Projects/Apps/Sermo/artifacts/oauth-ui-review/`:
`before-desktop.png`, `after-desktop.png`, `before-mobile.png`, `after-mobile.png`,
`after-mobile-sheet.png`. The earlier extension interference was intermittent; the
critical checks above were actually completed after the user selected the local page.

The currently published source `af88051` was frozen at
`/tmp/frienden-oauth-before` with the same synthetic fixture so accurate before captures
can still be produced after the browser is available. Temporary loopback servers are
5177 (published baseline) and 5176 (new source), both at `/tmp/oauth-design-qa.html`.
These fixtures render the existing App/router/platform console with synthetic records
and blocked external API requests. They are QA surfaces, not new product websites.
No production session or online authorization record is used.

## Acceptance checklist used

1. Capture published baseline and new directory at desktop and 390px, plus new detail
   and mobile bottom sheet. Compare with existing Overview/Spaces/Audit tabs.
2. Check search and pending filter; only the selected row's configuration should open.
3. Tab/Shift+Tab remain in the surface, Escape closes detail, focus returns to its row.
4. Dirty edit → Escape → Keep editing retains values; Discard returns to the directory.
5. Pending review → Approve/Reject shows one confirmation surface; reject is blocked
   without reason and loopback approval is blocked without explicit confirmation.
6. Toggle synthetic save failure: values/review note remain and retry recovers. Cancel
   never sends a mutation. Ordinary member mode has no platform review/disable actions.

## Proposed release scope

Frontend-only release 2026.10.17.18: shared OAuth directory/detail/editor UI, its scoped
styles, presentation helpers/tests, translations and concise release notes. Existing
platform page embeds the same shared component. No backend or database release is
needed. The user has now authorized publication conditional on successful audit UI
checks; the checks above meet that condition. Only this frontend UI and its review
record may be pushed/published. No backend reload, migration, registry mutation or
grant change is part of this release.

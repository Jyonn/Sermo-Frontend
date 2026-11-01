# Private chat history management

The search Drawer title opens a full-viewport management layer in the same tab.
The chat and search remain mounted, retaining drafts, filters and scroll positions.
The shared Drawer history stack handles browser/PWA back navigation. A guarded
`/app/chats/:chatId/history` route remains available for direct links.

Records are grouped by Shanghai calendar date and rendered in one to four columns.
The initial request returns at most 100 compact records; older pages load only on
explicit request. No media originals are fetched by the manager. Keyword, multiple
types (including system, official and invitation records), date range and private
protection filters share the server's query policy for browsing, preview and cleanup.

Optional daily clock bounds use UTC+8, independently of the selected calendar dates.
The start is inclusive and the end exclusive; an end earlier than the start denotes
an overnight range (for example 22:00–02:00). A single bound limits only that side.
Equal bounds are rejected; clear the time filter for all day. These bounds apply to
the list, preview, selected/day cleanup and protection actions through the same query.

Selection supports click, Shift ranges, rectangle intersection, additive Ctrl/Meta
drag, Ctrl/Meta+A for loaded records and explicit touch drag mode. Selection is
limited to 500 records. Whole-day/filtered cleanup applies to all matching server
records, including pages not loaded by the browser, in bounded 500-record batches.
Progress and a stop-after-current-batch action remain available during cleanup.

“Keep” is an account-private server marker, separate from shared chat pins. Both
the manager and existing bulk-delete/clear entry points skip these markers. Release
protection before deleting kept records. The marker survives device changes and
history recovery. It does not prevent an explicit individual delete-for-me action.

Cleanup requires a preview with a snapshot ceiling. Newer records are excluded,
protection and permissions are rechecked for every mutation, and all deletions use
per-user hidden states plus targeted sync events. Original messages, peer views and
shared media objects remain untouched. Existing account recovery allowances apply;
the manager does not grant extra recovery attempts or promise an unlimited undo.

Validation: backend history-management, recovery and forwarding suites; frontend
date-boundary, rectangle-intersection, range-selection and type-coverage tests;
production build; synthetic-data browser checks for desktop/mobile, private keep
versus day cleanup, same-tab return, dark mode and no horizontal overflow.

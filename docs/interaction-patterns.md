# Frienden Interaction Patterns

Preview: `/design/interactions` (no sign-in required; examples never call business APIs).

## What The Video Establishes

The supplied 2:48 video distinguishes seven patterns, not seven skins for the same Drawer. Content, actions, undo, irreversible decisions, guided discovery, image viewing and field validation require different interruption levels. The closing family chart also names eleven familiar patterns; this change does not replace those with duplicate implementations.

| Pattern | Implementation | Contract |
| --- | --- | --- |
| Bottom Sheet | Existing `BottomSheet`, opt-in `snapPoints` / `initialSnap` | Fractions of viewport height, normalized to 20–90%; the demonstrated stops are 30/60/80%. Header/handle gestures do not hijack body scrolling. Down past half the smallest stop dismisses; handle click supports keyboard users. Desktop stays a centered modal. Existing callers keep their previous content-sized sheet. |
| Action Sheet | `ActionSheet` | Short `SheetAction[]`, explicit labels, optional icon/description, red danger, independent Cancel. Async actions disable duplicates, keep errors visible, close only after success. A dangerous item is not a substitute for final confirmation. |
| Snackbar | `Snackbar` | Caller supplies a **real** `onAction` undo operation. At least four seconds, default six; pause on hover, focus and backgrounding. Failed undo remains visible for retry. A local demo is not a backend recovery promise. |
| Alert Dialog | `AlertDialog` over shared `ConfirmDialog` | `alertdialog` role, labelled/described, cancel focused first, focus trap/restore. Outside click and Escape cannot dismiss. Global Enter-to-confirm removed; a focused explicit button retains normal keyboard activation. Busy blocks duplicate/cancel operations. |
| Tour | `Tour` | Target getter per step, responsive spotlight/card placement, Back/Next/Skip, Escape and focus restoration. Missing targets fall back to a centered card. No automatic production launch or persistent completion tracking is imposed. |
| Lightbox | Existing `ImageLightbox` / `MediaLightbox` | No second viewer. Preserve the photo archive, metadata, zoom, download, video and fullscreen immersion. |
| Inline Alert | `InlineAlert` | Persistent info/success/error feedback. Fields connect via `aria-describedby` and `aria-invalid`; errors remain until corrected or retried, not an expiring Toast. |

All components use existing Frienden colors, typography and controls, Chinese/English keys and reduced-motion support. Overlays share `useModalFocus` to prioritize the top layer and restore the opener. Existing nonmodal Drawer navigation and image-viewing behavior are preserved.

## Implemented Product Changes

1. Menu → bind more contact methods now uses Action Sheet instead of a generic content sheet. Existing binding routes and permissions are unchanged.
2. Final account-deletion confirmation now uses Alert Dialog. Verification, final API enforcement and explicit cancellation remain intact; no account is deleted by opening or dismissing a preview.
3. Friend search failures remain next to the search field via Inline Alert, with accessible error association; editing the query clears stale feedback.
4. All existing Confirm Dialogs and Bottom Sheets receive shared focus containment/restoration. Confirmation no longer fires from an arbitrary Enter press, and busy dialogs cannot close through the backdrop or Escape.

## Next Adoption Opportunities

| Priority | Existing scene | Recommended component | Boundary / prerequisite |
| --- | --- | --- | --- |
| P1 | Avatar source / attachments source | Action Sheet | Keep file input, upload progress and permission errors in their existing flows; source selection alone belongs in this sheet. |
| P1 | Mobile message more menu / cloud file actions | Action Sheet | Adapt selection to screen size; desktop anchored menus may remain. Destructive actions still require policy-specific confirmation. |
| P1 | Nickname, invitation, contact fields, OAuth redirect URI | Inline Alert | Real server errors must bind to the right field; do not invent client constraints that diverge from backend policy. |
| P1 | Calendar preview in a conversation | Bottom Sheet with detents | Replace a cramped mobile popover only on mobile; preserve the desktop anchored calendar and timezone logic. |
| P2 | Comments preview | Bottom Sheet with detents | Suitable for quick preview while retaining the underlying post. Full statement detail already has carefully tuned full-height transitions and should not be replaced indiscriminately. |
| P2 | Local selected attachments / recoverable drafts / favorites | Snackbar | Use actual restore data or a delayed commit; coordinate multiple pending operations. Do not label a notification as Undo without a real action. |
| P2 | File deletion / group dissolution / critical unlinking | Alert Dialog | Describe what is lost and use an explicit verb. Do not silently strengthen every ordinary setting prompt. |
| P2 | First Square visit / calendar setup / BGM keychain | Opt-in Tour | Anchor only to visible live controls; record completion per user/feature only after defining persistence and revisit behavior. Never show repeatedly on every visit. |
| P2 | Duplicate image previews | Existing MediaLightbox | Unify adapters, not viewer copies; retain existing metadata and private-media URL handling. |

The remaining family chart patterns map to existing architecture: Modal/Popconfirm → `ConfirmDialog` and lightweight anchored confirmation where suitable; Drawer → `SideDrawer`; Toast → `AppToast`; Message/Alert → inline/global feedback; Notification → inbox / `GlobalMessageSync`; Tooltip/Popover/Dropdown → contextual hints, calendar popover and `SettingSelect`; Loading → `ContentLoader` / media wait states. They are different semantics, not aliases for a giant global popup.

## Verification

- Pure tests: snap normalization/release, responsive tour placement, localization, destructive-confirmation behavior and real integration contracts.
- Browser checks: pointer handle drag and 60/80% detents, keyboard Tab/Escape, action cancellation, real local undo, persistent validation, tour completion, Lightbox dismissal, 390px/desktop and light/dark. Physical iPhone touch, keyboard safe-area behavior and PWA installation remain device-level follow-up checks.
- Run `node --test tests/interactionPatterns.test.ts`, related regression suites and `npm run build`.

# Feedback State Audit

## Updated Surfaces

- Shared `FeedbackState`: no dashed outline or boxed info badge; compact typography, unboxed context icons, theme-aware soft surfaces, distinct loading/error/empty/success semantics and accessible announcements.
- All existing callers inherit the shared visual update: interaction quota, conversation information, submission invitations, verification guidance, profile availability, friend invitations, official login, account switching and administration states.
- Explicitly corrected neutral fallbacks for profile failures, activity failures and submission-invitation loading/failure. Empty member/post/mute lists now have contextual empty-state icons.
- Quota failures expose a retry using the existing `openQuota` fetch path. Loading has a labeled status instead of an unlabeled isolated spinner.
- Removed equivalent dashed borders from generic `.empty-state`, sticker loading failures, travel-map access overview empty hints, and permission-editor defaults/preview placeholders.

## Intentionally Retained

Dashed upload/add affordances, unearned badge/stamp placeholders, decorative avatar frames, deleted-message boundaries, recovery-code outlines, map check-in actions and editorial separators are not info/error panels. They retain their interaction or decorative semantics.

## Verification

`tests/feedbackState.test.ts` covers shared rendering, context icons, accessible roles, retry wiring, loading behavior and CSS regression guards. Verify narrow screens, long titles, light/dark surfaces and reduced motion when changing these styles.

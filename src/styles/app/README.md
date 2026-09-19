# Application style order

These files are loaded by the root `styles.css` in numeric order. The order is
intentional: later files currently contain compatibility overrides for earlier
components.

- `00-foundation.css`: original foundations, shared surfaces, early chat and
  application layouts.
- `10-chat-city.css`: city collections, settings primitives, activities and
  expanded chat layouts.
- `20-profile-settings.css`: profile surfaces, administration, stickers and
  ceremony layouts.
- `30-personalization.css`: message cards and bubble skin foundations.
- `35-avatar-frames.css`: the complete avatar-frame rendering protocol and its
  motion definitions.
- `39-personalization-tools.css`: personalization editors, character previews
  and the first Square refinements.
- `40-square-platform.css`: Square feed, campaigns, media inspection and
  platform administration.
- `50-chat-settings.css`: chat personalization, account binding and decorative
  wallpaper readability.
- `60-profile-themes.css`: profile themes, composer studies and shared profile
  geometry.
- `70-square-composer.css`: submission workflows, mobile composer behavior and
  Square comments.
- `80-chat-messages.css`: canonical message grouping, card alignment and
  transcript controls.
- `81-chat-moderation.css`: conversation moderation and submission-round state.
- `90-viewport.css`: shared fixed-viewport and safe-area behavior.
- `95-landing-facade.css`: the standalone public home page, including its
  light and dark letter-inspired presentation.

Do not move a rule between numbered files as part of an unrelated visual fix.
New shared structure belongs in the owning component file and theme paint stays
in a theme file. Do not add compatibility or override files: update the
canonical component rule and its responsive state together.

`npm run styles:check` is part of every production build. It rejects unregistered
modules, reordered imports and increases in duplicate selectors, duplicate
declarations, `!important` usage, oversized rules and selector complexity.

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
- `30-personalization.css`: message cards, bubble skins, avatar frames, motion
  previews and the first Square refinements.
- `40-square-platform.css`: Square feed, campaigns, media inspection and
  platform administration.
- `50-chat-settings.css`: chat personalization, account binding and decorative
  wallpaper readability.
- `60-profile-themes.css`: profile themes, composer studies and shared profile
  geometry.
- `70-square-composer.css`: submission workflows, mobile composer behavior and
  Square comments.
- `80-chat-overrides.css`: audited message grouping, card alignment, transcript
  controls and viewport compatibility fixes.

Do not move a rule between numbered files as part of an unrelated visual fix.
New shared structure belongs in the earliest suitable file; theme paint belongs
in a theme file; temporary compatibility rules must be documented in the final
override file. A later cleanup will replace compatibility overrides with the
canonical component rule after visual regression coverage is in place.

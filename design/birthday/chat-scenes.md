# 花间来日 · 聊天场景本地修订

## Current direction: painted stationery

The welcome illustration and welcome layout remain unchanged. The latest revision replaces the earlier gift stickers, sprite corner frame and repeated group bows. Those earlier studies below are historical, not the active design.

`BirthdaySurfaceArt` is attached to the actual shared `ConfirmDialog`, `BottomSheet` and `SideDrawer` shells. It is hidden outside the birthday skin and absent from destructive dialogs, fullscreen drawers and headerless media surfaces. Ordinary component content is unchanged. One static crop of the approved oil painting and native SVG silk curves establish the visual language; no new bitmap, timer or animation loop is added.

- Dialog: asymmetric paper corners, fine inset rule, a painted upper edge and silk thread below its rim.
- Sheet: folded paper surface, stitched rose handle and a painted corner outside the heading's text flow.
- Drawer: a full-height folio, with the painting and thread at the bottom; the scrolling body stays transparent to this separate art layer.
- Menu and Contacts: paper sections and sage controls, without a bow on every row. Profile artwork uses the same welcome painting.
- Chats: readable cream/sage bubbles and a quiet garden at the page edge. Existing selected backgrounds and bubble styles keep priority.

Chrome visual checks completed for desktop ordinary confirmation and notification sheet, mobile notification sheet, mobile dark drawer, and the real mobile group conversation. The dark drawer's opaque content-layer issue was corrected after inspection. Final follow-up inspection was limited by repeated Chrome accessibility timeouts; do not claim every surface has a final screenshot. Browser screenshots are actual UI captures, not generated mockups.

Branch: `design/birthday-chat-scenes`. This branch is for local review; do not deploy it without a separate request.

## Review

Use the isolated preview backend and frontend at `http://localhost:5190`:

- `/api/__birthday__/direct`: enter the birthday recipient's private conversation.
- `/api/__birthday__/group`: enter the four-person group.
- `/api/__birthday__/celebrate`: replay the welcome and two administrator letters.
- `/design/birthday/components.html`: shared Tab, Sheet, Drawer and Modal with a light/dark switch and real button styles.

All participants and messages are fictional, in the SQLite preview database. The entry helpers log into these local test accounts only. They are outside production routing. Both chats contain 24 messages and an inline reply, allowing long-scroll, avatar, multiline, composer and detail-panel checks. Sending stays within the isolated local database.

## Art direction

Gift revision: `assets/botanical-frame-v1.webp` is the previously generated gift/cake/floral frame. The component study clips its four corners at a fixed proportional scale, joins them with responsive CSS lines, and never stretches the complete bitmap. This reference frame remains local to the design gallery. Actual birthday components reuse the cloud-managed gift emblem: the sheet handle is a bow, drawers end with a gift, and modal stationery carries a gift on its rim.

Birthday profile revision: the first dialog shows the saved month/day and secondary actions only. Setting the date opens a separate five-row wheel view; letters have their own list and reader. Outer dialog surfaces allow overflow for four independent gift/flower corners, while only the content region scrolls. This keeps the gift intact and the overview short on mobile.

Ribbon revision: a shared vector bow and CSS ribbon edge wrap communication-entry groups, menu-link groups and shared setting groups. They sit on the group margin, outside labels and touch targets, scale without bitmaps, and use dusty rose in light mode and a lighter rose in dark mode. Sheets use a ribbon handle, drawers use a ribbon seam and dialogs use a ribbon-colored action divider. All decorative layers ignore pointer input; no ambient animation is added.

Keep the existing Frienden navigation, message geometry and personalization preferences. The birthday theme is a paper-warm garden: sage for actions and own messages, ecru for received messages, a quiet botanical illustration on the edge of the conversation. No decorative flower is appended to navigation titles, settings rows or dialog headings. Existing non-default chat backgrounds and bubble styles take priority.

The garden illustration is a single static layer, uses the existing cloud-managed asset, consumes no additional message space and cannot receive pointer events. Dark mode reduces its opacity. The welcome keeps its larger illustration and finite ribbons; no ambient animation runs while chatting.

## Header correction

Remove the previous global mobile-header override. Restore the shared sticky-header elevation logic: transparent at the top; a full-width background fades in with scrolling. The birthday skin changes the background tint, preserving the existing geometry, safe area and scroll measurement. Desktop navigation and settings headings remain clean.

## Fixture setup

From the backend directory, with `frienden_birthday_preview_settings` on `PYTHONPATH`, run:

```sh
python manage.py shell --settings=frienden_birthday_preview_settings -c "exec(open('../sermo-frontend/design/birthday/seed-chat-scenes.py').read())"
```

The seed refuses any database except `/private/tmp/frienden-birthday-final-preview.sqlite3`. It adds only named test conversations and reuses them on subsequent runs. It does not invoke message delivery or create production data.

HTTP checks and build validation do not substitute for the visual checks recorded above. Keep this branch local until the user requests deployment.

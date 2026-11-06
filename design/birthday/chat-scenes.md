# 花间来日 · 聊天场景本地修订

Branch: `design/birthday-chat-scenes`. This branch is for local review; do not deploy it without a separate request.

## Review

Use the isolated preview backend and frontend at `http://localhost:5190`:

- `/api/__birthday__/direct`: enter the birthday recipient's private conversation.
- `/api/__birthday__/group`: enter the four-person group.
- `/api/__birthday__/celebrate`: replay the welcome and two administrator letters.

All participants and messages are fictional, in the SQLite preview database. The entry helpers log into these local test accounts only. They are outside production routing. Both chats contain 24 messages and an inline reply, allowing long-scroll, avatar, multiline, composer and detail-panel checks. Sending stays within the isolated local database.

## Art direction

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

Browser visual verification is unavailable while local browser use is disabled. HTTP checks and build validation do not substitute for screenshot review.

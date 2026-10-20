# Campaign presentation

Campaign `config.presentation` is optional public metadata, returned by the existing activity API. No additional authentication or scope is introduced.

```json
{
  "palette": "sage",
  "artwork_layout": "keychain-sheet",
  "artwork_url": "/activity/bgm/keychains-v1.png",
  "title_art_url": "/activity/bgm/title-zh-v1.png"
}
```

Supported palettes: sage, rose, ocean, gold. Artwork defaults to a complete contained image; keychain-sheet uses the first half of the existing two-style sprite. Images must be root-relative or public HTTPS URLs without credentials. Never put private storage URLs or tokens here. Title artwork is used in Chinese; other languages retain the localized text title. Failed title images fall back to text. Unknown campaigns use a neutral card, not another event's artwork. The current BGM key also has a built-in fallback so existing messages work before API metadata is updated.

The Square banner and chat share card share ActivityCampaignCard. The Drawer title uses ActivityTitle. Publish versioned image files before updating metadata. Update only the presentation entry; do not re-register a live campaign or reset claims, dates or collection progress.

Backend maintenance command (does not restart the activity):

```sh
python manage.py configure_activity_presentation main-character-bgm-2026 --palette sage --artwork-layout keychain-sheet --artwork-url /activity/bgm/keychains-v1.png --title-art-url /activity/bgm/title-zh-v1.png
```

The BGM Chinese title artwork was generated with ImageGen: transparent horizontal exact lettering “主角登场”, forest-green rounded brush lettering, ivory outline, blush offset and restrained mint/pink sound accents. Keychain source/provenance remains documented under src/assets/activity/bgm/README.md.

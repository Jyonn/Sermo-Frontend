# Immersive Markdown interaction demo

Run `npx vite --host 0.0.0.0 --port 8805`, then open
`/demos/research/immersive-editor.html` (append `?dark` for dark mode).
Use the host computer's LAN address from a phone on the same network.

This is a standalone prototype, not a production route. It reuses the shared
Markdown editor and does not save to a real project. Drafts last only until reload.

On focus, the editor fills the visual viewport, the toolbar appears and page
chrome disappears. The Done action dismisses focus and restores the page.
VisualViewport resize/scroll events account for the software keyboard and iOS
viewport panning. The demo does not draw or emulate an operating-system keyboard.

Device checks still required: iOS Safari/PWA and Android keyboard opening,
IME composition, selection, toolbar horizontal scrolling, heading/table popovers,
keyboard dismissal and rotation while typing. Desktop viewport emulation checks
layout only, not the native keyboard lifecycle.

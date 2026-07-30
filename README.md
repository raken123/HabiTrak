# Miniphone — flip-case mini screen

A single-file HTML device mockup: the phone's front is an ordinary home screen, and
flipping the case over reveals a **mini screen** built into the case back that runs its
own tiny OS.

Open `index.html` in a browser. Click **Flip the case** (or press <kbd>F</kbd>).

## Mini screen features

| App | What it does |
| --- | --- |
| **Camera** | Live rear-lens viewfinder (`getUserMedia` with `facingMode: environment`), shutter with flash blink, front/back swap, torch where the hardware supports it, grid overlay, gallery of captured shots, download, and "send in Messenger". |
| **Messenger** | Its own chat list with unread badges, threads with bubbles and timestamps, composer, quick-reply chips, typing indicator and auto-replies. Conversations persist. |
| **Miniphone Settings** | Device name, 24-hour clock, always-on mini screen, haptics, brightness, five wallpapers, camera grid / mirror / shutter-flash toggles, messenger auto-reply and clear, storage + about, full reset. |

The mini home screen shows a clock, the date, a notification bubble for the newest
unread message, and app badges.

## Notes

- No build step, no dependencies, no network calls — one file.
- Everything (settings, photos, chats) lives in `localStorage` under `miniphone.v1`.
  Photos are cropped to 3:4 and stored at 480×640 JPEG, capped at 12 to stay inside quota.
- The camera stream is stopped whenever you flip back to the front or leave the app.
- The camera needs a secure context (`https://` or `localhost`); over plain `file://`
  most browsers still allow it, but some will block the permission prompt.
- On a touch device with motion sensors, turning the phone face-down flips to the mini
  screen automatically.
- Keyboard: <kbd>F</kbd> flips, <kbd>Esc</kbd> goes back / home.

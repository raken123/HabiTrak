# Miniphone — mini screen

A single HTML file that turns the phone's display into a **mini screen**: one rounded
square in the top-left corner runs a tiny phone OS, and the entire rest of the display
stays pure black. Flip the case over and that square is all you see.

Open `index.html` on the phone. On a desktop it renders inside a 390×844 stand-in so
the square keeps its real proportions.

## Where the square sits

The geometry comes straight from the reference photo — a **598 × 598 px square at
(20, 23)** on a 1170 px wide display:

| | fraction of display width |
| --- | --- |
| left | 20 / 1170 = 1.71 % |
| top | 23 / 1170 = 1.97 % |
| size | 598 / 1170 = 51.1 % |
| corner radius | 35 % of the square |

Those fractions are applied to whatever screen the page is on, so the square keeps its
place and shape. The mini UI is drawn on a fixed 200 × 200 canvas and scaled to fit,
and all content stays inside the rectangle that clears the rounded corners.

Browser chrome (address bar) pushes the viewport down, so **Settings → Screen fit** has
Left / Top / Size / Corner sliders to nudge the square onto the black area exactly, plus
a reset to the photo measurements. Adding the page to the Home Screen makes it run
fullscreen, where the defaults land on the mark.

## Apps

| App | What it does |
| --- | --- |
| **Camera** | Live rear-lens viewfinder (`getUserMedia` with `facingMode: environment`, with fallbacks), shutter with flash blink, front/back swap, torch where the hardware supports it, grid overlay, square shots, gallery, save, and "send" into Messenger. |
| **Messenger** | Chat list with unread counts, threads with bubbles and timestamps, composer, quick-reply chips, typing indicator, auto-replies. |
| **Miniphone Settings** | Screen fit, device name, 24-hour clock, wake lock, haptics, brightness, wallpapers, camera options, messenger options, storage/about, full reset. |

The mini home screen shows the clock, date, a one-line bubble for the newest unread
message, and an unread badge on Messenger.

## Notes

- No build step, no dependencies, no network calls — one file.
- State lives in `localStorage` under `miniphone.v2`. Shots are stored as 512 × 512 JPEG
  and capped at 12 so they can't blow the quota.
- The camera stream stops whenever you leave the app or the page is hidden.
- The camera needs a secure context — `https://` or `localhost`. Over `file://` most
  browsers still allow it, but some block the prompt.
- A screen wake lock keeps the mini screen lit while it's showing (toggle in Settings).
- <kbd>Esc</kbd> goes back / home.

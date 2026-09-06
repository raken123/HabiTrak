# Hazelnut Mini

One chat bar that removes things from photos. Windows, Mac and Android.
**Half the price of Hazelnut** — $9.99 a month against $19.99.

Attach a photo, say what should go (“the bin on the left”, “that guy in the
background”), and the picture that comes back becomes the working photo, so
removals stack up without a layers panel. Ask for anything that is not a
removal and Mini says so — and charges nothing, because nothing ran.

Each removal costs 20 credits, the same as Realtouch in the full app.

## Desktop

```bash
npm install        # from the repository root
npm run start:mini
npm run dist:mini  # .exe and .dmg
```

## Android

Mini's page is plain HTML and ES modules, so Capacitor ships it as-is. The
Android build has no main process to hide the key in, so it runs the same
`@hazelnut/core` engine in the page and keeps the key in `localStorage` — see
`www/js/web-bridge.js`.

```bash
npm install --include=optional          # pulls in the Capacitor CLI
npm run sync:core                       # copy the browser-safe core into www/vendor
npx cap add android                     # first time only
npm run android:sync                    # copy www/ into the Android project
npm run android:open                    # open it in Android Studio
```

`npm run android:build` does the sync and runs it on a connected device.

Requirements: Android Studio, JDK 17, and an SDK of API 34 or newer.

### What `sync:core` is for

`www/` is copied verbatim onto the device, so anything the page imports has to
live inside it. `scripts/sync-core.mjs` copies the browser-safe modules out of
`@hazelnut/core` into `www/vendor/core/`, and **fails** if one of them has
picked up a `node:` import since the last run — which is what stops a change in
`packages/core` from silently breaking the Android build.

The copies carry a generated-file header. Edit `packages/core` and re-run the
script; never edit `www/vendor/core` by hand.

## Saving

On desktop, a save opens the system dialog. On Android it goes through
`@capacitor/filesystem` into Documents when the plugin is installed, and falls
back to a browser download when it is not.

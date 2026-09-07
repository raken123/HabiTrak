#!/usr/bin/env bash
# Assemble a runnable Windows or macOS build from a prebuilt Electron runtime.
#
#   ./scripts/build-portable.sh hazelnut win32 x64      -> dist/Hazelnut-1.0.0-win-x64.zip
#   ./scripts/build-portable.sh hazelnut darwin arm64   -> dist/Hazelnut-1.0.0-mac-arm64.zip
#
# electron-builder is the normal route and produces a .exe installer and a .dmg.
# This is the fallback for machines that cannot reach the npm registry: it needs
# only curl, unzip, zip and node, and produces the app itself rather than an
# installer — a portable folder on Windows, a .app bundle on macOS.
set -euo pipefail

APP="${1:-hazelnut}"
PLATFORM="${2:-win32}"
ARCH="${3:-x64}"
ELECTRON_VERSION="${ELECTRON_VERSION:-33.4.11}"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORK="${WORK:-$ROOT/.build}"
DIST="$ROOT/dist"

case "$APP" in
  hazelnut)      NAME="Hazelnut";      SRC="$ROOT/apps/hazelnut";      PAYLOAD="electron renderer build"; ID="com.hazelnut.studio";;
  hazelnut-squirreal) NAME="Hazelnut Squirreal"; SRC="$ROOT/apps/hazelnut-squirreal"; PAYLOAD="electron build"; ID="com.hazelnut.squirreal";;
  hazelnut-mini) NAME="Hazelnut Mini"; SRC="$ROOT/apps/hazelnut-mini"; PAYLOAD="electron www build";      ID="com.hazelnut.mini";;
  *) echo "unknown app: $APP" >&2; exit 1;;
esac

VERSION="$(node -p "require('$SRC/package.json').version")"
DESCRIPTION="$(node -p "require('$SRC/package.json').description")"
RUNTIME="$WORK/electron-$ELECTRON_VERSION-$PLATFORM-$ARCH"
ZIP="$WORK/electron-$ELECTRON_VERSION-$PLATFORM-$ARCH.zip"

mkdir -p "$WORK" "$DIST"

if [ ! -d "$RUNTIME" ]; then
  echo "==> fetching Electron $ELECTRON_VERSION ($PLATFORM-$ARCH)"
  curl -sSL --retry 4 --retry-delay 2 -o "$ZIP" \
    "https://github.com/electron/electron/releases/download/v$ELECTRON_VERSION/electron-v$ELECTRON_VERSION-$PLATFORM-$ARCH.zip"
  rm -rf "$RUNTIME"
  unzip -q "$ZIP" -d "$RUNTIME"
fi

# The app payload is identical on every platform; only its home differs.
stage_app() {
  local appdir="$1"
  mkdir -p "$appdir"
  for dir in $PAYLOAD; do cp -a "$SRC/$dir" "$appdir/"; done
  # Squirreal has no renderer of its own: it runs Hazelnut's, so a packaged
  # build carries a copy of it rather than a second one to keep in step.
  if [ "$APP" = "hazelnut-squirreal" ]; then cp -a "$ROOT/apps/hazelnut/renderer" "$appdir/"; fi
  mkdir -p "$appdir/node_modules/@hazelnut"
  cp -a "$ROOT/packages/core" "$appdir/node_modules/@hazelnut/core"
  node -e "
    const pkg = require('$SRC/package.json');
    require('fs').writeFileSync('$appdir/package.json', JSON.stringify({
      name: pkg.name, productName: pkg.productName, version: pkg.version,
      description: pkg.description, type: pkg.type, main: pkg.main,
    }, null, 2));
  "
}

STAGE="$WORK/portable-$APP-$PLATFORM-$ARCH"
rm -rf "$STAGE"
mkdir -p "$STAGE"

if [ "$PLATFORM" = "win32" ]; then
  OUTDIR="$STAGE/$NAME"
  cp -a "$RUNTIME" "$OUTDIR"
  rm -f "$OUTDIR/resources/default_app.asar"
  stage_app "$OUTDIR/resources/app"
  mv "$OUTDIR/electron.exe" "$OUTDIR/$(echo "$NAME" | tr -d ' ').exe"

  cat > "$OUTDIR/README.txt" <<TXT
$NAME $VERSION — portable build for Windows ($ARCH)

$DESCRIPTION

Run $(echo "$NAME" | tr -d ' ').exe. Keep it in this folder: it needs the files
beside it. To put it on the Start menu, right-click the .exe and pin it.

Windows SmartScreen will warn on first run because this build is not code
signed. Choose "More info" then "Run anyway", or build a signed installer
with electron-builder.

Draw, Expand and the AIScope zoom work straight away. The AI tools need a
Gemini API key: Settings -> AI. It is stored only on this machine.
TXT

  OUT="$DIST/${NAME// /}-$VERSION-win-$ARCH.zip"
  rm -f "$OUT"
  (cd "$STAGE" && zip -qr9 "$OUT" "$NAME")

elif [ "$PLATFORM" = "darwin" ]; then
  BUNDLE="$STAGE/$NAME.app"
  cp -a "$RUNTIME/Electron.app" "$BUNDLE"
  rm -f "$BUNDLE/Contents/Resources/default_app.asar"
  stage_app "$BUNDLE/Contents/Resources/app"

  EXEC="$(echo "$NAME" | tr -d ' ')"
  mv "$BUNDLE/Contents/MacOS/Electron" "$BUNDLE/Contents/MacOS/$EXEC"
  cp "$SRC/build/icon.icns" "$BUNDLE/Contents/Resources/electron.icns"

  # Rewrite the bundle's identity. Info.plist is XML, so this is a surgical
  # replacement of the four keys that name the app to macOS.
  node -e "
    const fs = require('fs');
    const file = '$BUNDLE/Contents/Info.plist';
    let plist = fs.readFileSync(file, 'utf8');
    const set = (key, value) => {
      const re = new RegExp('(<key>' + key + '</key>\\\\s*<string>)[^<]*(</string>)');
      plist = re.test(plist) ? plist.replace(re, '\$1' + value + '\$2')
        : plist.replace('</dict>', '  <key>' + key + '</key>\\n  <string>' + value + '</string>\\n</dict>');
    };
    set('CFBundleName', '$NAME');
    set('CFBundleDisplayName', '$NAME');
    set('CFBundleExecutable', '$EXEC');
    set('CFBundleIdentifier', '$ID');
    set('CFBundleShortVersionString', '$VERSION');
    set('CFBundleVersion', '$VERSION');
    fs.writeFileSync(file, plist);
  "

  cat > "$STAGE/README.txt" <<TXT
$NAME $VERSION — macOS ($ARCH)

$DESCRIPTION

Drag $NAME.app into /Applications.

This build is not signed or notarised, so Gatekeeper will refuse it on the
first launch. Either right-click the app and choose Open, or run:

    xattr -dr com.apple.quarantine "/Applications/$NAME.app"

A signed, notarised .dmg comes from electron-builder on a Mac; see
.github/workflows/build-installers.yml.

Draw, Expand and the AIScope zoom work straight away. The AI tools need a
Gemini API key: Settings -> AI. It is stored only on this machine.
TXT

  OUT="$DIST/${NAME// /}-$VERSION-mac-$ARCH.zip"
  rm -f "$OUT"
  # -y keeps symlinks as symlinks: the framework bundles inside are full of
  # them, and following them would both bloat and break the app.
  (cd "$STAGE" && zip -qr9 -y "$OUT" "$NAME.app" README.txt)

else
  echo "unknown platform: $PLATFORM (expected win32 or darwin)" >&2
  exit 1
fi

echo "==> $OUT  ($(du -h "$OUT" | cut -f1))"

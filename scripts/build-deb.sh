#!/usr/bin/env bash
# Build a .deb for Hazelnut or Hazelnut Mini against a prebuilt Electron runtime.
#
#   ./scripts/build-deb.sh hazelnut       -> dist/hazelnut_1.0.0_amd64.deb
#   ./scripts/build-deb.sh hazelnut-mini  -> dist/hazelnut-mini_1.0.0_amd64.deb
#
# electron-builder is the normal route; this exists so a Linux package can be
# produced with nothing but curl, unzip and dpkg-deb — no npm install, no
# electron-builder, no network beyond the Electron release itself.
set -euo pipefail

APP="${1:-hazelnut}"
ELECTRON_VERSION="${ELECTRON_VERSION:-33.4.11}"
ARCH="${ARCH:-x64}"
DEB_ARCH="amd64"
[ "$ARCH" = "arm64" ] && DEB_ARCH="arm64"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORK="${WORK:-$ROOT/.build}"
DIST="$ROOT/dist"

case "$APP" in
  hazelnut)      NAME="Hazelnut";      BIN="hazelnut";      SRC="$ROOT/apps/hazelnut";      PAYLOAD="electron renderer build";;
  hazelnut-mini) NAME="Hazelnut Mini"; BIN="hazelnut-mini"; SRC="$ROOT/apps/hazelnut-mini"; PAYLOAD="electron www build";;
  *) echo "unknown app: $APP (expected hazelnut or hazelnut-mini)" >&2; exit 1;;
esac

VERSION="$(node -p "require('$SRC/package.json').version")"
RUNTIME="$WORK/electron-$ELECTRON_VERSION-linux-$ARCH"
ZIP="$WORK/electron-$ELECTRON_VERSION-linux-$ARCH.zip"

mkdir -p "$WORK" "$DIST"

# 1. the Electron runtime
if [ ! -x "$RUNTIME/electron" ]; then
  echo "==> fetching Electron $ELECTRON_VERSION ($ARCH)"
  curl -sSL --retry 4 --retry-delay 2 -o "$ZIP" \
    "https://github.com/electron/electron/releases/download/v$ELECTRON_VERSION/electron-v$ELECTRON_VERSION-linux-$ARCH.zip"
  rm -rf "$RUNTIME"
  unzip -q "$ZIP" -d "$RUNTIME"
fi

# 2. the app payload, laid out the way Electron expects
STAGE="$WORK/stage-$APP"
rm -rf "$STAGE"
mkdir -p "$STAGE/opt/$NAME"
cp -a "$RUNTIME/." "$STAGE/opt/$NAME/"
rm -rf "$STAGE/opt/$NAME/resources/default_app.asar"

APPDIR="$STAGE/opt/$NAME/resources/app"
mkdir -p "$APPDIR"
for dir in $PAYLOAD; do cp -a "$SRC/$dir" "$APPDIR/"; done

# @hazelnut/core is a workspace dependency; without `npm install` to symlink it,
# copy it into place so Node's resolver finds it exactly as it would normally.
mkdir -p "$APPDIR/node_modules/@hazelnut"
cp -a "$ROOT/packages/core" "$APPDIR/node_modules/@hazelnut/core"

# A trimmed manifest: Electron only needs name, version, main and the module type.
node -e "
  const pkg = require('$SRC/package.json');
  require('fs').writeFileSync('$APPDIR/package.json', JSON.stringify({
    name: pkg.name, productName: pkg.productName, version: pkg.version,
    description: pkg.description, type: pkg.type, main: pkg.main,
  }, null, 2));
"

mv "$STAGE/opt/$NAME/electron" "$STAGE/opt/$NAME/$BIN"

# 3. desktop integration
mkdir -p "$STAGE/usr/bin" "$STAGE/usr/share/applications" \
         "$STAGE/usr/share/icons/hicolor/512x512/apps" "$STAGE/usr/share/doc/$BIN"
ln -sf "/opt/$NAME/$BIN" "$STAGE/usr/bin/$BIN"
cp "$SRC/build/icon.png" "$STAGE/usr/share/icons/hicolor/512x512/apps/$BIN.png"

CATEGORY="Graphics;Photography;RasterGraphics;"
[ "$APP" = "hazelnut-mini" ] && CATEGORY="Graphics;Photography;"

cat > "$STAGE/usr/share/applications/$BIN.desktop" <<DESKTOP
[Desktop Entry]
Type=Application
Name=$NAME
Comment=$(node -p "require('$SRC/package.json').description")
Exec=/opt/$NAME/$BIN %U
Icon=$BIN
Terminal=false
Categories=$CATEGORY
StartupWMClass=$NAME
MimeType=image/png;image/jpeg;image/webp;
DESKTOP

# 4. control metadata
mkdir -p "$STAGE/DEBIAN"
INSTALLED_KB="$(du -sk "$STAGE" | cut -f1)"
cat > "$STAGE/DEBIAN/control" <<CONTROL
Package: $BIN
Version: $VERSION
Section: graphics
Priority: optional
Architecture: $DEB_ARCH
Installed-Size: $INSTALLED_KB
Depends: libgtk-3-0 | libgtk-3-0t64, libnotify4, libnss3, libxss1, libxtst6, xdg-utils, libatspi2.0-0 | libatspi2.0-0t64, libdrm2, libgbm1, libasound2 | libasound2t64
Maintainer: Hazelnut <noreply@anthropic.com>
Description: $(node -p "require('$SRC/package.json').description")
 Part of the Hazelnut suite. AI tools require a Gemini API key, which is
 entered in the app and stored only on this machine.
CONTROL

# Chromium's sandbox helper has to be setuid root, or the app refuses to start
# on a normal desktop.
cat > "$STAGE/DEBIAN/postinst" <<'POST'
#!/bin/sh
set -e
chmod 4755 "/opt/__NAME__/chrome-sandbox" || true
if command -v update-desktop-database >/dev/null 2>&1; then
  update-desktop-database -q /usr/share/applications || true
fi
POST
sed -i "s|__NAME__|$NAME|" "$STAGE/DEBIAN/postinst"
chmod 755 "$STAGE/DEBIAN/postinst"

# 5. build
OUT="$DIST/${BIN}_${VERSION}_${DEB_ARCH}.deb"
dpkg-deb --build --root-owner-group -Zxz "$STAGE" "$OUT" >/dev/null
echo "==> $OUT  ($(du -h "$OUT" | cut -f1))"

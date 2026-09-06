#!/usr/bin/env bash
# Build the standalone apps: one self-contained executable per platform that
# carries Hazelnut and borrows the browser engine already on the machine.
#
#   ./scripts/build-launcher.sh                  # every app, every platform
#   ./scripts/build-launcher.sh hazelnut windows # one
#
# An Electron build is ~110 MB per platform because it ships a browser. These
# are a few megabytes because they do not.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LAUNCHER="$ROOT/launcher"
DIST="$ROOT/dist"
WORK="${WORK:-$ROOT/.build}"

APPS=("${1:-hazelnut hazelnut-mini}")
PLATFORMS=("${2:-windows macos linux}")
read -ra APPS <<< "${APPS[0]}"
read -ra PLATFORMS <<< "${PLATFORMS[0]}"

mkdir -p "$DIST" "$WORK"

# ── payload ────────────────────────────────────────────────────────────────
# What the executable serves: the app itself, plus the shared core it imports.

stage_payload() {
  node "$ROOT/scripts/stage-payload.mjs" "$1" "launcher/payload"
}

# ── build ──────────────────────────────────────────────────────────────────

build() {
  local app="$1" goos="$2" goarch="$3" out="$4"
  local flags="-s -w"
  # Link Windows as a GUI app so no console window sits behind the application.
  [ "$goos" = "windows" ] && flags="$flags -H windowsgui"
  ( cd "$LAUNCHER" && CGO_ENABLED=0 GOOS="$goos" GOARCH="$goarch" \
      go build -trimpath -ldflags "$flags" -o "$out" . )
}

# A .app is a directory, so macOS gets a bundle rather than a bare file.
bundle_mac() {
  local app="$1" name="$2" exec_name="$3" bundle="$4" version="$5" ident="$6"
  rm -rf "$bundle"
  mkdir -p "$bundle/Contents/MacOS" "$bundle/Contents/Resources"
  cp "$ROOT/apps/$app/build/icon.icns" "$bundle/Contents/Resources/icon.icns"
  cat > "$bundle/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key><string>$name</string>
  <key>CFBundleDisplayName</key><string>$name</string>
  <key>CFBundleExecutable</key><string>$exec_name</string>
  <key>CFBundleIdentifier</key><string>$ident</string>
  <key>CFBundleShortVersionString</key><string>$version</string>
  <key>CFBundleVersion</key><string>$version</string>
  <key>CFBundleIconFile</key><string>icon</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>LSMinimumSystemVersion</key><string>11.0</string>
  <key>NSHighResolutionCapable</key><true/>
  <!-- The window is a browser window; the app itself draws nothing. -->
  <key>LSUIElement</key><false/>
</dict>
</plist>
PLIST
  printf 'APPL????' > "$bundle/Contents/PkgInfo"
}

for app in "${APPS[@]}"; do
  case "$app" in
    hazelnut)      NAME="Hazelnut";      EXEC="Hazelnut";     IDENT="com.hazelnut.studio";;
    hazelnut-mini) NAME="Hazelnut Mini"; EXEC="HazelnutMini"; IDENT="com.hazelnut.mini";;
    *) echo "unknown app: $app" >&2; exit 1;;
  esac
  VERSION="$(node -p "require('$ROOT/apps/$app/package.json').version")"

  echo "==> $NAME $VERSION"
  stage_payload "$app"

  for platform in "${PLATFORMS[@]}"; do
    case "$platform" in
      windows)
        out="$DIST/$EXEC.exe"
        build "$app" windows amd64 "$out"
        echo "    $(basename "$out")  $(du -h "$out" | cut -f1)"
        ;;
      linux)
        out="$DIST/$EXEC-linux-x64"
        build "$app" linux amd64 "$out"
        echo "    $(basename "$out")  $(du -h "$out" | cut -f1)"
        ;;
      macos)
        staging="$WORK/mac-$app"
        rm -rf "$staging"; mkdir -p "$staging"
        bundle="$staging/$NAME.app"
        bundle_mac "$app" "$NAME" "$EXEC" "$bundle" "$VERSION" "$IDENT"
        # A universal binary would need lipo; ship the two archs side by side
        # and let the bundle carry the Apple silicon one, which is the default
        # on every Mac sold since 2020.
        build "$app" darwin arm64 "$bundle/Contents/MacOS/$EXEC"
        chmod +x "$bundle/Contents/MacOS/$EXEC"
        out="$DIST/$EXEC-macos.zip"
        rm -f "$out"
        ( cd "$staging" && zip -qr9 -y "$out" "$NAME.app" )
        echo "    $(basename "$out")  $(du -h "$out" | cut -f1)  (.app bundle)"

        intel="$DIST/$EXEC-macos-intel"
        build "$app" darwin amd64 "$intel"
        echo "    $(basename "$intel")  $(du -h "$intel" | cut -f1)"
        ;;
    esac
  done
done

rm -rf "$LAUNCHER/payload"

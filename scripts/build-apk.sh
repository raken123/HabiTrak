#!/usr/bin/env bash
# Build Hazelnut Mini for Android without the Android SDK.
#
#   ./scripts/build-apk.sh    ->  dist/HazelnutMini.apk
#
# The SDK is not always reachable. Apktool ships the two pieces that matter —
# a smali assembler and aapt2 — and uber-apk-signer ships zipalign and a debug
# key, so between them the whole chain is available from two jars:
#
#   smali  -> classes.dex     (apktool)
#   aapt2  -> manifest + resources + assets   (extracted from apktool)
#   sign   -> v1, v2, v3      (uber-apk-signer)
#
# The app itself is Mini's own page, bundled into a classic script because a
# WebView loading from file:// cannot use ES modules.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROJ="$ROOT/android"
WORK="${WORK:-$ROOT/.build}"
TOOLS="$WORK/android-tools"
DIST="$ROOT/dist"

APKTOOL_VERSION="${APKTOOL_VERSION:-2.9.3}"
SIGNER_VERSION="${SIGNER_VERSION:-1.3.0}"

mkdir -p "$TOOLS" "$DIST"

fetch() {
  local url="$1" out="$2"
  [ -s "$out" ] && return 0
  echo "==> fetching $(basename "$out")"
  curl -sSL --retry 4 --retry-delay 2 -o "$out" "$url"
}

fetch "https://github.com/iBotPeaches/Apktool/releases/download/v${APKTOOL_VERSION}/apktool_${APKTOOL_VERSION}.jar" "$TOOLS/apktool.jar"
fetch "https://github.com/patrickfav/uber-apk-signer/releases/download/v${SIGNER_VERSION}/uber-apk-signer-${SIGNER_VERSION}.jar" "$TOOLS/uber-apk-signer.jar"

# aapt2 and the android framework both live inside apktool's jar.
if [ ! -x "$TOOLS/aapt2" ]; then
  unzip -o -j "$TOOLS/apktool.jar" "prebuilt/linux/aapt2_64" -d "$TOOLS" >/dev/null
  mv "$TOOLS/aapt2_64" "$TOOLS/aapt2"
  chmod +x "$TOOLS/aapt2"
fi
FRAMEWORK="$HOME/.local/share/apktool/framework/1.apk"
if [ ! -s "$FRAMEWORK" ]; then
  mkdir -p "$(dirname "$FRAMEWORK")"
  unzip -o -j "$TOOLS/apktool.jar" "brut/androlib/android-framework.jar" -d "$(dirname "$FRAMEWORK")" >/dev/null
  mv "$(dirname "$FRAMEWORK")/android-framework.jar" "$FRAMEWORK"
fi

echo "==> web assets"
node "$ROOT/scripts/build-apk-assets.mjs" "$PROJ/assets"

echo "==> smali -> classes.dex"
rm -rf "$PROJ/build" "$PROJ/out"
# Apktool assembles the smali first and then tries to build resources from its
# own metadata, which is not used here — aapt2 is driven directly below. The
# resource stage is allowed to fail; the dex it already wrote is what we want.
java -jar "$TOOLS/apktool.jar" b "$PROJ" -o /dev/null >/dev/null 2>&1 || true
DEX="$PROJ/build/apk/classes.dex"
[ -s "$DEX" ] || { echo "smali did not assemble; see: java -jar $TOOLS/apktool.jar -v b $PROJ" >&2; exit 1; }

echo "==> aapt2"
mkdir -p "$PROJ/out"
"$TOOLS/aapt2" compile --dir "$PROJ/res" -o "$PROJ/out/res.zip" >/dev/null
"$TOOLS/aapt2" link \
  -o "$PROJ/out/base.apk" \
  -I "$FRAMEWORK" \
  --manifest "$PROJ/AndroidManifest.xml" \
  -A "$PROJ/assets" \
  --min-sdk-version 21 \
  --target-sdk-version 28 \
  --version-code 1 \
  --version-name "$(node -p "require('$ROOT/apps/hazelnut-mini/package.json').version")" \
  "$PROJ/out/res.zip"

cp "$DEX" "$PROJ/out/classes.dex"
( cd "$PROJ/out" && zip -q -X base.apk classes.dex && rm classes.dex )

echo "==> sign"
java -jar "$TOOLS/uber-apk-signer.jar" --apks "$PROJ/out/base.apk" --allowResign --overwrite >/dev/null 2>&1 \
  || java -jar "$TOOLS/uber-apk-signer.jar" --apks "$PROJ/out/base.apk" --allowResign >/dev/null 2>&1

SIGNED="$PROJ/out/base.apk"
[ -s "$PROJ/out/base-aligned-debugSigned.apk" ] && SIGNED="$PROJ/out/base-aligned-debugSigned.apk"
cp "$SIGNED" "$DIST/HazelnutMini.apk"

echo "==> $DIST/HazelnutMini.apk  ($(du -h "$DIST/HazelnutMini.apk" | cut -f1))"
"$TOOLS/../android-tools/aapt2" version >/dev/null 2>&1 || true

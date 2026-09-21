#!/usr/bin/env bash
# Build Hazelnut Mini as an Android App Bundle.
#
#   ./scripts/build-aab.sh    ->  dist/HazelnutMini.aab
#
# An .aab is not a renamed .apk. Play wants the app before it has been split:
# resources in protobuf rather than in the binary table aapt2 normally writes,
# the manifest likewise, and the whole thing laid out per module so the server
# can cut device-specific APKs out of it later.
#
# So the chain differs from build-apk.sh in exactly two places — `aapt2 link
# --proto-format`, and bundletool assembling the module — and is otherwise the
# same one: apktool's smali assembler for the dex, aapt2 for resources, and the
# app itself bundled out of Mini's own page.
#
#   smali  -> classes.dex                     (apktool)
#   aapt2 --proto-format -> manifest + resources.pb + res + assets
#   bundletool build-bundle -> the .aab
#   jarsigner -> signed, because an AAB is signed as a jar and apksigner
#                does not handle bundles at all
#
# The signing key here is generated locally and is a stand-in. Uploading to
# Play means signing with the upload key for that listing: pass KEYSTORE,
# KEY_ALIAS, KEYSTORE_PASS and KEY_PASS and this will use it instead.
set -euo pipefail

# The JVM prints its tool options banner to stderr on every invocation, and
# this script runs java five times. Nothing here needs the proxy or truststore
# those options carry — no java step touches the network — so they are dropped
# to keep the log readable.
export JAVA_TOOL_OPTIONS=""

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROJ="$ROOT/android"
WORK="${WORK:-$ROOT/.build}"
TOOLS="$WORK/android-tools"
DIST="$ROOT/dist"
OUT="$WORK/aab"

APKTOOL_VERSION="${APKTOOL_VERSION:-2.9.3}"
BUNDLETOOL_VERSION="${BUNDLETOOL_VERSION:-1.17.2}"

MIN_SDK="${MIN_SDK:-21}"
# Play will not accept a bundle below its current floor, and the app's Android
# surface is a WebView, a file chooser and its own external files directory —
# none of which changed behaviour on the way up.
TARGET_SDK="${TARGET_SDK:-34}"
VERSION_CODE="${VERSION_CODE:-1}"
VERSION_NAME="${VERSION_NAME:-$(node -p "require('$ROOT/apps/hazelnut-mini/package.json').version")}"

mkdir -p "$TOOLS" "$DIST" "$OUT"

fetch() {
  local url="$1" out="$2"
  [ -s "$out" ] && return 0
  echo "==> fetching $(basename "$out")"
  curl -sSL --retry 4 --retry-delay 2 -o "$out" "$url"
}

fetch "https://github.com/iBotPeaches/Apktool/releases/download/v${APKTOOL_VERSION}/apktool_${APKTOOL_VERSION}.jar" "$TOOLS/apktool.jar"
fetch "https://github.com/google/bundletool/releases/download/${BUNDLETOOL_VERSION}/bundletool-all-${BUNDLETOOL_VERSION}.jar" "$TOOLS/bundletool.jar"

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
rm -rf "$PROJ/build"
# Apktool assembles the smali and then tries to build resources from its own
# metadata, which is not used here — aapt2 is driven directly below. The
# resource stage is allowed to fail; the dex it already wrote is what we want.
java -jar "$TOOLS/apktool.jar" b "$PROJ" -o /dev/null >/dev/null 2>&1 || true
DEX="$PROJ/build/apk/classes.dex"
[ -s "$DEX" ] || { echo "smali did not assemble; see: java -jar $TOOLS/apktool.jar -v b $PROJ" >&2; exit 1; }

echo "==> aapt2 (protobuf)"
rm -rf "$OUT"; mkdir -p "$OUT"
"$TOOLS/aapt2" compile --dir "$PROJ/res" -o "$OUT/res.zip" >/dev/null
"$TOOLS/aapt2" link \
  --proto-format \
  -o "$OUT/proto.apk" \
  -I "$FRAMEWORK" \
  --manifest "$PROJ/AndroidManifest.xml" \
  -A "$PROJ/assets" \
  --min-sdk-version "$MIN_SDK" \
  --target-sdk-version "$TARGET_SDK" \
  --version-code "$VERSION_CODE" \
  --version-name "$VERSION_NAME" \
  "$OUT/res.zip"

echo "==> module layout"
# bundletool wants a zip per module, and it wants the pieces in its own places:
# the manifest under manifest/, the dex under dex/, and resources.pb at the
# top. aapt2's output is an APK-shaped zip, so it is unpacked and rearranged.
MOD="$OUT/module"
rm -rf "$MOD"; mkdir -p "$MOD/raw" "$MOD/manifest" "$MOD/dex"
unzip -q "$OUT/proto.apk" -d "$MOD/raw"
mv "$MOD/raw/AndroidManifest.xml" "$MOD/manifest/AndroidManifest.xml"
[ -f "$MOD/raw/resources.pb" ] && mv "$MOD/raw/resources.pb" "$MOD/resources.pb"
[ -d "$MOD/raw/res" ] && mv "$MOD/raw/res" "$MOD/res"
[ -d "$MOD/raw/assets" ] && mv "$MOD/raw/assets" "$MOD/assets"
cp "$DEX" "$MOD/dex/classes.dex"
rm -rf "$MOD/raw"

ENTRIES=(manifest dex)
[ -f "$MOD/resources.pb" ] && ENTRIES+=(resources.pb)
[ -d "$MOD/res" ] && ENTRIES+=(res)
[ -d "$MOD/assets" ] && ENTRIES+=(assets)
( cd "$MOD" && zip -qrX "$OUT/base.zip" "${ENTRIES[@]}" )

echo "==> bundletool"
rm -f "$OUT/app.aab"
java -jar "$TOOLS/bundletool.jar" build-bundle \
  --modules="$OUT/base.zip" \
  --output="$OUT/app.aab"

echo "==> sign"
KEYSTORE="${KEYSTORE:-$TOOLS/upload.keystore}"
KEY_ALIAS="${KEY_ALIAS:-hazelnut}"
KEYSTORE_PASS="${KEYSTORE_PASS:-hazelnut}"
KEY_PASS="${KEY_PASS:-$KEYSTORE_PASS}"
if [ ! -s "$KEYSTORE" ]; then
  echo "    generating a local signing key (stand-in — use your own for Play)"
  keytool -genkeypair -v \
    -keystore "$KEYSTORE" -alias "$KEY_ALIAS" \
    -keyalg RSA -keysize 2048 -validity 10000 \
    -storepass "$KEYSTORE_PASS" -keypass "$KEY_PASS" \
    -dname "CN=Hazelnut Mini, OU=Hazelnut, O=Hazelnut, L=, S=, C=GB" >/dev/null 2>&1
fi
jarsigner -keystore "$KEYSTORE" \
  -storepass "$KEYSTORE_PASS" -keypass "$KEY_PASS" \
  -sigalg SHA256withRSA -digestalg SHA-256 \
  "$OUT/app.aab" "$KEY_ALIAS" >/dev/null

echo "==> validate"
java -jar "$TOOLS/bundletool.jar" validate --bundle="$OUT/app.aab" | sed 's/^/    /'

# A bundle that validates is not yet a bundle that produces an installable app.
# Cutting a universal APK out of it and reading it back is the part that proves
# the manifest, the resources and the dex all survived the round trip.
echo "==> proving it makes APKs"
rm -f "$OUT/app.apks"
java -jar "$TOOLS/bundletool.jar" build-apks \
  --bundle="$OUT/app.aab" \
  --output="$OUT/app.apks" \
  --mode=universal \
  --ks="$KEYSTORE" --ks-pass="pass:$KEYSTORE_PASS" \
  --ks-key-alias="$KEY_ALIAS" --key-pass="pass:$KEY_PASS" >/dev/null
unzip -o -q "$OUT/app.apks" -d "$OUT/apks"
UNIVERSAL="$OUT/apks/universal.apk"
[ -s "$UNIVERSAL" ] || { echo "bundletool produced no universal APK" >&2; exit 1; }
"$TOOLS/aapt2" dump badging "$UNIVERSAL" | head -4 | sed 's/^/    /'

cp "$OUT/app.aab" "$DIST/HazelnutMini.aab"
echo "==> $DIST/HazelnutMini.aab  ($(du -h "$DIST/HazelnutMini.aab" | cut -f1))"

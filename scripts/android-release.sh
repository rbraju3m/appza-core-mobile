#!/usr/bin/env bash
# One-command QA APK: bundle → cap sync → assembleQa (signed) → verify.
#   scripts/android-release.sh --site https://example.com [--template slug] [--version-code N]
#     [--version-name X] [--out dir] [--tunnel-shims]
# Signing: APPZA_KEYSTORE, APPZA_KEYSTORE_PASSWORD, APPZA_KEY_ALIAS, APPZA_KEY_PASSWORD,
# or a file of them in APPZA_KEYSTORE_ENV (default ~/.config/appza/qa-keystore.env).
# Last line of stdout on success: the APK path.
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/.." && pwd)
MOBILE=$ROOT/packages/mobile
SITE=''
TEMPLATE=fluent-community-default
VERSION_CODE=$(( ($(date +%s) - 1704067200) / 60 ))
VERSION_NAME=$(node -p "require('$MOBILE/package.json').version")
OUT=$ROOT/out/android-qa
SHIMS=0

while [ $# -gt 0 ]; do
	case $1 in
		--site) SITE=${2%/}; shift 2 ;;
		--template) TEMPLATE=$2; shift 2 ;;
		--version-code) VERSION_CODE=$2; shift 2 ;;
		--version-name) VERSION_NAME=$2; shift 2 ;;
		--out) OUT=$2; shift 2 ;;
		--tunnel-shims) SHIMS=1; shift ;;
		*) echo "unknown argument: $1" >&2; exit 2 ;;
	esac
done

die() { echo "android-release: $*" >&2; exit 1; }
step() { echo "── $*" >&2; }

[[ $SITE =~ ^https://[A-Za-z0-9.-]+(:[0-9]+)?$ ]] || die "--site must be an https origin with no path (got '$SITE')"
[[ $TEMPLATE =~ ^[a-z0-9-]+$ ]] || die "bad --template '$TEMPLATE'"
[[ $VERSION_CODE =~ ^[0-9]+$ ]] && [ "$VERSION_CODE" -ge 1 ] && [ "$VERSION_CODE" -le 2100000000 ] || die "bad --version-code '$VERSION_CODE'"
[[ $VERSION_NAME =~ ^[A-Za-z0-9.+-]+$ ]] || die "bad --version-name '$VERSION_NAME'"

KEYENV=${APPZA_KEYSTORE_ENV:-$HOME/.config/appza/qa-keystore.env}
if [ -z "${APPZA_KEYSTORE:-}" ] && [ -r "$KEYENV" ]; then
	set -a
	. "$KEYENV"
	set +a
fi
for v in APPZA_KEYSTORE APPZA_KEYSTORE_PASSWORD APPZA_KEY_ALIAS APPZA_KEY_PASSWORD; do
	[ -n "${!v:-}" ] || die "$v is not set (see the header of this script)"
done
[ -r "$APPZA_KEYSTORE" ] || die "keystore not readable: $APPZA_KEYSTORE"

export JAVA_HOME=${JAVA_HOME:-$HOME/jdk17}
export ANDROID_HOME=${ANDROID_HOME:-$HOME/Android/Sdk}
BT=$(ls -d "$ANDROID_HOME"/build-tools/* 2>/dev/null | sort -V | tail -1)
[ -x "$BT/apksigner" ] || die "no apksigner under $ANDROID_HOME/build-tools"
HOST=${SITE#https://}
HOST=${HOST%%:*}

step "web bundle for $SITE ($TEMPLATE)"
cd "$MOBILE"
rm -rf dist
VITE_APPZA_SITE_URL=$SITE VITE_APPZA_TEMPLATE=$TEMPLATE APPZA_RELEASE=1 \
	VITE_APPZA_TUNNEL_SHIMS=$([ $SHIMS = 1 ] && echo 1 || echo '') npm run build >&2

mkdir -p "$OUT"
NAME=appza-qa-$VERSION_NAME-$VERSION_CODE
MAPS=$OUT/$NAME-sourcemaps
rm -rf "$MAPS"
mkdir -p "$MAPS"
(cd dist && find . -name '*.map' -print0 | xargs -0 -r cp --parents -t "$MAPS" && find . -name '*.map' -delete)
[ $SHIMS = 1 ] || rm -f dist/sw.js

step "cap sync"
APPZA_ALLOW_MIXED_CONTENT='' npx cap sync android >&2

step "assembleQa $VERSION_NAME ($VERSION_CODE)"
cd android
./gradlew --quiet assembleQa -PappzaVersionCode="$VERSION_CODE" -PappzaVersionName="$VERSION_NAME" >&2
APK=$(ls app/build/outputs/apk/qa/*.apk | head -1)
[ -f "$APK" ] || die "gradle produced no APK"

step "verify"
CERT=$("$BT/apksigner" verify --print-certs "$APK" 2>&1) || die "apksigner verify failed: $CERT"
grep -q 'CN=Android Debug' <<<"$CERT" && die "signed with the debug key"
BADGING=$("$BT/aapt" dump badging "$APK")
grep -q "package: name='net.appza.app.qa' versionCode='$VERSION_CODE' versionName='$VERSION_NAME-qa'" <<<"$BADGING" \
	|| die "unexpected package line: $(head -1 <<<"$BADGING")"
grep -q "application-label:'Appza QA'" <<<"$BADGING" || die "app label is not 'Appza QA'"
FILES=$(unzip -Z1 "$APK")
grep -q '\.map$' <<<"$FILES" && die "source maps inside the APK"
[ $SHIMS = 1 ] || ! grep -q 'assets/public/sw\.js$' <<<"$FILES" || die "sw.js inside the APK"
TMP=$(mktemp -d)
unzip -qo "$APK" 'assets/public/assets/*.js' -d "$TMP"
grep -rqF "$SITE" "$TMP" || die "site URL $SITE is not in the bundle"
OTHER=$(grep -rhoE 'https?://[a-z0-9.-]+\.(local|test|localhost|trycloudflare\.com|loca\.lt)\b' "$TMP" | grep -vF "$HOST" | sort -u || true)
rm -rf "$TMP"
[ -z "$OTHER" ] || die "other dev hosts baked in: $OTHER"

cp "$APK" "$OUT/$NAME.apk"
SHA=$(sha256sum "$OUT/$NAME.apk" | cut -d' ' -f1)
SIGNER=$(grep -m1 'SHA-256 digest' <<<"$CERT" | awk '{print $NF}')
cat > "$OUT/$NAME.json" <<JSON
{"apk":"$NAME.apk","sha256":"$SHA","site":"$SITE","template":"$TEMPLATE","version_code":$VERSION_CODE,"version_name":"$VERSION_NAME-qa","application_id":"net.appza.app.qa","signer_sha256":"$SIGNER","tunnel_shims":$([ $SHIMS = 1 ] && echo true || echo false),"commit":"$(git -C "$ROOT" rev-parse --short HEAD)","dirty":$([ -z "$(git -C "$ROOT" status --porcelain)" ] && echo false || echo true),"built_at":"$(date -u +%FT%TZ)"}
JSON
step "done: $OUT/$NAME.apk ($(du -h "$OUT/$NAME.apk" | cut -f1))"
echo "$OUT/$NAME.apk"

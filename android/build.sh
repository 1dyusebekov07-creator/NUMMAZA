#!/usr/bin/env bash
# Сборка NUMMAZA.apk без Android Studio и Android SDK.
# Нужны: JDK 17+, python3, curl, zip. Инструменты скачиваются с Maven Central:
#   aapt2 + ресурсы фреймворка Android — из apktool-lib (Apache-2.0),
#   dx (Java → dex) — com.jakewharton.android.repackaged:dalvik-dx (Apache-2.0),
#   apksig (подпись v2) — com.android.tools.build:apksig (Apache-2.0).
set -euo pipefail
cd "$(dirname "$0")"
ROOT=$(pwd)
T=$ROOT/tools
B=$ROOT/build
OUT=${1:-$ROOT/../dist/NUMMAZA.apk}
VERSION_CODE=${VERSION_CODE:-2}
VERSION_NAME=${VERSION_NAME:-1.1}
MAVEN=https://repo1.maven.org/maven2

mkdir -p "$T"
fetch() { [ -f "$T/$2" ] || curl -sSfL "$MAVEN/$1" -o "$T/$2"; }
fetch org/apktool/apktool-lib/2.12.1/apktool-lib-2.12.1.jar apktool-lib.jar
fetch com/jakewharton/android/repackaged/dalvik-dx/16.0.1/dalvik-dx-16.0.1.jar dx.jar
fetch com/android/tools/build/apksig/2.3.0/apksig-2.3.0.jar apksig.jar
if [ ! -x "$T/aapt2" ]; then
  (cd "$T" && unzip -o -q apktool-lib.jar 'prebuilt/linux/aapt2_64' 'prebuilt/android-framework.jar' \
    && mv prebuilt/linux/aapt2_64 aapt2 && mv prebuilt/android-framework.jar android.jar && rm -rf prebuilt && chmod +x aapt2)
fi

rm -rf "$B" && mkdir -p "$B/classes" "$B/stubs" "$B/assets/www"

echo "1/6 Веб-приложение → assets/www"
cp -r "$ROOT/../app/." "$B/assets/www/"
# Адрес сервера: NUMMAZA_API_URL=https://nummaza.onrender.com android/build.sh (пусто — приложение работает без сервера)
API_URL=${NUMMAZA_API_URL:-}
if [ -n "$API_URL" ]; then
  case "$API_URL" in https://*) ;; *) echo "NUMMAZA_API_URL должен начинаться с https:// (Android не пускает http)"; exit 1;; esac
  printf "window.NZ = window.NZ || {};\nNZ.API_URL = '%s';\n" "${API_URL%/}" > "$B/assets/www/js/config.js"
  echo "   сервер: $API_URL"
else
  echo "   сервер не задан — локальный режим (задайте NUMMAZA_API_URL)"
fi

echo "2/6 Ресурсы (aapt2 compile + link)"
"$T/aapt2" compile --dir "$ROOT/res" -o "$B/res.zip"
"$T/aapt2" link -o "$B/base.apk" -I "$T/android.jar" --manifest "$ROOT/AndroidManifest.xml" \
  -A "$B/assets" "$B/res.zip" --min-sdk-version 26 --target-sdk-version 34 \
  --version-code "$VERSION_CODE" --version-name "$VERSION_NAME" --auto-add-overlay

echo "3/6 Java → class (заглушки Android API только для компиляции)"
javac -nowarn -source 8 -target 8 -d "$B/stubs" $(find "$ROOT/stubs" -name '*.java') 2>&1 | grep -v 'warning: \[options\]' || true
javac -nowarn -source 8 -target 8 -cp "$B/stubs" -d "$B/classes" $(find "$ROOT/src" -name '*.java') 2>&1 | grep -v 'warning: \[options\]' || true
test -f "$B/classes/kz/nummaza/app/MainActivity.class"

echo "4/6 class → classes.dex"
java -cp "$T/dx.jar" com.android.dx.command.Main --dex --min-sdk-version=26 --output="$B/classes.dex" "$B/classes"

echo "5/6 Упаковка и выравнивание"
cp "$B/base.apk" "$B/unaligned.apk"
(cd "$B" && zip -q -j unaligned.apk classes.dex)
python3 "$ROOT/zipalign.py" "$B/unaligned.apk" "$B/aligned.apk"

echo "6/6 Подпись (APK Signature Scheme v2)"
KS=${KEYSTORE:-$ROOT/nummaza-release.p12}
KS_PASS=${KEYSTORE_PASS:-nummaza-dev}
if [ ! -f "$KS" ]; then
  keytool -genkeypair -storetype PKCS12 -keystore "$KS" -storepass "$KS_PASS" -keypass "$KS_PASS" \
    -alias nummaza -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=NUMMAZA, O=NUMMAZA, C=KZ" >/dev/null 2>&1
fi
javac -nowarn -cp "$T/apksig.jar" -d "$B/signer" "$ROOT/signer/Sign.java"
mkdir -p "$(dirname "$OUT")"
java --add-exports java.base/sun.security.x509=ALL-UNNAMED --add-exports java.base/sun.security.pkcs=ALL-UNNAMED --add-exports java.base/sun.security.util=ALL-UNNAMED -cp "$T/apksig.jar:$B/signer" Sign "$B/aligned.apk" "$OUT" "$KS" "$KS_PASS" nummaza
echo "Готово: $OUT ($(du -h "$OUT" | cut -f1))"

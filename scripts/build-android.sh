#!/bin/zsh
# Moonwave Memo for Android: a signed release APK from this checkout, and (with --publish) on GitHub Releases.
#
#   ./scripts/build-android.sh                         build → release/android/moonwave-memo.apk (+ android.json)
#   ./scripts/build-android.sh --publish               …and upload both to the rolling GitHub release "android"
#   ./scripts/build-android.sh --if-changed --publish  the nightly job: skip when the published APK already holds
#                                                      everything of this commit that goes into the app
#
# The APK carries the web build inside it (Capacitor, webDir dist), so it does not follow a web deploy by itself:
# a change to the web app reaches the phone only through a new APK. That is why this is built automatically
# (LaunchAgent com.moonwave.memo.apk, from a clone of origin/master — see Vector_DB_Memo_v1.0/deploy).
#
# Needs, on this Mac: JDK 21, the Android SDK (~/Library/Android/sdk, platform 36), and
#   ~/Library/Application Support/Moonwave/memo-android.env   (mode 600, never printed)
#     MEMO_APK_KEYSTORE, MEMO_APK_STORE_PASS, MEMO_APK_KEY_ALIAS   the release key "CN=Moonwave Memo"
#     VITE_FIREBASE_*                                              the public web config Vercel builds with
# The key's SHA-1/SHA-256 are registered on the Firebase Android app (Google sign-in checks them). Lose the key and
# every phone has to remove the app and install again, so keep a copy of the .jks and the env file somewhere safe.
#
# Download: https://github.com/hersouls/moonwave-memo-v1/releases/download/android/moonwave-memo.apk
set -u
setopt pipefail
cd "${0:A:h}/.."

REPO=hersouls/moonwave-memo-v1
TAG=android
SECRETS="${MEMO_ANDROID_ENV:-$HOME/Library/Application Support/Moonwave/memo-android.env}"
OUT=release/android
say() { print -r -- "[android] $*" }
die() { print -r -- "[android] 실패: $*" >&2; exit 1 }

PUBLISH=0; IF_CHANGED=0
for a in "$@"; do case "$a" in --publish) PUBLISH=1 ;; --if-changed) IF_CHANGED=1 ;; *) die "모르는 옵션: $a" ;; esac; done

SHA=$(git rev-parse HEAD)
# what goes into the app: the web source, the native project, and what both are built with
APP_PATHS=(src public index.html android capacitor.config.ts vite.config.ts package.json package-lock.json scripts/build-android.sh scripts/strip-dist-extras.mjs)

if (( IF_CHANGED )); then
  last=$(gh release download "$TAG" -R "$REPO" -p android.json -O - 2>/dev/null | python3 -c 'import json,sys; print(json.load(sys.stdin).get("sha",""))' 2>/dev/null)
  if [[ -n "$last" ]] && git cat-file -e "$last^{commit}" 2>/dev/null && git diff --quiet "$last" "$SHA" -- $APP_PATHS; then
    say "올라가 있는 APK(${last[1,7]}) 뒤로 앱에 들어가는 것이 바뀌지 않았어요. 빌드하지 않아요"
    exit 0
  fi
fi

[[ -f "$SECRETS" ]] || die "서명 키 정보가 없어요: $SECRETS"
val() { grep "^$1=" "$SECRETS" | head -1 | cut -d= -f2- }
export MEMO_APK_KEYSTORE="$(val MEMO_APK_KEYSTORE)" MEMO_APK_STORE_PASS="$(val MEMO_APK_STORE_PASS)" MEMO_APK_KEY_ALIAS="$(val MEMO_APK_KEY_ALIAS)"
[[ -f "$MEMO_APK_KEYSTORE" && -n "$MEMO_APK_STORE_PASS" ]] || die "서명 키를 찾지 못했어요 (memo-android.env)"
for k in VITE_FIREBASE_API_KEY VITE_FIREBASE_AUTH_DOMAIN VITE_FIREBASE_PROJECT_ID VITE_FIREBASE_STORAGE_BUCKET VITE_FIREBASE_MESSAGING_SENDER_ID VITE_FIREBASE_APP_ID; do
  v="$(val $k)"; [[ -n "$v" ]] || die "$k 가 memo-android.env에 없어요 (없으면 앱 안의 웹이 Firebase에 붙지 못해요)"
  export "$k=$v"
done
export JAVA_HOME="${JAVA_HOME:-$(/usr/libexec/java_home -v 21 2>/dev/null)}"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
[[ -x "$JAVA_HOME/bin/java" ]] || die "JDK 21이 없어요"
[[ -d "$ANDROID_HOME/platforms" ]] || die "Android SDK가 없어요: $ANDROID_HOME"
BT="$ANDROID_HOME/build-tools/$(ls "$ANDROID_HOME/build-tools" | sort -V | tail -1)"

VERSION=$(node -p "require('./package.json').version")
CODE=$(git rev-list --count HEAD)          # one number per commit, always rising on master
say "Moonwave Memo $VERSION ($CODE) · ${SHA[1,7]}"

# ── 1. the web build that goes inside the app, then into the native project
if [[ ! -d node_modules || package-lock.json -nt node_modules/.package-lock.json ]]; then
  say "의존성 설치"
  npx -y npm@11 ci --no-audit --no-fund >/dev/null 2>&1 || die "npm ci"
fi
step() { local name=$1; shift; say "$name"; local out; out=$("$@" 2>&1) || { print -r -- "$out" | tail -40 >&2; die "$name" }; }
step "웹 빌드"            npm run build
git checkout -q -- tsconfig.tsbuildinfo 2>/dev/null
grep -rqs "$VITE_FIREBASE_PROJECT_ID" dist/assets || die "웹 빌드에 Firebase 설정이 들어가지 않았어요"
step "소스맵 · 압축본 정리" node scripts/strip-dist-extras.mjs
step "Capacitor 동기화"   npx cap sync android

# ── 2. the signed release APK
printf 'sdk.dir=%s\n' "$ANDROID_HOME" > android/local.properties
say "Gradle assembleRelease (처음에는 몇 분 걸려요)"
(cd android && sh ./gradlew --no-daemon -q :app:assembleRelease "-PmemoVersionCode=$CODE" "-PmemoVersionName=$VERSION") > /tmp/memo-gradle.$$ 2>&1 || { tail -40 /tmp/memo-gradle.$$ >&2; rm -f /tmp/memo-gradle.$$; die "Gradle 빌드" }
rm -f /tmp/memo-gradle.$$
APK=android/app/build/outputs/apk/release/app-release.apk
[[ -s "$APK" ]] || die "APK가 만들어지지 않았어요"
"$BT/apksigner" verify --print-certs "$APK" 2>/dev/null | grep -q "CN=Moonwave Memo" || die "APK가 Moonwave Memo 키로 서명되지 않았어요"
badge=$("$BT/aapt2" dump badging "$APK" 2>/dev/null | head -1)
[[ "$badge" == *"versionCode='$CODE'"* && "$badge" == *"name='kr.moonwave.memo'"* ]] || die "APK의 버전이나 패키지가 달라요: $badge"

mkdir -p "$OUT"
cp "$APK" "$OUT/moonwave-memo.apk"
python3 - "$OUT" "$VERSION" "$CODE" "$SHA" <<'PY'
import datetime, hashlib, json, os, sys
out, version, code, sha = sys.argv[1], sys.argv[2], int(sys.argv[3]), sys.argv[4]
apk = os.path.join(out, "moonwave-memo.apk")
data = open(apk, "rb").read()
info = {"versionName": version, "versionCode": code, "sha": sha,
        "builtAt": datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=9))).isoformat(timespec="seconds"),
        "sizeBytes": len(data), "sha256": hashlib.sha256(data).hexdigest(), "file": "moonwave-memo.apk"}
json.dump(info, open(os.path.join(out, "android.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print(f"[android] 만들었어요: {apk} · {len(data) // 1024 // 1024} MB")
PY
(( PUBLISH )) || { say "게시하지 않았어요 (--publish를 붙이면 GitHub Releases에 올려요)"; exit 0 }

# ── 3. the rolling release "android": one stable download address, replaced by each build
NOTES="Moonwave Memo for Android $VERSION (빌드 $CODE, ${SHA[1,7]})

휴대폰에서 moonwave-memo.apk를 내려받아 설치해요. 새 빌드가 나오면 같은 파일을 다시 받아 덮어 설치하면 돼요.
이 릴리스는 빌드할 때마다 같은 주소에서 새 파일로 바뀌어요. android.json에 버전 · 커밋 · sha256이 있어요.
2026-10-10보다 앞선 설치본은 다른 키로 서명돼 있어서, 처음 한 번은 예전 앱을 지우고 설치해야 해요."
if gh release view "$TAG" -R "$REPO" >/dev/null 2>&1; then
  gh release edit "$TAG" -R "$REPO" --title "Moonwave Memo for Android" --notes "$NOTES" --latest=false >/dev/null || die "릴리스 설명 갱신"
else
  gh release create "$TAG" -R "$REPO" --target "$SHA" --title "Moonwave Memo for Android" --notes "$NOTES" --latest=false >/dev/null || die "릴리스 만들기"
fi
gh release upload "$TAG" -R "$REPO" "$OUT/moonwave-memo.apk" "$OUT/android.json" --clobber >/dev/null || die "APK 올리기"
say "게시했어요: https://github.com/$REPO/releases/download/$TAG/moonwave-memo.apk"

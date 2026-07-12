# 안드로이드 앱 (Capacitor) — 빌드 · 폴더 저장 (Phase 3)

Phase 3에서 추가된 Capacitor 안드로이드 래퍼. 웹 렌더러를 그대로 WebView로 감싸고, 동기화 폴더의 파일 저장을 안드로이드 백엔드(`CapacitorFileSyncTarget`)로 처리한다.

> **환경 요건**: APK 빌드는 **Android SDK(API 36) + JDK 21** 이 필요하다. Capacitor 8의 `capacitor-android` 모듈이 Java 21로 컴파일되므로 **JDK 17로는 빌드가 실패한다**(`invalid source release: 21`). 별도 JDK 21이 없으면 Android Studio 번들 JBR(21)을 그대로 쓰면 된다:
>
> ```bash
> JAVA_HOME="C:\Program Files\Android\Android Studio\jbr" ./gradlew assembleDebug
> ```
>
> SDK 경로는 `android/local.properties`(`sdk.dir=...`, gitignore됨)로 지정한다.

## 1. 네이티브 프로젝트 (커밋됨)

- `android/`는 **저장소에 커밋돼 있다** — `AndroidManifest.xml`을 커스터마이즈(아래 §3)했기 때문. 빌드 출력·로컬 설정은 `android/.gitignore`가 제외한다(`build/`, `local.properties`, 복사된 웹 자산 `assets/public` 등).
- 새로 생성해야 할 때만: `npm run build && npm run cap:add` (→ 생성 후 §3의 매니페스트 커스터마이즈를 다시 적용해야 한다).
- `capacitor.config.ts`가 appId(`kr.moonwave.memo`)·appName·webDir(`dist`)를 정의한다.

## 2. 개발 · 빌드

```bash
npm run cap:sync       # 웹 빌드 + .gz/.br/.map 제거(scripts/strip-dist-extras.mjs) + dist를 android로 복사
npm run cap:open       # Android Studio 열기 → Run으로 에뮬레이터/기기 실행
```

APK 산출(Android Studio 없이):
```bash
npm run cap:sync
cd android && JAVA_HOME="C:\Program Files\Android\Android Studio\jbr" ./gradlew assembleDebug
# → android/app/build/outputs/apk/debug/app-debug.apk
```

## 3. AndroidManifest 커스터마이즈 내역

`android/app/src/main/AndroidManifest.xml` — 기본 생성본 대비 변경 (동기화 폴더 = `@capacitor/filesystem` `Directory.Documents` 쓰기용):

- `READ_EXTERNAL_STORAGE`(maxSdkVersion 32) + `WRITE_EXTERNAL_STORAGE`(maxSdkVersion 29) — API 29 이하에서 공용 Documents 쓰기에 필요. API 33+는 플러그인이 자동 승인, API 30–32는 하위 경로 쓰기에 권한 불요(플러그인 네이티브 소스 확인).
- `<application android:requestLegacyExternalStorage="true">` — Android 10(API 29)에서 Documents 접근용, 30+에서는 무시됨.

릴리스 APK/AAB는 서명 키(keystore)로 서명해야 배포 가능(§10 절차와 유사, `gradlew bundleRelease`).

## 4. 폴더 저장 방식 (구현됨)

**권장 경로 — 로컬 폴더 + 동기화 에이전트** (`CapacitorFileSyncTarget`):
- 앱이 공식 `@capacitor/filesystem`으로 폰의 **공용 Documents 폴더 하위 `MoonwaveMemo/`** 에 `.md`를 저장한다.
- Documents는 공용이라 **Synology Drive / FolderSync / Syncthing** 같은 동기화 앱이 그 폴더를 NAS와 백그라운드 동기화할 수 있다 — Obsidian 사용자 표준 패턴.
- 설정 → 데이터 → 동기화 폴더에서 토글을 켜면 자동으로 `Documents/MoonwaveMemo`가 설정된다(별도 폴더 선택 없음).
- **단방향**: 모바일은 "앱 → 폴더" 기록만. 폴더 파일 직접 수정 감지(파일 감시)는 OS 제약으로 구현하지 않는다(§Phase 3 범위 제한). 데스크톱(Electron)이 양방향을 담당한다.

## 5. 임의 SAF 폴더 직접 선택 — 다음 스파이크 (미구현)

DS File/Synology Drive가 노출하는 **NAS 폴더를 앱에서 직접 지정(SAF)** 하는 경로는 별도 작업이다:
- 공식 `@capacitor/filesystem`은 사전 정의 디렉터리(Documents/External 등)만 쓰기 지원 — 사용자 지정 SAF 트리 쓰기는 범위 밖.
- `@capawesome/capacitor-file-picker`의 `pickDirectory`로 트리 URI를 얻고, `takePersistableUriPermission` + DocumentFile 쓰기를 **커뮤니티 플러그인 또는 커스텀 네이티브 코드**로 구현해야 한다.
- **실기기 검증 선행 필수** — 제공자 앱(DS File 등)별 쓰기 지원 편차, 네트워크 끊김 시 실패 처리(큐잉)를 확인한 뒤 `CapacitorSafFileSyncTarget`를 추가하고 `platform.ts` 팩토리에 분기한다.

## 6. APK 알려진 한계 (2026-07-12 코드 감사 — 미해결 항목)

APK는 빌드·설치되고 로컬 메모 + 폴더 저장은 동작하지만, 아래는 코드 수준 감사에서 확인된 미해결 한계다:

| 한계 | 원인 | 해결 방향 |
|------|------|-----------|
| **Google 로그인 불가 → 클라우드 동기화 불가** | 유일한 로그인 수단이 `signInWithPopup`/`signInWithRedirect`(authStore) — WebView에서 Google이 차단(disallowed_useragent)하고 `https://localhost`는 승인 도메인이 아님 | `@capacitor-firebase/authentication` 네이티브 플러그인으로 ID 토큰 취득 후 `signInWithCredential` 브리지 |
| **서버 프록시 AI 기능 전부 불가** | 클라이언트 13곳이 상대경로 `/api/...`(Vercel 서버리스)를 호출 — APK의 origin `https://localhost`에는 존재하지 않음 | `VITE_API_BASE` 도입(웹은 '' 유지, APK는 배포 origin) + api 핸들러 CORS 허용 |
| **파일 내보내기(백업 JSON·.md·.html·PNG) 무동작** | blob URL `<a download>` 클릭 방식 7곳 — WebView에는 다운로드 매니저 없음 | `Capacitor.isNativePlatform()` 분기로 `@capacitor/filesystem` 저장 또는 `navigator.share` |
| 하드웨어 뒤로가기 기본 동작 | `@capacitor/app` 미설치 — 모달 열림 상태에서 뒤로가기가 히스토리 pop/앱 종료 | `@capacitor/app` 추가 + backButton 리스너 |
| 재설치 후 기존 파일 접근 불가 | Android 11+ scoped storage — 공용 Documents의 파일 소유권이 재설치 시 소실(MediaStore) | 재설치 후 새 하위 폴더 지정 안내, 장기적으로 SAF 스파이크(§5) |
| 외부 링크(`target="_blank"`) 무동작 | WebView는 멀티 윈도우 미지원 | `@capacitor/browser` 경유 |

## 7. 아직 남은 것

- §6 한계 해소 (우선순위: 네이티브 Google 로그인 → API base → 내보내기).
- 앱 아이콘·스플래시(`@capacitor/assets`로 생성).
- 릴리스 서명 keystore + Play Store 또는 사이드로드 배포 결정.
- SAF 직접 선택(§5) 실기기 스파이크.

# 안드로이드 앱 (Capacitor) — 빌드 · 폴더 저장 (Phase 3)

Phase 3에서 추가된 Capacitor 안드로이드 래퍼. 웹 렌더러를 그대로 WebView로 감싸고, 동기화 폴더의 파일 저장을 안드로이드 백엔드(`CapacitorFileSyncTarget`)로 처리한다.

> **환경 요건**: APK 빌드는 **Android SDK + JDK 17 + Android Studio(또는 Gradle)** 가 필요하다. 코드/설정은 준비돼 있으나 네이티브 프로젝트 생성·빌드·기기 테스트는 이 저장소 밖의 로컬 작업이다.

## 1. 네이티브 프로젝트 생성 (최초 1회)

```bash
npm run build          # dist/ 생성 (Capacitor webDir)
npm run cap:add        # npx cap add android → android/ 네이티브 프로젝트 생성
```

- `android/`는 `.gitignore`됨(생성물). 네이티브 커스터마이즈를 시작하면 ignore를 풀고 커밋한다.
- `capacitor.config.ts`가 appId(`kr.moonwave.memo`)·appName·webDir(`dist`)를 정의한다.

## 2. 개발 · 빌드

```bash
npm run cap:sync       # 웹 빌드 + dist를 android로 복사 + 플러그인 동기화
npm run cap:open       # Android Studio 열기 → Run으로 에뮬레이터/기기 실행
```

APK 산출(Android Studio 없이):
```bash
npm run build && npx cap sync android
cd android && ./gradlew assembleDebug     # 디버그 APK → android/app/build/outputs/apk/
```

릴리스 APK/AAB는 서명 키(keystore)로 서명해야 배포 가능(§10 절차와 유사, `gradlew bundleRelease`).

## 3. 폴더 저장 방식 (구현됨)

**권장 경로 — 로컬 폴더 + 동기화 에이전트** (`CapacitorFileSyncTarget`):
- 앱이 공식 `@capacitor/filesystem`으로 폰의 **공용 Documents 폴더 하위 `MoonwaveMemo/`** 에 `.md`를 저장한다.
- Documents는 공용이라 **Synology Drive / FolderSync / Syncthing** 같은 동기화 앱이 그 폴더를 NAS와 백그라운드 동기화할 수 있다 — Obsidian 사용자 표준 패턴.
- 설정 → 데이터 → 동기화 폴더에서 토글을 켜면 자동으로 `Documents/MoonwaveMemo`가 설정된다(별도 폴더 선택 없음).
- **단방향**: 모바일은 "앱 → 폴더" 기록만. 폴더 파일 직접 수정 감지(파일 감시)는 OS 제약으로 구현하지 않는다(§Phase 3 범위 제한). 데스크톱(Electron)이 양방향을 담당한다.

## 4. 임의 SAF 폴더 직접 선택 — 다음 스파이크 (미구현)

DS File/Synology Drive가 노출하는 **NAS 폴더를 앱에서 직접 지정(SAF)** 하는 경로는 별도 작업이다:
- 공식 `@capacitor/filesystem`은 사전 정의 디렉터리(Documents/External 등)만 쓰기 지원 — 사용자 지정 SAF 트리 쓰기는 범위 밖.
- `@capawesome/capacitor-file-picker`의 `pickDirectory`로 트리 URI를 얻고, `takePersistableUriPermission` + DocumentFile 쓰기를 **커뮤니티 플러그인 또는 커스텀 네이티브 코드**로 구현해야 한다.
- **실기기 검증 선행 필수** — 제공자 앱(DS File 등)별 쓰기 지원 편차, 네트워크 끊김 시 실패 처리(큐잉)를 확인한 뒤 `CapacitorSafFileSyncTarget`를 추가하고 `platform.ts` 팩토리에 분기한다.

## 5. 아직 남은 것

- 앱 아이콘·스플래시(`@capacitor/assets`로 생성).
- 릴리스 서명 keystore + Play Store 또는 사이드로드 배포 결정.
- SAF 직접 선택(4장) 실기기 스파이크.

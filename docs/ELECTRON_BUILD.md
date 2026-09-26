# Electron 데스크톱 앱 — 빌드 · 서명 · 배포 (§10 운영 계획)

Phase 2에서 추가된 Electron 데스크톱 앱의 패키징/서명/배포 절차와 보안 모델. **서명과 릴리스 발행은 인증서·토큰이 필요한 조직 작업**이라 여기서 절차로 문서화한다. 자동 업데이트는 아직 연결되지 않았다(4장).

**실제 동작:** 설치본은 로컬 `dist/`가 아니라 **운영 사이트 `https://memo.moonwave.kr`를 그대로 로드**한다(Firebase Google 로그인은 https 승인 도메인이 필요하다). 그래서 웹 배포가 곧 데스크톱 앱의 화면 업데이트이고, 인터넷 없이는 시작 화면이 뜨지 않는다. 데스크톱 셸이 더하는 것은 preload 브리지(`window.electronBridge`)를 통한 동기화 폴더의 네이티브 파일 접근·파일 감시뿐이다. 예전 `app://` 로컬 번들 프로토콜은 쓰이지 않아 제거했다(`dist/`는 아직 electron-builder `files`에 포함돼 설치본에 들어가지만 로드되지 않는다).

## 1. 로컬 실행

```bash
npm run dev            # 터미널 A: Vite 개발 서버 (localhost:3000)
npm run electron:dev   # 터미널 B: main/preload 번들 후 Electron 실행 (dev URL 로드)

# 설치본과 같은 구성(운영 사이트 로드)으로 확인 — 비패키지 실행에서만 쓰는 스위치
npm run electron:build && MEMO_DESKTOP_LIVE=1 npx electron .
```

- 비패키지 실행은 기본적으로 `http://localhost:3000`을 로드한다. `electron:preview`도 이름과 달리 dev URL을 로드하므로 dev 서버가 떠 있어야 한다(또는 `MEMO_DESKTOP_LIVE=1`).
- 동기화 폴더 실동작(폴더 지정 → `.md` 생성 → 외부 편집 반영 → NAS 미러)은 위 방식으로 수동 검증한다.

## 2. 설치파일 빌드

```bash
npm run dist:win     # Windows NSIS 설치파일 (.exe)
npm run dist:mac     # macOS .dmg
npm run dist:linux   # Linux AppImage
```

산출물은 `release/`에 생성된다(gitignore됨). 각 스크립트는 `build`(렌더러) → `electron:build`(main/preload esbuild 번들) → `electron-builder`를 순차 실행한다.

## 3. 코드 서명

electron-builder가 **환경변수를 자동으로 읽는다.** 인증서가 없으면 미서명 빌드(개발·테스트용)로 나온다.

### Windows (Authenticode)
```bash
export CSC_LINK="/path/to/cert.pfx"     # 또는 base64 인코딩 문자열
export CSC_KEY_PASSWORD="…"
npm run dist:win
```
- OV/EV 코드사인 인증서 필요. 미서명 시 SmartScreen 경고가 뜬다.

### macOS (Developer ID + 공증)
```bash
export CSC_LINK="/path/to/DeveloperID.p12"
export CSC_KEY_PASSWORD="…"
export APPLE_ID="you@example.com"
export APPLE_APP_SPECIFIC_PASSWORD="xxxx-xxxx-xxxx-xxxx"
export APPLE_TEAM_ID="XXXXXXXXXX"
npm run dist:mac
```
- `electron-builder.yml`의 `mac.hardenedRuntime: true` + `mac.notarize: true`로 공증이 자동 수행된다(위 환경변수 존재 시).
- Apple Developer 계정 + Developer ID Application 인증서 필요. **미서명·미공증 dmg는 Gatekeeper에서 실행이 차단**되고, 자동 업데이트도 적용되지 않는다.

## 4. 자동 업데이트 (electron-updater) — 아직 연결 안 됨

`electron/main.ts`가 설치본에서 `autoUpdater.checkForUpdatesAndNotify()`를 호출하고 피드는 `electron-builder.yml`의 `publish`(GitHub `hersouls/moonwave-memo-v1`)로 잡혀 있지만, **현재는 동작하지 않는다.** 저장소가 비공개라 앱이 토큰 없이 릴리스를 읽을 수 없고(앱에 토큰을 넣는 것은 금지), `.github/workflows/release-desktop.yml`은 `.exe`/`.blockmap`만 올리고 `latest.yml`을 올리지 않는다. 확인은 조용히 실패하고 끝난다. 지금 사용자는 설정의 "데스크톱 앱" 항목(`DesktopDownloadSection`, `/api/download-desktop` 프록시)에서 설치된 버전(`app.getVersion()`)과 최신 버전을 비교해 **"업데이트 내려받기"로 수동 업데이트**한다. 연결하려면 공개적으로 읽을 수 있는 피드(예: `generic` provider + 공개 URL)에 `latest.yml`과 설치파일을 올리고, 가능하면 서명(3장)을 먼저 갖춘다.

**(연결 후) 릴리스 발행 절차:**
1. `package.json`의 `version`을 올린다.
2. `GH_TOKEN`(repo 권한 Personal Access Token) + 서명 환경변수를 설정한다.
3. 발행:
   ```bash
   npm run dist:win -- --publish always     # (mac/linux 동일)
   ```
   → 설치파일 + `latest.yml`(업데이트 매니페스트)이 GitHub Releases에 업로드된다.
4. 설치된 앱은 다음 실행 시 자동으로 새 버전을 감지·다운로드하고, 종료 시 설치한다.

**주의:** macOS 자동 업데이트는 **서명·공증된 빌드에서만** 적용된다. Windows는 미서명도 적용되나 SmartScreen 경고가 남는다. 따라서 자동 업데이트의 실제 활성화는 3장 서명이 선행 조건이다.

## 5. 보안 모델

창이 **운영 사이트를 그대로** 띄우므로, 그 origin에서 도는 스크립트(XSS, 악성 배포, 의존성 사고)가 브리지를 통해 사용자가 고른 폴더 밖을 건드리지 못하게 하는 것이 목표다. 정책의 순수 로직은 `electron/security.ts`·`rootStore.ts`·`atomicWrite.ts`에 있고 `electron/__tests__/`에서 vitest로 검증한다.

- **렌더러**: `sandbox: true`, `contextIsolation: true`, `nodeIntegration: false`, `webSecurity` 기본값. sandbox preload는 `require('electron')`만 가능하므로 `scripts/build-electron.mjs`가 preload 번들에 다른 import(node 내장 모듈 등)가 섞이면 빌드를 실패시킨다. preload는 페이지 origin이 허용 origin일 때만 `window.electronBridge`를 노출한다. 앱 버전은 main이 `additionalArguments`(`--memo-version=`, `app.getVersion()`)로 넘긴다.
- **IPC 발신자 검사**: 모든 `ipcMain.handle`/`on`은 먼저 발신자가 **메인 창의 최상위 프레임**이고 origin이 정확히 `https://memo.moonwave.kr`인지 확인한다(비패키지 실행에서만 `http://localhost:3000` 추가). 팝업·iframe·다른 페이지는 거부된다.
- **폴더 허용 목록**: 렌더러는 더 이상 임의의 루트를 지정할 수 없다. 루트는 main이 띄운 네이티브 대화상자로만 목록(`userData/sync-roots.json`, 원자적 저장)에 들어간다 — 폴더 선택(`pickDirectory`), 폴더 다시 연결(`authorizeRoot`: 저장된 폴더에서 열리는 선택 창, 같은 폴더만 인정), 아래의 1회 레거시 확인. 모든 파일 IPC는 요청된 루트를 realpath로 정규화해 목록과 대조하고, 상대 경로 탈출 검사(`..`, 절대 경로, Windows 드라이브·`:`), 심볼릭 링크/정션을 통한 루트 밖 탈출 거부, 앱 데이터 폴더(userData) 접근 거부를 거친다. 파일 감시는 링크를 따라가지 않고 루트 안의 일반 `.md` 파일만 읽어 메인 창에만 보낸다.
- **기존 사용자(업그레이드) 처리**: 이전 버전은 선택한 폴더를 웹 저장소에만 두었으므로 main의 목록이 비어 있다. 첫 실행 때 프로필에 웹 저장소(IndexedDB/Local Storage)가 이미 있으면(=업그레이드) **30일 동안** 목록에 없는 기존 폴더를 쓰려 할 때 네이티브 확인창("이전에 지정한 동기화 폴더를 계속 사용할까요?" + 전체 경로, 허용/허용 안 함)을 한 번 띄우고, 허용하면 기록한다. 주 폴더는 앱 시작 시, 미러 폴더는 첫 미러 쓰기 때 뜬다. 숨김 폴더(`.ssh` 등)·앱 데이터 폴더와 겹치는 경로는 묻지 않고 거부하며, 한 세션에 최대 5번까지만 묻는다. 새로 설치했거나 목록 파일이 손상된 경우, "허용 안 함"을 누른 경우, 30일이 지난 경우에는 설정 › 동기화 폴더의 **"폴더 다시 연결"**(주 폴더) 또는 **"폴더 변경"**/미러 삭제 후 재추가로 한 번 다시 선택하면 된다.
- **창·탐색**: `window.open`은 Google 로그인 팝업(`https://moonwave-memo-v1.firebaseapp.com/__/auth/…`, `https://accounts.google.com`)만 앱 안에서 연다 — preload 없이, sandbox·contextIsolation 켠 채로. 그 밖의 http(s) 링크는 시스템 브라우저로, 나머지 스킴은 거부. 메인 창의 `will-navigate`/`will-redirect`는 앱 origin만 허용하고 외부 http(s)는 시스템 브라우저로 넘긴다(예: 설치본 다운로드의 GitHub 리디렉션). `<webview>`는 금지.
- **원자적 쓰기**: 같은 폴더의 임시 파일(`.memo-tmp-*`)에 쓰고 fsync 후 rename한다. Windows에서 대상이 잠겨 있으면 몇 번 재시도하고, 그래도 안 되면 기존처럼 제자리 덮어쓰기로 저장한다.
- **단일 인스턴스**: 두 번째 실행은 기존 창을 앞으로 가져오고 종료한다(같은 동기화 폴더에 두 프로세스가 쓰지 않도록).

## 6. 아직 남은 것

- **허용 목록 정리**: 미러를 지우거나 동기화 폴더를 끄거나 바꿔도 예전 루트는 목록에 남는다(렌더러가 목록을 줄이는 IPC가 아직 없음). `syncFolderService`에서 `forgetRoot` 같은 호출을 추가하면 된다.
- **다시 연결 후 파일 감시**: `reconnectSyncFolder`가 감시 루트 없이 `setActiveTarget`을 불러, "폴더 다시 연결" 직후에는 외부 편집 반영이 다음 실행부터 켜진다.
- **권한 요청 핸들러/CSP**: 알림·카메라 등 권한 요청을 앱 origin으로 제한하는 `session.setPermissionRequestHandler`는 아직 없다.
- **앱 아이콘**: `build/` 디렉터리에 `icon.ico`(Win)/`icon.icns`(mac)/`icon.png`(Linux)을 넣으면 electron-builder가 사용한다. 현재는 기본 아이콘.
- **선택적 한글 폰트 오프라인**: 기본 폰트 Pretendard는 로컬 번들됨(§4.8). NanumSquare 계열·MaruBuri는 CDN 로드 + 시스템 폰트 폴백(오프라인 시 사용자 선택 폰트만 시스템으로 대체). 전량 번들은 앱 용량 ~15MB↑ 증가라 보류.

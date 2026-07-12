# Electron 데스크톱 앱 — 빌드 · 서명 · 배포 (§10 운영 계획)

Phase 2에서 추가된 Electron 데스크톱 앱의 패키징/서명/자동 업데이트 절차. 코드는 모두 구현돼 있고, **서명과 릴리스 발행은 인증서·토큰이 필요한 조직 작업**이라 여기서 절차로 문서화한다.

## 1. 로컬 실행 · 미리보기

```bash
npm run dev            # 터미널 A: Vite 개발 서버 (localhost:3000)
npm run electron:dev   # 터미널 B: main/preload 번들 후 Electron 실행 (dev URL 로드)

npm run electron:preview   # 프로덕션 모드: 웹+Electron 빌드 후 app:// 프로토콜로 실행
```

- `electron:preview`가 실제 배포와 가장 가까운 실행(커스텀 `app://` 프로토콜, 로컬 fs 백엔드, 파일 감시).
- 동기화 폴더 실동작(폴더 지정 → `.md` 생성 → 외부 편집 반영 → NAS 미러)은 이 모드에서 수동 검증한다.

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

## 4. 자동 업데이트 (electron-updater + GitHub Releases)

코드는 구현돼 있다 — `electron/main.ts`가 프로덕션 빌드에서 `autoUpdater.checkForUpdatesAndNotify()`를 호출하고, 피드는 `electron-builder.yml`의 `publish`(GitHub `hersouls/moonwave-memo-v1`)로 설정돼 있다.

**릴리스 발행 절차:**
1. `package.json`의 `version`을 올린다.
2. `GH_TOKEN`(repo 권한 Personal Access Token) + 서명 환경변수를 설정한다.
3. 발행:
   ```bash
   npm run dist:win -- --publish always     # (mac/linux 동일)
   ```
   → 설치파일 + `latest.yml`(업데이트 매니페스트)이 GitHub Releases에 업로드된다.
4. 설치된 앱은 다음 실행 시 자동으로 새 버전을 감지·다운로드하고, 종료 시 설치한다.

**주의:** macOS 자동 업데이트는 **서명·공증된 빌드에서만** 적용된다. Windows는 미서명도 적용되나 SmartScreen 경고가 남는다. 따라서 자동 업데이트의 실제 활성화는 3장 서명이 선행 조건이다.

## 5. 아직 남은 것

- **앱 아이콘**: `build/` 디렉터리에 `icon.ico`(Win)/`icon.icns`(mac)/`icon.png`(Linux)을 넣으면 electron-builder가 사용한다. 현재는 기본 아이콘.
- **선택적 한글 폰트 오프라인**: 기본 폰트 Pretendard는 로컬 번들됨(§4.8). NanumSquare 계열·MaruBuri는 CDN 로드 + 시스템 폰트 폴백(오프라인 시 사용자 선택 폰트만 시스템으로 대체). 전량 번들은 앱 용량 ~15MB↑ 증가라 보류.

# Moonwave Memo 전체 개발 방향 (Development Roadmap)

> 작성일: 2026-07-11
> 목표: 브라우저 기반 메모 앱을 **"파일 기반 로컬 저장 + 멀티 디바이스 동기화 + AI 시맨틱 검색"** 생태계로 확장

---

## 1. 개요 & 목표

### 현재 상태

- **형태**: React 19 + TypeScript + Vite 기반 웹 앱 (SPA + PWA)
- **저장**: 브라우저 IndexedDB (Dexie, `MemoApp` DB v6) — 메모 원본은 브라우저 내부에 존재
- **동기화**: Firebase Firestore (로그인 시 기기 간 클라우드 동기화, 오프라인 큐 지원)
- **내보내기**: 전체 JSON 백업, 메모별 .md/.html/PNG 다운로드 (모두 브라우저 다운로드 방식, 단건)

### 확장 목표

| # | 목표 | 요약 |
|---|------|------|
| 1 | **Sync 폴더** | Obsidian처럼 메모를 지정 폴더에 `.md`/`.html` 파일로 자동 저장 |
| 2 | **PC 설치파일** | Electron 패키징 → `.exe`/`.dmg` 설치 프로그램, OS 파일시스템 자유 접근 |
| 3 | **갤럭시 APK** | Capacitor 패키징 → 안드로이드 앱, 폰 폴더에 파일 저장 |
| 4 | **NAS 연동** | PC 앱의 저장 위치를 NAS 네트워크 폴더로 지정 |
| 5 | **HTML 지원** | 메모 → HTML 저장·동기화 + 외부 HTML 가져오기(import) + 미리보기 |
| 6 | **벡터 DB** | 메모를 임베딩하여 시맨틱 검색·RAG·AI(데미안) 강화 |
| 7 | **별도 인덱서** | 폴더의 파일들을 벡터 DB 파일로 변환하는 독립 프로그램 (선택) |

---

## 2. 전체 아키텍처

핵심 원칙: **폴더의 파일이 Firebase에 직접 붙는 것이 아니라, 항상 각 기기의 앱이 중계한다.**
동기화의 허브는 기존 Firebase를 그대로 사용하고, 로컬 폴더는 각 기기에서 앱이 읽고 쓰는 저장 위치다.

```
              ┌──────────────────────────────────────┐
              │        Firebase Firestore            │
              │      (기기 간 동기화 허브 — 기존)      │
              └───────▲──────────────────▲───────────┘
                      │                  │
        ┌─────────────┴────┐      ┌──────┴────────────┐
        │   PC 앱 (Electron)│      │ 갤럭시 앱 (Capacitor)│
        │  .exe / .dmg 설치 │      │     APK 설치        │
        └───▲──────────▲───┘      └──────▲─────────────┘
            │ 읽기/쓰기  │                │ 읽기/쓰기 (SAF)
            │ + 파일감시 │                │
   ┌────────┴───┐  ┌───┴──────────┐  ┌───┴──────────────┐
   │ 로컬 폴더    │  │ NAS 공유 폴더 │  │ 폰 내부 저장소 폴더 │
   │ (.md/.html) │  │ (Z:\Memo 등) │  │  (.md/.html)      │
   └────────────┘  └───────▲──────┘  └───────────────────┘
                           │ 파일 읽기
                  ┌────────┴─────────┐
                  │  별도 인덱서 프로그램 │
                  │ (PC 설치 or NAS Docker)│
                  │ 파일 → 임베딩 → 벡터DB │
                  └────────┬─────────┘
                           ▼
                  ┌──────────────────┐
                  │  벡터 DB 파일      │
                  │ (SQLite .db 권장) │
                  └──────────────────┘
```

### 데이터 흐름 예시 (갤럭시에서 메모 수정 시)

1. 갤럭시 앱에서 메모 저장 → 폰 폴더에 `.md` 파일 기록 + Firebase로 동기화 (기존 기능)
2. PC 앱이 Firebase에서 변경 수신 (기존 기능) → PC/NAS 폴더에 `.md` 파일 기록
3. 인덱서가 NAS 폴더 변경 감지 → 해당 파일만 재임베딩 → 벡터 DB 갱신

### 방향별 난이도

| 방향 | 난이도 | 비고 |
|------|--------|------|
| 앱에서 수정 → 폴더 + Firebase 반영 | 쉬움 | 모바일 포함 모든 기기에서 매끄럽게 동작 |
| 폴더 파일 직접 수정 → 앱 → Firebase 반영 | 어려움 | PC(Electron)는 파일 감시로 가능, 모바일은 사실상 곤란 |

---

## 3. 현재 코드베이스 자산 (재사용 대상)

새로 만들 것보다 **이미 있는 코드를 재사용**하는 것이 원칙이다.

### 3.1 백업 / 내보내기

| 파일 | 기능 | 재사용처 |
|------|------|----------|
| `src/services/backup.ts` | 전체 JSON 백업 생성/다운로드/복원 (`createBackup`, `downloadBackup`, `restoreFromBackup`) | Sync 폴더 초기 전체 내보내기 |
| `src/components/editor/EditorHeader.tsx` | 메모 → `.md` 내보내기 (`handleExportMarkdown`) | 폴더 저장 시 md 직렬화 로직 |
| `src/components/editor/ShareLinkModal.tsx` | 메모 → `.html` 생성·다운로드 + iframe 미리보기 | HTML 저장 형식, HTML 미리보기 |
| `src/services/shareLink.ts` | `generateShareHTML` (이스케이프 처리된 안전한 HTML 생성) | .html 파일 저장 포맷 |

### 3.2 저장 / 동기화

| 파일 | 기능 | 재사용처 |
|------|------|----------|
| `src/services/database.ts` | Dexie `MemoApp` DB (v6): memos, folders, memoImages, memoVersions, demianChats, pendingSyncs | 벡터 저장 시 스키마 확장 지점 |
| `src/services/firestoreSync.ts` | Firebase 양방향 동기화 + 충돌 처리 | 폴더 동기화의 허브로 그대로 사용 |
| `src/services/offlineQueue.ts` | 오프라인 변경 큐잉 | NAS 오프라인 시 재시도 패턴 참고 |

### 3.3 미리보기

| 파일 | 기능 | 비고 |
|------|------|------|
| `src/components/editor/MarkdownPreview.tsx` | react-markdown + `rehypeRaw` 렌더링 — 본문 내 HTML도 실제 렌더링됨 | ⚠️ **정화(sanitize) 없음** — HTML 가져오기 도입 시 DOMPurify 필수 (4.4 참고) |
| `src/components/editor/MemoEditor.tsx` | 모바일 편집↔미리보기 탭, 데스크톱 분할 화면(스크롤 미러링) | HTML 미리보기 UI 그대로 활용 |

### 3.4 AI / 임베딩 (벡터 DB 기반의 ~70%가 이미 존재)

| 파일 | 기능 | 상태 |
|------|------|------|
| `src/services/embeddingService.ts` | OpenAI `text-embedding-3-small`(1536차원) 임베딩 생성, 코사인 유사도, localStorage 캐시 | 동작 중 (Semantic Canvas에서만 사용, 80개 제한) |
| `api/langchain/search.ts` | 하이브리드 RAG 검색 (임베딩 70% + 키워드 30% + LLM 재정렬) | **구현돼 있으나 미사용 (잠자는 코드)** |
| `api/lib/models.ts` | `createEmbeddingModel()` — OpenAIEmbeddings | 인덱서와 모델 통일 기준 |
| `src/components/dashboard/SemanticCanvas.tsx` | 임베딩 → PCA 2D 시각화 | 유일한 임베딩 소비처 |
| `api/langchain/demian.ts` | 데미안 AI 챗 (LangGraph) — 현재 **키워드 매칭** 기반 메모 검색 | 벡터 검색으로 업그레이드 대상 |
| `src/hooks/useMemoFilters.ts` | Fuse.js 퍼지 검색 (현재 메모 검색) | 시맨틱 검색과 하이브리드로 결합 |

---

## 4. 단계별 로드맵

### Phase 1 — 웹 Sync 폴더 (File System Access API) · 최소 투자 검증

**목표**: 설치파일 없이, 현재 웹 앱에서 폴더 저장 개념을 검증한다.

- `showDirectoryPicker()`로 사용자가 Sync 폴더 지정 → 폴더 핸들을 IndexedDB에 보관
- 메모 저장/수정 시 해당 폴더에 `제목.md` 자동 기록, 메모 폴더 구조를 하위 디렉터리로 재현
- 설정 모달(`SettingsModal.tsx`)에 "동기화 폴더" 섹션 추가 (UI 상세는 §4.5 참조)

**제약 (알고 시작할 것)**
- Chromium 계열(Chrome/Edge) 전용 — Safari/Firefox/iOS 미지원
- 세션이 바뀌면 폴더 권한 재허용 필요할 수 있음
- 탭이 열려 있을 때만 동작, 백그라운드 동기화 불가 → 이 한계가 Phase 2의 근거

**완료 기준**: Chrome에서 폴더 지정 → 메모 작성 → 폴더에 .md 생성 확인

---

### Phase 2 — PC 데스크톱 앱 (Electron) + NAS 지원 · 핵심 단계

**목표**: `.exe`(Windows)/`.dmg`(Mac) 설치파일. Obsidian 수준의 폴더 접근.

- Electron으로 기존 Vite 빌드 결과물 래핑 (웹 코드 최대한 그대로 재사용)
- `electron-builder`로 설치파일 생성
- 네이티브 파일 API로 Sync 폴더 읽기/쓰기 — **권한 재요청 없음, 상시 접근**
- **파일 감시(chokidar 등)**: 폴더의 .md 파일을 외부에서 직접 수정해도 감지 → 앱으로 읽어들여 Firebase로 동기화 (**양방향 완성**)
- **NAS 지원**: 저장 경로로 네트워크 드라이브(`Z:\Memo` 등) 지정 가능 — 앱은 일반 폴더와 동일하게 취급
  - NAS 오프라인 시: 쓰기 실패를 큐잉하고 재연결 시 재시도 (offlineQueue 패턴 재사용)
- **다중 폴더 미러링**: 저장 대상을 여러 개(예: 로컬 폴더 + NAS 공유폴더) 지정 가능. **주(主) 로컬 + 보조(NAS 미러)** 구조 권장
  - **로컬 = 주 저장소**: 즉시 읽기/쓰기, **파일 감시(외부 수정 감지)는 로컬만** 수행
  - **NAS = 미러/백업**: 로컬 쓰기 결과를 복사만 함(감시 X). 오프라인이면 큐잉 후 재연결 시 반영
  - 이유: 원본을 로컬로 명확히 하여 쓰기 루프·충돌 회피, 편집 지연 없음. 대상 목록으로 로컬 1 + NAS N개까지 확장 가능
  - 주의: 앱이 방금 쓴 파일은 감시기가 무시하도록 "자기 쓰기 억제(write suppression)" 처리, NAS 쓰기는 디바운스
- 충돌 규칙: 기존 firestoreSync의 충돌 처리(최신 우선)를 파일 계층에도 동일 적용
- 설정 UI: `SettingsModal`에 "주 저장 폴더" + "미러 폴더 목록" 지정란 추가

**기술 선택**: Electron 권장 (Tauri 대비 자료·성숙도 우위, Obsidian도 Electron). 설치 용량이 중요해지면 Tauri 재검토.

**완료 기준**: 설치파일로 설치 → NAS 폴더 지정 → 앱 수정·파일 직접 수정 양방향 모두 반영 확인

---

### Phase 3 — 갤럭시 APK (Capacitor)

**목표**: 안드로이드 설치 앱 + 폰 폴더 저장.

- Capacitor로 웹 코드 래핑 → APK 빌드
- 안드로이드 Scoped Storage(SAF): 사용자가 저장 폴더를 1회 지정 → 그 안에서 읽기/쓰기
- 동기화는 기존 Firebase 경유 (폰 ↔ PC 파일 공유의 허브)
- **범위 제한**: 모바일은 "앱에서 수정 → 폴더 기록" 단방향 중심. 폴더 파일 직접 수정 감지는 모바일에서 구현하지 않음 (OS 제약)
- **모바일 → NAS 연동 경로** (앱이 직접 SMB를 다루는 것은 비권장이지만, 아래 두 경로는 현실적)
  1. **로컬 폴더 + 동기화 에이전트 (권장)**: 앱은 폰 로컬 폴더에만 저장하고, Synology Drive / FolderSync / Syncthing이 그 폴더를 백그라운드로 NAS와 동기화. 오프라인에도 안전하고 앱 구현 부담 없음 — Obsidian 사용자들의 표준 패턴
  2. **DS File을 SAF 제공자로 직접 선택**: 폴더 지정(SAF) 시 DS File/Synology Drive가 노출하는 NAS 폴더를 직접 선택. 네트워크 끊김 시 저장 실패(큐잉 필요), 제공자 앱에 따라 쓰기 지원 편차 → 실기기 검증 필요

**완료 기준**: APK 설치 → 폴더 지정 → 앱에서 메모 수정 시 폰 폴더 + PC/NAS 폴더 모두 반영 (NAS 연동은 Synology Drive 동기화 조합으로 확인, DS File SAF 직접 선택은 실기기 검증)

---

### Phase 4 — HTML 지원 강화

**목표**: 메모 ↔ HTML 파일 양방향.

1. **HTML 저장**: Sync 폴더 저장 형식 옵션에 `.html` 추가 (`.md` 단독 / `.html` 단독 / 둘 다) — `generateShareHTML` 재사용
2. **HTML 가져오기(import)**: 외부 `.html` 파일 → 본문 추출 → TipTap 문서로 변환 → 새 메모 저장 (저장 즉시 일반 메모와 동일하게 Firebase·폴더 동기화)
3. **미리보기**: 기존 `MarkdownPreview` 분할/탭 미리보기 + `ShareLinkModal`의 sandbox iframe 방식 재사용

**⚠️ 보안 필수 사항**
- `MarkdownPreview.tsx`는 `rehypeRaw`로 원시 HTML을 **정화 없이** 렌더링 중 — `<img onerror=...>` 류 XSS 벡터 존재
- 외부 HTML을 가져오는 순간 신뢰할 수 없는 입력이 유입되므로, **DOMPurify(또는 rehype-sanitize) 도입은 이 Phase의 선행 조건**
- 알려진 한계: 복잡한 HTML(스크립트, 고급 CSS, 표 병합)은 TipTap 서식으로 단순화됨. 왕복 변환(md→html→md)의 100% 일치는 보장하지 않음

**완료 기준**: 외부 HTML 가져오기 → 메모 생성 → 미리보기 정상 + XSS 페이로드 무력화 확인

---

### Phase 5 — 벡터 DB & 시맨틱 검색

**목표**: 잠자는 인프라를 깨워 메모를 실제 벡터 DB로 운영한다.

**5-A. 앱 내 벡터 DB (필수)**
1. **영구 저장**: Dexie 스키마 v7 — `memoEmbeddings` 테이블(memoId, vector, contentHash, updatedAt) 신설. localStorage 캐시·80개 제한 폐지
2. **임베딩 파이프라인**: 메모 생성/수정 시 자동 임베딩 (contentHash로 변경분만, 디바운스 적용)
3. **검색 연결**: 미사용 상태인 `semanticSearchWithRAG` / `api/langchain/search.ts`를 검색 UI에 연결 — Fuse.js 키워드 + 임베딩 하이브리드
4. **데미안 업그레이드**: 키워드 매칭 도구를 벡터 검색 기반으로 교체 → 의미로 관련 메모를 찾아 답변
5. 동기화: 임베딩은 로컬 재계산 가능하므로 Firebase 동기화 대상에서 제외 (각 기기가 자체 계산) — 비용/복잡도 절감

**5-B. 별도 인덱서 프로그램 (선택)**
- 독립 설치 프로그램(Node.js 기반 CLI/서비스, `.exe` 패키징) 또는 **NAS Docker 컨테이너**로 실행
- NAS 폴더 감시 → 변경 파일만 텍스트 추출(md 파싱/HTML 태그 제거) → 임베딩 → 벡터 DB 파일 갱신
- **벡터 DB 파일 형식**: SQLite + sqlite-vec (`.db` 단일 파일) 권장 — 백업·이동 용이. 대안: LanceDB(`.lance` 폴더)
- **증분 처리**: 파일 해시/수정시각 기록으로 변경분만 재임베딩
- **임베딩 모델 통일 원칙**: 앱과 인덱서 모두 `text-embedding-3-small` 사용 (모델이 다르면 벡터 호환 불가). 오프라인/프라이버시가 우선이면 로컬 모델(Ollama `nomic-embed-text` 등)로 **양쪽을 함께** 교체

**완료 기준**: 의미 기반 검색이 키워드 검색으로 못 찾던 메모를 찾아냄, 데미안이 관련 메모를 벡터 검색으로 인용

---

## 4.5 동기화 폴더 UI/UX 명세

### 위치

- **설정(Settings) 모달 → "동기화 폴더" 섹션** (`src/components/layout/SettingsModal.tsx`)
- 기존 섹션 구조(화면 테마 / 글자 설정 / 프로필 / 백업 및 복원 / 데이터 관리)에 맞춰 **"백업 및 복원" 인근에 새 `<section>`** 추가
- 진입: 설정(톱니바퀴) 아이콘 → 모달 → 해당 섹션

### 섹션 레이아웃

```
[동기화 폴더]                                    ⦿ 켬 / ○ 끔   ← ① 활성화 토글

주 저장 폴더:  D:\Memo            [폴더 선택]      ← ② 폴더 지정 버튼
미러 폴더:     Z:\NAS\Memo        [+ 폴더 추가]    ← ③ (Electron) 로컬+NAS 다중 대상
저장 형식:     (•) .md  ( ) .html  ( ) 둘 다        ← ④ 파일 형식
상태:          ✓ 방금 저장됨 · 파일 128개          ← ⑤ 동기화 상태 배지
              [지금 전체 내보내기]                  ← ⑥ 기존 메모 일괄 파일화
```

### 요소별 동작

1. **활성화 토글** — 켜면 이후 메모 저장 시 폴더에도 파일 기록. `settingsStore`에 상태 persist
2. **폴더 선택 버튼** — OS 폴더 선택창 호출
   - Electron: 네이티브 폴더 선택 대화상자 (IPC)
   - 웹/PWA(Chrome·Edge): `showDirectoryPicker()` → 폴더 핸들 IndexedDB 보관
3. **미러 폴더 추가** (Electron 전용) — 주(로컬) + 미러(NAS 등) 다중 대상 목록 관리 (Phase 2 미러링 설계)
4. **저장 형식** — `.md` / `.html` / 둘 다 (Phase 4)
5. **상태 배지** — 기존 `SyncStatusBadge` 패턴 재사용: 마지막 저장 시각, 파일 개수, NAS 오프라인 시 "대기 중"
6. **전체 내보내기** — 활성화 시 기존 메모 전부를 폴더로 1회 채움 (`backup.ts` 재사용)

### 플랫폼별 UI 게이팅

| 환경 | 섹션 상태 |
|------|-----------|
| Electron (PC) | 전체 활성, 미러 폴더 노출 |
| Chrome/Edge PWA·브라우저 | 활성 + "브라우저가 열려 있을 때만 동작" 안내 문구 |
| iOS/Safari/Firefox PWA·미지원 | **비활성(회색) + "이 기기는 폴더 저장 미지원 — Firebase로만 동기화" 안내** |

- 기능 지원 여부는 `window.showDirectoryPicker` 존재 여부 / Electron 브리지 존재 여부로 런타임 감지

### 신규 디바이스 온보딩 흐름

1. 로그인 → Firebase에서 메모 데이터를 로컬 DB로 수신 (기존 동기화)
2. 설정 → 동기화 폴더 → 토글 켜고 폴더 1회 지정
3. "전체 내보내기" 실행 → 받아온 메모가 지정 폴더에 파일로 채워짐
   - (Firebase는 파일/폴더가 아닌 메모 데이터를 보관 → 파일은 각 기기 앱이 폴더에 재구성)

---

## 5. 기술 선택 요약

| 항목 | 선택 | 근거 |
|------|------|------|
| PC 패키징 | **Electron** + electron-builder | 성숙도·자료 풍부, Obsidian 동일 스택, 파일 감시 용이. 용량 이슈 시 Tauri 재검토 |
| 모바일 패키징 | **Capacitor** | 웹 코드 재사용 극대화, 네이티브 파일 플러그인(SAF) 지원 |
| 동기화 허브 | **기존 Firebase** | 충돌 처리·오프라인 큐 이미 구현됨. NAS를 허브로 삼는 방식은 모바일 연동·충돌 처리 부담으로 비권장 |
| 파일 형식 | `.md` 기본 + `.html` 옵션 | md는 이식성(Obsidian 호환), html은 서식 보존 |
| HTML 정화 | **DOMPurify** | Phase 4 선행 조건 |
| 벡터 저장(앱) | Dexie 신규 테이블 | 기존 DB 인프라 재사용, 수천 개 규모까지 로컬 코사인 검색으로 충분 |
| 벡터 저장(인덱서) | SQLite + sqlite-vec (`.db`) | 단일 파일, NAS 보관·백업 용이 |
| 임베딩 모델 | OpenAI `text-embedding-3-small` (앱·인덱서 통일) | 기존 코드와 호환. 프라이버시 요구 시 로컬 모델로 일괄 전환 |

---

## 6. 제약 · 리스크

| 리스크 | 내용 | 대응 |
|--------|------|------|
| 브라우저 API 한계 | File System Access API는 Chrome/Edge 전용, 권한 재요청, 백그라운드 불가 | Phase 1은 검증용으로 한정, 본편은 Phase 2(Electron) |
| 모바일 역방향 감지 | 폰에서 폴더 파일 직접 수정 감지 곤란 | 모바일은 "앱 경유 수정"만 지원한다고 명시 |
| 동시 편집 충돌 | 여러 기기/폴더 직접 수정 병행 시 덮어쓰기 위험 | Firebase 충돌 규칙(최신 우선)을 파일 계층에 일관 적용, 필요 시 충돌 사본 생성 |
| NAS 오프라인 | 네트워크 끊김 시 저장 실패 | 쓰기 큐잉 + 재연결 시 재시도 (offlineQueue 패턴) |
| XSS | MarkdownPreview 무정화 + 외부 HTML 유입 | DOMPurify를 Phase 4 이전에 도입 (기존 콘텐츠에도 적용 검토) |
| 임베딩 비용/의존 | OpenAI API 비용, 오프라인 불가 | 변경분만 임베딩(해시 기반), 장기적으로 로컬 모델 옵션 |
| 왕복 변환 손실 | md↔html↔TipTap 변환 시 서식 단순화 | 한계로 문서화, 원본은 항상 앱 DB(md) 기준 |

---

## 7. 권장 우선순위

```
Phase 1 (웹 Sync 폴더)     ─ 작음   ─ 개념 검증, 즉시 체감
Phase 2 (PC Electron+NAS)  ─ 큼     ─ 핵심 가치, Obsidian 수준 달성
Phase 3 (갤럭시 APK)       ─ 중간   ─ 멀티 디바이스 완성
Phase 4 (HTML 강화)        ─ 중간   ─ 보안 정화 포함
Phase 5 (벡터 DB)          ─ 중간   ─ 기반 70% 존재, 독립 진행 가능
```

- **Phase 1 → 2 → 3**은 순차 진행 권장 (각 단계가 다음 단계의 검증대)
- **Phase 4, 5는 서로 독립적**이며 Phase 2와 병행 가능
- Phase 5-B(별도 인덱서)는 5-A(앱 내 벡터 검색)로 충분한지 확인 후 착수 판단

---

## 부록: 자주 나온 질문 정리

- **폴더 파일이 Firebase와 직접 연동되나?** → 아니오. 항상 각 기기의 앱이 중계한다. 앱이 꺼져 있으면 폴더도 갱신되지 않는다.
- **APK로 PC 폴더 저장이 되나?** → 아니오. APK는 안드로이드 전용. PC는 Electron 설치파일, 폰은 APK로 각각 빌드 (코드는 공유).
- **벡터 DB 파일 확장자는?** → 정해진 하나는 없음. 본 로드맵은 SQLite `.db` 단일 파일 권장 (대안: LanceDB `.lance` 폴더).
- **HTML 미리보기 되나?** → 이미 가능 (MarkdownPreview + ShareLinkModal iframe). 단, 외부 HTML 도입 전 정화 필수.

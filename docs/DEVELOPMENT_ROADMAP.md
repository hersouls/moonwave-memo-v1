# Moonwave Memo 전체 개발 방향 (Development Roadmap)

> 작성일: 2026-07-11 · **개정: 2026-07-12 (v2)**
> 목표: 브라우저 기반 메모 앱을 **"파일 기반 로컬 저장 + 멀티 디바이스 동기화 + AI 시맨틱 검색"** 생태계로 확장
>
> v2 개정 요약: 전체 코드베이스 대조 감사(83건 점검, 핵심 16건 교차 검증) 반영.
> §2.1 동기화 데이터 인벤토리, §4 공통 설계 명세(파일 포맷·이미지·삭제·충돌·쓰기 프로토콜), §8 보안·프라이버시, §10 운영·호환성 신설. 자산 표(§3)의 재사용 한계 명시, 기술 선택(§7) 2026-07 기준 갱신.

---

## 1. 개요 & 목표

### 현재 상태

- **형태**: React 19 + TypeScript + Vite 기반 웹 앱 (SPA + PWA — PWA는 수제 `public/sw.js`, vite-plugin-pwa 아님)
- **저장**: 브라우저 IndexedDB (Dexie, `MemoApp` DB v6, 테이블 7개) — 메모 원본은 브라우저 내부에 존재
- **동기화**: Firebase Firestore (로그인 시 자동 동기화, 오프라인 큐 일부 지원) — **단, 동기화 범위는 메모·폴더·설정 일부에 한정** (→ §2.1 인벤토리)
- **내보내기**: 전체 JSON 백업(demianChats·pendingSyncs 제외), 메모별 .md/.html/PNG 다운로드 (모두 브라우저 다운로드 방식, 단건)

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
파일 트리는 **원본이 아니라 투영(projection)** — 원본은 항상 앱 DB이며, 앱이 꺼져 있으면 폴더(특히 NAS 미러)는 몇 시간~며칠 뒤처질 수 있다.

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

### 2.1 동기화 데이터 인벤토리 ⚠️ 설계의 전제

Firebase가 "모든 것"을 옮겨주지 않는다. 실제 동기화 범위 (코드 확인 기준):

| 데이터 (Dexie 테이블) | 클라우드 동기화 | 비고 |
|----------------------|:---:|------|
| memos | ✓ `users/{uid}/memos` | 단, `ephemeralExpiresAt`·`contextSnapshot`·`accessLog` 필드는 **미동기화** (`firestoreSync.ts` pushMemo 필드 목록) |
| folders | ✓ `users/{uid}/folders` | 단층 구조 (하위 폴더 없음 — parentId 부재) |
| 설정(settingsStore) | 부분 ✓ (7개 필드) | `settingsSync.ts` 허용목록 방식. API 키·기기 전용 설정은 의도적으로 제외 |
| **memoImages** | **✗** | base64 데이터 URL, 본문에서 `memo-image:{로컬id}` 스킴으로 참조 — **타 기기에서는 깨진 참조** |
| memoVersions (버전 이력) | ✗ | |
| demianChats (AI 채팅) | ✗ | 로컬 memoId 키(`&memoId`) — 기기 간 정체성 자체가 없음 |
| ambientImages | ✗ | 기기 로컬 캐시 성격 |
| pendingSyncs | ✗ | 오프라인 큐 자체 (동기화 대상 아님) |

**설계 결론**:
- "새 기기에서 로그인 → 전체 내보내기 → 폴더 재구성"(§6 온보딩)은 **메모 텍스트+메타데이터에만 성립**한다. 이미지·버전 이력·AI 채팅은 새 기기에 도착하지 않는다.
- 따라서 **이미지 전략(§4.2)이 Phase 2 전 선행 결정 사항**이다.

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

## 3. 현재 코드베이스 자산 (재사용 대상과 한계)

새로 만들 것보다 **이미 있는 코드를 재사용**하는 것이 원칙이다. 단, v2 감사 결과 일부 자산은 "그대로 재사용"이 아니라 **패턴 참고 + 신규 구현**이 정확한 표현이다 — 한계 열을 반드시 읽을 것.

### 3.1 백업 / 내보내기

| 파일 | 기능 | 재사용 범위와 한계 |
|------|------|------|
| `src/services/backup.ts` | 전체 JSON 백업 생성/다운로드/복원 (`createBackup`/`downloadBackup`/`restoreFromBackup`) — memos·folders·memoImages·memoVersions·ambientImages + 설정 일부 | **데이터 열거 패턴만 재사용.** 단일 JSON 블롭 생성기이므로 "폴더 초기 전체 내보내기"에는 메모→파일 직렬화 서비스(§4.1)를 **신규 구현**해야 함. demianChats·pendingSyncs는 백업에서도 제외 |
| `src/components/editor/EditorHeader.tsx` | 메모 → `.md` 내보내기 (`handleExportMarkdown`) | 실체는 `# 제목\n\n본문` 3줄 인라인 템플릿 — front-matter·태그·날짜 없음, `memo-image:` 참조 미해결, 파일명 무정화. **직렬화는 신규 서비스로 추출·대체**하고 단건 내보내기도 그 서비스를 쓰도록 통합 |
| `src/components/editor/ShareLinkModal.tsx` | 메모 → `.html` 생성·다운로드 + sandbox iframe 미리보기 | 미리보기 UI·페이지 셸은 재사용 가능 |
| `src/services/shareLink.ts` | `generateShareHTML` (전체 escape 후 정규식 변환 — 안전) | **공유 카드용 간이 변환기** — h1-h3·굵게·기울임·체크박스 수준만 지원, 이미지·하이퍼링크·표·중첩 목록 미지원, 원시 HTML은 문자 그대로 노출. **"서식 보존" HTML 파일 포맷으로는 부적합** (→ Phase 4는 실제 md→HTML 파이프라인 사용) |

### 3.2 저장 / 동기화

| 파일 | 기능 | 재사용 범위와 한계 |
|------|------|------|
| `src/services/database.ts` | Dexie `MemoApp` DB (v6, **테이블 7개**): memos, folders, memoImages, memoVersions, **ambientImages**, demianChats, pendingSyncs | v7 확장 지점. **Dexie는 다운그레이드 불가** — v7 배포 후 앱 롤백 시나리오는 §10 참조 |
| `src/services/firestoreSync.ts` | Firebase 양방향 동기화 + 충돌 처리 | 충돌 규칙의 실체: **updatedAt ISO 문자열 비교, 문서 단위 최신 우선(LWW)** — 필드 병합 없음, 지는 쪽 편집은 통째로 유실. 이 방식이 동작하는 전제는 **안정적인 syncId 키** — 파일 계층에도 동일한 정체성 장치(§4.1 front-matter)가 필요한 이유 |
| `src/services/offlineQueue.ts` | 오프라인 변경 큐잉 (pendingSyncs) | **현재 인큐 경로는 "오프라인 상태의 메모 upsert 실패" 단 하나** — 폴더 변경·삭제 실패, 온라인 중 push 실패는 큐잉되지 않음. 패턴은 참고하되 NAS 미러 큐는 **일반화된 신규 큐(§4.6)** 로 구현 |
| `src/components/editor/BacklinksPanel.tsx` | **`[[제목]]` 위키링크/백링크** (제목 완전일치 매칭) | Obsidian 정합성 측면의 숨은 자산. 단, 제목 개명 시 링크가 깨지는 특성이 파일 rename 정책(§4.1)과 맞물림 |

### 3.3 미리보기

| 파일 | 기능 | 비고 |
|------|------|------|
| `src/components/editor/MarkdownPreview.tsx` | react-markdown + `rehypeRaw` 렌더링 + `[[제목]]` 링크 해석 | ⚠️ **정화(sanitize) 없음** — XSS 벡터 현존. 정화는 Phase 4만이 아니라 **Phase 2(파일 감시 = 외부 입력 유입)의 선행 조건**이기도 함 (→ §8) |
| `src/components/editor/MemoEditor.tsx` | 에디터 모드 3종: `tabs`(기본) / `split`(데스크톱 분할+스크롤 미러링) / `tiptap`(WYSIWYG 단일 창) | 자동저장 디바운스 **500ms** — 파일 쓰기 주기와 분리 필요(§4.6). TipTap 모드에서도 본문은 markdown으로 직렬화 저장됨(tiptap-markdown) → **.md 파일 전제가 성립하는 근거. TipTap JSON 저장으로 바꾸지 말 것** |

### 3.4 AI / 임베딩 (벡터 DB 기반의 ~70%가 이미 존재)

| 파일 | 기능 | 상태와 한계 |
|------|------|------|
| `src/services/embeddingService.ts` | OpenAI `text-embedding-3-small`(1536차원) 임베딩, 코사인 유사도, localStorage 캐시 | 입력 **2,000자 절단** (인덱서와 절단 규칙 통일 필요). 캐시는 JSON number[] — 수백 개 규모에서 localStorage quota 한계 → v7 Dexie 이전이 필수인 실제 이유 |
| `src/hooks/useSemanticCanvas.ts` | 임베딩 유일 소비처 | **80개 제한(slice(0,80))의 실제 위치는 여기** (embeddingService가 아님) |
| `api/langchain/search.ts` | 하이브리드 RAG 검색 (임베딩 70% + 키워드 30% + LLM 재정렬) | 구현돼 있으나 미사용 (잠자는 코드). ⚠️ 단, **요청 바디에 전체 메모 본문+1536차원 벡터를 실어 보내는 구조** — 그대로 "연결"하면 수천 건 규모에서 성립 불가, **재설계 필요** (→ Phase 5-A) |
| `api/lib/models.ts` | `createEmbeddingModel()` — OpenAIEmbeddings | 인덱서와 모델 통일 기준 |
| `src/components/dashboard/SemanticCanvas.tsx` | 임베딩 → PCA 2D 시각화 | 유일한 임베딩 소비 UI |
| `api/langchain/demian.ts` | 데미안 AI 챗 (LangGraph) — **키워드 매칭** 기반 메모 검색 | 검색 대상은 클라이언트가 요청에 실어 보낸 memoSummaries — 벡터 업그레이드 시 검색을 클라이언트 측으로 옮기고 결과만 전달하는 구조가 자연스러움 |
| `src/hooks/useMemoFilters.ts` | Fuse.js 퍼지 검색 (현재 메모 검색) | 시맨틱 검색과 하이브리드로 결합 |

---

## 4. 공통 설계 명세 — Phase 1 착수 전 확정할 계약 ⚠️ 신설

파일 동기화의 어려운 문제는 전부 여기 있다. **이 절의 결정 없이 첫 파일을 쓰기 시작하면 안 된다.**

### 4.1 파일 포맷 & 정체성

firestoreSync의 최신 우선 규칙이 동작하는 이유는 모든 레코드가 안정적 `syncId`를 갖기 때문이다. `제목.md`라는 경로에는 그 정체성이 없다 — front-matter가 이를 대신한다.

**front-matter (YAML) — 필수 스키마**

```yaml
---
syncId: m_a1b2c3d4        # 필수. 파일↔메모 매칭의 유일한 기준 (경로 아님)
schemaVersion: 1          # 파일 포맷 버전 (호환성 정책 → §10)
createdAt: 2026-07-12T09:30:00.000Z
updatedAt: 2026-07-12T10:15:00.000Z   # 충돌 판정 기준 (동기화와 동일 ISO 형식)
tags: [아이디어, 여행]
color: blue
isPinned: false
isStarred: true
---
```

- **본문에 `# 제목`을 중복 삽입하지 않는다** (기존 handleExportMarkdown 방식 폐기 — 재가져오기 시 제목이 본문으로 복제되는 원인). 제목은 front-matter 또는 파일명에서.
- 폴더 소속은 디렉터리 경로로 표현 (folders는 단층이므로 1단계 하위 디렉터리).

**파일명 규칙**

- `slug(제목)-{syncId 앞 6자}.md` — 예: `여행-계획-a1b2c3.md`
- 정화: Windows/NAS 금지 문자(`\/:*?"<>|`), 예약어(CON, PRN 등), 후행 점·공백 제거, 유니코드 NFC 정규화 (macOS NFD 대비)
- 빈 제목 → `제목-없음-{shortId}.md` (빈 제목 메모는 정상 케이스 — UI 15곳이 '제목 없음' 폴백 사용 중)
- 제목 중복은 shortId 접미사로 자연 해소. **제목 변경 = 파일 rename** (파일 쓰기 디바운스 이후 1회 — §4.6)
- `[[제목]]` 백링크와의 상호작용: 제목 개명 시 다른 메모의 `[[옛제목]]` 참조는 깨진다 — v1에서는 한계로 문서화, 개선(참조 일괄 치환)은 후속 과제

**동기화 상태 테이블 (Dexie 신설, 기기 전용)**

`syncId → { filePath, lastWrittenAt, contentHash }` 매핑. 증분 내보내기·rename 감지·자기 쓰기 억제의 근거 데이터. (Phase 1의 폴더 핸들 보관까지 포함해 v7 스키마에 함께 반영)

### 4.2 이미지·첨부 전략 ⚠️ Phase 2 전 결정

**현실**: 이미지는 로컬 Dexie `memoImages`에 base64로만 존재하고, 본문은 `![...](memo-image:{로컬 자동증가 id})`로 참조하며, **Firebase에 동기화되지 않는다.** 이대로 .md를 내보내면 어떤 외부 도구(Obsidian, 인덱서)도 열 수 없는 죽은 링크가 되고, 타 기기에서는 엉뚱한 이미지이거나 부재다.

**파일 계층 (필수)**:
- 내보내기 시 참조된 이미지를 `assets/` 하위 폴더에 파일로 추출 (파일명 = 이미지 syncId — 필드는 이미 존재하나 현재 미사용) 후 본문 링크를 상대경로로 치환
- 가져오기 시 역치환 (`assets/` 상대경로 → memoImages 등록 + `memo-image:` 링크)

**기기 간 (택 1, Phase 2 전 결정)**:
1. **이미지 클라우드 동기화 도입** (Firebase Storage + memoImages 메타 동기화) — 온보딩 완결성 확보. 권장.
2. **한계 명시** — "이미지는 생성 기기에서만 파일화됨"을 §6 온보딩·FAQ에 고지. 저비용이지만 멀티 디바이스 목표와 상충.

### 4.3 삭제·휘발 메모 매핑

메모 삭제는 soft delete(deletedAt)→휴지통→영구삭제의 3단계이고, 휘발(brain-dump) 메모는 1시간 후 자동 soft delete된다. 파일 측 규칙:

| 앱 이벤트 | 파일 동작 |
|-----------|-----------|
| soft delete (휴지통 이동) | 파일 삭제 (또는 `.trash/`로 이동 — 택 1 고정) |
| 휴지통에서 복원 | 파일 재기록 |
| 영구 삭제 / 휴지통 비우기 | 파일 제거 보장 (`.trash/` 채택 시 그쪽도) |
| 휘발 메모 만료 | soft delete와 동일 |
| **감시자가 폴더에서 파일 삭제 감지 (Phase 2)** | 해당 메모 soft delete로 처리 (명시적 규칙 — 미정의 시 유령 파일/유령 메모 발생) |

- **휘발 메모는 애초에 폴더 기록에서 제외 권장**: `ephemeralExpiresAt`은 Firebase에 동기화되지 않아 타 기기는 휘발임을 알 수 없다 — 제외가 가장 단순한 일관성 확보.
- 시스템 휴지통 폴더('삭제된 메모', isSystem)는 **디렉터리로 생성하지 않는다.**
- Phase 5 인덱서도 이 규칙에 의존한다 (삭제 메모가 벡터 DB에 남는 문제 방지).

### 4.4 역방향 가져오기(import) 계약 — Phase 2 파일 감시의 전제

| 파일 상태 | 처리 |
|-----------|------|
| front-matter `syncId` 있음 | 해당 메모 **업데이트** (충돌 규칙 §4.5 적용) |
| front-matter 없음 (외부에서 새로 만든 파일) | **신규 메모 생성** + front-matter를 파일에 역기록(write-back) |

- 태그: front-matter 우선, 없으면 본문 `#해시태그`에서 재추출 (기존 extractTags와 동일 규칙)
- 폴더: 파일의 디렉터리 → 폴더 매핑, color/pin/star: front-matter
- 이 계약이 없으면 **모든 외부 편집이 신규 메모로 중복 생성**되어 Firebase를 타고 전 기기로 퍼진다.

### 4.5 충돌 규칙 — "최신 우선"의 파일 계층 구현

- 판정 기준은 **front-matter `updatedAt` + contentHash**. **파일 mtime은 변경 힌트로만 사용, 판정에 쓰지 않는다** — NAS/SMB 타임스탬프 부정확, 복사·미러링에 의한 변조, 에디터의 무의미 mtime 갱신 때문.
- contentHash 동일 → 타임스탬프와 무관하게 skip (재기록 루프 차단).
- **대량 변경 서킷브레이커**: 감시자 한 배치에서 N건(예: 50) 초과 변경 감지 시 자동 반영을 멈추고 사용자 확인 — NAS 백업 복원·재마운트로 전체 파일이 "새것"으로 보이는 시나리오에서 스테일 데이터가 Dexie→Firebase→전 기기로 역류하는 사고 방지.
- **충돌 사본 규칙** (동시 편집으로 어느 쪽도 버릴 수 없을 때): `제목 (충돌 2026-07-12 1530)-{shortId}.md` 생성 후 양쪽 보존. 기존 LWW는 문서 단위 전체 교체(지는 편집 전량 유실)임을 전제로, 파일 계층에서는 사본 생성을 기본값으로.

### 4.6 쓰기 프로토콜

- **원자적 쓰기**: 임시 파일 기록 → rename. 크래시/정전 시 잘린 .md가 감시자에 의해 "새 본문"으로 역류하는 것 방지.
- **파일 쓰기 디바운스는 자동저장과 분리**: 자동저장은 500ms마다 발화한다 — 파일 쓰기는 마지막 저장 후 2~5초 + 에디터 닫힘 시 즉시 flush. 제목 타이핑 중 rename 연쇄(글자마다 다른 파일명) 방지.
- **감시자 설정** (Phase 2): chokidar `awaitWriteFinish`(외부 에디터의 분할 쓰기 대응), 임시 파일 패턴 무시.
- **자기 쓰기 억제**: 경로+시간이 아니라 **(경로, contentHash) 키 + TTL** — 외부 에디터의 safe-write(임시 파일 기록 후 rename 덮어쓰기)가 경로 기반 억제를 우회하는 문제 대응.
- **잠긴 파일**(백신·NAS 인덱서): 지수 백오프 제한 재시도. 미러 쓰기 실패는 **전용 `pendingFileOps` Dexie 큐**(작업 종류·대상 경로·페이로드)로 영속화 — 기존 offlineQueue는 스키마·커버리지 모두 부족해 직접 재사용 불가(§3.2).

### 4.7 다중 인스턴스 조정

현재 코드에는 탭 간 조정 장치가 전혀 없다 (BroadcastChannel/Web Locks/storage 이벤트 부재). 폴더 쓰기가 들어오는 순간 필수가 된다:

- **웹 멀티탭**: Web Locks API(또는 BroadcastChannel 리더 선출)로 **폴더당 단일 기록자** 보장.
- **웹 앱 + Electron 앱 동시 실행** (같은 폴더 지정): Sync 폴더 내 lockfile로 상호 배제 + 후순위 인스턴스에 UI 안내.

### 4.8 패키징 공통 이슈 (Phase 2·3 공통 선행)

- **서비스 워커 게이팅**: `/sw.js` 등록과 Background Sync는 보안 origin 전제 — Electron/Capacitor에서는 등록을 플랫폼 게이팅으로 건너뛴다. 미처리 시 offlineQueue의 `navigator.serviceWorker.ready` 대기가 **영구 hang**(등록된 SW가 없으면 resolve되지 않는 Promise)으로 큐 인입 자체를 막는다.
- **CDN 폰트 로컬 번들**: index.html이 jsdelivr에서 폰트 6종(Pretendard, NanumSquare 계열 등)을 로드 — 패키징 빌드는 오프라인에서 폰트가 전부 깨지므로 로컬 번들 필수.
- **동기화 폴더 설정은 기기 전용**: settingsStore는 클라우드 동기화된다(`settingsSync.ts`, 원격 우선 병합). 폴더 경로(`D:\Memo`)·활성화 토글·미러 목록이 동기화 필드에 실리면 **한 PC의 경로가 다른 기기를 덮어쓴다** — AI 키와 동일하게 동기화 허용목록에서 제외하거나 별도 기기 전용 스토어에 저장. 폴더 핸들·§4.1 상태 테이블도 로컬 전용.

---

## 5. 단계별 로드맵

### Phase 1 — 웹 Sync 폴더 (File System Access API) · 최소 투자 검증

**목표**: 설치파일 없이, 현재 웹 앱에서 폴더 저장 개념을 검증한다.

**산출물 재정의 (중요)**: 이 Phase의 가치는 FSA 연동 자체가 아니다 — FSA 통합 코드(showDirectoryPicker, 권한 UX)는 Electron(IPC+Node fs)·Capacitor(SAF)에서 **통째로 폐기**된다. 살아남아 Phase 2·3의 토대가 되는 것은:

1. **`FileSyncTarget` 인터페이스** (write/delete/rename/list) — 플랫폼 불문 추상화. Phase 2·3은 이 인터페이스의 백엔드만 교체
2. **메모→파일 직렬화 서비스** (§4.1 front-matter + §4.2 assets 처리; EditorHeader의 단건 내보내기도 여기로 통합)
3. **설정 UI + 플랫폼 게이팅** (§6)
4. §4.3 삭제 매핑, §4.6 쓰기 디바운스, §4.7 멀티탭 단일 기록자

- `showDirectoryPicker()`로 Sync 폴더 지정 → 폴더 핸들을 IndexedDB에 보관
- 메모 저장/수정 시 §4.1 규칙의 파일 자동 기록, 메모 폴더를 하위 디렉터리로 재현 (시스템 휴지통 폴더 제외)

**제약 (알고 시작할 것)**
- Chromium 계열(Chrome/Edge) 전용 — Safari/Firefox/iOS 미지원 (2026-07 현재도 변화 없음: WebKit은 OPFS만, Mozilla는 부정적 입장)
- 권한: **Chrome 122+부터 영구 권한("항상 허용") 지원** — IndexedDB에 보관한 핸들을 재프롬프트 없이 복원 가능(특히 설치형 PWA). 단 queryPermission/requestPermission 복원 코드는 필요. 권한 UX는 최소 구현(복원 실패 시 토글 자동 off + 안내)으로 제한 — 어차피 폐기되는 코드
- 탭이 열려 있을 때만 동작, 백그라운드 동기화 불가 → 이 한계가 Phase 2의 근거

**완료 기준 (체크리스트)**
- [ ] Chrome에서 폴더 지정 → 메모 작성 → front-matter 포함 .md 생성
- [ ] 제목 변경 → 디바운스 후 rename **1회** (타이핑 중 파일명 연쇄 생성 없음)
- [ ] 이미지 포함 메모 → `assets/` 생성 + 상대경로 치환 확인
- [ ] 메모 삭제(soft) → 파일 제거, 복원 → 재기록
- [ ] 탭 2개 동시 편집 → 단일 기록자만 쓰기 (충돌 없음)
- [ ] 미지원 브라우저 → 섹션 비활성 + 안내 문구

---

### Phase 2 — PC 데스크톱 앱 (Electron) + NAS 지원 · 핵심 단계

**목표**: `.exe`(Windows)/`.dmg`(Mac) 설치파일. Obsidian 수준의 폴더 접근.

- Electron으로 기존 Vite 빌드 결과물 래핑 (웹 코드 최대한 재사용 — 단, §4.8 SW 게이팅·폰트 번들 선행)
- `electron-builder`로 설치파일 생성 (참고: Electron 공식 문서 기준 툴체인은 electron-forge; Vite 프로젝트는 electron-vite + electron-builder 조합이 일반적 — 스캐폴딩 시 비교 검토)
- 네이티브 파일 API로 Sync 폴더 읽기/쓰기 — 권한 재요청 없음, 상시 접근. Phase 1의 `FileSyncTarget` 백엔드 교체로 구현
- **파일 감시(chokidar)**: 폴더의 .md 외부 수정 감지 → §4.4 가져오기 계약으로 앱 반영 → Firebase 동기화 (**양방향 완성**). §4.6 감시자 설정·자기 쓰기 억제, §4.5 서킷브레이커 적용. ⚠️ 외부 편집 파일은 신뢰 불가 입력 — **정화(§8) 이 Phase의 선행 조건**
- **NAS 지원**: 저장 경로로 네트워크 드라이브(`Z:\Memo` 등) 지정 가능
  - NAS 오프라인 시: `pendingFileOps` 큐(§4.6)로 큐잉 후 재연결 시 재시도
- **다중 폴더 미러링**: **주(主) 로컬 + 보조(NAS 미러)** 구조
  - **로컬 = 주 저장소**: 즉시 읽기/쓰기, **파일 감시는 로컬만**
  - **NAS = 미러/백업**: 로컬 쓰기 결과를 복사만 (감시 X). 오프라인이면 큐잉
  - 이유: 원본을 로컬로 명확히 하여 쓰기 루프·충돌 회피, 편집 지연 없음. 로컬 1 + NAS N개 확장 가능
  - 자기 쓰기 억제·NAS 쓰기 디바운스는 §4.6 프로토콜 따름
- 충돌 규칙: §4.5 (front-matter updatedAt + contentHash — mtime 판정 금지)
- 설정 UI: §6 명세의 "주 저장 폴더" + "미러 폴더 목록"

**기술 선택**: **Electron 유지** — 근거는 웹 코드 100% 재사용, Chromium 렌더링 일관성, Node 생태계(chokidar), Obsidian 선례. (구버전 근거였던 "Tauri 대비 성숙도 우위"는 2026년 기준 유효하지 않음 — Tauri 2.x는 2024-10 안정화, 모바일 지원 포함. 용량/메모리가 중요해지거나 PC+모바일 단일 스택을 원하면 Tauri 2 재검토가 1순위)

**완료 기준 (체크리스트)**
- [ ] 서명된 설치파일로 설치(§10) → NAS 폴더 지정 → 앱 수정·파일 직접 수정 양방향 반영
- [ ] NAS 언마운트 상태에서 저장 10회 → 재마운트 후 전량 반영, 유실 0
- [ ] 외부 수정 → 앱 반영 시 재기록 루프 미발생 (contentHash skip 동작)
- [ ] NAS 복원 시뮬레이션(전 파일 mtime 일괄 변경) → 서킷브레이커 발동, 자동 반영 중단
- [ ] front-matter 없는 새 .md를 폴더에 투입 → 신규 메모 생성 + write-back

---

### Phase 3 — 갤럭시 APK (Capacitor)

**목표**: 안드로이드 설치 앱 + 폰 폴더 저장.

- **Capacitor 8.x 기준** (Android SDK 36, Android Studio Otter 2025.2.1+; 플러그인도 Capacitor 8 호환 버전으로 선정)
- ⚠️ **선행 스파이크 필수**: 공식 `@capacitor/filesystem`은 사전 정의 디렉터리(Documents/External 등)만 쓰기 지원 — **사용자 지정 SAF 폴더 쓰기는 공식 플러그인 범위 밖**이다. `@capawesome/capacitor-file-picker`의 `pickDirectory` + persistable URI permission 처리(커뮤니티 플러그인 또는 커스텀 네이티브 코드)로 실기기 검증 후 본 구현 착수
- 동기화는 기존 Firebase 경유 (폰 ↔ PC 파일 공유의 허브)
- **범위 제한**: 모바일은 "앱에서 수정 → 폴더 기록" 단방향 중심. 폴더 파일 직접 수정 감지는 구현하지 않음 (OS 제약)
- **모바일 → NAS 연동 경로**
  1. **로컬 폴더 + 동기화 에이전트 (권장)**: 앱은 폰 로컬 폴더에만 저장, Synology Drive / FolderSync / Syncthing이 백그라운드로 NAS와 동기화 — 오프라인 안전, 앱 구현 부담 없음, Obsidian 사용자 표준 패턴
  2. **DS File을 SAF 제공자로 직접 선택**: 네트워크 끊김 시 저장 실패(큐잉 필요), 제공자 앱별 쓰기 지원 편차 → 실기기 검증 필요

**완료 기준**: SAF 스파이크 통과 → APK 설치 → 폴더 지정 → 앱에서 메모 수정 시 폰 폴더 + PC/NAS 폴더 모두 반영 (NAS 연동은 Synology Drive 조합으로 확인)

---

### Phase 4 — HTML 지원 강화

**목표**: 메모 ↔ HTML 파일 양방향.

1. **HTML 저장**: Sync 폴더 저장 형식 옵션에 `.html` 추가 (`.md` 단독 / `.html` 단독 / 둘 다)
   - ⚠️ 변환기는 **실제 markdown 파이프라인**(remark 기반 md→HTML 또는 TipTap `getHTML`)으로 신규 구성 — `generateShareHTML`은 이미지·링크·표 미지원 간이 변환기라 "서식 보존" 목표에 부적합(§3.1). 페이지 셸/스타일 템플릿으로만 재사용
   - 이미지: §4.2와 동일하게 `assets/` 상대경로 (또는 단일 파일 요구 시 base64 인라인 옵션)
2. **HTML 가져오기(import)**: 외부 `.html` → **DOMPurify로 원문 정화** → 본문 추출 → TipTap 문서로 변환 → 새 메모 저장 (이후 일반 메모와 동일하게 동기화)
3. **미리보기**: 기존 `MarkdownPreview` 분할/탭 + `ShareLinkModal`의 sandbox iframe 재사용 (sandbox 속성 목록 명시, `allow-scripts` 금지)

**⚠️ 보안 필수 사항** (상세 → §8)
- 정화는 경로별로: MarkdownPreview(react-markdown)는 `rehype-sanitize`를 rehype-raw 뒤에, HTML 가져오기는 TipTap 파싱 전 원문에 `DOMPurify`. 두 경로 모두 `javascript:` 프로토콜 차단
- CSP 적용 범위 수정(§8) 병행
- 알려진 한계: 복잡한 HTML(스크립트, 고급 CSS, 표 병합)은 TipTap 서식으로 단순화. 왕복 변환(md→html→md) 100% 일치 비보장

**완료 기준**: 외부 HTML 가져오기 → 메모 생성 → 미리보기 정상 + **페이로드 목록(img onerror, svg onload, `javascript:` href, data: iframe) 전부 무력화 확인**

---

### Phase 5 — 벡터 DB & 시맨틱 검색

**목표**: 잠자는 인프라를 깨워 메모를 실제 벡터 DB로 운영한다.

**5-A. 앱 내 벡터 DB (필수)**

1. **영구 저장**: Dexie 스키마 v7 — `memoEmbeddings` 테이블 신설
   - **키는 syncId** (로컬 id 아님 — 기기 이동 생존), vector는 **Float32Array/ArrayBuffer** (JSON number[]는 3-4배 비대 — 현 localStorage 캐시가 수백 개에서 quota 초과하는 원인), contentHash, updatedAt, 차원 1536 고정
   - contentHash **정규화 규칙 명문화** (트림·개행·절단 2,000자 — 전 플랫폼·인덱서 동일 규칙, 아니면 기기마다 신선도 판단이 어긋남)
   - v7 마이그레이션은 기존 **7개 테이블 전부** + §4.1 동기화 상태 테이블 포함. **Dexie 다운그레이드 불가** → §10 롤백 정책
2. **임베딩 파이프라인**: 메모 생성/수정 시 자동 임베딩 (contentHash 변경분만, 디바운스)
   - ⚠️ **프라이버시**: 자동 임베딩 = 모든 메모 본문이 OpenAI로 전송. **명시적 opt-in(기본 off)** + 폴더/태그 제외 규칙 + 설정 UI 고지 문구 필수 (→ §8). 현재는 Semantic Canvas를 열 때만 전송되는 좁은 흐름임
   - 신규 기기 최초 인덱싱은 **백그라운드 배치** (진행률 UI, 중단·재개 가능) — 비용은 미미($0.02/1M tokens, 수천 건 < $1)하나 wall-clock·rate limit이 UX 이슈
3. **검색 연결 — 재설계** (기존 계획 "search.ts 연결"의 수정): 쿼리 임베딩만 API 호출 → **코사인은 로컬**(Dexie 벡터 대상 브루트포스 — 수천 건 규모에서 수십 ms로 충분) → 상위 ~20 후보의 제목+스니펫만 search.ts에 보내 LLM 재정렬. 현재 search.ts처럼 전체 메모+벡터를 요청마다 전송하는 구조는 서버리스 바디 한도·비용에서 성립 불가
4. **데미안 업그레이드**: 클라이언트 측 벡터 검색 결과(관련 메모)를 요청에 전달 → 키워드 매칭 도구 대체
5. **동기화 제외 유지**: 임베딩은 로컬 재계산 가능한 파생 데이터 — Firebase 동기화 대상에서 제외 (각 기기 자체 계산)

**5-B. 별도 인덱서 프로그램 (선택 — 범위 재정의)**

- **고유 가치에만 한정**: "앱이 만들지 않은 외부 파일 인덱싱(NAS 공유에 직접 투입된 문서)" + "NAS 측 검색 API 제공". 앱이 만든 메모 파일 재인덱싱은 5-A와 이중 지출·이중 신선도 체계 — 하지 않는다. 이 고유 가치의 실수요가 확인될 때만 착수 (§11)
- NAS Docker 컨테이너 또는 Node.js CLI(`.exe` 패키징). 폴더 감시 → 텍스트 추출 → 임베딩 → 벡터 DB 갱신 (증분: §5-A와 동일한 contentHash 규칙)
- **벡터 DB 파일**: SQLite + sqlite-vec (`.db` 단일 파일) 우선 — 단 **유지보수 리스크 주석**: pre-1.0(v0.1.x), 단독 메인테이너, 2025년 장기 공백 이력, ANN 인덱스 알파 (수천 건 브루트포스에는 충분). 벡터 스토어는 **어댑터로 추상화**해 활발히 개발 중인 LanceDB(`.lance`)로 교체 가능하게
- **API 키 관리**: Docker secret/env 주입만 (설정 파일 평문 금지), 전용 저비용 키 + 지출 한도, **키가 필요 없는 로컬 모델 경로를 1순위 권장** (→ §8)
- **임베딩 모델 통일 원칙**: 앱·인덱서 모두 `text-embedding-3-small` (2026-07 기준 여전히 현행 세대·합리적 기본값). 오프라인/프라이버시 우선 시 로컬 모델로 **양쪽 함께** 교체 — 한국어 앱이므로 다국어 성능 기준 **Qwen3-Embedding(0.6B/4B) 또는 BGE-M3** 권장 (기존 예시였던 nomic-embed-text v1은 영어 중심). 차원이 달라지므로 전량 재임베딩 + 벡터 테이블 차원 변경 필요

**완료 기준**: 고정 평가 세트(실데이터 기반 쿼리→기대 메모 ~20쌍)에서 **hit@5 ≥ 80%** 및 Fuse.js 단독 대비 개선 확인, 데미안이 벡터 검색으로 관련 메모 인용

---

## 6. 동기화 폴더 UI/UX 명세

### 위치

- **설정 모달 → "데이터" 탭 → "클라우드 동기화" 섹션과 "백업 및 복원" 섹션 사이**에 새 섹션 추가
- (현행 SettingsModal은 7탭 구조: 일반 / 계정 / **데이터** / 메모 / AI / 워크스페이스 / 시스템 — 구버전 명세의 "단일 페이지 섹션 나열 + 데이터 관리 섹션" 서술은 현행 코드와 불일치하여 폐기)
- 진입: 설정(톱니바퀴) → 데이터 탭 → 해당 섹션

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

1. **활성화 토글** — 켜면 이후 메모 저장 시 폴더에도 파일 기록. ⚠️ 상태는 **기기 전용 스토어에 persist** — settingsSync 클라우드 동기화 대상에서 제외 (§4.8: 경로·토글이 타 기기로 전파되면 안 됨)
2. **폴더 선택 버튼** — Electron: 네이티브 대화상자(IPC) / 웹·PWA(Chrome·Edge): `showDirectoryPicker()` → 핸들 IndexedDB 보관 + 권한 복원 코드(Chrome 122+ 영구 권한)
3. **미러 폴더 추가** (Electron 전용) — 주(로컬) + 미러(NAS) 다중 대상 목록 (Phase 2 미러링 설계)
4. **저장 형식** — `.md` / `.html` / 둘 다 (Phase 4)
5. **상태 배지** — 기존 SyncStatusBadge(SettingsModal 내부 비공개 3-상태 컴포넌트)의 **시각 스타일만 참고**하여 공용 컴포넌트로 추출. 파일 동기화용 상태 모델은 신규 정의: `idle / writing / queued / error` + lastWrittenAt + fileCount (NAS 오프라인 시 "대기 중 n건")
6. **전체 내보내기** — 기존 메모 전부를 폴더로 1회 채움. **신규 fileExport 서비스**로 구현 (backup.ts는 데이터 열거 패턴만 참고 — §3.1)

### 플랫폼별 UI 게이팅

| 환경 | 섹션 상태 |
|------|-----------|
| Electron (PC) | 전체 활성, 미러 폴더 노출 |
| Chrome/Edge PWA·브라우저 | 활성 + "브라우저가 열려 있을 때만 동작" 안내 문구 |
| iOS/Safari/Firefox PWA·미지원 | **비활성(회색) + "이 기기는 폴더 저장 미지원 — Firebase로만 동기화" 안내** |

- 지원 여부는 `window.showDirectoryPicker` 존재 / Electron 브리지 존재로 런타임 감지

### 신규 디바이스 온보딩 흐름

1. 로그인 → Firebase에서 메모 데이터를 로컬 DB로 수신 (기존 동기화)
2. 설정 → 데이터 탭 → 동기화 폴더 → 토글 켜고 폴더 1회 지정
3. "전체 내보내기" 실행 → 받아온 메모가 지정 폴더에 파일로 채워짐
   - ⚠️ **복원 범위는 메모 텍스트+메타데이터** (Firebase는 파일이 아닌 메모 데이터를 보관 → 각 기기 앱이 재구성). **이미지·버전 이력·AI 채팅은 §2.1 인벤토리상 클라우드에 없음** — 이미지는 §4.2 결정(Storage 동기화 도입 여부)에 따름

---

## 7. 기술 선택 요약 (2026-07 기준 갱신)

| 항목 | 선택 | 근거 (갱신) |
|------|------|------|
| PC 패키징 | **Electron** + electron-builder | 웹 코드 100% 재사용, Chromium 렌더링 일관성, Node 생태계(chokidar), Obsidian 선례. Tauri 2.x(2024-10 안정화, 모바일 지원)와의 성숙도 격차는 해소됨 — 용량/메모리 요구 또는 단일 스택(PC+모바일) 필요 시 Tauri 2 재검토 1순위 |
| 모바일 패키징 | **Capacitor 8.x** | 웹 코드 재사용 극대화. ⚠️ 공식 filesystem 플러그인은 사용자 지정 SAF 폴더 쓰기 미지원 — 커뮤니티 플러그인(@capawesome file-picker) + persistable URI permission, 착수 전 스파이크 필수 |
| 동기화 허브 | **기존 Firebase** | 충돌 처리·syncId 정체성 체계 기구현. NAS 허브 방식은 모바일 연동·충돌 부담으로 비권장 |
| 파일 형식 | `.md`(front-matter 필수, §4.1) 기본 + `.html` 옵션 | md는 이식성(Obsidian 호환), html은 서식 보존 — 단 html 변환은 실 파이프라인 신규 구성(§Phase 4) |
| HTML 정화 | 경로별: **rehype-sanitize**(MarkdownPreview) + **DOMPurify**(HTML 가져오기 원문) | Phase 2(파일 감시)·Phase 4 공통 선행 조건 (§8) |
| 벡터 저장(앱) | Dexie v7 신규 테이블 (syncId 키, Float32Array) | 기존 DB 인프라 재사용. 수천 건 규모 로컬 코사인으로 충분 (수십 ms) |
| 벡터 저장(인덱서) | SQLite + sqlite-vec (`.db`) — **어댑터 추상화 필수** | 단일 파일 이식성. pre-1.0·단독 메인테이너 리스크 → 대안 LanceDB 교체 가능 구조로 |
| 임베딩 모델 | OpenAI `text-embedding-3-small` (앱·인덱서 통일, 1536d 고정) | 현행 세대 유지 중, $0.02/1M tokens. 로컬 전환 시 한국어 고려 Qwen3-Embedding/BGE-M3 — 차원 변경 = 전량 재임베딩 |

---

## 8. 보안 · 프라이버시 ⚠️ 신설

| 영역 | 현실 | 조치 |
|------|------|------|
| XSS (현존) | MarkdownPreview가 rehypeRaw로 원시 HTML을 무정화 렌더링 — `<img onerror>` 류 벡터가 **외부 HTML 도입 전인 지금도** 존재 | `rehype-sanitize`를 rehype-raw 뒤에 삽입(허용 태그 스키마 정의). **Phase 2 파일 감시 = 외부 편집 파일 유입이므로 Phase 2 선행 조건으로 승격** (Phase 4만의 문제 아님) |
| XSS (가져오기) | 외부 .html은 신뢰 불가 입력 | TipTap 파싱 **전** 원문 문자열에 DOMPurify. 미리보기 iframe은 sandbox 속성 명시(`allow-scripts` 금지). 양 경로에 `javascript:` 프로토콜 차단 |
| CSP 적용 범위 | vercel.json의 CSP 헤더가 **`/` 경로에만** 적용 — SPA 딥링크(`/memo/123` 등 rewrite 경유)는 CSP 없이 서빙됨 | headers source를 `/(.*)` 로 확장(정적 자산 예외 분리) — DOMPurify와 방어선 이중화 |
| 메모 본문 → OpenAI | Phase 5-A 자동 임베딩은 전 메모 본문을 OpenAI로 전송 (현재는 Semantic Canvas 사용 시에만) | **opt-in 기본 off**, 폴더/태그 제외 규칙, 설정 문구 "메모 본문이 OpenAI로 전송됩니다" 명시. 로컬 임베딩 모델을 비용 폴백이 아닌 **프라이버시 옵션**으로 승격 |
| 인덱서 API 키 | NAS의 헤드리스 프로세스가 키 보유 — 앱은 "키는 이 기기에만 저장" 원칙 유지 중 | Docker secret/env 주입만, 설정 파일 평문 금지, 전용 키 + 지출 한도, 로컬 모델 경로 1순위 |
| NAS 평문 노출 | 메모가 브라우저 프로필 내 IndexedDB·인증 게이트 Firestore에서 → **SMB 공유의 평문 .md/.html**로 이동 (NAS 계정 접근·스냅샷·백업에 노출) | 전용 공유폴더 + 최소 권한 계정 권고, 인덱서 컨테이너 접근 범위 문서화. **저장 시 암호화는 명시적 비범위(non-goal)로 선언** — Obsidian 호환·외부 도구 열람이 본 기능의 목적이므로 |

---

## 9. 제약 · 리스크

| 리스크 | 내용 | 대응 |
|--------|------|------|
| 브라우저 API 한계 | FSA는 Chrome/Edge 전용, 탭 열림 시만, 백그라운드 불가 (영구 권한은 Chrome 122+로 완화됨) | Phase 1은 검증용 한정, 본편은 Phase 2(Electron) |
| **이미지 미동기화** | memoImages는 로컬 전용 — 파일 내보내기 시 죽은 링크, 타 기기 재구성 불가 | §4.2 assets/ 추출 + Storage 동기화 여부 Phase 2 전 결정 |
| **파일 정체성 부재** | `제목.md` 경로는 syncId를 담지 못함 — 중복·개명·왕복 매핑 전부 붕괴 | §4.1 front-matter 필수 + slug-shortId 파일명 |
| **mtime 신뢰 불가** | NAS/SMB 부정확·복사 변조·에디터 bump — 특히 NAS 백업 복원 시 전체 파일이 "최신"으로 위장 | §4.5: front-matter updatedAt + contentHash 판정, 대량 변경 서킷브레이커 |
| 동시 편집 충돌 | 여러 기기/폴더 직접 수정 병행 시 덮어쓰기 (기존 LWW는 문서 단위 전체 교체) | §4.5 충돌 사본 생성 규칙 |
| **다중 인스턴스** | 멀티탭·웹+Electron 동시 실행 시 폴더 쓰기 경합 (현재 조정 장치 전무) | §4.7 단일 기록자 (Web Locks / lockfile) |
| NAS 오프라인 | 네트워크 끊김 시 저장 실패 | §4.6 pendingFileOps 큐 + 재연결 재시도 (기존 offlineQueue는 커버리지 부족으로 신규 구현) |
| 모바일 역방향 감지 | 폰에서 폴더 파일 직접 수정 감지 곤란 | 모바일은 "앱 경유 수정"만 지원 명시 |
| **Capacitor SAF 의존** | 사용자 지정 폴더 쓰기가 공식 플러그인 범위 밖 — 커뮤니티 플러그인/네이티브 코드 필요 | Phase 3 착수 전 실기기 스파이크 |
| XSS | MarkdownPreview 무정화 + 외부 HTML/파일 유입 | §8 경로별 정화 — Phase 2·4 선행 조건 |
| **NAS 평문 노출** | 메모 기밀성 저하 (공유 접근·스냅샷) | §8 전용 폴더·최소 권한, 암호화 non-goal 선언 |
| 임베딩 비용/의존 | OpenAI API 의존, 오프라인 불가 (비용 자체는 수천 건 < $1로 미미) | 변경분만 임베딩(해시), 로컬 모델 옵션(§5-B) |
| **sqlite-vec 유지보수** | pre-1.0, 단독 메인테이너, 공백 이력 | 어댑터 추상화 + LanceDB 대체 경로 |
| **Dexie 다운그레이드 불가** | v7 배포 후 앱 롤백 시 DB 열기 실패 | §10 롤백 정책 (백업 선행 안내) |
| 왕복 변환 손실 | md↔html↔TipTap 변환 시 서식 단순화 | 한계로 문서화, 원본은 항상 앱 DB(md) 기준 |

---

## 10. 운영 · 호환성 계획 ⚠️ 신설

### 테스트 전략
- **파일 동기화 코어(직렬화·파일명·충돌·삭제 매핑)는 플랫폼 독립 순수 모듈로 분리** → 단위 테스트로 §4의 계약을 각각 검증 (이 로직이 정확히 자동화 테스트가 필요한 종류의 코드)
- E2E는 기존 Playwright 인프라 활용, 성능 회귀는 기존 Lighthouse CI 유지
- 각 Phase 완료 기준의 체크리스트가 곧 인수 테스트 시나리오

### 파일 포맷 호환성
- front-matter `schemaVersion`으로 버전 관리. 정책: **구버전 앱이 신버전 파일을 만나면 front-matter 미지의 키를 보존하고 아는 필드만 갱신** (파괴적 재직렬화 금지)

### DB 마이그레이션 / 롤백
- Dexie v7 업그레이드는 **다운그레이드 불가** — v7 배포 릴리스 노트에 "업데이트 전 JSON 백업 권장" 명시, 롤백 필요 시 백업 복원 경로 안내
- 동기화 폴더 기능 자체의 롤백 = 토글 off + 상태 테이블 정리 (파일은 사용자 자산이므로 삭제하지 않음)

### 배포 / 서명
- **Electron**: Windows 코드 서명 인증서 + macOS 공증(notarization) — `.exe`/`.dmg` 배포의 필수 비용·프로세스 항목. 자동 업데이트 전략(electron-updater 등) 결정
- **Android**: APK 서명 키 관리, 배포 채널 결정 (Play Store vs 사이드로드)
- **점진 롤아웃**: 동기화 폴더는 피처 플래그로 게이팅해 단계적 활성화 (파일을 건드리는 기능은 사고 반경이 큼)

---

## 11. 권장 우선순위

```
§4 공통 설계 명세 확정      ─ 작음   ─ Phase 1의 선행 조건 (파일 포맷·이미지 결정)
Phase 1 (웹 Sync 폴더)     ─ 작음~중간 ─ 직렬화 서비스·FileSyncTarget 추상화 산출
Phase 2 (PC Electron+NAS)  ─ 큼     ─ 핵심 가치, Obsidian 수준 달성
Phase 3 (갤럭시 APK)       ─ 중간   ─ 멀티 디바이스 완성 (SAF 스파이크 선행)
Phase 4 (HTML 강화)        ─ 중간   ─ 정화·CSP 포함
Phase 5 (벡터 DB)          ─ 중간   ─ 기반 70% 존재
```

- **Phase 1 → 2 → 3**은 순차 진행 (각 단계가 다음 단계의 검증대)
- **Phase 4는 둘로 나뉜다**: 가져오기·미리보기·정화는 독립적이며 언제든 병행 가능 / **HTML "저장"은 Phase 1(최소한)·2의 파일 쓰기 파이프라인이 선행 조건** — "Phase 4·5 완전 독립"이라는 구버전 서술은 부정확
- **Phase 5-A는 독립 진행 가능** (Phase 2와 병행 무방). 정화(§8)는 Phase 2 전 완료 권장
- Phase 5-B(별도 인덱서)는 "외부 파일 인덱싱" 실수요 확인 후 착수 판단

---

## 부록: 자주 나온 질문 정리

- **폴더 파일이 Firebase와 직접 연동되나?** → 아니오. 항상 각 기기의 앱이 중계한다. 앱이 꺼져 있으면 폴더도 갱신되지 않는다 (NAS 미러는 그만큼 뒤처질 수 있다).
- **이미지도 파일로 저장되나?** → 계획상 `assets/` 하위 폴더로 추출하고 본문 링크를 상대경로로 바꾼다(§4.2). 단, 이미지는 현재 Firebase에 동기화되지 않으므로 **다른 기기에서는 그 기기에 이미지가 없다** — Storage 동기화 도입 여부가 Phase 2 전 결정 사항.
- **APK로 PC 폴더 저장이 되나?** → 아니오. APK는 안드로이드 전용. PC는 Electron 설치파일, 폰은 APK로 각각 빌드 (코드는 공유).
- **폴더의 파일을 직접 고치면 앱에 반영되나?** → PC(Electron, Phase 2)에서만. front-matter의 syncId로 어느 메모인지 식별한다 — front-matter가 없는 새 파일은 새 메모로 들어온다(§4.4).
- **벡터 DB 파일 확장자는?** → 정해진 하나는 없음. 본 로드맵은 SQLite `.db` 단일 파일 권장 (대안: LanceDB `.lance` — 어댑터로 교체 가능하게 설계).
- **HTML 미리보기 되나?** → 이미 가능 (MarkdownPreview + ShareLinkModal iframe). 단, 외부 HTML 도입 전 정화 필수(§8).

---

## 변경 이력

| 버전 | 일자 | 내용 |
|------|------|------|
| v1 | 2026-07-11 | 최초 작성 (개요·아키텍처·Phase 1~5·기술 선택·리스크) |
| v1.1 | 2026-07-12 | 동기화 폴더 UI/UX 명세, PC 다중 폴더 미러링, 모바일 NAS 경로 보완 |
| **v2** | **2026-07-12** | **코드베이스 대조 감사 반영 (83건 점검·핵심 16건 교차 검증).** 신설: §2.1 동기화 데이터 인벤토리, §4 공통 설계 명세(파일 포맷·정체성 / 이미지 / 삭제 / 가져오기 / 충돌 / 쓰기 프로토콜 / 다중 인스턴스 / 패키징 공통), §8 보안·프라이버시, §10 운영·호환성. 수정: §3 자산 표 재사용 한계 명시(backup.ts·handleExportMarkdown·generateShareHTML·offlineQueue·SyncStatusBadge 과대 서술 교정, ambientImages 누락 보완), §6 위치를 현행 7탭 구조로 교정, Phase 5-A 검색 아키텍처 재설계(로컬 코사인), Phase 4 독립성 서술 교정, 기술 선택 2026-07 기준 갱신(Tauri 2.x·Capacitor 8 SAF·Chrome 122 영구 권한·sqlite-vec 리스크·한국어 로컬 임베딩 모델), 완료 기준을 부정 케이스 포함 체크리스트로 강화 |

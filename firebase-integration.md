# Firebase 연동 및 동기화 로직 상세 문서

> Moonwave To-Do List v1.0 — Firebase 아키텍처 기술 문서

---

## 목차

1. [프로젝트 개요](#1-프로젝트-개요)
2. [Firebase 프로젝트 구성](#2-firebase-프로젝트-구성)
3. [Firebase 초기화](#3-firebase-초기화)
4. [인증 (Authentication)](#4-인증-authentication)
5. [Firestore 데이터 구조](#5-firestore-데이터-구조)
6. [로컬 데이터베이스 (IndexedDB/Dexie)](#6-로컬-데이터베이스-indexeddbdexie)
7. [동기화 아키텍처 전체 흐름](#7-동기화-아키텍처-전체-흐름)
8. [초기 병합 (Initial Merge)](#8-초기-병합-initial-merge)
9. [실시간 리스너 (Real-Time Listeners)](#9-실시간-리스너-real-time-listeners)
10. [Push 동작 (로컬 → 클라우드)](#10-push-동작-로컬--클라우드)
11. [에코 억제 (Echo Suppression)](#11-에코-억제-echo-suppression)
12. [충돌 감지 및 해결 (Conflict Resolution)](#12-충돌-감지-및-해결-conflict-resolution)
13. [오프라인/온라인 처리](#13-오프라인온라인-처리)
14. [앱 초기화 순서](#14-앱-초기화-순서)
15. [보안 규칙 (Security Rules)](#15-보안-규칙-security-rules)
16. [백업 시스템 (Firebase 동기화와 별개)](#16-백업-시스템-firebase-동기화와-별개)
17. [파일 인벤토리](#17-파일-인벤토리)
18. [설계 특징 및 주의사항](#18-설계-특징-및-주의사항)

---

## 1. 프로젝트 개요

Moonwave To-Do List는 **오프라인 우선(Offline-First)** PWA 애플리케이션이다.

| 기술 스택 | 용도 |
|-----------|------|
| React + TypeScript | 프론트엔드 프레임워크 |
| Zustand | 상태 관리 |
| Dexie.js (IndexedDB) | 로컬 오프라인 저장소 |
| Firebase Auth | Google 로그인 |
| Cloud Firestore | 클라우드 실시간 동기화 |
| Firebase Hosting | 정적 호스팅 (SPA) |
| Firebase Storage | 음악 파일 CDN (읽기 전용) |

**핵심 원칙**: 모든 CRUD 작업은 먼저 로컬 IndexedDB에 기록되고, 클라우드 동기화는 비차단(non-blocking)으로 수행된다. 로그인이나 인터넷 없이도 앱은 완전히 동작한다.

---

## 2. Firebase 프로젝트 구성

### `.firebaserc`
```json
{
  "projects": {
    "default": "moonwave-todolist-v1"
  }
}
```

### `firebase.json`
```json
{
  "hosting": {
    "public": "dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [{ "source": "**", "destination": "/index.html" }]
  },
  "storage": { "rules": "storage.rules" },
  "firestore": { "rules": "firestore.rules" }
}
```

| 서비스 | 설정 |
|--------|------|
| Hosting | `dist/` 폴더 배포, SPA 리라이트 (`**` → `/index.html`) |
| Storage | `storage.rules` 파일 참조 |
| Firestore | `firestore.rules` 파일 참조 |
| Cloud Functions | **사용하지 않음** — 모든 동기화 로직은 클라이언트 사이드 |

---

## 3. Firebase 초기화

**파일**: `src/lib/firebase.ts`

```typescript
import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const env = (key: string) => (import.meta.env[key] as string || '').trim()

const firebaseConfig = {
  apiKey: env('VITE_FIREBASE_API_KEY'),
  authDomain: env('VITE_FIREBASE_AUTH_DOMAIN'),
  projectId: env('VITE_FIREBASE_PROJECT_ID'),
  storageBucket: env('VITE_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: env('VITE_FIREBASE_MESSAGING_SENDER_ID'),
  appId: env('VITE_FIREBASE_APP_ID'),
}

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const firestore = getFirestore(app)
```

- 모든 설정 값은 `VITE_FIREBASE_*` 환경 변수에서 로드 (`.env.local` 파일)
- `auth`와 `firestore` 두 개의 싱글턴을 export
- Firebase Storage SDK는 앱 코드에서 초기화하지 않음 (Storage는 음악 파일 CDN 전용)

### 필수 환경 변수 (`.env.local`)

```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

---

## 4. 인증 (Authentication)

**파일**: `src/stores/authStore.ts`

### 인증 방식: Google 로그인 전용

Firebase Authentication + Google Provider를 유일한 인증 수단으로 사용한다.

### 상태 구조

```typescript
interface AuthState {
  user: AuthUser | null        // { uid, email, displayName, photoURL }
  isLoading: boolean           // 인증 상태 확인 중
  isSigningIn: boolean         // 로그인 프로세스 진행 중
  syncStatus: SyncStatus       // 'idle' | 'syncing' | 'synced' | 'error'
  lastSyncTime: string | null  // 마지막 동기화 시각
  error: string | null         // 에러 메시지
}
```

### 로그인 흐름

```
사용자가 로그인 버튼 클릭
    │
    ▼
signInWithPopup(auth, GoogleAuthProvider) 시도
    │
    ├─ 성공 → onAuthStateChanged 리스너에서 처리
    │
    └─ 실패 (팝업 차단, COOP 문제, 내부 오류)
         │
         ▼
    signInWithRedirect(auth, GoogleAuthProvider) 폴백
         │
         ▼
    다음 페이지 로드 시 getRedirectResult()에서 처리
```

**팝업 → 리다이렉트 폴백 전략**: 카카오톡, 인스타그램, 네이버 등 인앱 브라우저에서 팝업이 차단되는 경우를 위해 리다이렉트 방식으로 자동 전환된다.

### 로그인 후 동기화 시작

```
onAuthStateChanged(firebaseUser) 발생
    │
    ▼
syncStatus = 'syncing' 설정
    │
    ▼
initSync(firebaseUser.uid) 호출
    │
    ├─ 성공 → syncStatus = 'synced', lastSyncTime 기록
    │
    └─ 실패 → syncStatus = 'error'
```

### 로그아웃 흐름

```
logout() 호출
    │
    ▼
stopSync() — 모든 Firestore 리스너 해제
    │
    ▼
signOut(auth) — Firebase 로그아웃
    │
    ▼
user, syncStatus, lastSyncTime 초기화
```

---

## 5. Firestore 데이터 구조

### 컬렉션 경로

모든 데이터는 `users/{userId}/` 하위에 저장된다.

```
users/
  └── {userId}/
        ├── tasks/          ← 할 일 목록
        │     └── {syncId}  ← UUID 문서 ID
        ├── categories/     ← 카테고리
        │     └── {syncId}
        ├── completionLogs/ ← 완료 기록
        │     └── {syncId}
        └── taskGroups/     ← 작업 그룹
              └── {syncId}
```

### tasks 컬렉션

| 필드 | 타입 | 설명 |
|------|------|------|
| `title` | string | 작업 제목 |
| `categorySyncId` | string | 카테고리 syncId (로컬 ID가 아닌 UUID) |
| `status` | string | 'active' \| 'completed' |
| `priority` | number | 우선순위 (0-4) |
| `isFlagged` | boolean | 플래그 표시 여부 |
| `isStarred` | boolean | 즐겨찾기 여부 |
| `dueDate` | string \| null | 마감일 (YYYY-MM-DD) |
| `dueTime` | string \| null | 마감 시간 (HH:MM) |
| `alarm` | object \| null | 알람 설정 |
| `repeat` | object \| null | 반복 설정 |
| `memo` | string | 메모 |
| `subtasks` | array | 하위 작업 목록 |
| `completedAt` | string \| null | 완료 시각 |
| `createdAt` | string | 생성 시각 |
| `updatedAt` | string | 수정 시각 |
| `sortOrder` | number | 정렬 순서 |

### categories 컬렉션

| 필드 | 타입 | 설명 |
|------|------|------|
| `name` | string | 카테고리 이름 |
| `color` | string | 색상 코드 |
| `icon` | string | 아이콘 이름 |
| `isDefault` | boolean | 기본 카테고리 여부 |
| `sortOrder` | number | 정렬 순서 |
| `createdAt` | string | 생성 시각 |
| `updatedAt` | string | 수정 시각 |

### completionLogs 컬렉션

| 필드 | 타입 | 설명 |
|------|------|------|
| `taskSyncId` | string | 완료된 작업의 syncId |
| `completedAt` | string | 완료 시각 |
| `date` | string | 완료 날짜 (YYYY-MM-DD) |

### taskGroups 컬렉션

| 필드 | 타입 | 설명 |
|------|------|------|
| `name` | string | 그룹 이름 |
| `description` | string | 그룹 설명 |
| `color` | string | 색상 코드 |
| `icon` | string | 아이콘 이름 |
| `taskSyncIds` | string[] | 포함된 작업들의 syncId 배열 |
| `sortOrder` | number | 정렬 순서 |
| `createdAt` | string | 생성 시각 |
| `updatedAt` | string | 수정 시각 |

### ID 체계: 이중 ID 시스템

```
로컬 (IndexedDB)          클라우드 (Firestore)
┌─────────────────┐       ┌──────────────────────────────────┐
│ id: 1 (auto-inc)│       │ docId: "a1b2c3d4-..." (UUID)     │
│ syncId: "a1b2.."│  ←──→ │ (syncId가 문서 ID로 사용됨)       │
└─────────────────┘       └──────────────────────────────────┘
```

- **로컬 ID** (`id`): Dexie 자동 증가 정수 — 로컬 DB의 기본 키
- **동기화 ID** (`syncId`): UUID v4 — Firestore 문서 ID이자 디바이스 간 식별자
- 카테고리 참조는 `categorySyncId` (UUID) 로 저장하여 디바이스 간 호환성 보장
- `resolveCategorySyncId()` / `resolveTaskSyncIds()` 함수가 두 ID 체계 간 변환 담당

---

## 6. 로컬 데이터베이스 (IndexedDB/Dexie)

**파일**: `src/services/database.ts`

### DB 이름: `"TodoList"`

### 스키마 버전 이력

| 버전 | 변경 내용 |
|------|-----------|
| v1 | tasks, categories, completionLogs 테이블 생성 |
| v2 | attachments, templates, activityLogs 테이블 추가 |
| v3 | tasks, categories, completionLogs에 `syncId` 컬럼 추가 (기존 레코드에 UUID 자동 생성) |
| v4 | categories에 `parentId` 컬럼 추가 |
| v5 | taskGroups 테이블 추가 |

### 전체 테이블 (7개)

| 테이블 | Firestore 동기화 | 설명 |
|--------|-------------------|------|
| tasks | O | 할 일 목록 |
| categories | O | 카테고리 |
| completionLogs | O | 완료 기록 |
| taskGroups | O | 작업 그룹 |
| attachments | **X (로컬 전용)** | 첨부 파일 (Blob) |
| templates | **X (로컬 전용)** | 작업 템플릿 |
| activityLogs | **X (로컬 전용)** | 활동 로그 |

### 시드 데이터

최초 DB 생성 시 3개의 기본 한국어 카테고리가 자동 생성된다:
- "작업" (Work)
- "개인" (Personal)
- "위시리스트" (Wishlist)

---

## 7. 동기화 아키텍처 전체 흐름

**파일**: `src/services/firestoreSync.ts` (926줄)

### 전체 아키텍처 다이어그램

```
사용자 액션 (작업 생성/수정/삭제)
    │
    ▼
Zustand Store (taskStore, categoryStore, groupStore)
    │
    ├──→ Dexie/IndexedDB (즉시 로컬 저장)
    │
    └──→ firestoreSync.push*() (비동기 클라우드 전송, fire-and-forget)
              │
              ▼
         Cloud Firestore
              │
              ▼ (onSnapshot 리스너)
         firestoreSync.handle*Changes()
              │
              ├──→ 클라우드가 최신: 로컬 DB 업데이트
              │
              ├──→ 양쪽 모두 변경: detectConflicts()
              │         │
              │         ├──→ 자동 병합 가능한 필드 적용
              │         │
              │         └──→ 충돌 필드 → syncConflictStore에 큐잉
              │                   │
              │                   ▼
              │              ConflictResolverModal (사용자가 선택)
              │
              └──→ refreshCallbacks → store.refreshFromDb()
```

### 동기화 3단계

| 단계 | 시점 | 동작 |
|------|------|------|
| **1. 초기 병합** | 로그인 시 1회 | 로컬 ↔ 클라우드 전체 데이터 양방향 병합 |
| **2. 실시간 리스너** | 로그인 후 상시 | Firestore `onSnapshot`으로 클라우드 변경사항 수신 |
| **3. Push** | 로컬 CRUD 시 | 변경된 데이터를 Firestore에 즉시 전송 |

### 모듈 상태

```typescript
let unsubTasks: Unsubscribe | null = null      // tasks 리스너 해제 함수
let unsubCategories: Unsubscribe | null = null  // categories 리스너 해제 함수
let unsubLogs: Unsubscribe | null = null        // completionLogs 리스너 해제 함수
let unsubGroups: Unsubscribe | null = null      // taskGroups 리스너 해제 함수
let currentUserId: string | null = null         // 현재 로그인된 사용자 UID
let mergeInProgress = false                     // 초기 병합 진행 중 플래그
const recentlyPushed = new Set<string>()        // 에코 억제용 syncId 집합
```

---

## 8. 초기 병합 (Initial Merge)

**함수**: `initialMerge()` in `firestoreSync.ts`

로그인 시 한 번 실행되는 양방향 전체 병합 프로세스.

### Step 0: 새 디바이스 감지

```typescript
const isNewDevice =
  localCategories.every((c) => !c.syncId) &&
  localTasks.every((t) => !t.syncId) &&
  localLogs.every((l) => !l.syncId)
```

로컬에 syncId가 없는 데이터만 존재하고, 클라우드에 데이터가 있으면 **새 디바이스**로 판단한다.

```
새 디바이스 감지됨?
    │
    ├─ YES + 클라우드에 데이터 있음
    │     │
    │     ▼
    │   로컬 카테고리 전체 삭제
    │   클라우드 데이터 전체 임포트
    │   온보딩 스킵 처리
    │   튜토리얼 작업 정리
    │
    └─ NO → 일반 병합 프로세스 진행
```

### Step 1: 카테고리 병합

```
각 카테고리에 대해:
    │
    ├─ syncId가 일치하는 클라우드 카테고리 있음?
    │     │
    │     ├─ 클라우드 updatedAt > 로컬 updatedAt → 로컬 업데이트
    │     │
    │     └─ 로컬 updatedAt > 클라우드 updatedAt → 클라우드에 Push
    │
    ├─ syncId 없지만 이름이 같은 클라우드 카테고리 있음? (시드 데이터 매칭)
    │     │
    │     └─ 클라우드 syncId를 로컬에 할당
    │
    └─ 클라우드에 없음 (로컬 전용)
          │
          └─ syncId 생성 → 클라우드에 Push
```

- 로컬 카테고리를 syncId와 이름 기준으로 중복 제거
- 시드 카테고리(기본 3개)는 이름으로 매칭 시도

### Step 2: 작업 병합

```
각 작업에 대해:
    │
    ├─ syncId 일치하는 클라우드 작업 있음?
    │     │
    │     ├─ 클라우드 updatedAt > 로컬 → 로컬 업데이트
    │     │     └─ categorySyncId → resolveCategorySyncId() → 로컬 categoryId 변환
    │     │
    │     └─ 로컬 updatedAt > 클라우드 → 클라우드에 Push
    │
    └─ 클라우드에 없음 → syncId 생성 → 클라우드에 Push
```

- `categorySyncId`를 `resolveCategorySyncId()`로 로컬 `categoryId`로 변환
- `undefined` 값은 Firestore 기록 전에 제거 (Firestore는 `undefined`를 거부)

### Step 3: 완료 기록 병합

```
완료 기록은 추가 전용(Append-Only) 유니온:
    │
    ├─ 클라우드에만 있는 기록 → 로컬에 추가
    │
    └─ 로컬에만 있는 기록 → 클라우드에 Push
```

- 충돌 해결 불필요 — 기록은 수정/삭제되지 않고 추가만 됨

### Step 4: 작업 그룹 병합

- 카테고리와 동일한 `updatedAt` 비교 전략
- `taskSyncIds[]` → `resolveTaskSyncIds()` → 로컬 `taskIds[]` 변환

---

## 9. 실시간 리스너 (Real-Time Listeners)

**함수**: `startListeners()` in `firestoreSync.ts`

4개 컬렉션에 `onSnapshot` 리스너를 등록한다.

### 리스너 등록

```typescript
unsubTasks = onSnapshot(
  collection(firestore, `users/${userId}/tasks`),
  (snapshot) => {
    if (mergeInProgress) return  // 초기 병합 중에는 무시
    handleTaskChanges(snapshot.docChanges())
  }
)
```

### 변경 유형별 처리

| 컬렉션 | `added` | `modified` | `removed` |
|---------|---------|------------|-----------|
| tasks | 로컬에 추가 또는 업데이트 | 타임스탬프 비교 → 업데이트 또는 충돌 감지 | 로컬에서 삭제 |
| categories | 로컬에 추가 또는 업데이트 | 클라우드가 최신이면 업데이트 | 로컬에서 삭제 |
| completionLogs | 로컬에 추가 | — (추가 전용) | — |
| taskGroups | 로컬에 추가 또는 업데이트 | 클라우드가 최신이면 업데이트 | 로컬에서 삭제 |

### Task 변경 처리 상세 (`handleTaskChanges`)

```
onSnapshot 이벤트 수신
    │
    ├─ mergeInProgress? → 무시
    │
    ├─ recentlyPushed에 해당 syncId 있음? → 무시 (에코 억제)
    │
    └─ 처리 시작
         │
         ├─ 'added' 또는 'modified'
         │     │
         │     ├─ 로컬에 해당 syncId 작업 존재?
         │     │     │
         │     │     ├─ 클라우드 updatedAt > 로컬 → 로컬 업데이트
         │     │     │
         │     │     └─ 양쪽 다르지만 클라우드가 최신 아님
         │     │           → detectConflicts() (필드 레벨 충돌 감지)
         │     │                 │
         │     │                 ├─ 자동 병합 가능 → 자동 적용
         │     │                 └─ 충돌 발생 → syncConflictStore에 등록
         │     │
         │     └─ 로컬에 없음 → 새로 추가 (categorySyncId 해석 포함)
         │
         └─ 'removed' → 로컬에서 삭제
```

---

## 10. Push 동작 (로컬 → 클라우드)

### Push 함수 패턴

모든 push 함수는 동일한 패턴을 따른다:

```typescript
export async function pushTask(task: Task): Promise<void> {
  if (!currentUserId || !task.syncId) return  // 미로그인 또는 syncId 없으면 중단
  const categories = await getAllCategories()
  const docRef = doc(firestore, `users/${currentUserId}/tasks`, task.syncId)
  markPushed(task.syncId)  // 에코 억제 마킹
  await setDoc(docRef, taskToFirestore(task, categories))  // 전체 문서 교체
}
```

- `setDoc` 사용 (전체 문서 교체) — `updateDoc`가 아님
- push 전에 항상 `markPushed()`로 에코 억제 마킹
- 미로그인이거나 syncId가 없으면 조용히 무시

### Store별 Push 호출 지점

#### `taskStore.ts` — 모든 변형 작업에서 push 호출

| 메서드 | Push 동작 |
|--------|-----------|
| `addTask()` | syncId 생성 → DB 저장 → `pushTask()` |
| `updateTask()` | DB 업데이트 → `pushTask()` |
| `deleteTask()` | DB 삭제 → `deleteTaskFromCloud()` |
| `toggleComplete()` | `pushTask()` + `pushCompletionLog()` |
| `toggleFlag()` / `toggleStar()` | `pushTask()` |
| `addSubtask()` / `updateSubtask()` / `deleteSubtask()` | 부모 Task에 대해 `pushTask()` |
| `toggleSubtaskComplete()` | 부모 Task에 대해 `pushTask()` |
| `reorderTasks()` | 재정렬된 모든 Task에 대해 `pushTask()` |
| `batchComplete()` / `batchDelete()` | 각 Task에 대해 개별 push |
| `batchMoveCategory()` / `batchSetPriority()` | 각 Task에 대해 개별 push |

#### `categoryStore.ts`

| 메서드 | Push 동작 |
|--------|-----------|
| `addCategory()` | `pushCategory()` |
| `updateCategory()` | `pushCategory()` |
| `deleteCategory()` | `deleteCategoryFromCloud()` |

#### `groupStore.ts`

| 메서드 | Push 동작 |
|--------|-----------|
| `addGroup()` | `pushTaskGroup()` |
| `updateGroup()` | `pushTaskGroup()` |
| `deleteGroup()` | `deleteTaskGroupFromCloud()` |
| `addTaskToGroup()` / `removeTaskFromGroup()` | `pushTaskGroup()` |
| `setTaskIds()` | `pushTaskGroup()` |

### Fire-and-Forget 패턴

```typescript
// 예시: taskStore.ts 에서의 호출 방식
pushTask(updatedTask).catch(console.error)
```

모든 push는 `catch(console.error)`로 실패를 콘솔에만 기록하고 무시한다. 오프라인 상태에서 실패한 push는 재시도하지 않으며, 다음 동기화 사이클에서 복구된다.

---

## 11. 에코 억제 (Echo Suppression)

### 문제

로컬에서 변경 → Firestore에 push → onSnapshot 리스너가 같은 변경을 다시 수신 → 불필요한 로컬 업데이트 발생

### 해결: `recentlyPushed` Set

```typescript
const recentlyPushed = new Set<string>()

function markPushed(syncId: string) {
  recentlyPushed.add(syncId)
  setTimeout(() => recentlyPushed.delete(syncId), 2000)  // 2초 후 자동 제거
}
```

### 동작 흐름

```
로컬 변경 발생
    │
    ▼
markPushed(syncId) — 2초 타이머 시작
    │
    ▼
setDoc() → Firestore에 기록
    │
    ▼
onSnapshot 이벤트 수신 (0.1~1초 후)
    │
    ▼
recentlyPushed.has(syncId)? → YES → 무시 (에코 억제)
    │
    ▼ (2초 후)
recentlyPushed에서 syncId 제거 → 이후 클라우드 변경은 정상 수신
```

2초라는 시간은 일반적인 Firestore 왕복 시간(~500ms)보다 충분히 여유 있는 값이다.

---

## 12. 충돌 감지 및 해결 (Conflict Resolution)

### 충돌 감지

**파일**: `src/lib/syncConflict.ts`

#### 병합 가능 필드 (11개)

```typescript
const MERGEABLE_FIELDS = [
  'title', 'status', 'priority', 'isFlagged', 'isStarred',
  'dueDate', 'dueTime', 'memo', 'sortOrder', 'completedAt', 'categoryId'
]
```

#### 감지 로직

```typescript
function detectConflicts(local, cloud, base?)
```

| 시나리오 | 판정 |
|----------|------|
| `base` 있음 (3-way merge) | base→local 변경 & base→cloud 변경 & 값이 다름 → 충돌 |
| `base` 있음 | 한쪽만 변경 → 자동 병합 (변경된 쪽 채택) |
| `base` 없음 (2-way) | 값이 다르면 모두 충돌으로 판정 |

#### 반환값

```typescript
interface ConflictResult {
  autoMerged: Record<string, any>   // 자동 병합된 필드-값 쌍
  conflicts: ConflictField[]        // 수동 해결 필요한 충돌 필드 목록
  hasConflicts: boolean             // 수동 해결 필요한 충돌 존재 여부
}
```

### 충돌 저장소

**파일**: `src/stores/syncConflictStore.ts`

```typescript
interface PendingConflict {
  id: string              // 고유 충돌 ID
  taskId: number          // 로컬 작업 ID
  taskTitle: string       // 작업 제목 (UI 표시용)
  localTask: Task         // 로컬 버전 전체
  cloudData: Partial<Task> // 클라우드 버전 데이터
  conflictResult: ConflictResult // 감지 결과
}
```

### 충돌 해결 UI

**파일**: `src/components/ui/ConflictResolverModal.tsx`

```
충돌 발생!
┌─────────────────────────────────────────┐
│  동기화 충돌 해결                         │
│                                         │
│  "보고서 작성" 작업에 충돌이 발생했습니다   │
│                                         │
│  [자동 병합됨]                           │
│  ├─ 우선순위: 높음                       │
│  └─ 메모: (클라우드 버전 적용)            │
│                                         │
│  [수동 해결 필요]                        │
│  ├─ 제목:                               │
│  │   ○ 내 기기: "보고서 작성하기"         │
│  │   ● 클라우드: "보고서 작성 완료"       │
│  │                                      │
│  └─ 마감일:                             │
│      ● 내 기기: 2026-02-15              │
│      ○ 클라우드: 2026-02-20             │
│                                         │
│              [적용]                      │
└─────────────────────────────────────────┘
```

- 자동 병합된 필드는 정보성으로 표시
- 충돌 필드마다 "내 기기" vs "클라우드" 라디오 버튼으로 선택
- 모든 충돌 필드를 선택해야 "적용" 버튼 활성화
- 적용 시: 병합 결과를 로컬 DB에 저장 → Store 새로고침

---

## 13. 오프라인/온라인 처리

### 온라인 상태 감지

**파일**: `src/hooks/useOnlineStatus.ts`

```typescript
export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  // window 'online' / 'offline' 이벤트 리스닝
  return isOnline
}
```

### 오프라인 배너

**파일**: `src/components/ui/OfflineBanner.tsx`

```
┌──────────────────────────────────────────────────┐
│ ⚠ 오프라인 상태입니다. 일부 기능이 제한될 수 있습니다. │
└──────────────────────────────────────────────────┘
```

`App.tsx`에서 `{!isOnline && <OfflineBanner />}`로 조건부 렌더링.

### 오프라인 전략

```
[온라인 상태]
    사용자 액션 → IndexedDB 저장 → Firestore push (성공)
    Firestore 변경 → onSnapshot → 로컬 업데이트

[오프라인 전환]
    사용자 액션 → IndexedDB 저장 → Firestore push (실패, 무시됨)
    onSnapshot 리스너 끊김

[온라인 복귀]
    Firestore SDK 자동 재연결
    onSnapshot 리스너 재시작 → 마지막 스냅샷 이후 변경사항 수신
    handle*Changes()에서 로컬 ↔ 클라우드 비교 → 자동 동기화

[앱 재시작 + 로그인]
    initialMerge() → 전체 양방향 병합 수행
```

**주요 특징**:
- 명시적인 오프라인 쓰기 큐(write queue)가 **없음**
- 오프라인에서 실패한 push는 단순히 드롭됨
- 일관성은 Firestore SDK의 자동 재연결 + 리스너 복구로 회복
- 최악의 경우(장기 오프라인 + 다른 디바이스에서 변경), 다음 로그인 시 `initialMerge()`에서 복구

---

## 14. 앱 초기화 순서

**파일**: `src/App.tsx`

```
앱 시작
    │
    ▼
① 로컬 스토어 병렬 초기화
    ├─ initializeTasks()      ← IndexedDB에서 작업 로드
    ├─ initializeCategories() ← IndexedDB에서 카테고리 로드
    └─ initializeTemplates()  ← IndexedDB에서 템플릿 로드
    │
    ▼
② initSettings()             ← 테마, 색상 팔레트 적용
    │
    ▼
③ registerRefreshCallbacks() ← firestoreSync에 콜백 등록
    ├─ refreshTasks     → useTaskStore.refreshFromDb()
    ├─ refreshCategories → useCategoryStore.refreshFromDb()
    └─ refreshGroups    → useGroupStore.refreshFromDb()
    │
    ▼
④ useAuthStore.initialize()  ← Firebase Auth 초기화
    ├─ getRedirectResult(auth) 처리 (리다이렉트 로그인 결과)
    └─ onAuthStateChanged 리스너 등록
         │
         ├─ 사용자 있음 → initSync(uid)
         │     ├─ initialMerge()    ← 전체 양방향 병합
         │     └─ startListeners()  ← 실시간 리스너 시작
         │
         └─ 사용자 없음 → stopSync()
    │
    ▼
⑤ 알림, 프로필, 그룹 초기화
    │
    ▼
⑥ 렌더링 (ConflictResolverModal + OfflineBanner 포함)
```

---

## 15. 보안 규칙 (Security Rules)

### Firestore Rules (`firestore.rules`)

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

| 규칙 | 설명 |
|------|------|
| `request.auth != null` | 인증된 사용자만 접근 가능 |
| `request.auth.uid == userId` | 자신의 데이터만 읽기/쓰기 가능 |
| `{document=**}` | 재귀 와일드카드 — 모든 하위 컬렉션에 동일 규칙 적용 |

공개 컬렉션 없음. 공유 데이터 없음. 관리자 접근 없음.

### Storage Rules (`storage.rules`)

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /music/{allPaths=**} {
      allow read;
      allow write: if false;
    }
  }
}
```

| 규칙 | 설명 |
|------|------|
| `/music/**` 읽기 | 누구나 음악 파일 읽기 가능 |
| `/music/**` 쓰기 | 불가 — 콘솔에서만 업로드 |

Storage는 앱의 음악 플레이어 기능을 위한 CDN 전용이며, 사용자 데이터 저장에는 사용되지 않는다.

---

## 16. 백업 시스템 (Firebase 동기화와 별개)

### 로컬 백업

**파일**: `src/services/backup.ts`

| 함수 | 기능 |
|------|------|
| `createBackup()` | 모든 로컬 데이터를 JSON으로 내보내기 (첨부파일은 base64) |
| `downloadBackup()` | `TodoList_Backup_{date}_{time}.json` 브라우저 다운로드 |
| `restoreFromBackup()` | JSON 파일에서 전체 데이터 복원 (기존 데이터 삭제) |
| `clearAllData()` | 모든 데이터 삭제 + 기본 카테고리 재생성 |

### Google Drive 백업

**파일**: `src/services/googleDrive.ts`

Firebase/Firestore 동기화와 **완전히 별개의 시스템**:

- Google Drive API v3 직접 사용 (Firebase SDK 아님)
- 별도 OAuth 토큰 클라이언트 (GAPI + GIS 라이브러리)
- 백업 JSON 파일을 Google Drive에 업로드/다운로드
- 지수 백오프 재시도 로직 포함
- 인앱 브라우저 감지 (카카오톡, 인스타그램, 네이버 등)

```
[Firebase Firestore 동기화]          [Google Drive 백업]
┌──────────────────────────┐       ┌──────────────────────────┐
│ 실시간 양방향 동기화        │       │ 수동 전체 백업/복원        │
│ 4개 컬렉션 (tasks 등)     │       │ 전체 데이터 JSON 스냅샷    │
│ 자동 (로그인 시)           │       │ 수동 (사용자 요청 시)      │
│ 필드 레벨 충돌 해결        │       │ 전체 교체 (덮어쓰기)      │
│ Firebase SDK 사용         │       │ Google Drive API v3 직접   │
└──────────────────────────┘       └──────────────────────────┘
```

---

## 17. 파일 인벤토리

### Firebase 핵심

| 파일 | 역할 |
|------|------|
| `.firebaserc` | Firebase 프로젝트 설정 (moonwave-todolist-v1) |
| `firebase.json` | Hosting, Firestore, Storage 구성 |
| `firestore.rules` | Firestore 보안 규칙 (사용자 범위) |
| `storage.rules` | Storage 보안 규칙 (음악 CDN 읽기 전용) |
| `src/lib/firebase.ts` | Firebase 앱 초기화, auth & firestore export |

### 동기화 서비스

| 파일 | 역할 |
|------|------|
| `src/services/firestoreSync.ts` | 핵심 동기화 엔진 (926줄): 병합, 리스너, push/delete |
| `src/services/database.ts` | Dexie/IndexedDB 래퍼: 모든 로컬 CRUD, 동기화 헬퍼 |
| `src/services/backup.ts` | 로컬 JSON 백업/복원 |
| `src/services/googleDrive.ts` | Google Drive 백업 (Firestore 동기화와 별개) |

### 충돌 해결

| 파일 | 역할 |
|------|------|
| `src/lib/syncConflict.ts` | 필드 레벨 충돌 감지 & 해결 로직 |
| `src/stores/syncConflictStore.ts` | 대기 중인 충돌 Zustand 스토어 |
| `src/components/ui/ConflictResolverModal.tsx` | 수동 충돌 해결 UI |

### 인증 & 상태

| 파일 | 역할 |
|------|------|
| `src/stores/authStore.ts` | 인증 상태: Google 로그인/로그아웃, 동기화 상태 추적 |
| `src/stores/taskStore.ts` | 작업 CRUD + 매 변형마다 push-to-cloud |
| `src/stores/categoryStore.ts` | 카테고리 CRUD + push-to-cloud |
| `src/stores/groupStore.ts` | 작업 그룹 CRUD + push-to-cloud |
| `src/stores/settingsStore.ts` | 설정 (localStorage, 클라우드 동기화 안 함) |

### 훅 & UI

| 파일 | 역할 |
|------|------|
| `src/hooks/useOnlineStatus.ts` | 브라우저 온라인/오프라인 상태 |
| `src/components/ui/OfflineBanner.tsx` | 오프라인 알림 배너 |
| `src/components/layout/Header.tsx` | 로그인 시 사용자 아바타 표시 |
| `src/components/layout/SettingsModal.tsx` | 클라우드 동기화 섹션 (로그인/로그아웃/상태 UI) |

### 타입

| 파일 | 역할 |
|------|------|
| `src/lib/types.ts` | 모든 TypeScript 인터페이스 (Task, Category 등) |

---

## 18. 설계 특징 및 주의사항

### 설계 장점

1. **오프라인 우선**: 모든 CRUD가 IndexedDB에 먼저 기록되어, 로그인이나 인터넷 없이 완전 동작
2. **이중 ID 체계**: 로컬 정수 ID + 클라우드 UUID syncId로 디바이스 간 데이터 식별 보장
3. **필드 레벨 충돌 해결**: 단순 덮어쓰기가 아닌, 필드별 세밀한 충돌 감지 및 사용자 선택 제공
4. **팝업/리다이렉트 폴백**: 인앱 브라우저 등 다양한 환경에서 로그인 지원
5. **에코 억제**: 간단하면서 효과적인 2초 타임아웃 기반 순환 업데이트 방지

### 주의사항 및 한계

1. **오프라인 쓰기 큐 없음**: 오프라인에서 실패한 push는 재시도되지 않음. 장기 오프라인 후 다른 디바이스에서 동일 데이터 수정 시 데이터 유실 가능성 있음
2. **설정 동기화 안 됨**: 테마, 색상 팔레트 등 사용자 설정은 localStorage에만 저장 — 디바이스 간 설정이 다를 수 있음
3. **첨부파일 동기화 안 됨**: Blob 형태의 첨부파일은 로컬 전용. 디바이스 간 공유 불가
4. **Cloud Functions 없음**: 모든 동기화 로직이 클라이언트에 있어, 서버 사이드 검증이나 트리거 불가
5. **에코 억제 타이밍**: 2초 내에 Firestore 왕복이 완료되지 않는 극단적 지연 시 에코 발생 가능
6. **Batch 작업 성능**: `batchComplete()`/`batchDelete()` 등에서 각 아이템마다 개별 `setDoc` 호출 — 대량 처리 시 비효율적일 수 있음

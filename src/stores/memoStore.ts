import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { Memo, MemoColor } from '@/lib/types'
import { nowISO } from '@/lib/dateUtils'
import { generateSyncId } from '@/utils/id'
import { extractTags } from '@/lib/tagParser'
import * as database from '@/services/database'
import { pushMemo, deleteMemoFromCloud } from '@/services/firestoreSync'
import { notifyMemoSaved, notifyMemoDeleted } from '@/services/syncFolder'
import { calculateStreak, checkMilestones } from '@/services/gamification'
import { captureContext } from '@/services/contextCapture'
import { getCachedPosition } from '@/services/solarCalculator'
import { useSettingsStore } from './settingsStore'

// Track last version snapshot time per memo
const versionTimestamps = new Map<number, number>()

interface MemoState {
  memos: Memo[]
  isLoading: boolean
  error: string | null

  initialize: () => Promise<void>
  refreshFromDb: () => Promise<void>

  addMemo: (data: { title: string; body: string; folderId: number | null; color?: MemoColor; ephemeral?: boolean }) => Promise<number | undefined>
  saveEphemeral: (id: number) => Promise<void>
  updateMemo: (id: number, updates: Partial<Memo>) => Promise<void>
  softDelete: (id: number) => Promise<Memo | undefined>
  restore: (id: number) => Promise<void>
  permanentDelete: (id: number) => Promise<void>
  emptyTrash: () => Promise<void>
  toggleStar: (id: number) => Promise<void>
  togglePin: (id: number) => Promise<void>
  moveToFolder: (id: number, folderId: number) => Promise<void>

  recordAccess: (memoId: number) => Promise<void>

  batchDelete: (ids: number[]) => Promise<Memo[]>
  batchMove: (ids: number[], folderId: number) => Promise<void>
  batchStar: (ids: number[], starred: boolean) => Promise<void>
  batchPin: (ids: number[], pinned: boolean) => Promise<void>
  batchRestore: (ids: number[]) => Promise<void>
  batchRegenerateTitles: (ids: number[]) => Promise<void>
  seedWelcomeMemos: () => Promise<void>
}

export const useMemoStore = create<MemoState>()(
  devtools(
    (set, get) => ({
      memos: [],
      isLoading: false,
      error: null,

      initialize: async () => {
        set({ isLoading: true })
        try {
          const memos = await database.getAllMemos()
          set({ memos, isLoading: false })
        } catch (err) {
          console.error('Failed to initialize memos:', err)
          set({ error: '메모를 불러오는데 실패했습니다.', isLoading: false })
        }
      },

      refreshFromDb: async () => {
        try {
          const memos = await database.getAllMemos()
          set({ memos })
        } catch (err) {
          console.error('Failed to refresh memos:', err)
        }
      },

      addMemo: async (data) => {
        try {
          const now = nowISO()
          const tags = extractTags(data.body)
          const memo: Omit<Memo, 'id'> = {
            title: data.title,
            body: data.body,
            folderId: data.folderId,
            tags,
            isStarred: false,
            color: data.color || 'white',
            isPinned: false,
            syncId: generateSyncId(),
            createdAt: now,
            updatedAt: now,
            contextSnapshot: captureContext(),
            ...(data.ephemeral ? { ephemeralExpiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString() } : {}),
          }
          const id = await database.addMemo(memo)
          const newMemo = await database.getMemo(id)
          if (newMemo) {
            set((state) => ({ memos: [...state.memos, newMemo], error: null }))
            pushMemo(newMemo).catch(console.error)
            notifyMemoSaved(newMemo)
          }

          // Gamification: update streak + check milestones
          try {
            const settings = useSettingsStore.getState()
            const gamification = settings.settings.gamification
            const streakUpdated = calculateStreak(gamification)
            const totalMemos = get().memos.filter((m) => !m.deletedAt).length
            const { updatedState, newBadges } = checkMilestones(
              { ...streakUpdated, totalMemosCreated: totalMemos },
              totalMemos
            )
            settings.updateGamification(updatedState)

            // Trigger confetti for new badges (JS 캔버스 애니메이션 — reduced-motion 존중)
            if (newBadges.length > 0 && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
              import('canvas-confetti').then((mod) => {
                mod.default({ particleCount: 80, spread: 70, origin: { y: 0.6 } })
              }).catch(() => {})
            }
          } catch { /* gamification is non-critical */ }

          return id
        } catch (err) {
          console.error('Failed to add memo:', err)
          set({ error: '메모 생성에 실패했습니다.' })
          return undefined
        }
      },

      saveEphemeral: async (id) => {
        try {
          await database.updateMemo(id, { ephemeralExpiresAt: undefined })
          set((state) => ({
            memos: state.memos.map((m) =>
              m.id === id ? { ...m, ephemeralExpiresAt: undefined, updatedAt: nowISO() } : m
            ),
          }))
          const updated = await database.getMemo(id)
          if (updated) { pushMemo(updated).catch(console.error); notifyMemoSaved(updated) }
        } catch (err) {
          console.error('Failed to save ephemeral memo:', err)
        }
      },

      updateMemo: async (id, updates) => {
        try {
          // Auto-snapshot for version history
          const current = get().memos.find((m) => m.id === id)
          if (current && updates.body !== undefined) {
            const bodyDiff = Math.abs((updates.body?.length || 0) - (current.body?.length || 0))
            const lastVersion = versionTimestamps.get(id) || 0
            const elapsed = Date.now() - lastVersion
            // Snapshot if 5+ minutes elapsed or 100+ chars changed
            if (elapsed > 5 * 60 * 1000 || bodyDiff >= 100) {
              versionTimestamps.set(id, Date.now())
              database.addMemoVersion({
                memoId: id,
                title: current.title,
                body: current.body,
                createdAt: nowISO(),
              }).catch(() => {})
            }
          }

          if (updates.body !== undefined) {
            updates.tags = extractTags(updates.body)
          }
          await database.updateMemo(id, updates)
          set((state) => ({
            memos: state.memos.map((m) =>
              m.id === id ? { ...m, ...updates, updatedAt: nowISO() } : m
            ),
            error: null,
          }))
          const updated = await database.getMemo(id)
          if (updated) { pushMemo(updated).catch(console.error); notifyMemoSaved(updated) }
        } catch (err) {
          console.error('Failed to update memo:', err)
          set({ error: '메모 수정에 실패했습니다.' })
        }
      },

      softDelete: async (id) => {
        try {
          const memo = get().memos.find((m) => m.id === id)
          await database.softDeleteMemo(id)
          const now = nowISO()
          set((state) => ({
            memos: state.memos.map((m) =>
              m.id === id ? { ...m, deletedAt: now, updatedAt: now } : m
            ),
            error: null,
          }))
          const updated = await database.getMemo(id)
          if (updated) pushMemo(updated).catch(console.error)
          if (memo) notifyMemoDeleted(memo)
          return memo
        } catch (err) {
          console.error('Failed to delete memo:', err)
          return undefined
        }
      },

      restore: async (id) => {
        try {
          await database.restoreMemo(id)
          set((state) => ({
            memos: state.memos.map((m) =>
              m.id === id ? { ...m, deletedAt: undefined, updatedAt: nowISO() } : m
            ),
            error: null,
          }))
          const updated = await database.getMemo(id)
          if (updated) { pushMemo(updated).catch(console.error); notifyMemoSaved(updated) }
        } catch (err) {
          console.error('Failed to restore memo:', err)
        }
      },

      permanentDelete: async (id) => {
        try {
          const memo = get().memos.find((m) => m.id === id)
          const syncId = memo?.syncId
          versionTimestamps.delete(id)
          await database.permanentDeleteMemo(id)
          set((state) => ({
            memos: state.memos.filter((m) => m.id !== id),
            error: null,
          }))
          if (syncId) deleteMemoFromCloud(syncId).catch(console.error)
          if (memo) notifyMemoDeleted(memo)
        } catch (err) {
          console.error('Failed to permanently delete memo:', err)
        }
      },

      emptyTrash: async () => {
        try {
          const trashed = get().memos.filter((m) => m.deletedAt)
          const syncIds = trashed.map((m) => m.syncId).filter(Boolean) as string[]
          await database.emptyTrash()
          set((state) => ({
            memos: state.memos.filter((m) => !m.deletedAt),
            error: null,
          }))
          syncIds.forEach((syncId) => deleteMemoFromCloud(syncId).catch(console.error))
          trashed.forEach((m) => notifyMemoDeleted(m))
        } catch (err) {
          console.error('Failed to empty trash:', err)
        }
      },

      toggleStar: async (id) => {
        const memo = get().memos.find((m) => m.id === id)
        if (!memo) return
        const newStarred = !memo.isStarred
        // When starring an ephemeral memo, also clear ephemeralExpiresAt
        const clearEphemeral = newStarred && !!memo.ephemeralExpiresAt

        // Optimistic update
        set((state) => ({
          memos: state.memos.map((m) =>
            m.id === id
              ? { ...m, isStarred: newStarred, updatedAt: nowISO(), ...(clearEphemeral ? { ephemeralExpiresAt: undefined } : {}) }
              : m
          ),
        }))

        try {
          await database.updateMemo(id, {
            isStarred: newStarred,
            ...(clearEphemeral ? { ephemeralExpiresAt: undefined } : {}),
          })
          const updated = await database.getMemo(id)
          if (updated) { pushMemo(updated).catch(console.error); notifyMemoSaved(updated) }
        } catch (err) {
          console.error('Failed to toggle star:', err)
          // Rollback: use inverse of newStarred to avoid stale closure
          set((state) => ({
            memos: state.memos.map((m) =>
              m.id === id ? { ...m, isStarred: !newStarred } : m
            ),
          }))
        }
      },

      togglePin: async (id) => {
        const memo = get().memos.find((m) => m.id === id)
        if (!memo) return
        const newPinned = !memo.isPinned

        // Optimistic update
        set((state) => ({
          memos: state.memos.map((m) =>
            m.id === id ? { ...m, isPinned: newPinned, updatedAt: nowISO() } : m
          ),
        }))

        try {
          await database.updateMemo(id, { isPinned: newPinned })
          const updated = await database.getMemo(id)
          if (updated) { pushMemo(updated).catch(console.error); notifyMemoSaved(updated) }
        } catch (err) {
          console.error('Failed to toggle pin:', err)
          // Rollback: use inverse of newPinned to avoid stale closure
          set((state) => ({
            memos: state.memos.map((m) =>
              m.id === id ? { ...m, isPinned: !newPinned } : m
            ),
          }))
        }
      },

      moveToFolder: async (id, folderId) => {
        try {
          await database.updateMemo(id, { folderId })
          set((state) => ({
            memos: state.memos.map((m) =>
              m.id === id ? { ...m, folderId, updatedAt: nowISO() } : m
            ),
          }))
          const updated = await database.getMemo(id)
          if (updated) { pushMemo(updated).catch(console.error); notifyMemoSaved(updated) }
        } catch (err) {
          console.error('Failed to move memo:', err)
        }
      },

      recordAccess: async (memoId) => {
        try {
          const memo = get().memos.find((m) => m.id === memoId)
          if (!memo) return

          const now = nowISO()
          const entry: { timestamp: string; lat?: number; lon?: number } = { timestamp: now }
          const pos = getCachedPosition()
          if (pos) {
            entry.lat = pos.latitude
            entry.lon = pos.longitude
          }

          const currentLog = memo.accessLog || []
          const updatedLog = [...currentLog, entry]
          // Cap at 20 entries (remove oldest)
          while (updatedLog.length > 20) updatedLog.shift()

          await database.updateMemo(memoId, { accessLog: updatedLog })
          set((state) => ({
            memos: state.memos.map((m) =>
              m.id === memoId ? { ...m, accessLog: updatedLog } : m
            ),
          }))
        } catch (err) {
          console.error('Failed to record access:', err)
        }
      },

      batchDelete: async (ids) => {
        const memosToDelete = get().memos.filter((m) => ids.includes(m.id!))
        try {
          await database.bulkSoftDeleteMemos(ids)
          const now = nowISO()
          set((state) => ({
            memos: state.memos.map((m) =>
              ids.includes(m.id!) ? { ...m, deletedAt: now, updatedAt: now } : m
            ),
          }))
          await Promise.all(ids.map(async (id) => {
            const updated = await database.getMemo(id)
            if (updated) { pushMemo(updated).catch(console.error); notifyMemoDeleted(updated) }
          }))
        } catch (err) {
          console.error('Failed to batch delete memos:', err)
        }
        return memosToDelete
      },

      batchMove: async (ids, folderId) => {
        try {
          await database.bulkMoveMemos(ids, folderId)
          set((state) => ({
            memos: state.memos.map((m) =>
              ids.includes(m.id!) ? { ...m, folderId, updatedAt: nowISO() } : m
            ),
          }))
          await Promise.all(ids.map(async (id) => {
            const updated = await database.getMemo(id)
            if (updated) { pushMemo(updated).catch(console.error); notifyMemoSaved(updated) }
          }))
        } catch (err) {
          console.error('Failed to batch move memos:', err)
        }
      },

      batchStar: async (ids, starred) => {
        try {
          await database.bulkUpdateMemos(ids, { isStarred: starred })
          set((state) => ({
            memos: state.memos.map((m) =>
              ids.includes(m.id!) ? { ...m, isStarred: starred, updatedAt: nowISO() } : m
            ),
          }))
          await Promise.all(ids.map(async (id) => {
            const updated = await database.getMemo(id)
            if (updated) { pushMemo(updated).catch(console.error); notifyMemoSaved(updated) }
          }))
        } catch (err) {
          console.error('Failed to batch star memos:', err)
        }
      },

      batchPin: async (ids, pinned) => {
        try {
          await database.bulkUpdateMemos(ids, { isPinned: pinned })
          set((state) => ({
            memos: state.memos.map((m) =>
              ids.includes(m.id!) ? { ...m, isPinned: pinned, updatedAt: nowISO() } : m
            ),
          }))
          await Promise.all(ids.map(async (id) => {
            const updated = await database.getMemo(id)
            if (updated) { pushMemo(updated).catch(console.error); notifyMemoSaved(updated) }
          }))
        } catch (err) {
          console.error('Failed to batch pin memos:', err)
        }
      },
      batchRestore: async (ids) => {
        try {
          await database.bulkUpdateMemos(ids, { deletedAt: undefined })
          set((state) => ({
            memos: state.memos.map((m) =>
              ids.includes(m.id!) ? { ...m, deletedAt: undefined, updatedAt: nowISO() } : m
            ),
          }))
          await Promise.all(ids.map(async (id) => {
            const updated = await database.getMemo(id)
            if (updated) { pushMemo(updated).catch(console.error); notifyMemoSaved(updated) }
          }))
        } catch (err) {
          console.error('Failed to batch restore memos:', err)
        }
      },

      // 카테고리별 제목 재생성: [폴더]_요약_YYMMDD. AI 사용 가능 시 요약을 다듬고, 아니면 규칙 기반.
      // 실패는 삼키지 않고 호출측으로 전파(성공분은 반영 후 남은 실패 개수만큼 throw).
      batchRegenerateTitles: async (ids) => {
        const { useFolderStore } = await import('./folderStore')
        const { buildRuleTitle, composeTitle, getCategoryLabel, formatTitleDate } = await import('@/utils/memoTitle')
        const { isAIAvailable, summarizeTitleKeyword } = await import('@/services/aiFeatures')

        const folders = useFolderStore.getState().folders
        const targets = get().memos.filter((m) => ids.includes(m.id!) && !m.deletedAt)
        if (targets.length === 0) return

        let useAI = isAIAvailable()
        const newTitles = new Map<number, string>()

        // AI 다듬기는 제한된 동시성(4). 무료 한도 초과가 감지되면 이후 AI 호출을 멈춰 토스트 스팸 방지.
        const CONCURRENCY = 4
        let cursor = 0
        const worker = async () => {
          while (cursor < targets.length) {
            const memo = targets[cursor++]
            let title = buildRuleTitle(
              { folderId: memo.folderId, createdAt: memo.createdAt, body: memo.body },
              folders,
            )
            if (useAI) {
              try {
                const { keyword, error } = await summarizeTitleKeyword(memo.body)
                if (error === 'daily_limit_exceeded') {
                  useAI = false // 이후 메모는 규칙 기반으로만 — 한도 초과 토스트 반복 방지
                } else if (keyword) {
                  title = composeTitle(getCategoryLabel(memo.folderId, folders), keyword, formatTitleDate(memo.createdAt))
                }
              } catch { /* AI 실패 시 규칙 기반 제목 유지 */ }
            }
            newTitles.set(memo.id!, title)
          }
        }
        await Promise.all(Array.from({ length: Math.min(CONCURRENCY, targets.length) }, worker))

        // 저장은 개별 실패가 전체를 막지 않도록 allSettled. 성공분만 상태·클라우드·폴더 동기화에 반영.
        const entries = [...newTitles]
        const results = await Promise.allSettled(entries.map(([id, title]) => database.updateMemo(id, { title })))
        const okIds = new Set<number>()
        entries.forEach(([id], i) => { if (results[i].status === 'fulfilled') okIds.add(id) })

        if (okIds.size > 0) {
          const now = nowISO()
          set((state) => ({
            memos: state.memos.map((m) =>
              okIds.has(m.id!) ? { ...m, title: newTitles.get(m.id!)!, updatedAt: now } : m
            ),
          }))
          await Promise.all([...okIds].map(async (id) => {
            const updated = await database.getMemo(id)
            if (updated) { pushMemo(updated).catch(console.error); notifyMemoSaved(updated) }
          }))
        }

        const failed = entries.length - okIds.size
        if (failed > 0) throw new Error(`${failed}개 메모 제목 저장에 실패했습니다`)
      },

      seedWelcomeMemos: async () => {
        const addMemo = get().addMemo

        await addMemo({
          title: 'Memo에 오신 것을 환영합니다!',
          body: `## Memo by Moonwave

빠르고 강력한 메모 앱, Memo에 오신 것을 환영합니다.

### 주요 기능

- **마크다운 편집기**: 슬래시 명령어(/)와 플로팅 툴바로 빠르게 서식 적용
- **AI 기능**: 음성 입력(STT), 이미지 OCR, AI 자동완성, AI 요약
- **분할 보기 & 집중 모드**: 편집과 미리보기를 나란히, 또는 전체 화면 집중 모드
- **버전 기록**: 자동 스냅샷으로 이전 버전 복원 가능
- **스마트 정리**: 폴더, 태그(#), 색상 코딩, 상단 고정, 백링크(\`[[제목]]\`)
- **명령 팔레트**: Ctrl+K로 메모 검색 & 빠른 액션 실행
- **대시보드**: 활동 히트맵, 연속 기록(스트릭), 마일스톤 배지
- **클라우드 동기화**: Google 로그인으로 여러 기기에서 동기화
- **PWA 지원**: 앱으로 설치하여 오프라인에서도 사용

### 단축키 모음

| 단축키 | 기능 |
|--------|------|
| \`Alt+N\` | 새 메모 |
| \`Ctrl+K\` | 명령 팔레트 |
| \`Ctrl+B\` | 굵게 |
| \`Ctrl+I\` | 기울임 |
| \`/\` | 슬래시 명령 |
| \`Tab\` | AI 자동완성 수락 |
| \`Ctrl+/\` | 단축키 안내 |

### 시작하기

1. 우측 하단 **+** 버튼으로 새 메모 작성
2. 사이드바에서 폴더와 태그로 정리
3. 설정에서 테마, AI 기능 등을 커스터마이즈

> 이 메모를 삭제하고 자유롭게 사용해보세요!`,
          folderId: null,
          color: 'blue',
        })

        await addMemo({
          title: '마크다운 & 편집 가이드',
          body: `## 마크다운 문법

### 텍스트 서식

**굵은 글씨**는 \`**텍스트**\`로, *기울임*은 \`*텍스트*\`로 작성합니다.

~~취소선~~은 \`~~텍스트~~\`로 표현합니다.

### 목록

- 순서 없는 목록: \`-\`로 시작
- 순서 있는 목록: \`1.\`로 시작

### 체크리스트

- [x] 완료된 항목
- [ ] 미완료 항목

### 코드

인라인 코드: \`console.log('Hello')\`

\`\`\`javascript
// 코드 블록
function hello() {
  return 'Hello, World!'
}
\`\`\`

### 인용문

> 인용문은 \`>\` 기호로 작성합니다.

### 링크 & 표

[링크 텍스트](https://example.com)

| 문법 | 설명 |
|------|------|
| \`# ~ ######\` | 제목 (H1~H6) |
| \`**텍스트**\` | 굵게 |
| \`[[제목]]\` | 다른 메모 연결 |

---

### 슬래시 명령어

편집 중 \`/\`를 입력하면 다음 명령을 사용할 수 있습니다:

| 명령 | 설명 |
|------|------|
| /제목 | 제목(H2) 삽입 |
| /목록 | 글머리 기호 목록 |
| /체크리스트 | 체크리스트 |
| /코드 | 코드 블록 |
| /인용 | 인용문 |
| /구분선 | 수평선 |
| /음성 | 음성 입력 (AI) |
| /이미지 | 이미지 OCR (AI) |

*텍스트를 선택하면 플로팅 툴바가 나타나 빠르게 서식을 적용할 수 있습니다!*`,
          folderId: null,
          color: 'green',
        })

        await addMemo({
          title: '활용 팁 & AI 기능',
          body: `## 활용 팁

### 메모 정리

- **색상 코딩**: 메모마다 6가지 색상을 지정하여 시각적으로 분류
- **상단 고정**: 중요한 메모를 목록 최상단에 고정
- **일괄 작업**: 메모 선택 모드에서 여러 메모를 한번에 이동, 삭제, 중요 표시
- **모바일 스와이프**: 오른쪽 스와이프 = 중요 표시, 왼쪽 스와이프 = 삭제

### 검색 & 탐색

- **명령 팔레트** (Ctrl+K): 메모 검색 + 빠른 액션 실행
- **검색 필터**: 기간, 중요 표시, 색상별로 필터링
- **정렬**: 수정일, 생성일, 제목순으로 정렬 변경

### AI 기능 활용 (설정 > AI 서비스에서 API 키 입력 필요)

- **음성 입력**: 마이크 아이콘 또는 /음성으로 음성을 텍스트로 변환
- **이미지 OCR**: 카메라 아이콘 또는 /이미지로 사진에서 텍스트 추출
- **AI 자동완성**: 글을 쓰는 중 AI가 다음 문장을 제안 (Tab으로 수락)
- **AI 요약**: 긴 메모를 AI가 자동으로 요약

### 데이터 안전

- 설정 > 데이터에서 **정기적으로 백업**해두세요
- Google 로그인으로 **클라우드 동기화** 활성화 권장
- API 키는 **기기에만 저장**되며 외부로 전송되지 않습니다

> 도움이 필요하면 사이드바의 "도움말"을 확인하세요!`,
          folderId: null,
          color: 'purple',
        })
      },
    }),
    { name: 'MemoStore' }
  )
)

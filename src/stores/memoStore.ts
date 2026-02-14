import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { Memo, MemoColor } from '@/lib/types'
import { nowISO } from '@/lib/dateUtils'
import { generateSyncId } from '@/utils/id'
import { extractTags } from '@/lib/tagParser'
import * as database from '@/services/database'

interface MemoState {
  memos: Memo[]
  isLoading: boolean
  error: string | null

  initialize: () => Promise<void>
  refreshFromDb: () => Promise<void>

  addMemo: (data: { title: string; body: string; folderId: number | null; color?: MemoColor }) => Promise<number | undefined>
  updateMemo: (id: number, updates: Partial<Memo>) => Promise<void>
  softDelete: (id: number) => Promise<Memo | undefined>
  restore: (id: number) => Promise<void>
  permanentDelete: (id: number) => Promise<void>
  emptyTrash: () => Promise<void>
  toggleStar: (id: number) => Promise<void>
  togglePin: (id: number) => Promise<void>
  moveToFolder: (id: number, folderId: number) => Promise<void>

  batchDelete: (ids: number[]) => Promise<Memo[]>
  batchMove: (ids: number[], folderId: number) => Promise<void>
  batchStar: (ids: number[], starred: boolean) => Promise<void>
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
        const memos = await database.getAllMemos()
        set({ memos })
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
          }
          const id = await database.addMemo(memo)
          const newMemo = await database.getMemo(id)
          if (newMemo) {
            set((state) => ({ memos: [...state.memos, newMemo] }))
          }
          return id
        } catch (err) {
          console.error('Failed to add memo:', err)
          set({ error: '메모 생성에 실패했습니다.' })
          return undefined
        }
      },

      updateMemo: async (id, updates) => {
        try {
          if (updates.body !== undefined) {
            updates.tags = extractTags(updates.body)
          }
          await database.updateMemo(id, updates)
          set((state) => ({
            memos: state.memos.map((m) =>
              m.id === id ? { ...m, ...updates, updatedAt: nowISO() } : m
            ),
          }))
        } catch (err) {
          console.error('Failed to update memo:', err)
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
          }))
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
          }))
        } catch (err) {
          console.error('Failed to restore memo:', err)
        }
      },

      permanentDelete: async (id) => {
        try {
          await database.permanentDeleteMemo(id)
          set((state) => ({
            memos: state.memos.filter((m) => m.id !== id),
          }))
        } catch (err) {
          console.error('Failed to permanently delete memo:', err)
        }
      },

      emptyTrash: async () => {
        try {
          await database.emptyTrash()
          set((state) => ({
            memos: state.memos.filter((m) => !m.deletedAt),
          }))
        } catch (err) {
          console.error('Failed to empty trash:', err)
        }
      },

      toggleStar: async (id) => {
        const memo = get().memos.find((m) => m.id === id)
        if (!memo) return
        await database.updateMemo(id, { isStarred: !memo.isStarred })
        set((state) => ({
          memos: state.memos.map((m) =>
            m.id === id ? { ...m, isStarred: !m.isStarred, updatedAt: nowISO() } : m
          ),
        }))
      },

      togglePin: async (id) => {
        const memo = get().memos.find((m) => m.id === id)
        if (!memo) return
        await database.updateMemo(id, { isPinned: !memo.isPinned })
        set((state) => ({
          memos: state.memos.map((m) =>
            m.id === id ? { ...m, isPinned: !m.isPinned, updatedAt: nowISO() } : m
          ),
        }))
      },

      moveToFolder: async (id, folderId) => {
        await database.updateMemo(id, { folderId })
        set((state) => ({
          memos: state.memos.map((m) =>
            m.id === id ? { ...m, folderId, updatedAt: nowISO() } : m
          ),
        }))
      },

      batchDelete: async (ids) => {
        const memosToDelete = get().memos.filter((m) => ids.includes(m.id!))
        await database.bulkSoftDeleteMemos(ids)
        const now = nowISO()
        set((state) => ({
          memos: state.memos.map((m) =>
            ids.includes(m.id!) ? { ...m, deletedAt: now, updatedAt: now } : m
          ),
        }))
        return memosToDelete
      },

      batchMove: async (ids, folderId) => {
        await database.bulkMoveMemos(ids, folderId)
        set((state) => ({
          memos: state.memos.map((m) =>
            ids.includes(m.id!) ? { ...m, folderId, updatedAt: nowISO() } : m
          ),
        }))
      },

      batchStar: async (ids, starred) => {
        await database.bulkUpdateMemos(ids, { isStarred: starred })
        set((state) => ({
          memos: state.memos.map((m) =>
            ids.includes(m.id!) ? { ...m, isStarred: starred, updatedAt: nowISO() } : m
          ),
        }))
      },
      seedWelcomeMemos: async () => {
        const addMemo = get().addMemo

        await addMemo({
          title: 'Memo에 오신 것을 환영합니다!',
          body: `## Memo 앱 소개

Memo는 빠르고 간편한 메모 앱입니다.

### 주요 기능

- **폴더 분류**: 메모를 폴더별로 정리할 수 있습니다
- **태그 시스템**: 본문에 \`#태그\`를 입력하면 자동 분류됩니다
- **마크다운 지원**: 서식 있는 문서를 작성할 수 있습니다
- **오프라인 사용**: 인터넷 없이도 사용 가능합니다
- **클라우드 동기화**: Google 로그인으로 여러 기기에서 동기화

### 단축키

| 단축키 | 기능 |
|--------|------|
| \`Ctrl+N\` | 새 메모 |
| \`Ctrl+B\` | 굵게 |
| \`Ctrl+I\` | 기울임 |
| \`Ctrl+K\` | 링크 삽입 |
| \`Ctrl+Z\` | 실행 취소 |

> 이 메모를 삭제하고 자유롭게 사용해보세요!`,
          folderId: null,
          color: 'blue',
        })

        await addMemo({
          title: '마크다운 사용 가이드',
          body: `## 마크다운 문법

### 텍스트 서식

**굵은 글씨**는 \`**텍스트**\`로, *기울임*은 \`*텍스트*\`로 작성합니다.

~~취소선~~은 \`~~텍스트~~\`로 표현합니다.

### 목록

- 순서 없는 목록
- 하이픈(\`-\`)으로 시작

1. 순서 있는 목록
2. 숫자로 시작

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
> 여러 줄도 가능합니다.

### 링크 & 이미지

[링크 텍스트](https://example.com)

### 표

| 항목 | 설명 |
|------|------|
| 제목 | \`#\` ~ \`######\` |
| 굵게 | \`**텍스트**\` |
| 코드 | \`\\\`코드\\\`\` |

---

*편집 탭에서 마크다운을 작성하고, 미리보기 탭에서 결과를 확인하세요!*`,
          folderId: null,
          color: 'green',
        })
      },
    }),
    { name: 'MemoStore' }
  )
)

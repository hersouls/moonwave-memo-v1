import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { TaskTemplate } from '@/lib/types'
import {
  getAllTemplates,
  addTemplate as dbAddTemplate,
  deleteTemplate as dbDeleteTemplate,
} from '@/services/database'

const BUILT_IN_TEMPLATES: Omit<TaskTemplate, 'id'>[] = [
  {
    name: '회의 준비',
    description: '팀 회의를 위한 기본 준비 체크리스트',
    categoryId: null,
    priority: 'medium',
    subtasks: [
      { title: '안건 정리', sortOrder: 0 },
      { title: '자료 준비', sortOrder: 1 },
      { title: '회의실 예약 확인', sortOrder: 2 },
      { title: '참석자 알림', sortOrder: 3 },
    ],
    repeat: { type: 'none', interval: 1 },
    isBuiltIn: true,
    createdAt: new Date().toISOString(),
  },
  {
    name: '주간 리뷰',
    description: '한 주를 정리하고 다음 주를 계획하는 체크리스트',
    categoryId: null,
    priority: 'low',
    subtasks: [
      { title: '이번 주 완료 작업 확인', sortOrder: 0 },
      { title: '미완료 작업 정리', sortOrder: 1 },
      { title: '다음 주 계획 세우기', sortOrder: 2 },
      { title: '목표 진행 상황 점검', sortOrder: 3 },
    ],
    repeat: { type: 'weekly', interval: 1 },
    isBuiltIn: true,
    createdAt: new Date().toISOString(),
  },
  {
    name: '쇼핑 목록',
    description: '장보기용 기본 체크리스트',
    categoryId: null,
    priority: 'none',
    subtasks: [
      { title: '과일/채소', sortOrder: 0 },
      { title: '유제품', sortOrder: 1 },
      { title: '생필품', sortOrder: 2 },
    ],
    repeat: { type: 'none', interval: 1 },
    isBuiltIn: true,
    createdAt: new Date().toISOString(),
  },
  {
    name: '여행 준비',
    description: '여행 전 준비 체크리스트',
    categoryId: null,
    priority: 'high',
    subtasks: [
      { title: '항공편/숙소 예약 확인', sortOrder: 0 },
      { title: '여권/신분증 확인', sortOrder: 1 },
      { title: '짐 싸기', sortOrder: 2 },
      { title: '충전기/어댑터 챙기기', sortOrder: 3 },
      { title: '집 정리 (가스, 전기, 잠금)', sortOrder: 4 },
    ],
    repeat: { type: 'none', interval: 1 },
    isBuiltIn: true,
    createdAt: new Date().toISOString(),
  },
  {
    name: '프로젝트 시작',
    description: '새 프로젝트 킥오프 체크리스트',
    categoryId: null,
    priority: 'high',
    subtasks: [
      { title: '요구사항 정리', sortOrder: 0 },
      { title: '일정 수립', sortOrder: 1 },
      { title: '역할 분담', sortOrder: 2 },
      { title: '환경 구축', sortOrder: 3 },
      { title: '킥오프 미팅', sortOrder: 4 },
    ],
    repeat: { type: 'none', interval: 1 },
    isBuiltIn: true,
    createdAt: new Date().toISOString(),
  },
]

interface TemplateState {
  templates: TaskTemplate[]
  isLoading: boolean

  initialize: () => Promise<void>
  addTemplate: (template: Omit<TaskTemplate, 'id'>) => Promise<void>
  deleteTemplate: (id: number) => Promise<void>
  getBuiltInTemplates: () => Omit<TaskTemplate, 'id'>[]
}

export const useTemplateStore = create<TemplateState>()(
  devtools(
    (set) => ({
      templates: [],
      isLoading: false,

      initialize: async () => {
        set({ isLoading: true })
        try {
          const templates = await getAllTemplates()
          set({ templates, isLoading: false })
        } catch {
          set({ isLoading: false })
        }
      },

      addTemplate: async (template) => {
        try {
          const id = await dbAddTemplate(template)
          const newTemplate: TaskTemplate = { ...template, id }
          set((state) => ({ templates: [...state.templates, newTemplate] }))
        } catch { /* silent */ }
      },

      deleteTemplate: async (id) => {
        try {
          await dbDeleteTemplate(id)
          set((state) => ({ templates: state.templates.filter((t) => t.id !== id) }))
        } catch { /* silent */ }
      },

      getBuiltInTemplates: () => BUILT_IN_TEMPLATES,
    }),
    { name: 'template-store' }
  )
)

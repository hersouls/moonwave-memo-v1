import type { MemoColor } from '@/lib/types'

export interface MemoTemplate {
  id: string
  name: string
  icon: string
  color: MemoColor
  title: string
  body: string
}

export const MEMO_TEMPLATES: MemoTemplate[] = [
  {
    id: 'meeting',
    name: '회의록',
    icon: 'Users',
    color: 'blue',
    title: '회의록 - ',
    body: '## 참석자\n\n\n## 안건\n\n\n## 결정사항\n\n\n## Action Items\n\n- [ ] \n',
  },
  {
    id: 'diary',
    name: '일기',
    icon: 'BookOpen',
    color: 'yellow',
    title: '',
    body: '## 오늘의 기분\n\n\n## 있었던 일\n\n\n## 감사한 점\n\n',
  },
  {
    id: 'todo',
    name: '할 일',
    icon: 'CheckSquare',
    color: 'green',
    title: 'TODO',
    body: '## 오늘 할 일\n\n- [ ] \n- [ ] \n- [ ] \n\n## 완료\n\n- [x] \n',
  },
  {
    id: 'idea',
    name: '아이디어',
    icon: 'Lightbulb',
    color: 'purple',
    title: '',
    body: '## 아이디어\n\n\n## 배경\n\n\n## 다음 단계\n\n',
  },
  {
    id: 'weekly',
    name: '주간 회고',
    icon: 'Calendar',
    color: 'pink',
    title: '주간 회고',
    body: '## 이번 주 성과\n\n- \n\n## 배운 점\n\n- \n\n## 다음 주 계획\n\n- [ ] \n',
  },
]

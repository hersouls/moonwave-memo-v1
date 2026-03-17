import type { Memo } from './types'

export interface SmartFolderCondition {
  field: 'isStarred' | 'tags' | 'createdAt' | 'body'
  operator: 'equals' | 'contains' | 'within'
  value: string | boolean
}

export interface SmartFolder {
  id: string
  name: string
  icon: string
  conditions: SmartFolderCondition[]
  matchAll: boolean  // AND vs OR
}

export const PRESET_SMART_FOLDERS: SmartFolder[] = [
  {
    id: 'starred-this-week',
    name: '\uC774\uBC88 \uC8FC \uC911\uC694 \uBA54\uBAA8',
    icon: 'Star',
    conditions: [
      { field: 'isStarred', operator: 'equals', value: true },
      { field: 'createdAt', operator: 'within', value: '7days' },
    ],
    matchAll: true,
  },
  {
    id: 'has-todo',
    name: 'TODO \uD3EC\uD568 \uBA54\uBAA8',
    icon: 'CheckSquare',
    conditions: [
      { field: 'body', operator: 'contains', value: '- [ ]' },
    ],
    matchAll: true,
  },
  {
    id: 'recent-starred',
    name: '\uCD5C\uADFC \uC911\uC694 \uBA54\uBAA8',
    icon: 'Sparkles',
    conditions: [
      { field: 'isStarred', operator: 'equals', value: true },
      { field: 'createdAt', operator: 'within', value: '30days' },
    ],
    matchAll: true,
  },
]

export function evaluateSmartFolder(folder: SmartFolder, memos: Memo[]): Memo[] {
  return memos.filter((memo) => {
    if (memo.deletedAt) return false
    const results = folder.conditions.map((cond) => evaluateCondition(cond, memo))
    return folder.matchAll ? results.every(Boolean) : results.some(Boolean)
  })
}

function evaluateCondition(condition: SmartFolderCondition, memo: Memo): boolean {
  switch (condition.field) {
    case 'isStarred':
      return memo.isStarred === condition.value
    case 'tags':
      if (condition.operator === 'contains') {
        return memo.tags.some((t) => t === String(condition.value))
      }
      return false
    case 'createdAt': {
      if (condition.operator !== 'within') return false
      const days = parseInt(String(condition.value), 10)
      if (isNaN(days)) return false
      const cutoff = new Date(Date.now() - days * 86400000)
      return new Date(memo.createdAt) >= cutoff
    }
    case 'body':
      if (condition.operator === 'contains') {
        return memo.body.includes(String(condition.value))
      }
      return false
    default:
      return false
  }
}

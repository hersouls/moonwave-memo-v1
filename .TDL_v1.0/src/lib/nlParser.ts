import { addDays, nextMonday, nextFriday, format, addWeeks } from 'date-fns'
import type { TaskPriority } from './types'

export interface NLParseResult {
  cleanTitle: string
  dueDate?: string
  priority?: TaskPriority
}

const DATE_PATTERNS: { pattern: RegExp; resolve: () => Date }[] = [
  { pattern: /오늘/g, resolve: () => new Date() },
  { pattern: /내일/g, resolve: () => addDays(new Date(), 1) },
  { pattern: /모레/g, resolve: () => addDays(new Date(), 2) },
  { pattern: /다음\s*주\s*월요일/g, resolve: () => nextMonday(addWeeks(new Date(), 0)) },
  { pattern: /다음\s*주\s*금요일/g, resolve: () => nextFriday(addWeeks(new Date(), 0)) },
  { pattern: /이번\s*주\s*금요일/g, resolve: () => nextFriday(new Date()) },
  { pattern: /(\d+)일\s*후/g, resolve: () => new Date() }, // Handled specially below
]

const PRIORITY_PATTERNS: { pattern: RegExp; priority: TaskPriority }[] = [
  { pattern: /긴급|급한|급히|중요/g, priority: 'high' },
  { pattern: /보통/g, priority: 'medium' },
  { pattern: /나중에|낮은/g, priority: 'low' },
]

/**
 * Parse Korean natural language task input into structured data.
 * Does NOT use AI — pure local regex matching.
 */
export function parseNaturalLanguage(input: string): NLParseResult {
  let text = input.trim()
  let dueDate: string | undefined
  let priority: TaskPriority | undefined

  // Extract relative day patterns (e.g. "3일 후")
  const dayMatch = text.match(/(\d+)일\s*후/)
  if (dayMatch) {
    const days = parseInt(dayMatch[1], 10)
    if (days > 0 && days <= 365) {
      dueDate = format(addDays(new Date(), days), 'yyyy-MM-dd')
      text = text.replace(dayMatch[0], '').trim()
    }
  }

  // Extract date patterns
  if (!dueDate) {
    for (const { pattern, resolve } of DATE_PATTERNS) {
      if (pattern.source.includes('\\d+')) continue // Skip "N일 후" (already handled)
      const match = text.match(pattern)
      if (match) {
        dueDate = format(resolve(), 'yyyy-MM-dd')
        text = text.replace(match[0], '').trim()
        break
      }
    }
  }

  // Extract explicit date (YYYY-MM-DD or MM/DD)
  if (!dueDate) {
    const explicitDate = text.match(/(\d{4})[-.\/](\d{1,2})[-.\/](\d{1,2})/)
    if (explicitDate) {
      dueDate = `${explicitDate[1]}-${explicitDate[2].padStart(2, '0')}-${explicitDate[3].padStart(2, '0')}`
      text = text.replace(explicitDate[0], '').trim()
    }
  }

  // Extract "~까지" suffix attached to dates already parsed
  text = text.replace(/까지\s*/g, '').trim()

  // Extract priority
  for (const { pattern, priority: p } of PRIORITY_PATTERNS) {
    if (pattern.test(text)) {
      priority = p
      text = text.replace(pattern, '').trim()
      break
    }
  }

  // Clean up extra whitespace
  const cleanTitle = text.replace(/\s+/g, ' ').trim()

  return {
    cleanTitle: cleanTitle || input.trim(),
    dueDate,
    priority,
  }
}

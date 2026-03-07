import { useSettingsStore } from '@/stores/settingsStore'

export interface ParsedQuery {
  keywords: string[]
  dateRange: { start: string; end: string } | null
  tags: string[]
  starredOnly: boolean
}

// Simple local natural language parser (no AI needed for common patterns)
export function parseNaturalQuery(query: string): ParsedQuery {
  const result: ParsedQuery = { keywords: [], dateRange: null, tags: [], starredOnly: false }
  const q = query.toLowerCase().trim()

  // Date patterns
  const now = new Date()
  if (q.includes('\uC624\uB298')) {
    const today = now.toISOString().split('T')[0]
    result.dateRange = { start: today, end: today }
  } else if (q.includes('\uC5B4\uC81C')) {
    const yesterday = new Date(now.getTime() - 86400000).toISOString().split('T')[0]
    result.dateRange = { start: yesterday, end: yesterday }
  } else if (q.includes('\uC774\uBC88 \uC8FC') || q.includes('\uC774\uBC88\uC8FC')) {
    const weekStart = new Date(now)
    weekStart.setDate(now.getDate() - now.getDay())
    result.dateRange = { start: weekStart.toISOString().split('T')[0], end: now.toISOString().split('T')[0] }
  } else if (q.includes('\uC9C0\uB09C\uC8FC') || q.includes('\uC9C0\uB09C \uC8FC')) {
    const weekStart = new Date(now)
    weekStart.setDate(now.getDate() - now.getDay() - 7)
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekStart.getDate() + 6)
    result.dateRange = { start: weekStart.toISOString().split('T')[0], end: weekEnd.toISOString().split('T')[0] }
  } else if (q.includes('\uC774\uBC88 \uB2EC') || q.includes('\uC774\uBC88\uB2EC')) {
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    result.dateRange = { start: monthStart.toISOString().split('T')[0], end: now.toISOString().split('T')[0] }
  }

  // Starred
  if (q.includes('\uC911\uC694') || q.includes('\uBCC4\uD45C') || q.includes('\uC2A4\uD0C0')) {
    result.starredOnly = true
  }

  // Tags (hashtags in query)
  const tagMatches = query.match(/#(\S+)/g)
  if (tagMatches) {
    result.tags = tagMatches.map((t) => t.slice(1))
  }

  // Keywords: remaining words after removing date/star/tag patterns
  const cleaned = q
    .replace(/(\uC624\uB298|\uC5B4\uC81C|\uC774\uBC88\s?\uC8FC|\uC9C0\uB09C\s?\uC8FC|\uC774\uBC88\s?\uB2EC|\uC911\uC694|\uBCC4\uD45C|\uC2A4\uD0C0)/g, '')
    .replace(/#\S+/g, '')
    .trim()
  if (cleaned) {
    result.keywords = cleaned.split(/\s+/).filter((w) => w.length > 1)
  }

  return result
}

export function hasAIKey(): boolean {
  const ai = useSettingsStore.getState().settings.ai
  return !!(ai?.openaiApiKey || ai?.anthropicApiKey)
}

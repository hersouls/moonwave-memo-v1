/**
 * Checklist parser utility for `- [ ]` / `- [x]` markdown patterns.
 * Shared by interactive checklist (#6) and TODO auto-extract (#14).
 */

export interface ChecklistItem {
  text: string
  checked: boolean
  lineIndex: number
}

const CHECKLIST_REGEX = /^(\s*)-\s\[([ xX])\]\s(.*)$/

/**
 * Parse all checklist items from markdown body text.
 */
export function parseChecklist(body: string): ChecklistItem[] {
  const lines = body.split('\n')
  const items: ChecklistItem[] = []
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(CHECKLIST_REGEX)
    if (match) {
      items.push({
        text: match[3],
        checked: match[2].toLowerCase() === 'x',
        lineIndex: i,
      })
    }
  }
  return items
}

/**
 * Toggle a checklist item at a specific line index.
 * Returns the updated body text.
 */
export function toggleChecklistItem(body: string, lineIndex: number): string {
  const lines = body.split('\n')
  if (lineIndex < 0 || lineIndex >= lines.length) return body
  const line = lines[lineIndex]
  if (line.includes('- [ ]')) {
    lines[lineIndex] = line.replace('- [ ]', '- [x]')
  } else if (line.includes('- [x]') || line.includes('- [X]')) {
    lines[lineIndex] = line.replace(/- \[[xX]\]/, '- [ ]')
  }
  return lines.join('\n')
}

/**
 * Get checklist progress stats.
 */
export function getChecklistStats(body: string): { total: number; checked: number } | null {
  const items = parseChecklist(body)
  if (items.length === 0) return null
  return {
    total: items.length,
    checked: items.filter((i) => i.checked).length,
  }
}

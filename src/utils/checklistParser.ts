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
 * 미리보기가 체크로 그리는 줄의 번호들이에요 (화면의 n번째 체크 → 본문의 줄).
 * GFM은 -, *, +, 1. 뒤의 [ ] · [x]를 모두 할 일로 그리고, 코드 블록 안의 줄은 그리지 않아요.
 */
export function taskLineIndexes(body: string): number[] {
  const out: number[] = []
  let fenced = false
  body.split('\n').forEach((line, index) => {
    if (/^\s*(```|~~~)/.test(line)) { fenced = !fenced; return }
    if (!fenced && /^\s*(?:>\s*)*(?:[-*+]|\d+[.)])\s+\[[ xX]\]\s/.test(line)) out.push(index)
  })
  return out
}

/**
 * Toggle a checklist item at a specific line index.
 * Returns the updated body text.
 */
export function toggleChecklistItem(body: string, lineIndex: number): string {
  const lines = body.split('\n')
  if (lineIndex < 0 || lineIndex >= lines.length) return body
  const line = lines[lineIndex]
  // 목록 표시가 -가 아닌 할 일(* [ ] · + [ ] · 1. [ ])도 같은 자리에서 뒤집어요
  const marked = /^(\s*(?:>\s*)*(?:[*+]|\d+[.)])\s+)\[([ xX])\]/.exec(line)
  if (marked) {
    lines[lineIndex] = `${marked[1]}[${marked[2] === ' ' ? 'x' : ' '}]${line.slice(marked[0].length)}`
  } else if (line.includes('- [ ]')) {
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
